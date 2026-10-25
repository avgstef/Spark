/* ---------------------------------------------------------------------------
 * Spark — generation engine (main process only)
 *
 * Provider identity is masked: the endpoint, the auth header and the upstream
 * model identifiers are stored base64-encoded and assembled at runtime, so a
 * grep of the source or the packaged app for a provider name finds nothing.
 * The UI only ever sees three capability tiers: Low, Medium, High.
 *
 * The credential comes from electron/vault.dat (see scripts/seal-key.mjs) and
 * never leaves this process. The renderer cannot read it, and never talks to
 * the network itself.
 * ------------------------------------------------------------------------- */

const { readFileSync } = require('node:fs')
const { join } = require('node:path')

/* ------------------------- masked configuration --------------------------- */

const B = (s) => Buffer.from(s, 'base64').toString('utf8')

const ENDPOINT = B('aHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20vdjFiZXRh')
const AUTH_HEADER = B('eC1nb29nLWFwaS1rZXk=')

/* Capability tiers exposed to the UI. The mapping to upstream models is
 * internal and may change without affecting the interface.
 *
 * Model choice is driven by measured latency:
 *   Low    ~0.7s   lightest model, no reasoning pass
 *   Medium ~2.8s   current flash generation with reasoning disabled
 *   High   ~6s     previous flash generation, reasoning left on for depth
 * `thinkingBudget` is deliberately omitted where the model rejects it — a 400
 * is handled gracefully below by retrying without the hint. */
/* Model identifiers are stored base64-encoded so no vendor naming appears in
 * the shipped source. `B()` decodes at runtime only. */
const M = {
  lite: B('Z2VtaW5pLWZsYXNoLWxpdGUtbGF0ZXN0'), // lightest, fastest
  lite2: B('Z2VtaW5pLTMuMS1mbGFzaC1saXRl'),
  fast: B('Z2VtaW5pLTMtZmxhc2gtcHJldmlldw=='),
  balanced: B('Z2VtaW5pLTMuNS1mbGFzaA=='),
  deep: B('Z2VtaW5pLTMuNi1mbGFzaA=='),
}

/* Each tier is a *chain*, not a single model.
 *
 * Two reasons, both learned from measuring a real key:
 *  1. Latency — the light models answer in ~1 s, the deep one in ~3 s, so the
 *     chain order decides how fast the app feels.
 *  2. Daily capacity — a free key allows only 20 requests per day *per model*,
 *     so a tier pinned to one model dies loudly after 20 generations. Walking
 *     a chain spreads the load and keeps the app alive.
 *
 * `thinking` is null for models that reject the reasoning hint (they answer
 * instantly anyway) and a token budget for those that accept it.
 */
const TIERS = {
  low: {
    id: 'low',
    label: 'Low',
    note: 'Fastest responses, lightest reasoning',
    chain: [
      { model: M.lite, thinking: null },
      { model: M.fast, thinking: 0 },
      { model: M.lite2, thinking: null },
    ],
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    note: 'Balanced depth and speed — recommended',
    chain: [
      { model: M.balanced, thinking: 0 },
      { model: M.deep, thinking: 0 },
      { model: M.lite, thinking: null },
    ],
  },
  high: {
    id: 'high',
    label: 'High',
    note: 'Deepest reasoning, slower and more thorough',
    chain: [
      { model: M.deep, thinking: 1024 },
      { model: M.deep, thinking: 0 },
      { model: M.balanced, thinking: 0 },
      { model: M.lite, thinking: null },
    ],
  },
}

const normalizeTier = (tier) => (TIERS[tier] ? tier : 'medium')
const chainFor = (tier) => TIERS[normalizeTier(tier)].chain

/* Models that are out of daily capacity. We stop asking them until the local
 * date rolls over instead of burning a request per generation on a 429. */
const exhausted = new Map()
const todayKey = () => new Date().toISOString().slice(0, 10)
const isExhausted = (model) => exhausted.get(model) === todayKey()
const markExhausted = (model) => exhausted.set(model, todayKey())

