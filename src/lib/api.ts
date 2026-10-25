import type {
  Analysis,
  AppSettings,
  Category,
  ClarifyResult,
  GeneratedPrompt,
  LabAction,
  LabResult,
  OutputStyle,
  TargetModel,
  Tone,
} from './types'
import { BROWSER_DEFAULTS, getBrowserKey, saveLocalSettings, setBrowserKey } from './storage'
import * as local from './localEngine'

/* ---------------------------------------------------------------------------
 * The single API surface the UI talks to.
 *
 * Desktop (Electron): every request is proxied through the main process, so the
 * API key never enters the renderer and there is no CORS to fight.
 * Browser (vite dev / hosted): a fallback path that talks to the service
 * directly, for testing the UI outside a packaged build.
 * ------------------------------------------------------------------------- */

interface Bridge {
  isDesktop: true
  settings: {
    get: () => Promise<AppSettings>
    setKey: (key: string) => Promise<AppSettings>
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>
    testKey: (key: string) => Promise<{ ok: boolean; message: string }>
  }
  engine: (kind: string, payload: Record<string, unknown>) => Promise<EngineResponse>
  engineStream?: (
    kind: string,
    payload: Record<string, unknown>,
    onEvent: (e: { delta: string; received: number }) => void
  ) => Promise<EngineResponse>
  app: {
    info: () => Promise<{ version: string; platform: string; dataDir: string; electron: string }>
    openExternal: (url: string) => Promise<void>
    clearLocalData: () => Promise<{ ok: boolean }>
  }
  win: { minimize: () => void; maximize: () => void; close: () => void }
}

type EngineResponse = { ok: true; data: unknown } | { ok: false; code: string; message: string }

declare global {
  interface Window {
    spark?: Bridge
  }
}

export const bridge: Bridge | undefined =
  typeof window !== 'undefined' ? window.spark : undefined
export const isDesktop = Boolean(bridge)



class ApiError extends Error {
  code: string
  constructor(message: string, code = 'ERROR') {
    super(message)
    this.code = code
  }
}

/* The dev/browser build can carry a key from .env (VITE_SPARK_KEY).
 * A key saved in Settings always wins. */
const BUILD_KEY = (import.meta.env?.VITE_SPARK_KEY as string | undefined)?.trim() || ''

export const browserKey = () => getBrowserKey() || BUILD_KEY

/* ---------------------------------------------------------------------------
 * Dev-only fallback.
 *
 * `import.meta.env.DEV` is statically false in a production build, so this
 * entire block — endpoint, auth header, model id — is removed by the bundler
 * and never ships. The packaged desktop app can only reach the engine through
 * IPC, which means the shipped bundle contains no provider details at all.
 * ------------------------------------------------------------------------- */
