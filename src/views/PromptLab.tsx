import { useEffect, useState } from 'react'
import { useApp } from '../lib/appState'
import type { LabAction, LabResult, Tone } from '../lib/types'
import { labRewrite } from '../lib/api'
import { download, slug } from '../lib/storage'
import { Icon } from '../components/Icon'
import {
  Button,
  Card,
  CopyButton,
  Field,
  Notice,
  Segmented,
  Chips,
} from '../components/ui'

const ACTIONS: { id: LabAction; hint: string; icon: 'wand' | 'plus' | 'min' | 'pen' | 'alert' | 'sliders' }[] = [
  { id: 'Improve', hint: 'Sharpen wording and add missing constraints', icon: 'wand' },
  { id: 'Expand', hint: 'Add depth, edge cases and quality criteria', icon: 'plus' },
  { id: 'Simplify', hint: 'Cut to the essentials', icon: 'min' },
  { id: 'Change tone', hint: 'Rewrite the instruction voice', icon: 'pen' },
  { id: 'Fix ambiguity', hint: 'Replace vague instructions with testable ones', icon: 'alert' },
  { id: 'Adapt model', hint: 'Restructure for a specific model', icon: 'sliders' },
]

const TONES: Tone[] = ['Professional', 'Friendly', 'Direct', 'Playful', 'Academic', 'Persuasive']

