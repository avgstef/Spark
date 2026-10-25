import type { AppSettings, Category, HistoryEntry, OutputStyle, SavedPrompt } from './types'

/* Local persistence. In the desktop build this lands in the Electron userData
 * partition; in a browser it is plain localStorage. Either way, everything
 * stays on the machine — nothing is uploaded except the prompt text you send
 * to the generation service. */

const K = {
  library: 'pf.library.v1',
  history: 'pf.history.v1',
  settings: 'pf.settings.v1',
  key: 'pf.apikey.v1',
  draft: 'pf.draft.v1',
  handoff: 'pf.handoff.v1',
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota — ignore */
  }
}

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/* ------------------------------- library ---------------------------------- */

export const loadLibrary = (): SavedPrompt[] => readJSON<SavedPrompt[]>(K.library, [])
export const saveLibrary = (items: SavedPrompt[]) => writeJSON(K.library, items)

export const loadHistory = (): HistoryEntry[] => readJSON<HistoryEntry[]>(K.history, [])
export const saveHistory = (items: HistoryEntry[]) => writeJSON(K.history, items)

export const MAX_HISTORY = 60

/* ------------------------------- settings --------------------------------- */

export const BROWSER_DEFAULTS: AppSettings = {
  hasKey: false,
  keyHint: '',
  tier: 'medium',
  temperature: 0.7,
  theme: 'obsidian',
  outputStyle: 'Detailed',
  defaultCategory: 'General',
  encryption: 'browser-local',
}

export function loadLocalSettings(): AppSettings {
  return { ...BROWSER_DEFAULTS, ...readJSON<Partial<AppSettings>>(K.settings, {}) }
}

export function saveLocalSettings(patch: Partial<AppSettings>) {
  writeJSON(K.settings, { ...loadLocalSettings(), ...patch })
}

export const getBrowserKey = () => localStorage.getItem(K.key) || ''
export const setBrowserKey = (key: string) => {
  if (key) localStorage.setItem(K.key, key)
  else localStorage.removeItem(K.key)
  const hint = key ? `${key.slice(0, 6)}••••${key.slice(-4)}` : ''
  saveLocalSettings({ hasKey: Boolean(key), keyHint: hint })
}

/* -------------------------------- draft ----------------------------------- */

export interface Draft {
  idea: string
  category: Category
  targetModel: string
  outputStyle: OutputStyle
}

export const loadDraft = (): Partial<Draft> => readJSON<Partial<Draft>>(K.draft, {})
export const saveDraft = (d: Partial<Draft>) => writeJSON(K.draft, d)

/* ------------------------------- handoff ---------------------------------- */

export type Handoff =
  | { target: 'lab'; prompt: string; title?: string }
  | { target: 'analyzer'; prompt: string }
  | { target: 'studio'; idea: string }

export function setHandoff(h: Handoff) {
  writeJSON(K.handoff, h)
}
export function takeHandoff(): Handoff | null {
  const h = readJSON<Handoff | null>(K.handoff, null)
  try {
    localStorage.removeItem(K.handoff)
  } catch {
    /* noop */
  }
  return h
}

/* -------------------------------- export ---------------------------------- */

export function download(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'prompt'