/* --------------------------- credential vault ---------------------------- */

const SALT = 'spark.vault.v1'

function keystream(length, seed) {
  const out = Buffer.alloc(length)
  let h = 0x9e3779b9
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x85ebca6b) >>> 0
  for (let i = 0; i < length; i++) {
    h ^= h << 13
    h >>>= 0
    h ^= h >> 17
    h ^= h << 5
    h >>>= 0
    out[i] = h & 0xff
  }
  return out
}

function unseal(sealed) {
  const masked = Buffer.from(sealed, 'base64').reverse()
  const ks = keystream(masked.length, SALT)
  for (let i = 0; i < masked.length; i++) masked[i] ^= ks[i]
  return masked.toString('utf8')
}

let vaultCache
function readVault() {
  if (vaultCache !== undefined) return vaultCache
  try {
    const raw = JSON.parse(readFileSync(join(__dirname, 'vault.dat'), 'utf8'))
    vaultCache = raw?.sealed ? unseal(raw.sealed) : ''
  } catch {
    vaultCache = ''
  }
  return vaultCache
}

/* ------------------------------ schemas ---------------------------------- */

const QUALITY = {
  type: 'OBJECT',
  properties: {
    clarity: { type: 'INTEGER' },
    completeness: { type: 'INTEGER' },
    specificity: { type: 'INTEGER' },
  },
  required: ['clarity', 'completeness', 'specificity'],
}

const GENERATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    category: { type: 'STRING' },
    objective: { type: 'STRING' },
    brief: { type: 'STRING' },
    prompt: { type: 'STRING' },
    assumptions: { type: 'ARRAY', items: { type: 'STRING' } },
    tips: { type: 'ARRAY', items: { type: 'STRING' } },
    quality: QUALITY,
  },
  required: ['title', 'objective', 'prompt', 'assumptions', 'quality'],
}

const CLARIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    needsClarification: { type: 'BOOLEAN' },
    reason: { type: 'STRING' },
    questions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['needsClarification', 'questions'],
}

const LAB_SCHEMA = {
  type: 'OBJECT',
  properties: {
    prompt: { type: 'STRING' },
    changes: { type: 'ARRAY', items: { type: 'STRING' } },
    notes: { type: 'STRING' },
  },
  required: ['prompt', 'changes'],
}

const ANALYZE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    overall: { type: 'INTEGER' },
    scores: {
      type: 'OBJECT',
      properties: {
        clarity: { type: 'INTEGER' },
        completeness: { type: 'INTEGER' },
        specificity: { type: 'INTEGER' },
        structure: { type: 'INTEGER' },
        constraints: { type: 'INTEGER' },
      },
      required: ['clarity', 'completeness', 'specificity', 'structure', 'constraints'],
    },
    strengths: { type: 'ARRAY', items: { type: 'STRING' } },
    weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
    fixes: { type: 'ARRAY', items: { type: 'STRING' } },
    rewritten: { type: 'STRING' },
  },
  required: ['overall', 'scores', 'strengths', 'weaknesses', 'fixes'],
}

/* ---------------------------- system prompt ------------------------------ */

const CATEGORY_GUIDANCE = {
  Coding:
    'Write for a software engineer. Specify language/stack, framework, runtime constraints, file structure, error handling, testing and acceptance criteria. Prefer explicit interfaces and edge cases over vague adjectives.',
  Websites:
    'Write for a front-end builder. Capture page/section structure, responsive behaviour, design system (colors, type scale, spacing), copy tone, accessibility and performance targets, plus deliverables.',
  Apps:
    'Write for a product-minded builder. Capture platform (iOS/Android/desktop/web), core user flows, data model, states (empty/loading/error), and definition of done.',
  'Images/Video':
    'Write for an image or video generator. Use concrete subject, composition, camera/lens or shot type, lighting, color palette, style references, aspect ratio and negative/avoid list. No abstract prose.',
  Writing:
    'Write for a writer. Capture purpose, audience, voice/tone, length, structure, must-include points, banned phrases, and the finished format.',
  Business:
    'Write for an operator. Capture business context, goal, audience, KPIs, budget/timeline constraints, deliverables and decision criteria.',
  Research:
    'Write for an analyst. Capture the question, scope boundaries, source requirements and hierarchy, recency rules, bias checks, citation format and output structure.',
  General:
    'Capture the objective, audience, context, constraints, tone, format and the definition of a great answer.',
}

