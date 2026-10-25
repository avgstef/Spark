import type {
  Analysis,
  Category,
  ClarifyResult,
  GeneratedPrompt,
  LabAction,
  LabResult,
  OutputStyle,
  TargetModel,
  Tone,
} from './types'

/* ---------------------------------------------------------------------------
 * Local fallback engine.
 *
 * Used when no credential is configured (or in the hosted preview). It is
 * deterministic and heuristic — the real quality jump comes from the model — but
 * it keeps the app fully usable offline and gives the UI something honest to
 * demonstrate.
 * ------------------------------------------------------------------------- */

const ROLE: Record<Category, string> = {
  Coding: 'You are a senior software engineer who ships production code.',
  Websites: 'You are a senior front-end engineer and product designer.',
  Apps: 'You are a product engineer who designs and builds shipping apps.',
  'Images/Video': 'You are an art director and visual prompt specialist.',
  Writing: 'You are an editor known for clear, persuasive writing.',
  Business: 'You are a strategy consultant and operations lead.',
  Research: 'You are a rigorous research analyst.',
  General: 'You are a domain expert and clear thinker.',
}

const OUTPUT: Record<Category, string> = {
  Coding:
    'Return: 1) a short plan, 2) complete runnable code in fenced blocks with filenames, 3) how to run it, 4) edge cases handled, 5) what you would test next.',
  Websites:
    'Return: 1) page/section outline, 2) the full implementation (HTML/CSS/JS or the requested framework), 3) responsive behaviour notes, 4) accessibility and performance checklist.',
  Apps:
    'Return: 1) user stories, 2) screen-by-screen breakdown with states (empty, loading, error), 3) data model, 4) implementation steps in build order.',
  'Images/Video':
    'Return: one final prompt line (comma-separated descriptors) plus a negative prompt, then two alternate variations that shift style or composition.',
  Writing:
    'Return: the finished piece, ready to publish, followed by a one-line summary of the choices you made.',
  Business:
    'Return: 1) executive summary, 2) analysis with assumptions stated, 3) a concrete plan with owners and dates, 4) risks and mitigations, 5) KPIs to track.',
  Research:
    'Return: 1) direct answer, 2) evidence with sources, 3) confidence level and what would change it, 4) open questions.',
  General:
    'Return: a direct answer first, then supporting detail, then any caveats or next steps. Use short paragraphs and headings.',
}

const CONSTRAINTS: Record<Category, string[]> = {
  Coding: [
    'Target runtime/stack: assume the most common modern choice and state it.',
    'No pseudocode. Every function must be complete and runnable.',
    'Handle invalid input, empty state and network failure explicitly.',
  ],
  Websites: [
    'Mobile-first and fully responsive from 360px to 1440px.',
    'Accessible: semantic landmarks, visible focus states, contrast >= 4.5:1.',
    'No external dependencies unless they are justified.',
  ],
  Apps: [
    'Every screen needs empty, loading and error states.',
    'Define the data model before the UI.',
    'Prefer boring, maintainable solutions over clever ones.',
  ],
  'Images/Video': [
    'Concrete nouns over adjectives: subject, setting, lens, lighting, palette.',
    'State aspect ratio and level of realism.',
    'List what to avoid.',
  ],
  Writing: [
    'Active voice, concrete examples, no filler.',
    'Match the audience vocabulary exactly.',
    'Cut 20% of the first draft without losing meaning.',
  ],
  Business: [
    'Quantify wherever possible; label every estimate.',
    'Separate facts, assumptions and opinions.',
    'Every recommendation needs an owner and a next action.',
  ],
  Research: [
    'Prefer primary sources; cite everything.',
    'Distinguish correlation from causation.',
    'State confidence and what evidence would overturn the conclusion.',
  ],
  General: [
    'Answer the question first, context second.',
    'No filler, no restating the prompt back.',
    'Flag any assumption you had to make.',
  ],
}

const OUTPUT_STYLE_RULE: Record<OutputStyle, string> = {
  Quick: 'Be compact: 80-140 words of prompt, no section headers.',
  Detailed: 'Use short section labels: Role, Task, Context, Constraints, Output format, Quality bar.',
  Expert:
    'Be thorough (250-450 words) and include a "Why this matters" note per constraint, plus 2 alternate angles under "Variants".',
}

function keyDetails(idea: string): string[] {
  return idea
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .slice(0, 4)
}