export function PromptLab() {
  const { settings, handoff, setHandoff, saveToLibrary, navigate, toast } = useApp()
  const [text, setText] = useState('')
  const [title, setTitle] = useState('Untitled prompt')
  const [action, setAction] = useState<LabAction>('Improve')
  const [tone, setTone] = useState<Tone>('Professional')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LabResult | null>(null)
  const [tab, setTab] = useState<'result' | 'changes'>('result')

  useEffect(() => {
    if (handoff && handoff.target === 'lab') {
      setText(handoff.prompt)
      if (handoff.title) setTitle(handoff.title)
      setResult(null)
      setHandoff(null)
    }
  }, [handoff, setHandoff])

  const run = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const out = await labRewrite({
        prompt: text,
        action,
        tone,
        targetModel: 'Medium',
        tier: settings.tier,
        temperature: settings.temperature,
      })
      setResult(out)
      setTab('result')
      toast(`${action} complete`, 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rewrite failed.')
    } finally {
      setBusy(false)
    }
  }

  const apply = () => {
    if (!result) return
    setText(result.prompt)
    setResult(null)
    toast('Applied to editor', 'success')
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">
          <Icon name="lab" size={12} /> Prompt Lab
        </div>
        <h1>Refine an existing prompt</h1>
        <p>
          Paste anything — a prompt you found, one you wrote, or something from your library. Pick an
          operation and the engine rewrites it with an explanation of every change.
        </p>
      </div>

      <div className="split">
        <Card className="card--pad-lg">
          <div className="row row--between" style={{ marginBottom: 12 }}>
            <span className="field__label">Working prompt</span>
            <span className="tiny muted">
              {text.trim() ? `${text.split(/\s+/).filter(Boolean).length} words` : 'empty'}
            </span>
          </div>

          <textarea
            className="textarea"
            style={{ minHeight: 260 }}
            placeholder="Paste a prompt here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="btn-row" style={{ marginTop: 10 }}>
            <label
              className="btn btn--ghost btn--sm"
              style={{ cursor: 'pointer' }}
              title="Load a prompt from a text file"
            >
              <Icon name="download" size={13} />
              Import .txt / .md
              <input
                type="file"
                accept=".txt,.md"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setText(await f.text())
                    setTitle(f.name.replace(/\.[^.]+$/, ''))
                  }
                }}
              />
            </label>
            <input
              className="input"
              style={{ maxWidth: 220, height: 29, fontSize: 12 }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
            />
            {text && (
              <button className="btn btn--ghost btn--sm" onClick={() => { setText(''); setResult(null) }}>
                Clear
              </button>
            )}
          </div>

          <hr className="divider" />

          <div className="field">
            <span className="field__label">Operation</span>
            <div className="chips">
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  className={`chip ${action === a.id ? 'chip--active' : ''}`}
                  onClick={() => setAction(a.id)}
                  title={a.hint}
                >
                  <Icon name={a.icon} size={13} />
                  {a.id}
                </button>
              ))}
            </div>
            <span className="field__hint" style={{ marginTop: 6 }}>
              {ACTIONS.find((a) => a.id === action)?.hint}
            </span>
          </div>

          {action === 'Change tone' && (
            <div style={{ marginTop: 12 }}>
              <Field label="Tone">
                <Chips
                  options={TONES.map((t) => ({ id: t }))}
                  value={tone}
                  onChange={(t) => setTone(t as Tone)}
                />
              </Field>
            </div>
          )}

          <div className="generate-bar" style={{ marginTop: 16 }}>
            <Icon name="wand" size={15} />
            <span className="tiny muted nowrap">{action}</span>
            <Button
              variant="primary"
              icon={busy ? 'refresh' : 'spark'}
              onClick={run}
              disabled={!text.trim() || busy}
            >
              {busy ? 'Rewriting…' : 'Run'}
            </Button>
          </div>

          {error && (
            <div style={{ marginTop: 12 }}>
              <Notice kind="error" icon="alert">
                {error}
              </Notice>
            </div>
          )}
        </Card>

        <div className="stack">
          {!result && !busy && (
            <Card className="card--pad-lg">
              <div className="section-title">
                <h3>What the Lab does</h3>
              </div>
              <div className="stack stack-sm">
                {ACTIONS.map((a) => (
                  <div key={a.id} className="list-row">
                    <Icon name={a.icon} size={14} />
                    <div className="list-row__main">
                      <div className="list-row__title">{a.id}</div>
                      <div className="list-row__sub">{a.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {busy && (
            <Card className="card--pad-lg">
              {[92, 88, 96, 74, 84, 62].map((w, i) => (
                <div
                  key={i}
                  className="skeleton skeleton-line"
                  style={{ width: `${w}%`, height: 12 }}
                />
              ))}
              <div className="row" style={{ marginTop: 14 }}>
                <span className="pulse-dot" />
                <span className="tiny muted">Rewriting with an explicit change log…</span>
              </div>
            </Card>
          )}

          {result && !busy && (
            <Card className="card--pad-lg">
              <div className="row row--between" style={{ marginBottom: 12 }}>
                <Segmented
                  options={[
                    { id: 'result' as const },
                    { id: 'changes' as const },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
                <span className="tag tag--success">
                  {result.changes.length} changes
                </span>
              </div>

              {tab === 'result' ? (
                <div className="prompt-box">
                  <div className="prompt-box__head">
                    <Icon name="layers" size={13} style={{ color: 'var(--primary)' }} />
                    <span className="tiny" style={{ fontWeight: 600 }}>
                      Rewritten prompt
                    </span>
                    <span className="tiny muted right">
                      {result.prompt.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                  <div className="prompt-box__body">{result.prompt}</div>
                </div>
              ) : (
                <ul className="stack stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {result.changes.map((c, i) => (
                    <li key={i} className="list-row" style={{ padding: '9px 12px' }}>
                      <span className="tag tag--primary" style={{ flex: 'none' }}>{i + 1}</span>
                      <span className="tiny" style={{ color: 'var(--text-2)' }}>{c}</span>
                    </li>
                  ))}
                  {result.notes && <li className="tiny muted" style={{ padding: '4px 2px' }}>{result.notes}</li>}
                </ul>
              )}

              <div className="btn-row" style={{ marginTop: 12 }}>
                <CopyButton text={result.prompt} />
                <Button icon="check" onClick={apply}>
                  Apply
                </Button>
                <Button
                  icon="save"
                  variant="ghost"
                  onClick={() =>
                    saveToLibrary(
                      {
                        id: '',
                        title,
                        category: 'General',
                        targetModel: 'Medium',
                        outputStyle: settings.outputStyle,
                        objective: `${action} pass in Prompt Lab`,
                        prompt: result.prompt,
                        assumptions: [],
                        quality: { clarity: 85, completeness: 85, specificity: 85 },
                        createdAt: Date.now(),
                        source: 'ai',
                      },
                      [action.toLowerCase()]
                    )
                  }
                >
                  Save
                </Button>
                <Button
                  icon="analyzer"
                  variant="ghost"
                  onClick={() => {
                    setHandoff({ target: 'analyzer', prompt: result.prompt })
                    navigate('analyzer')
                  }}
                >
                  Analyze
                </Button>
                <Button
                  icon="download"
                  variant="ghost"
                  title="Download"
                  onClick={() => download(`${slug(title)}-${slug(action)}.txt`, result.prompt)}
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
