/* Secure settings store.
 * The API key is encrypted with the OS keystore (DPAPI on Windows, Keychain on
 * macOS, libsecret on Linux) via Electron's safeStorage. If encryption is not
 * available we fall back to the plain JSON file and say so in Settings.
 */
const { app, safeStorage } = require('electron')
const { credentialStatus } = require('./engine.cjs')
const fs = require('node:fs')
const path = require('node:path')

const DEFAULTS = {
  apiKeyEnc: null,
  apiKeyPlain: null,
  tier: 'medium',
  temperature: 0.7,
  theme: 'obsidian',
  outputStyle: 'Detailed',
  defaultCategory: 'General',
  encryption: 'unavailable',
}

let cache = null

/* Is a credential sealed inside the app (electron/vault.dat)?
 *
 * NOTE: this deliberately reports presence only. It must never return the key
 * itself — the engine unseals the vault in its own module scope. Returning a
 * placeholder here previously caused the literal string "present" to be sent
 * as the API key, which the service correctly rejected. */
function hasBuiltIn() {
  return Boolean(credentialStatus().hasBuiltIn)
}

function file() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function read() {
  if (cache) return cache
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8'))
    cache = { ...DEFAULTS, ...raw }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

function write(patch) {
  const next = { ...read(), ...patch }
  cache = next
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true })
    fs.writeFileSync(file(), JSON.stringify(next, null, 2), { mode: 0o600 })
  } catch (e) {
    console.error('[store] write failed', e)
  }
  return next
}

function canEncrypt() {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function setApiKey(key) {
  const trimmed = (key || '').trim()
  if (!trimmed) {
    return write({ apiKeyEnc: null, apiKeyPlain: null })
  }
  if (canEncrypt()) {
    return write({
      apiKeyEnc: safeStorage.encryptString(trimmed).toString('base64'),
      apiKeyPlain: null,
      encryption: 'os-keystore',
    })
  }
  return write({ apiKeyEnc: null, apiKeyPlain: trimmed, encryption: 'plaintext-fallback' })
}

/* Resolve the API key, in priority order:
 *   1. the key saved from Settings (encrypted with the OS keystore)
 *   2. a `spark.key` file sitting next to the executable
 *   3. the SPARK_KEY environment variable
 * (2) and (3) let you ship or move the app without touching the UI, and keep
 * the key out of the source tree and out of the installer. */
function readKeyFile() {
  const candidates = [
    // 1. next to the packaged executable (Windows: install dir)
    path.join(path.dirname(app.getPath('exe')), 'spark.key'),
    // 2. project root during `npm run dev` / `npm start`
    path.join(app.getAppPath(), 'spark.key'),
    // 3. the user data folder (per-user override)
    path.join(app.getPath('userData'), 'spark.key'),
  ]
  for (const candidate of candidates) {
    try {
      const raw = fs.readFileSync(candidate, 'utf8').trim()
      if (raw) return raw.split(/\r?\n/)[0].trim()
    } catch {
      /* not present — keep looking */
    }
  }
  return ''
}

function getApiKey() {
  const s = read()
  if (s.apiKeyEnc) {
    try {
      const decrypted = safeStorage.decryptString(Buffer.from(s.apiKeyEnc, 'base64'))
      if (decrypted) return decrypted
    } catch {
      /* fall through to file / env */
    }
  }
  if (s.apiKeyPlain) return s.apiKeyPlain
  const fileKey = readKeyFile()
  if (fileKey) return fileKey
  const envKey = (process.env.SPARK_KEY || '').trim()
  if (envKey) return envKey
  // No explicit override: return an empty string so the engine falls through to
  // the sealed credential in electron/vault.dat (it unseals that itself).
  return ''
}

/* Where the active key came from — surfaced in Settings so it is never a
 * mystery which credential is being used. */
function keySource() {
  const s = read()
  if (s.apiKeyEnc || s.apiKeyPlain) return 'settings'
  if (readKeyFile()) return 'file'
  if ((process.env.SPARK_KEY || '').trim()) return 'env'
  if (hasBuiltIn()) return 'built-in'
  return 'none'
}

function publicSettings() {
  const s = read()
  const source = keySource()
  const vault = credentialStatus()
  return {
    hasKey: source !== 'none',
    keyHint: source === 'built-in' ? vault.tag : '',
    tier: s.tier,
    temperature: s.temperature,
    theme: s.theme,
    outputStyle: s.outputStyle,
    defaultCategory: s.defaultCategory,
    encryption: canEncrypt() ? 'os-keystore' : s.encryption,
    keySource: keySource(),
    dataDir: app.getPath('userData'),
  }
}

function update(patch) {
  const allowed = {}
  for (const k of ['tier', 'temperature', 'theme', 'outputStyle', 'defaultCategory']) {
    if (patch[k] !== undefined) allowed[k] = patch[k]
  }
  return write(allowed)
}

module.exports = { getApiKey, setApiKey, publicSettings, update, read, keySource }