export function localGenerate(args: {
  idea: string
  category: Category
  targetModel: TargetModel
  outputStyle: OutputStyle
  answers?: { q: string; a: string }[]
}): GeneratedPrompt {
  const { idea, category, targetModel, outputStyle, answers = [] } = args
  const details = keyDetails(idea)
  const title =
    details[0]
      ?.replace(/^(build|create|make|write|design|i want|help me)\s+/i, '')
      .split(' ')
      .slice(0, 6)
      .join(' ')
      .replace(/[^\w\s/&-]/g, '')
      .trim() || `${category} prompt`

  const answerBlock = answers.length
    ? answers.map((a) => `- ${a.q.replace(/\?$/, '')}: ${a.a}`).join('\n')
    : '- No extra answers were given; defaults below were assumed.'

  const prompt = [
    `ROLE`,
    ROLE[category],
    ``,
    `TASK`,
    idea.trim(),
    ``,
    `CONTEXT`,
    `Target model: ${targetModel}. Audience: whoever will use this output.`,
    answerBlock,
    ``,
    `CONSTRAINTS`,
    ...CONSTRAINTS[category].map((c) => `- ${c}`),
    `- Ask at most one clarifying question, and only if a missing detail would change the result.`,
    ``,
    `OUTPUT FORMAT`,
    OUTPUT[category],
    ``,
    `QUALITY BAR`,
    `- No filler, no restating the task.`,
    `- Concrete over vague: every instruction must be checkable.`,
    `- If something is uncertain, say so explicitly instead of inventing it.`,
    ``,
    `STYLE`,
    OUTPUT_STYLE_RULE[outputStyle],
  ].join('\n')

  const assumptions = answers.length
    ? ['Answered questions were treated as facts.', 'No further defaults were invented.']
    : [
        'The target stack/platform is the most common modern choice for this category.',
        'The output should be complete and runnable rather than a sketch.',
        'English output unless the request implies otherwise.',
      ]

  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    category,
    targetModel,
    outputStyle,
    objective: `Turn the request into an executable brief for ${targetModel}.`,
    brief: `Goal: ${idea.slice(0, 140)}`,
    prompt,
    assumptions,
    tips: [
      'Add your tech stack or constraints to sharpen the result.',
      'Switch to Expert style for long-form deliverables.',
    ],
    quality: {
      clarity: 84,
      completeness: answers.length ? 82 : 74,
      specificity: category === 'Images/Video' ? 70 : 78,
    },
    createdAt: Date.now(),
    source: 'local',
  }
}

export function localClarify(args: { idea: string; category: Category }): ClarifyResult {
  const idea = args.idea.toLowerCase()
  const questions: string[] = []
  if (!/(react|vue|python|node|rust|java|swift|kotlin|next|express|django|flutter)/.test(idea))
    questions.push('Which stack or platform should this target? (default: the most common modern choice)')
  if (!/(for (a|an|my)|audience|users?|beginner|expert|team|client)/.test(idea))
    questions.push('Who is the audience? (default: a technically literate generalist)')
  if (!/(short|long|words|pages|minutes|seconds)/.test(idea))
    questions.push('How long should the output be? (default: as long as the task needs, no padding)')
  return {
    needsClarification: questions.length > 0,
    reason: questions.length
      ? 'A few details would change the shape of the prompt.'
      : 'The idea already contains enough detail.',
    questions: questions.slice(0, 3),
  }
}

