/* ---------------------------------------------------------------------------
 * Spark — Electron main process
 * ------------------------------------------------------------------------- */
const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { callEngine, testKey, credentialStatus } = require('./engine.cjs')
const store = require('./store.cjs')

const DEV_SERVER = process.env.PF_DEV_SERVER || ''
const isDev = Boolean(DEV_SERVER)

let mainWindow = null

/* --------------------------- window geometry ----------------------------- */
/* Remember size, position and maximised state between launches — the sort of
 * thing that makes an app feel native rather than disposable. */
const statePath = () => path.join(app.getPath('userData'), 'window-state.json')

function loadWindowState() {
  const fallback = { width: 1400, height: 920, x: undefined, y: undefined, maximized: false }
  try {
    const raw = JSON.parse(fs.readFileSync(statePath(), 'utf8'))
    return { ...fallback, ...raw }
  } catch {
    return fallback
  }
}

let saveStateTimer = null
function trackWindowState(win) {
  const persist = () => {
    if (!win || win.isDestroyed()) return
    clearTimeout(saveStateTimer)
    saveStateTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return
      const bounds = win.getNormalBounds()
      try {
        fs.mkdirSync(path.dirname(statePath()), { recursive: true })
        fs.writeFileSync(
          statePath(),
          JSON.stringify({ ...bounds, maximized: win.isMaximized() }, null, 2)
        )
      } catch {
        /* non-fatal */
      }
    }, 400)
  }
  win.on('resize', persist)
  win.on('move', persist)
  win.on('maximize', persist)
  win.on('unmaximize', persist)
  win.on('close', persist)
}

function createWindow() {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: '#0B0E14',
    title: 'Spark',
    // Electron uses this for the taskbar / Alt-Tab icon on Windows and Linux.
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (state.maximized) mainWindow.maximize()
    mainWindow.show()
  })

  trackWindowState(mainWindow)
  mainWindow.on('closed', () => (mainWindow = null))

  // External links open in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Lock down navigation.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL()
    if (url !== current && !url.startsWith(DEV_SERVER || 'file://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
}

/* ----------------------------- IPC surface ------------------------------- */

ipcMain.handle('spark:settings:get', () => ({
  ...store.publicSettings(),
  ...credentialStatus(),
}))

ipcMain.handle('spark:settings:setKey', (_e, key) => {
  store.setApiKey(key)
  return store.publicSettings()
})

ipcMain.handle('spark:settings:update', (_e, patch) => {
  store.update(patch)
  return store.publicSettings()
})

ipcMain.handle('spark:key:test', async (_e, key) => {
  const candidate = (key || '').trim() || store.getApiKey()
  return testKey(candidate)
})

/* The single generation entry point. The renderer can ask Spark to generate,
 * clarify, rewrite or analyse — it can never read the credential or choose an
 * upstream model, only a capability tier. */
ipcMain.handle('spark:engine', async (event, { kind, payload, streamId }) => {
  const apiKey = store.getApiKey()
  const sender = event.sender
  const channel = streamId ? `spark:engine:chunk:${streamId}` : ''
  const push = (delta, full) => {
    if (!channel || sender.isDestroyed()) return
    sender.send(channel, { delta, received: full.length })
  }
  try {
    const data = await callEngine({
      kind,
      payload,
      apiKey,
      stream: Boolean(streamId),
      onChunk: streamId ? push : undefined,
    })
    return { ok: true, data }
  } catch (e) {
    return { ok: false, code: e.code || 'ERROR', message: e.message }
  }
})

ipcMain.handle('spark:app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  dataDir: app.getPath('userData'),
  electron: process.versions.electron,
}))

ipcMain.handle('spark:app:openExternal', (_e, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url)
})

ipcMain.handle('spark:app:clearLocalData', async () => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Delete everything'],
    defaultId: 0,
    cancelId: 0,
    title: 'Clear local data',
    message: 'Delete your saved prompts, history and API key?',
    detail: 'This cannot be undone. Templates are restored to defaults.',
  })
  if (response !== 1) return { ok: false }
  store.setApiKey('')
  await mainWindow.webContents.session.clearStorageData({ storages: ['localstorage'] })
  return { ok: true }
})

/* --------------------------- window controls ----------------------------- */

ipcMain.on('spark:win:minimize', () => mainWindow?.minimize())
ipcMain.on('spark:win:maximize', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('spark:win:close', () => mainWindow?.close())
ipcMain.on('spark:win:state', (e) => {
  e.sender.send('spark:win:state', { maximized: Boolean(mainWindow?.isMaximized()) })
})

/* ------------------------------- lifecycle ------------------------------- */

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // The window is frameless with our own chrome, so the default File/Edit/View
    // menu bar would only add clutter.
    Menu.setApplicationMenu(null)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