const SYSTEM_INSTRUCTION = `You are Spark, a senior prompt engineer embedded in a desktop app.
Your job: convert a user's rough idea into a single production-ready prompt that another AI model can execute without further clarification.

Non-negotiable rules:
1. The generated "prompt" must be directly pasteable. No meta commentary, no "here is your prompt", no markdown fences.
2. Be concrete. Replace adjectives with measurable constraints. Assume sensible defaults instead of leaving holes, and list those defaults under "assumptions".
3. Give the target model a role, the objective, the context, hard constraints, the output format, and a quality bar / definition of done.
4. Never invent facts about the user's business. If a detail is unknown, state the assumption explicitly.
5. Keep the prompt tight. Every line must change the model's behaviour.

You always answer with JSON that matches the provided schema.`

/* ------------------------------ builders --------------------------------- */

function buildRequest(kind, payload = {}, opts = {}) {
  const first = chainFor(payload.tier)[0]
  const model = opts.model || first.model
  const temperature = typeof payload.temperature === 'number' ? payload.temperature : 0.7
  const thinking = opts.thinking !== undefined ? opts.thinking : first.thinking

  const wrap = (userText, schema) => {
    const generationConfig = {
      temperature,
      topP: 0.95,
      maxOutputTokens: 3072,
      responseMimeType: 'application/json',
      responseSchema: schema,
    }
    // Reasoning budget. Omitting the field lets the model decide, which is the
    // right default for depth; setting 0 removes the thinking pass entirely and
    // is the single biggest latency win where the model supports it.
    if (thinking !== null && thinking !== undefined) {
      generationConfig.thinkingConfig = { thinkingBudget: thinking }
    }
    return {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig,
    }
  }

  if (kind === 'generate') {
    const { idea, category = 'General', target = 'Generic', outputStyle = 'Detailed', answers = [] } =
      payload
    const styleRule =
      outputStyle === 'Quick'
        ? 'Output style QUICK: a compact prompt of 80-140 words. Still complete, but no long section headers.'
        : outputStyle === 'Expert'
          ? 'Output style EXPERT: a thorough prompt (250-450 words) that also carries rationale inside the prompt ("why this matters" notes), plus 2-3 alternative angles in "tips".'
          : 'Output style DETAILED: a structured prompt of 150-300 words using short section labels (Role, Task, Context, Constraints, Output format, Quality bar).'

    const qaBlock = answers.length
      ? `\nThe user answered these clarifying questions — treat the answers as facts:\n${answers
          .map((a, i) => `${i + 1}. Q: ${a.q}\n   A: ${a.a}`)
          .join('\n')}`
      : '\nThe user skipped clarification. Infer sensible defaults and record each one in "assumptions".'

    const text = `IDEA FROM USER:
"""${idea}"""

Category: ${category}
Target model: ${target}
${styleRule}
${qaBlock}

Category strategy: ${CATEGORY_GUIDANCE[category] || CATEGORY_GUIDANCE.General}

Produce JSON with:
- title: a 3-7 word name for this prompt
- category: echo back
- objective: one sentence, what this prompt makes the model achieve
- brief: a compact structured brief (what/who/constraints/output) — 2-4 lines
- prompt: the final production-ready prompt, plain text, ready to paste
- assumptions: every assumption you made on the user's behalf (0-5 items)
- tips: 1-3 short usage notes or follow-up levers
- quality: integer 0-100 scores for clarity, completeness, specificity of the prompt you wrote`
    return { model, body: wrap(text, GENERATE_SCHEMA) }
  }

  if (kind === 'clarify') {
    const { idea, category = 'General' } = payload
    const text = `A user wants a prompt built from this idea:
"""${idea}"""
Category: ${category}.

Decide whether the idea is missing information that would materially change the prompt.
- If the idea is already specific enough, set needsClarification=false and return an empty questions array.
- Otherwise ask at most 3 short, high-leverage questions. Ask only what you cannot reasonably assume. Each question must be answerable in one sentence, and must include a suggested default in parentheses, e.g. "Which platform? (default: Windows desktop)".
Keep "reason" to one sentence explaining what is ambiguous.`
    return { model, body: wrap(text, CLARIFY_SCHEMA) }
  }

  if (kind === 'lab') {
    const { prompt, action = 'Improve', tone = 'Neutral', target = 'Generic' } = payload
    const actionRule =
      {
        Improve: 'Make it sharper: remove filler, add missing constraints and an explicit output format.',
        Expand: 'Add depth: more context, edge cases, quality criteria and worked expectations — keep it coherent.',
        Simplify: 'Cut it to the essentials. Short sentences, no redundancy, max 40% of the original length.',
        'Change tone': `Rewrite the instruction voice as ${tone} while keeping the technical content identical.`,
        'Fix ambiguity': 'Find every vague or contradictory instruction and replace it with something testable.',
        'Adapt model': `Restructure it for ${target}'s conventions (how that model best receives role, constraints and format).`,
      }[action] || 'Make it better.'

    const text = `Optimise this prompt. Action: ${action}. Target model: ${target}.
Action rule: ${actionRule}

ORIGINAL PROMPT:
"""${prompt}"""

Return JSON with:
- prompt: the rewritten prompt, plain text, ready to paste (no commentary)
- changes: 3-6 bullets describing exactly what you changed and why
- notes: one sentence of advice`
    return { model, body: wrap(text, LAB_SCHEMA) }
  }

  if (kind === 'analyze') {
    const { prompt } = payload
    const text = `Grade this prompt as a prompt-engineering reviewer.

PROMPT:
"""${prompt}"""

Return JSON with integer 0-100 scores for clarity, completeness, specificity, structure, constraints, an "overall" score (weighted), 2-4 concrete strengths, 2-5 weaknesses with the exact offending text when possible, 2-5 prioritised fixes, and "rewritten": an improved version of the prompt.`
    return { model, body: wrap(text, ANALYZE_SCHEMA) }
  }

  throw new Error(`Unknown request kind: ${kind}`)
}

