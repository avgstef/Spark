import { useEffect, useState } from 'react'
import { useApp } from '../lib/appState'
import { bridge, isDesktop, testApiKey } from '../lib/api'
import type { Category } from '../lib/types'
import { CATEGORIES } from '../lib/templates'
import { Icon } from '../components/Icon'
import { Button, Card, Field, Notice, Segmented } from '../components/ui'

const TIER_OPTIONS = [
  { id: 'low', label: 'Low', note: 'Fastest responses, lightest reasoning' },
  { id: 'medium', label: 'Medium', note: 'Balanced depth and speed — recommended' },
  { id: 'high', label: 'High', note: 'Deepest reasoning, slower and more thorough' },
] as const

export function Settings() {
  const { settings, saveKey, patchSettings, toast, library, history } = useApp()
  const [keyInput, setKeyInput] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [info, setInfo] = useState<{ version: string; platform: string; dataDir: string } | null>(null)

  useEffect(() => {
    bridge?.app.info().then(setInfo).catch(() => setInfo(null))
  }, [])

  const save = async () => {
    const value = keyInput.trim()
    if (!value) return
    // Fail fast on obviously wrong input before persisting it.
    if (!/^[A-Za-z0-9._\-]{20,}$/.test(value)) {
      setTestResult({
        ok: false,
        message: 'That does not look like a valid service key (expected a long string of letters, digits, dots, dashes or underscores).',
      })
      return
    }
    await saveKey(value)
    setKeyInput('')
    setTestResult(null)
    toast('API key saved', 'success')
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    const res = await testApiKey(keyInput.trim())
    setTestResult(res)
    setTesting(false)
  }

  const clearData = async () => {
    if (isDesktop && bridge) {
      const res = await bridge.app.clearLocalData()
      if (res.ok) {
        localStorage.clear()
        toast('All local data cleared', 'info')
        setTimeout(() => location.reload(), 600)
      }
      return
    }
    if (confirm('Delete your saved prompts, history and key from this browser?')) {
      localStorage.clear()
      location.reload()
    }
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">
          <Icon name="settings" size={12} /> Settings
        </div>
        <h1>Settings &amp; integrations</h1>
        <p>Spark ships with a sealed credential. You can also supply your own. Nothing leaves your machine except the generation requests you make.</p>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* ------------------------------ api key ------------------------------ */}
        <Card className="card--pad-lg stack">
          <div className="section-title">
            <h3>
              <Icon name="key" size={15} style={{ marginRight: 7, color: 'var(--primary)' }} />
              Service credential
            </h3>
            {settings.hasKey ? (
              <span className="tag tag--success">connected</span>
            ) : (
              <span className="tag tag--warning">not set</span>
            )}
          </div>

          {settings.hasKey ? (
            <Notice kind="success" icon="lock">
              Engine ready — credential source:{' '}
              {settings.keySource === 'built-in'
                ? 'sealed inside this build'
                : settings.keySource === 'file'
                  ? 'spark.key next to the app'
                  : settings.keySource === 'env'
                    ? 'SPARK_KEY environment variable'
                    : settings.encryption === 'os-keystore'
                      ? 'your operating system keystore'
                      : 'local app storage'}
              .
            </Notice>
          ) : (
            <Notice kind="info" icon="info">
              A sealed credential is bundled with this build, so Spark works out of the box. Adding
              your own key here overrides it and keeps your usage separate.
            </Notice>
          )}

          <Field
            label="Access key"
            hint={
              isDesktop
                ? 'Stored encrypted via the OS keystore. Never written into source control and never sent anywhere except the generation service.'
                : 'Browser mode: stored in this browser only.'
            }
          >
            <input
              className="input"
              type="password"
              placeholder={settings.hasKey ? '•••••••••••• (paste a new key to replace)' : 'Paste your key…'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              spellCheck={false}
              autoComplete="off"
            />
          </Field>

          <div className="btn-row">
            <Button variant="primary" icon="save" onClick={save} disabled={!keyInput.trim()}>
              Save key
            </Button>
            <Button icon={testing ? 'refresh' : 'zap'} onClick={test} disabled={testing || (!keyInput.trim() && !settings.hasKey)}>
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
            {settings.hasKey && (
              <Button
                variant="ghost"
                icon="trash"
                onClick={async () => {
                  await saveKey('')
                  setTestResult(null)
                  toast('Key removed', 'info')
                }}
              >
                Remove
              </Button>
            )}
          </div>

          {testResult && (
            <Notice kind={testResult.ok ? 'success' : 'error'} icon={testResult.ok ? 'check' : 'alert'}>
              {testResult.message}
            </Notice>
          )}
        </Card>

        {/* ------------------------------ provider ---------------------------- */}
        <div className="stack">
          <Card className="card--pad-lg stack">
            <div className="section-title">
              <h3>
                <Icon name="gauge" size={15} style={{ marginRight: 7, color: 'var(--secondary)' }} />
                Capability
              </h3>
              <span className="tag">default for new prompts</span>
            </div>
            <div className="tier-grid">
              {TIER_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  className={`tier ${settings.tier === t.id ? 'tier--active' : ''}`}
                  data-level={t.id}
                  onClick={() => {
                    patchSettings({ tier: t.id })
                    toast(`Capability set to ${t.label}`, 'info')
                  }}
                >
                  <span className="tier__bubble">
                    <span className="tier__bars">
                      <i />
                      <i />
                      <i />
                    </span>
                  </span>
                  <span className="tier__text">
                    <span className="tier__label">{t.label}</span>
                    <span className="tier__note">{t.note.split('—')[0].trim()}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="field__hint" style={{ margin: 0 }}>
              Higher levels take longer but reason more thoroughly. You can override this per prompt
              in Studio.
            </p>

            <Field label={`Temperature — ${settings.temperature.toFixed(1)}`} hint="Lower is more literal and repeatable; higher is more creative.">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={settings.temperature}
                onChange={(e) => patchSettings({ temperature: Number(e.target.value) })}
                style={{ accentColor: 'var(--primary)', width: '100%' }}
              />
            </Field>
          </Card>

          <Card className="card--pad-lg stack">
            <div className="section-title">
              <h3>
                <Icon name="sliders" size={15} style={{ marginRight: 7, color: 'var(--primary)' }} />
                Defaults
              </h3>
            </div>
            <Field label="Default category">
              <select
                className="select"
                value={settings.defaultCategory}
                onChange={(e) => patchSettings({ defaultCategory: e.target.value as Category })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Appearance">
              <Segmented
                options={[
                  { id: 'obsidian' as const },
                  { id: 'ember' as const },
                ]}
                value={settings.theme}
                onChange={(v) => patchSettings({ theme: v })}
              />
            </Field>
          </Card>
        </div>
      </div>

      {/* -------------------------------- privacy ------------------------------ */}
      <div className="grid grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <Card className="card--pad-lg stack">
          <div className="section-title">
            <h3>
              <Icon name="shield" size={15} style={{ marginRight: 7, color: 'var(--success)' }} />
              Privacy
            </h3>
          </div>
          <ul className="tiny muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Your prompts, history and library live only on this machine.</li>
            <li>Only the text you submit is sent to the generation service, using the sealed credential.</li>
            <li>The API key is encrypted with the OS keystore where available.</li>
            <li>No telemetry, no analytics, no account required.</li>
          </ul>
          <div className="row" style={{ gap: 10 }}>
            <span className="tag">Library: {library.length}</span>
            <span className="tag">History: {history.length}</span>
            <span className="tag">{settings.encryption}</span>
          </div>
        </Card>

        <Card className="card--pad-lg stack">
          <div className="section-title">
            <h3>
              <Icon name="info" size={15} style={{ marginRight: 7, color: 'var(--muted)' }} />
              About
            </h3>
          </div>
          <div className="tiny muted" style={{ lineHeight: 1.9 }}>
            <div>
              <b style={{ color: 'var(--text-2)' }}>Spark</b> · v{info?.version || '1.0.0'}
            </div>
            <div>Runtime: {isDesktop ? `Electron desktop (${info?.platform})` : 'Browser (dev preview)'}</div>
            {info?.dataDir && (
              <div style={{ wordBreak: 'break-all' }}>
                Data folder: <span className="mono">{info.dataDir}</span>
              </div>
            )}
          </div>

          <div className="credit">
            <span className="credit__mark">
              <Icon name="spark" size={14} />
            </span>
            <div className="credit__text">
              <span className="credit__label">Designed &amp; built by</span>
              <span className="credit__name">avgstef</span>
            </div>
          </div>

          <hr className="divider" style={{ margin: '4px 0' }} />
          <div className="btn-row">
            <Button variant="danger" icon="trash" onClick={clearData}>
              Clear all local data
            </Button>

          </div>
        </Card>
      </div>
    </div>
  )
}