async function browserCall(kind: string, payload: Record<string, unknown>): Promise<unknown> {
  if (!import.meta.env.DEV) {
    throw new ApiError('The generation engine is not available in this context.', 'NO_BRIDGE')
  }
  const key = getBrowserKey()
  if (!key) throw new ApiError('NO_KEY', 'NO_KEY')

  const { devEndpoint, devAuthHeader, devModel } = await import('./devTransport')
  const body = buildBrowserBody(kind, payload)
  const res = await fetch(`${devEndpoint}/models/${devModel}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [devAuthHeader]: key },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  if (!res.ok) {
    if (res.status === 429) throw new ApiError('Rate limit reached. Wait a moment.', 'API')
    throw new ApiError(`Spark returned HTTP ${res.status}.`, 'API')
  }
  const json = JSON.parse(raw)
  const text = (json?.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p?.text || '')
    .join('')
    .trim()
  if (!text) throw new ApiError('Spark returned an empty response.', 'EMPTY')
  return JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim())
}

function buildBrowserBody(kind: string, payload: Record<string, unknown>) {
  const system =
    'You are Spark, a senior prompt engineer. Answer only with JSON matching the requested shape.'
  return {
    systemInstruction: { parts: [{ text: `${system} Request kind: ${kind}` }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
    generationConfig: {
      temperature: (payload.temperature as number) ?? 0.7,
      responseMimeType: 'application/json',
    },
  }
}

export type OnProgress = (partial: { received: number; preview: string }) => void

/* Every engine request funnels through here. When the caller passes a progress
 * callback we use the streaming bridge, so the answer is painted while it is
 * still being written instead of arriving as one silent blob. */
async function call(
  kind: string,
  payload: Record<string, unknown>,
  onProgress?: OnProgress
): Promise<unknown> {
  if (bridge) {
    if (onProgress && bridge.engineStream) {
      let text = ''
      const res = await bridge.engineStream(kind, payload, (e) => {
        text += e.delta || ''
        onProgress({ received: e.received ?? text.length, preview: text })
      })
      if (!res.ok) throw new ApiError(res.message, res.code)
      return res.data
    }
    const res = await bridge.engine(kind, payload)
    if (!res.ok) throw new ApiError(res.message, res.code)
    return res.data
  }
  return browserCall(kind, payload)
}

/* ------------------------------- settings --------------------------------- */

export async function getSettings(): Promise<AppSettings> {
  if (bridge) return bridge.settings.get()
  const stored = JSON.parse(localStorage.getItem('pf.settings.v1') || '{}')
  const key = browserKey()
  return {
    ...BROWSER_DEFAULTS,
    ...stored,
    hasKey: Boolean(key),
    keyHint: key ? `${key.slice(0, 8)}••••${key.slice(-4)}` : '',
    keySource: key ? (getBrowserKey() ? 'settings' : 'env') : 'none',
  }
}

export async function setApiKey(key: string): Promise<AppSettings> {
  if (bridge) return bridge.settings.setKey(key)
  setBrowserKey(key.trim())
  return getSettings()
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  if (bridge) return bridge.settings.update(patch)
  const { hasKey, keyHint, keySource, tiers, dataDir, encryption, hasBuiltIn, ...persist } = patch
  void hasKey; void keyHint; void keySource; void tiers; void dataDir; void encryption; void hasBuiltIn
  saveLocalSettings(persist)
  return getSettings()
}

export async function testApiKey(key: string): Promise<{ ok: boolean; message: string }> {
  if (bridge) return bridge.settings.testKey(key)
  const candidate = key.trim() || browserKey()
  if (!candidate) return { ok: false, message: 'No key saved yet.' }
  if (!import.meta.env.DEV) {
    return { ok: false, message: 'Key testing is only available in the app or in dev mode.' }
  }
  try {
    const { devEndpoint, devAuthHeader } = await import('./devTransport')
    const res = await fetch(`${devEndpoint}/models?pageSize=1`, {
      headers: { [devAuthHeader]: candidate },
    })
    if (res.ok) return { ok: true, message: 'Connection healthy — Spark is ready.' }
    return { ok: false, message: `The service rejected the key (HTTP ${res.status}).` }
  } catch {
    return { ok: false, message: 'Could not reach the service. Check your connection.' }
  }
}

/* --------------------------- engine operations ---------------------------- */

export interface GenerateArgs {
  idea: string
  category: Category
  targetModel: TargetModel
  outputStyle: OutputStyle
  answers?: { q: string; a: string }[]
  tier?: string
  temperature?: number
}

/* Clarification runs on the fastest tier on purpose: it is a small routing
 * decision that sits *in front of* the real work, so spending a deep model on
 * it would add seconds to every single generation. */
export async function clarify(args: {
  idea: string
  category: Category
  targetModel: TargetModel
  tier?: string
}): Promise<ClarifyResult> {
  try {
    const data = (await call('clarify', { ...args, tier: 'low' })) as ClarifyResult
    if (!data?.questions) throw new ApiError('bad shape', 'PARSE')
    return data
  } catch (e) {
    if (e instanceof ApiError && e.code === 'NO_KEY') return local.localClarify(args)
    throw e
  }
}

export async function generatePrompt(
  args: GenerateArgs,
  onProgress?: OnProgress
): Promise<GeneratedPrompt> {
  try {
    const data = (await call(
      'generate',
      args as unknown as Record<string, unknown>,
      onProgress
    )) as Partial<GeneratedPrompt>
    return normalizeGenerated(data, args, 'ai')
  } catch (e) {
    if (e instanceof ApiError && e.code === 'NO_KEY') {
      return { ...local.localGenerate(args), source: 'local' }
    }
    throw e
  }
}

export async function labRewrite(args: {
  prompt: string
  action: LabAction
  tone?: Tone
  targetModel?: TargetModel
  tier?: string
  temperature?: number
}): Promise<LabResult> {
  try {
    const data = (await call('lab', args)) as LabResult
    if (!data?.prompt) throw new ApiError('bad shape', 'PARSE')
    return data
  } catch (e) {
    if (e instanceof ApiError && e.code === 'NO_KEY') return local.localLab(args)
    throw e
  }
}

export async function analyzePrompt(args: {
  prompt: string
  tier?: string
}): Promise<Analysis> {
  try {
    const data = (await call('analyze', args)) as Analysis
    if (!data?.scores) throw new ApiError('bad shape', 'PARSE')
    return data
  } catch (e) {
    if (e instanceof ApiError && e.code === 'NO_KEY') return local.localAnalyze(args.prompt)
    throw e
  }
}

function normalizeGenerated(
  data: Partial<GeneratedPrompt>,
  args: GenerateArgs,
  source: 'ai' | 'local'
): GeneratedPrompt {
  const clamp = (n: unknown, fallback = 80) =>
    Math.max(0, Math.min(100, Math.round(typeof n === 'number' ? n : fallback)))
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    title: data.title?.trim() || 'Untitled prompt',
    category: (data.category as Category) || args.category,
    targetModel: (data.targetModel as TargetModel) || args.targetModel,
    outputStyle: args.outputStyle,
    objective: data.objective?.trim() || 'Achieve the user objective with a production-ready prompt.',
    brief: data.brief,
    prompt: (data.prompt || '').trim(),
    assumptions: Array.isArray(data.assumptions) ? data.assumptions.filter(Boolean) : [],
    tips: Array.isArray(data.tips) ? data.tips.filter(Boolean) : [],
    quality: {
      clarity: clamp(data.quality?.clarity),
      completeness: clamp(data.quality?.completeness),
      specificity: clamp(data.quality?.specificity),
    },
    createdAt: Date.now(),
    source,
  }
}

export { ApiError }