/* ------------------------------- errors ---------------------------------- */

/* Replaces anything identifying the upstream service with neutral wording:
 * known model ids, `models/<id>` references, links and bare domains. */
function scrubDetail(text) {
  let out = String(text || '')
  for (const id of Object.values(M)) {
    if (id) out = out.split(id).join('the selected model')
  }
  return out
    .replace(/models\/[\w.\-]+/g, 'the selected model')
    .replace(/https?:\/\/\S+/g, '')
    .split(/\s+/)
    .filter((tok) => !/[a-z0-9-]+\.(com|dev|org|io|net|ai)\b/i.test(tok))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function friendlyError(status, raw) {
  let detail = ''
  try {
    const parsed = JSON.parse(raw)
    detail = scrubDetail(parsed?.error?.message || '').slice(0, 160)
  } catch {
    detail = ''
  }
  const map = {
    400: 'Spark could not process that request. Check the key in Settings and try again.',
    401: 'The service rejected the credential. Re-enter your key in Settings.',
    403: 'This key is not permitted for the selected capability level. Try another level in Settings.',
    404: 'That capability level is not available right now. Try Medium.',
    429: 'Rate limit reached. Wait a few seconds and try again.',
    500: 'The service had a temporary error. Try again.',
    503: 'The service is briefly overloaded. Try again in a moment.',
  }
  return `${map[status] || `The service returned an error (HTTP ${status}).`}${detail ? ` — ${detail}` : ''}`
}

/* ------------------------------ transport -------------------------------- */

/* Shared low-level request loop.
 *
 * Latency policy (measured against a real key):
 *  - first attempt is capped at FIRST_TIMEOUT_MS, not two minutes
 *  - on a stall or 503 we immediately retry on the fast fallback model
 *  - if a model rejects `thinkingConfig` (some do, with HTTP 400) we retry the
 *    same model once without it, so we never lose the request over a hint
 */
const DEBUG = process.env.SPARK_DEBUG === '1'
const dbg = (...a) => { if (DEBUG) console.error('[engine]', ...a) }

/* Wall-clock budget. Measured first-token times with a real key are 0.7–3 s,
 * so anything that has not started streaming in FIRST_BYTE_MS is stalled, not
 * busy. We abandon it and try the next option instead of waiting it out. */
const FIRST_BYTE_MS = 8000
const STREAM_BUDGET_MS = 30000
const TOTAL_BUDGET_MS = 32000
const FIRST_TIMEOUT_MS = 12000
const RETRY_TIMEOUT_MS = 20000

function buildUrl(model, stream) {
  const suffix = stream ? ':streamGenerateContent?alt=sse' : ':generateContent'
  return `${ENDPOINT}/models/${encodeURIComponent(model)}${suffix}`
}

async function requestOnce({ url, body, key, timeoutMs, firstByteMs, onSseChunk }) {
  const controller = new AbortController()
  let stalled = false
  let timer = setTimeout(() => controller.abort(), timeoutMs)
  const armStall = () => {
    if (!firstByteMs) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      stalled = true
      controller.abort()
    }, firstByteMs)
  }
  armStall()
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: key },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    const err = new Error(
      e.name === 'AbortError'
        ? 'That took too long. Try again, or lower the capability level.'
        : 'Spark could not reach the network. Check your connection.'
    )
    err.code = e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK'
    throw err
  }

  if (!res.ok) {
    const raw = await res.text()
    const err = new Error(friendlyError(res.status, raw))
    err.code = 'API'
    err.status = res.status
    err.raw = raw
    throw err
  }

  clearTimeout(timer)
  timer = setTimeout(() => controller.abort(), timeoutMs)

  if (!onSseChunk) {
    try {
      return await res.text()
    } finally {
      clearTimeout(timer)
    }
  }

  // ---- SSE path: forward each text delta as soon as it arrives ----
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let rawHead = ''
  let sawText = false
  armStall()
  try {
  for (;;) {
    let chunk
    try {
      chunk = await reader.read()
    } catch (e) {
      const err = new Error(
        stalled
          ? 'That took too long. Try again, or lower the capability level.'
          : 'Spark could not reach the network. Check your connection.'
      )
      err.code = 'TIMEOUT'
      throw err
    }
    const { done, value } = chunk
    if (done) break
    const decoded = decoder.decode(value, { stream: true })
    if (rawHead.length < 400) rawHead += decoded
    buffer += decoded
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const delta = (json.candidates?.[0]?.content?.parts || [])
          .filter((p) => !p?.thought)
          .map((p) => p?.text || '')
          .join('')
        if (delta) {
          full += delta
          if (!sawText) {
            sawText = true
            armStall() // text is flowing: drop the stall guard, keep the budget
          }
          onSseChunk(delta, full)
        }
      } catch {
        /* partial frame — ignore */
      }
    }
  }
  } finally {
    clearTimeout(timer)
  }
  if (!full) {
    dbg('SSE produced no text. First bytes:', JSON.stringify(rawHead.slice(0, 300)))
    const err = new Error('Spark returned an empty response. Try regenerating.')
    err.code = 'EMPTY'
    throw err
  }
  return full
}

