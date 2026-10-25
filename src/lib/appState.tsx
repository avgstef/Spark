import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type {
  AppSettings,
  GeneratedPrompt,
  HistoryEntry,
  SavedPrompt,
} from './types'
import {
  BROWSER_DEFAULTS,
  MAX_HISTORY,
  loadHistory,
  loadLibrary,
  saveHistory,
  saveLibrary,
  takeHandoff,
  uid,
} from './storage'
import type { Handoff } from './storage'
import * as api from './api'

export type Route =
  | 'studio'
  | 'lab'
  | 'library'
  | 'history'
  | 'templates'
  | 'analyzer'
  | 'settings'

interface Toast {
  id: string
  message: string
  kind: 'success' | 'error' | 'info'
}

interface AppState {
  route: Route
  navigate: (route: Route) => void
  handoff: Handoff | null
  setHandoff: (h: Handoff | null) => void

  settings: AppSettings
  saveKey: (key: string) => Promise<void>
  patchSettings: (patch: Partial<AppSettings>) => Promise<void>

  library: SavedPrompt[]
  saveToLibrary: (p: GeneratedPrompt, tags?: string[]) => void
  removeFromLibrary: (id: string) => void
  updateSaved: (id: string, patch: Partial<SavedPrompt>) => void

  history: HistoryEntry[]
  addHistory: (idea: string, result: GeneratedPrompt, meta: HistoryEntry) => void
  clearHistory: () => void
  removeHistory: (id: string) => void

  toasts: Toast[]
  toast: (message: string, kind?: Toast['kind']) => void
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>('studio')
  const [handoff, setHandoff] = useState<Handoff | null>(null)
  const [settings, setSettings] = useState<AppSettings>(BROWSER_DEFAULTS)
  const [library, setLibrary] = useState<SavedPrompt[]>(() => loadLibrary())
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, number>>({})

  /* settings are loaded from the OS keystore in the desktop build */
  useEffect(() => {
    let alive = true
    api.getSettings().then((s) => {
      if (alive) setSettings(s)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  const navigate = useCallback((next: Route) => {
    setRoute(next)
    document.querySelector('.main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const toast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = uid()
    // Ignore an identical message that is already on screen (prevents stacks).
    setToasts((t) => (t.some((x) => x.message === message) ? t : [...t, { id, message, kind }].slice(-3)))
    timers.current[id] = window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
      delete timers.current[id]
    }, 3800)
  }, [])

  const saveKey = useCallback(
    async (key: string) => {
      const next = await api.setApiKey(key)
      setSettings(next)
    },
    []
  )

  const patchSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await api.updateSettings(patch)
    setSettings(next)
  }, [])

  const saveToLibrary = useCallback(
    (p: GeneratedPrompt, tags: string[] = []) => {
      setLibrary((lib) => {
        if (lib.some((x) => x.prompt === p.prompt)) {
          toast('That prompt is already in your library', 'info')
          return lib
        }
        const next: SavedPrompt[] = [
          { ...p, id: p.id || uid(), tags, favorite: false },
          ...lib,
        ]
        saveLibrary(next)
        toast('Saved to library', 'success')
        return next
      })
    },
    [toast]
  )

  const removeFromLibrary = useCallback((id: string) => {
    setLibrary((lib) => {
      const next = lib.filter((x) => x.id !== id)
      saveLibrary(next)
      return next
    })
    toast('Removed from library', 'info')
  }, [toast])

  const updateSaved = useCallback((id: string, patch: Partial<SavedPrompt>) => {
    setLibrary((lib) => {
      const next = lib.map((x) => (x.id === id ? { ...x, ...patch } : x))
      saveLibrary(next)
      return next
    })
  }, [])

  const addHistory = useCallback(
    (idea: string, result: GeneratedPrompt, meta: HistoryEntry) => {
      setHistory((h) => {
        const next = [{ ...meta, idea, result }, ...h].slice(0, MAX_HISTORY)
        saveHistory(next)
        return next
      })
    },
    []
  )

  const clearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
    toast('History cleared', 'info')
  }, [toast])

  const removeHistory = useCallback((id: string) => {
    setHistory((h) => {
      const next = h.filter((x) => x.id !== id)
      saveHistory(next)
      return next
    })
  }, [])

  /* pick up any pending cross-screen navigation request */
  useEffect(() => {
    const h = takeHandoff()
    if (h) {
      setHandoff(h)
      setRoute(h.target === 'lab' ? 'lab' : h.target === 'analyzer' ? 'analyzer' : 'studio')
    }
  }, [])

  const value = useMemo<AppState>(
    () => ({
      route,
      navigate,
      handoff,
      setHandoff,
      settings,
      saveKey,
      patchSettings,
      library,
      saveToLibrary,
      removeFromLibrary,
      updateSaved,
      history,
      addHistory,
      clearHistory,
      removeHistory,
      toasts,
      toast,
    }),
    [
      route,
      navigate,
      handoff,
      settings,
      saveKey,
      patchSettings,
      library,
      saveToLibrary,
      removeFromLibrary,
      updateSaved,
      history,
      addHistory,
      clearHistory,
      removeHistory,
      toasts,
      toast,
    ]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