export function localLab(args: {
  prompt: string
  action: LabAction
  tone?: Tone
  targetModel?: TargetModel
}): LabResult {
  const { prompt, action, tone = 'Professional', targetModel = 'Generic' } = args
  const clean = prompt.trim()
  const changes: string[] = []
  let out = clean

  if (action === 'Simplify') {
    const sentences = clean
      .split(/(?<=[.!?\n])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    out = sentences.slice(0, Math.max(6, Math.ceil(sentences.length * 0.55))).join('\n')
    changes.push('Cut redundant sentences.', 'Kept the hard requirements only.')
  } else if (action === 'Expand') {
    out = [
      clean,
      '',
      'ADDITIONAL CONTEXT',
      '- Explain your reasoning briefly before the final answer.',
      '- Cover edge cases and failure modes.',
      '',
      'QUALITY CHECK',
      '- Every claim must be verifiable or flagged as an assumption.',
      '- Finish with the single most useful next step.',
    ].join('\n')
    changes.push('Added reasoning and quality-check sections.', 'Added an explicit deliverable list.')
  } else if (action === 'Change tone') {
    out = `TONE: ${tone}.\n\n${clean}`
    changes.push(`Prefixed the instruction voice with ${tone.toLowerCase()}.`)
  } else if (action === 'Fix ambiguity') {
    out = clean
      .replace(/\bsome\b/gi, 'a specific')
      .replace(/\betc\.?\b/gi, '')
      .replace(/\bas needed\b/gi, 'only where stated below')
      .replace(/\bgood\b/gi, 'meeting the quality bar below')
    out += '\n\nCLARITY RULES\n- If a requirement is ambiguous, choose the simplest reading and state it.\n- Do not invent facts.'
    changes.push('Replaced vague quantifiers with explicit language.', 'Added a rule for handling remaining ambiguity.')
  } else if (action === 'Adapt model') {
    out = [
      `TUNED FOR ${targetModel.toUpperCase()} CAPABILITY`,
      '',
      clean,
      '',
      'EXECUTION NOTES',
      targetModel === 'High'
        ? '- Reason step by step before answering, then give the final deliverable.'
        : '- Lead with the deliverable, then constraints, then format. No preamble.',
    ].join('\n')
    changes.push(`Restructured for ${targetModel} capability.`)
  } else {
    // Improve
    const missing: string[] = []
    if (!/role|you are/i.test(clean)) missing.push('ROLE\nYou are a senior expert in this domain.')
    if (!/format|return|output/i.test(clean)) missing.push('OUTPUT FORMAT\nReturn the complete deliverable, ready to use, with no meta commentary.')
    if (!/constraint|must|do not|avoid/i.test(clean)) missing.push('CONSTRAINTS\n- Be concrete; replace vague adjectives with measurable requirements.\n- Ask one question only if a missing detail changes the outcome.')
    out = [...missing, clean].join('\n\n')
    changes.push(
      missing.length
        ? 'Added the missing structural sections (role / format / constraints).'
        : 'Tightened wording and removed filler.',
      'Kept the original intent unchanged.'
    )
  }

  return {
    prompt: out,
    changes,
    notes: 'Local heuristic pass — connect the engine for deeper rewrites.',
  }
}

export function localAnalyze(prompt: string): Analysis {
  const p = prompt.trim()
  const words = p.split(/\s+/).filter(Boolean).length
  const has = (re: RegExp) => re.test(p)
  const score = (base: number, cond: boolean, weight = 12) => Math.max(20, Math.min(98, base + (cond ? weight : 0)))

  const clarity = score(55, words > 30 && words < 600)
  const completeness = score(
    45,
    has(/format|return|output|deliverable/i),
    18
  )
  const specificity = score(45, (p.match(/\d+/g) || []).length >= 2, 16)
  const structure = score(45, has(/^(#|\d\.|role|task|context)/im), 20)
  const constraints = score(40, has(/must|do not|avoid|constraint|limit/i), 22)
  const overall = Math.round((clarity + completeness + specificity + structure + constraints) / 5)

  const weaknesses: string[] = []
  const fixes: string[] = []
  if (!has(/role|you are/i)) {
    weaknesses.push('No role is assigned to the model.')
    fixes.push('Open with "You are a [specific expert]…" to set the register.')
  }
  if (!has(/format|return|output/i)) {
    weaknesses.push('The output format is never specified.')
    fixes.push('Add an explicit "Output format" section (structure, length, style).')
  }
  if (!has(/must|do not|avoid|constraint|limit/i)) {
    weaknesses.push('No hard constraints — the model is free to guess.')
    fixes.push('Add 2-3 "must / must not" constraints.')
  }
  if ((p.match(/\d+/g) || []).length < 2) {
    weaknesses.push('Almost nothing is quantified.')
    fixes.push('Replace adjectives with numbers (length, count, resolution, budget).')
  }
  if (words < 25) {
    weaknesses.push('Very short prompt — likely under-specified.')
    fixes.push('Add context: who it is for, what success looks like, what to avoid.')
  }
  if (words > 900) {
    weaknesses.push('Long prompt — key instructions may get diluted.')
    fixes.push('Cut repetition; merge overlapping instructions.')
  }

  return {
    overall,
    scores: { clarity, completeness, specificity, structure, constraints },
    strengths: [
      has(/you are|role/i) ? 'Assigns a clear role.' : 'States the task directly.',
      words > 40 ? 'Provides enough context to act on.' : 'Short and easy to iterate on.',
    ],
    weaknesses: weaknesses.length ? weaknesses : ['No structural weaknesses detected.'],
    fixes: fixes.length ? fixes : ['Try an Expert-style rewrite to add variants.'],
  }
}