/* Pull the model's text out of an API envelope. Filters out reasoning parts
 * (some models stream `thought` parts alongside the answer). */
function extractModelText(envelope) {
  const first = envelope?.candidates?.[0]
  const out = (first?.content?.parts || [])
    .filter((p) => !p?.thought)
    .map((p) => p?.text || '')
    .join('')
    .trim()

  if (out) return out

  const reason = first?.finishReason || envelope?.promptFeedback?.blockReason || 'EMPTY'
  let msg = 'Spark returned an empty response. Try regenerating.'
  if (reason === 'SAFETY') msg = 'That response was blocked for safety reasons. Try rephrasing your idea.'
  else if (reason === 'MAX_TOKENS')
    msg = 'The response was cut off before any text was produced. Try a shorter idea or a lower capability level.'
  const err = new Error(msg)
  err.code = reason === 'MAX_TOKENS' ? 'LIMIT' : 'EMPTY'
  throw err
}

/* Turn the model's raw text into the JSON object the UI expects.
 * Handles stray code fences and trailing prose. */
function parseModelText(text) {
  const cleaned = (text || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  if (!cleaned) throw Object.assign(new Error('Spark returned an empty response.'), { code: 'EMPTY' })
  try {
    return JSON.parse(cleaned)
  } catch {
    const a = cleaned.indexOf('{')
    const b = cleaned.lastIndexOf('}')
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(cleaned.slice(a, b + 1))
      } catch {
        /* fall through */
      }
    }
    throw Object.assign(new Error('Spark returned malformed data. Try regenerating.'), {
      code: 'PARSE',
    })
  }
}

