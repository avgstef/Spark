import { useEffect, useState } from 'react'
import { useApp } from '../lib/appState'
import type { Analysis } from '../lib/types'
import { analyzePrompt } from '../lib/api'
import { Icon } from '../components/Icon'
import {
  Button,
  Card,
  CopyButton,
  Empty,
  Meter,
  Notice,
  Ring,
  Segmented,
} from '../components/ui'

export function Analyzer() {
  const { settings, handoff, setHandoff, navigate, saveToLibrary, toast } = useApp()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [tab, setTab] = useState<'review' | 'rewrite'>('review')

  useEffect(() => {
    if (handoff && handoff.target === 'analyzer') {
      setText(handoff.prompt)
      setAnalysis(null)
      setHandoff(null)
    }
  }, [handoff, setHandoff])

  const run = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    setAnalysis(null)
    try {
      const a = await analyzePrompt({ prompt: text, tier: settings.tier })
      setAnalysis(a)
      setTab('review')
      toast(`Scored ${a.overall}/100`, 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">
          <Icon name="analyzer" size={12} /> Quality Analyzer
        </div>
        <h1>Grade a prompt before you use it</h1>
        <p>
          Paste any prompt to get scores across clarity, completeness, specificity, structure and
          constraints — plus the exact weaknesses and a rewritten version.
        </p>
      </div>

      <div className="split">
        <Card className="card--pad-lg">
          <div className="row row--between" style={{ marginBottom: 12 }}>
            <span className="field__label">Prompt under review</span>
            <span className="tiny muted">
              {text.trim() ? `${text.split(/\s+/).filter(Boolean).length} words` : 'empty'}
            </span>
          </div>
          <textarea
            className="textarea"
            style={{ minHeight: 320 }}
            placeholder="Paste the prompt you want to grade…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="generate-bar" style={{ marginTop: 14 }}>
            <Icon name="analyzer" size={15} />
            <span className="tiny muted nowrap">5-axis review</span>
            <Button variant="primary" icon={busy ? 'refresh' : 'zap'} onClick={run} disabled={!text.trim() || busy}>
              {busy ? 'Scoring…' : 'Analyze'}
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
          {!analysis && !busy && (
            <Card className="card--pad-lg">
              <Empty icon="analyzer" title="No analysis yet">
                Paste a prompt and run the analyzer. Weak prompts typically lose points on structure
                and constraints — the fixes panel tells you exactly what to add.
              </Empty>
            </Card>
          )}

          {busy && (
            <Card className="card--pad-lg">
              <div className="row" style={{ gap: 14, marginBottom: 18 }}>
                <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%' }} />
                <div className="grow">
                  <div className="skeleton skeleton-line" style={{ width: '60%' }} />
                  <div className="skeleton skeleton-line" style={{ width: '40%' }} />
                </div>
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton skeleton-line" style={{ height: 9 }} />
              ))}
              <div className="row" style={{ marginTop: 14 }}>
                <span className="pulse-dot" />
                <span className="tiny muted">Reviewing against prompt-engineering criteria…</span>
              </div>
            </Card>
          )}

          {analysis && !busy && (
            <Card className="card--pad-lg">
              <div className="row" style={{ gap: 14, marginBottom: 16 }}>
                <Ring value={analysis.overall} label="Overall" />
                <div className="grow">
                  <div style={{ fontWeight: 650, fontSize: 15 }}>
                    {analysis.overall >= 85
                      ? 'Strong prompt'
                      : analysis.overall >= 65
                        ? 'Decent — a few gaps'
                        : analysis.overall >= 45
                          ? 'Needs work'
                          : 'Under-specified'}
                  </div>
                  <div className="tiny muted">Weighted across five axes</div>
                </div>
                <Segmented
                  options={[{ id: 'review' as const }, { id: 'rewrite' as const }]}
                  value={tab}
                  onChange={setTab}
                />
              </div>

              {tab === 'review' ? (
                <div className="stack">
                  <div className="stack stack-sm">
                    <Meter value={analysis.scores.clarity} label="Clarity" />
                    <Meter value={analysis.scores.completeness} label="Completeness" />
                    <Meter value={analysis.scores.specificity} label="Specificity" />
                    <Meter value={analysis.scores.structure} label="Structure" />
                    <Meter value={analysis.scores.constraints} label="Constraints" />
                  </div>

                  <hr className="divider" style={{ margin: '6px 0' }} />

                  <div>
                    <div className="field__label" style={{ marginBottom: 6 }}>
                      Weaknesses
                    </div>
                    <ul className="stack stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {analysis.weaknesses.map((w, i) => (
                        <li key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                          <Icon name="alert" size={13} style={{ color: 'var(--warning)', marginTop: 3 }} />
                          <span className="tiny" style={{ color: 'var(--text-2)' }}>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="field__label" style={{ marginBottom: 6 }}>
                      Fixes, in order
                    </div>
                    <ul className="stack stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {analysis.fixes.map((f, i) => (
                        <li key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                          <span className="tag tag--primary" style={{ flex: 'none' }}>{i + 1}</span>
                          <span className="tiny" style={{ color: 'var(--text-2)' }}>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {analysis.strengths.length > 0 && (
                    <div>
                      <div className="field__label" style={{ marginBottom: 6 }}>
                        Strengths
                      </div>
                      <ul className="stack stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {analysis.strengths.map((s, i) => (
                          <li key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                            <Icon name="check" size={13} style={{ color: 'var(--success)', marginTop: 3 }} />
                            <span className="tiny" style={{ color: 'var(--text-2)' }}>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {analysis.rewritten ? (
                    <>
                      <div className="prompt-box">
                        <div className="prompt-box__head">
                          <Icon name="wand" size={13} style={{ color: 'var(--primary)' }} />
                          <span className="tiny" style={{ fontWeight: 600 }}>
                            Improved version
                          </span>
                        </div>
                        <div className="prompt-box__body">{analysis.rewritten}</div>
                      </div>
                      <div className="btn-row" style={{ marginTop: 12 }}>
                        <CopyButton text={analysis.rewritten} />
                        <Button
                          icon="edit"
                          onClick={() => {
                            setText(analysis.rewritten!)
                            toast('Loaded into the editor', 'success')
                          }}
                        >
                          Load into editor
                        </Button>
                        <Button
                          icon="lab"
                          variant="ghost"
                          onClick={() => {
                            setHandoff({ target: 'lab', prompt: analysis.rewritten! })
                            navigate('lab')
                          }}
                        >
                          Refine further
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Notice kind="info">This analysis did not include a rewrite.</Notice>
                  )}
                </div>
              )}

              <hr className="divider" />
              <div className="btn-row">
                <Button
                  size="sm"
                  icon="save"
                  onClick={() =>
                    saveToLibrary({
                      id: '',
                      title: `Analysis — ${new Date().toLocaleDateString()}`,
                      category: 'General',
                      targetModel: 'Medium',
                      outputStyle: settings.outputStyle,
                      objective: `Score ${analysis.overall}/100`,
                      prompt: text,
                      assumptions: [],
                      quality: {
                        clarity: analysis.scores.clarity,
                        completeness: analysis.scores.completeness,
                        specificity: analysis.scores.specificity,
                      },
                      createdAt: Date.now(),
                      source: 'ai',
                    })
                  }
                >
                  Save reviewed prompt
                </Button>
                <Button size="sm" variant="ghost" icon="refresh" onClick={run}>
                  Re-run
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
