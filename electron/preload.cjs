const { contextBridge, ipcRenderer } = require('electron')

/**
 * The only bridge between the UI and the OS. The renderer never sees Node, the
 * credential, or any provider detail — it can only ask the main process to run
 * a generation task at a given capability tier.
 */
contextBridge.exposeInMainWorld('spark', {
  isDesktop: true,
  settings: {
    get: () => ipcRenderer.invoke('spark:settings:get'),
    setKey: (key) => ipcRenderer.invoke('spark:settings:setKey', key),
    update: (patch) => ipcRenderer.invoke('spark:settings:update', patch),
    testKey: (key) => ipcRenderer.invoke('spark:key:test', key),
  },
  // The UI can request work; it can never read the credential.
  engine: (kind, payload) => ipcRenderer.invoke('spark:engine', { kind, payload }),
  /**
   * Same call, but the main process pushes partial text back while the answer
   * is still being written, so the UI can show progress instead of a spinner.
   * Each call gets its own channel, so concurrent requests cannot cross-talk.
   */
  engineStream: async (kind, payload, onEvent) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const channel = `spark:engine:chunk:${id}`
    const listener = (_e, msg) => {
      try {
        onEvent(msg)
      } catch {
        /* the UI handler must never break the stream */
      }
    }
    ipcRenderer.on(channel, listener)
    try {
      return await ipcRenderer.invoke('spark:engine', { kind, payload, streamId: id })
    } finally {
      ipcRenderer.removeListener(channel, listener)
    }
  },
  app: {
    info: () => ipcRenderer.invoke('spark:app:info'),
    openExternal: (url) => ipcRenderer.invoke('spark:app:openExternal', url),
    clearLocalData: () => ipcRenderer.invoke('spark:app:clearLocalData'),
  },
  win: {
    minimize: () => ipcRenderer.send('spark:win:minimize'),
    maximize: () => ipcRenderer.send('spark:win:maximize'),
    close: () => ipcRenderer.send('spark:win:close'),
  },
})