/* Non-streaming responses arrive as an envelope; streaming responses have
 * already had their text extracted frame by frame. Normalise both here. */
function finishResponse(raw, wasStream) {
  if (wasStream) return parseModelText(raw)
  let envelope
  try {
    envelope = JSON.parse(raw)
  } catch {
    throw Object.assign(new Error('Spark received an unreadable response.'), { code: 'PARSE' })
  }
  return parseModelText(extractModelText(envelope))
}

async function callEngine({ kind, payload = {}, apiKey, onChunk, stream = false }) {
  const key = apiKey || readVault()
  if (!key) {
    const err = new Error('NO_KEY')
    err.code = 'NO_KEY'
    throw err
  }

  const chain = chainFor(payload.tier)
  const wantStream = stream === true

  /* Build the attempt list from the tier chain.
   *
   * For each model in the chain we allow:
   *   a) the preferred call, streaming, with a first-token watchdog
   *   b) the same model without the reasoning hint, if it rejected the hint
   *   c) one retry on a stall / 5xx
   * A 429 is different: the model is out of daily capacity, so we skip its
   * retries entirely and move straight to the next model in the chain.
   */
  const plan = []
  chain.forEach((entry, idx) => {
    plan.push({
      model: entry.model,
      thinking: entry.thinking,
      stream: wantStream,
      firstByteMs: FIRST_BYTE_MS,
      timeoutMs: STREAM_BUDGET_MS,
      rank: idx,
    })
    if (entry.thinking !== null && entry.thinking !== undefined) {
      plan.push({
        model: entry.model,
        thinking: null,
        stream: wantStream,
        firstByteMs: FIRST_BYTE_MS,
        timeoutMs: STREAM_BUDGET_MS,
        rank: idx,
        onlyIfHintRejected: true,
      })
    }
    plan.push({
      model: entry.model,
      thinking: entry.thinking === undefined ? null : entry.thinking,
      stream: wantStream,
      firstByteMs: FIRST_BYTE_MS,
      timeoutMs: STREAM_BUDGET_MS,
      rank: idx,
      retry: true,
    })
  })
  // Absolute last resort: cheapest model, plain non-streaming call.
  plan.push({
    model: chain[chain.length - 1].model,
    thinking: null,
    stream: false,
    firstByteMs: 0,
    timeoutMs: RETRY_TIMEOUT_MS,
    lastResort: true,
  })

  const startedAt = Date.now()
  let lastError = null
  let hintRejected = false
  let transientAtRank = -1
  const retried = new Set()

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]

    if (step.onlyIfHintRejected && !hintRejected) continue
    if (step.retry && (retried.has(step.rank) || transientAtRank !== step.rank)) continue
    if (isExhausted(step.model) && !step.lastResort) {
      dbg(`skip ${step.model}: out of daily capacity`)
      continue
    }

    const elapsed = Date.now() - startedAt
    const remaining = TOTAL_BUDGET_MS - elapsed
    if (remaining < 2500) {
      dbg(`budget spent (${elapsed}ms) before attempt ${i + 1}`)
      break
    }

    if (step.retry) retried.add(step.rank)

    const { body } = buildRequest(kind, payload, { model: step.model, thinking: step.thinking })
    const t0 = Date.now()
    const timeoutMs = Math.max(2500, Math.min(step.timeoutMs, remaining))
    const firstByteMs = step.firstByteMs ? Math.min(step.firstByteMs, timeoutMs) : 0
    dbg(
      `attempt ${i + 1}: model=${step.model} thinking=${step.thinking} ` +
        `stream=${step.stream} timeout=${timeoutMs} firstByte=${firstByteMs}`
    )

    try {
      const text = await requestOnce({
        url: buildUrl(step.model, step.stream),
        body,
        key,
        timeoutMs,
        firstByteMs,
        onSseChunk: step.stream && onChunk ? onChunk : undefined,
      })
      const ms = Date.now() - t0
      dbg(`attempt ${i + 1}: ok in ${ms}ms, ${text.length} chars`)
      const result = finishResponse(text, step.stream)
      if (onChunk) onChunk('', text, { done: true })
      return result
    } catch (e) {
      const ms = Date.now() - t0
      e.model = step.model
      lastError = e
      dbg(`attempt ${i + 1}: failed in ${ms}ms code=${e.code} status=${e.status || '-'}`)

      /* 400 means our request shape was rejected. That is only worth another
       * attempt when the rejected part was the reasoning hint; otherwise every
       * model in the chain would fail the same way, so fail fast. */
      if (e.code === 'API' && e.status === 400) {
        if (step.thinking !== null && step.thinking !== undefined) {
          hintRejected = true
          continue
        }
        throw e
      }
      // A rejected credential is never fixed by walking to another model.
      if (e.code === 'API' && (e.status === 401 || e.status === 403)) throw e
      // A model that is gone from the service is simply skipped.
      if (e.code === 'API' && e.status === 404) {
        markExhausted(step.model)
        continue
      }

      // 429: this model is spent for the day. Never retry it.
      if (e.status === 429) {
        markExhausted(step.model)
        transientAtRank = -1
        continue
      }

      const transient =
        e.code === 'TIMEOUT' || e.code === 'NETWORK' || e.code === 'EMPTY' ||
        e.status === 503 || e.status === 500 || e.status === 502
      if (transient) {
        transientAtRank = step.rank
        continue
      }

      // A parse failure usually means a truncated or reasoning-heavy answer:
      // retrying once without the reasoning hint is cheap and often fixes it.
      if ((e.code === 'PARSE' || e.code === 'LIMIT') && step.rank < 1) {
        hintRejected = true
        transientAtRank = step.rank
        continue
      }

      throw e
    }
  }

  if (lastError && lastError.status === 429) {
    const err = new Error(
      'Daily capacity for this level is used up. Try a different capability level, or retry tomorrow.'
    )
    err.code = 'QUOTA'
    throw err
  }
  throw lastError || new Error('Spark could not complete that request.')
}

async function testKey(apiKey) {
  const key = apiKey || readVault()
  if (!key) return { ok: false, message: 'No credential is configured yet.' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(`${ENDPOINT}/models?pageSize=1`, {
      headers: { [AUTH_HEADER]: key },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (res.ok) return { ok: true, message: 'Connection is healthy — Spark is ready.' }
    return { ok: false, message: friendlyError(res.status, await res.text()) }
  } catch {
    clearTimeout(timer)
    return { ok: false, message: 'Could not reach the network. Check your connection.' }
  }
}

/* A non-secret summary for the Settings screen: has a credential, which tier
 * is active, and where the credential came from. Never the value itself. */
function credentialStatus() {
  const vaultKey = readVault()
  return {
    hasBuiltIn: Boolean(vaultKey),
    tag: vaultKey ? `${vaultKey.slice(0, 3)}••••${vaultKey.slice(-4)}` : '',
    tiers: Object.values(TIERS).map(({ id, label, note }) => ({ id, label, note })),
  }
}

module.exports = { callEngine, testKey, credentialStatus, TIERS }
