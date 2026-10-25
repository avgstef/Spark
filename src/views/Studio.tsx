import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/appState'
import { CATEGORIES } from '../lib/templates'
import type { Category, ClarifyResult, GeneratedPrompt, OutputStyle, TargetModel } from '../lib/types'
import { loadDraft, saveDraft, slug, download, uid } from '../lib/storage'
import { generatePrompt, clarify, isDesktop } from '../lib/api'
import { salvage, type PartialFields } from '../lib/partial'
import { Icon } from '../components/Icon'
import {
  Button,
  Card,
  CopyButton,
  Empty,
  Field,
  Meter,
  Modal,
  Notice,
  Ring,
} from '../components/ui'

const CATEGORY_ICONS = {
  Coding: 'code',
  Websites: 'globe',
  Apps: 'apps',
  'Images/Video': 'image',
  Writing: 'pen',
  Business: 'chart',
  Research: 'search',
  General: 'spark',
} as const

const EXAMPLES = [
  'Build a habit tracking app for iOS with streaks and reminders',
  'Cinematic product shot of a matte black earbud case on dark stone',
  'A 90-day go-to-market plan for a $29/mo AI writing tool',
  'Write a 1,200 word article about habit tracking for ADHD adults',
]

type Stage = 'idle' | 'clarifying' | 'generating'

export function Studio() {
  const { settings, saveToLibrary, addHistory, navigate, toast, handoff, setHandoff, library } =
    useApp()

  const draft = useRef(loadDraft())
  const [idea, setIdea] = useState(draft.current.idea || '')
  const [category, setCategory] = useState<Category>(
    (draft.current.category as Category) || settings.defaultCategory || 'General'
  )
  const [targetModel, setTargetModel] = useState<TargetModel>(
    (draft.current.targetModel as TargetModel) || 'Medium'
  )
  // Output style is no longer user-facing; a detailed structure is always used.
  const outputStyle: OutputStyle = 'Detailed'
  const [askQuestions, setAskQuestions] = useState(true)
  const [stage, setStage] = useState<Stage>('idle')
  const [result, setResult] = useState<GeneratedPrompt | null>(null)
  const [error, setError] = useState('')
  /* The answer is painted while it is still being written. `live` holds the
     fields that have arrived so far, `liveChars` the raw character count. */
  const [live, setLive] = useState<PartialFields | null>(null)
  const [liveChars, setLiveChars] = useState(0)
  const startedAt = useRef(0)

  const [clarifyData, setClarifyData] = useState<ClarifyResult | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})

  useEffect(() => {
    saveDraft({ idea, category, targetModel })
  }, [idea, category, targetModel])

  /* template / library handoff lands here */
  useEffect(() => {
    if (!handoff) return
    if (handoff.target === 'studio') {
      setIdea(handoff.idea)
      setResult(null)
      setHandoff(null)
    }
  }, [handoff, setHandoff])

  const busy = stage !== 'idle'

  /* Lightweight category detection: if the user types something obviously
     code-shaped we preselect Coding, etc. Never overrides an explicit pick. */
  const touchedCategory = useRef(false)
  useEffect(() => {
    if (touchedCategory.current || !idea.trim()) return
    const t = idea.toLowerCase()
    const guess: Category | null = /\b(react|typescript|python|api|endpoint|function|bug|refactor|sql|docker|node|rust|code|script)\b/.test(t)
      ? 'Coding'
      : /\b(landing page|website|html|css|tailwind|web page|frontend|webflow)\b/.test(t)
        ? 'Websites'
        : /\b(app|ios|android|mobile|desktop|feature|onboarding|dashboard)\b/.test(t)
          ? 'Apps'
          : /\b(image|photo|portrait|cinematic|render|midjourney|illustration|video shot)\b/.test(t)
            ? 'Images/Video'
            : /\b(article|blog|copy|email|headline|essay|script|newsletter)\b/.test(t)
              ? 'Writing'
              : /\b(gtm|pricing|business|revenue|market|strategy|sales|customers|kpi)\b/.test(t)
                ? 'Business'
                : /\b(research|study|evidence|sources|literature|analysis|survey)\b/.test(t)
                  ? 'Research'
                  : null
    if (guess && guess !== category) setCategory(guess)
  }, [idea, category])

  const canGenerate = idea.trim().length > 3 && !busy

  const runGeneration = async (qa: { q: string; a: string }[]) => {
    setStage('generating')
    setError('')
    setLive(null)
    setLiveChars(0)
    startedAt.current = Date.now()

    /* Chunks arrive every few dozen milliseconds; repaint at most ~12×/s so a
       long answer never starves the UI thread. */
    let lastPaint = 0
    const onProgress = ({ received, preview }: { received: number; preview: string }) => {
      const now = Date.now()
      setLiveChars(received)
      if (now - lastPaint < 80) return
      lastPaint = now
      const partial = salvage(preview)
      if (partial) setLive(partial)
    }

    try {
      const out = await generatePrompt(
        {
          idea: idea.trim(),
          category,
          targetModel,
          outputStyle,
          answers: qa,
          tier: settings.tier,
          temperature: settings.temperature,
        },
        onProgress
      )
      if (!out.prompt) throw new Error('The engine returned an empty prompt. Try again.')
      setResult(out)
      setLive(null)
      addHistory(idea.trim(), out, {
        id: uid(),
        idea: idea.trim(),
        category,
        targetModel,
        outputStyle,
        result: out,
        createdAt: Date.now(),
      })
      if (out.source === 'local') {
        toast('Generated locally — connect the engine for deeper results', 'info')
      } else {
        toast('Prompt generated', 'success')
      }
    } catch (e) {
      setLive(null)
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setStage('idle')
    }
  }

  const generate = async () => {
    if (!canGenerate) return
    setError('')
    setResult((r) => (r ? r : r))

    if (!askQuestions) {
      await runGeneration([])
      return
    }

    setStage('clarifying')
    try {
      const c = await clarify({
        idea: idea.trim(),
        category,
        targetModel,
        tier: settings.tier,
      })
      if (c.needsClarification && c.questions?.length) {
        setClarifyData(c)
        setAnswers({})
        setStage('idle')
        return
      }
    } catch {
      /* clarification is optional — fall through to generation */
    }
    await runGeneration([])
  }

  const submitAnswers = async () => {
    const qa = (clarifyData?.questions || []).map((q, i) => ({ q, a: answers[i]?.trim() || 'Use your best judgement.' }))
    setClarifyData(null)
    await runGeneration(qa)
  }

  const refine = (action: 'improve' | 'expand' | 'simplify') => {
    if (!result) return
    setHandoff({
      target: 'lab',
      prompt: result.prompt,
      title: result.title,
    })
    navigate('lab')
    toast(
      action === 'improve' ? 'Opened in Prompt Lab' : `Opened in Prompt Lab — run "${action}"`,
      'info'
    )
  }

  const stats = useMemo(() => {
    const words = result?.prompt.split(/\s+/).filter(Boolean).length ?? 0
    return { words, chars: result?.prompt.length ?? 0 }
  }, [result])

  return (
    <div>
      <div className="studio-hero">
        <div className="aurora" aria-hidden="true" />
        <span
          className="orb"
          style={{ width: 190, height: 190, top: -80, right: 30, background: 'rgba(245,184,65,0.5)' }}
          aria-hidden="true"
        />
        <span
          className="orb"
          style={{ width: 120, height: 120, bottom: -60, right: 250, background: 'rgba(255,150,60,0.35)', animationDelay: '3s' }}
          aria-hidden="true"
        />
        <div className="studio-hero__content">
          <div className="hero-eyebrow">Your idea <b>+</b> AI <b>=</b> endless possibilities</div>
          <h1>
            <span className="hero-line-1">Turn your ideas into</span>
            <span className="hero-line-2">powerful prompts</span>
          </h1>
          <p>
            Just tell us what you're thinking about, and Spark will craft the perfect prompt to
            bring it to life.
          </p>
          <div className="hero-features">
            <div className="hero-feature">
              <span className="hero-feature__icon">
                <Icon name="zap" size={15} />
              </span>
              <span className="hero-feature__text">
                <span className="hero-feature__title">Fast &amp; easy</span>
                <span className="hero-feature__desc">Idea to prompt in seconds.</span>
              </span>
            </div>
            <div className="hero-feature">
              <span className="hero-feature__icon">
                <Icon name="gauge" size={15} />
              </span>
              <span className="hero-feature__text">
                <span className="hero-feature__title">Better results</span>
                <span className="hero-feature__desc">Focused, structured prompts.</span>
              </span>
            </div>
            <div className="hero-feature">
              <span className="hero-feature__icon">
                <Icon name="spark" size={15} />
              </span>
              <span className="hero-feature__text">
                <span className="hero-feature__title">No limits</span>
                <span className="hero-feature__desc">Eight categories, any idea.</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="split">
        {/* ------------------------------- composer ------------------------------ */}
        <Card className="card--pad-lg studio-composer">
          <Field label="Your idea">
            <div className="idea-wrap">
              <textarea
                className="textarea textarea--lg"
                placeholder="e.g. Build a build-planner app for Windows gamers that recommends upgrades by budget…"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate()
                }}
              />
            </div>
          </Field>

          <div className="btn-row" style={{ marginTop: 10 }}>
            <span className="tiny muted">{idea.trim().split(/\s+/).filter(Boolean).length} words</span>
            <span className="tiny muted">·</span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setIdea(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
            >
              <Icon name="wand" size={13} /> Surprise me
            </button>
            {idea && (
              <button className="btn btn--ghost btn--sm" onClick={() => setIdea('')}>
                Clear
              </button>
            )}
          </div>

          <hr className="divider" />

          <div className="stack">
            <div className="field">
              <span className="field__label">Category</span>
              <div className="chips">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    className={`chip ${category === c.id ? 'chip--active' : ''}`}
                    onClick={() => {
                      touchedCategory.current = true
                      setCategory(c.id as Category)
                    }}
                    title={c.hint}
                  >
                    <Icon name={CATEGORY_ICONS[c.id]} size={13} />
                    {c.id}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label">Capability</span>
              <div className="tier-grid">
                {(['Low', 'Medium', 'High'] as TargetModel[]).map((t) => (
                  <button
                    key={t}
                    className={`tier ${targetModel === t ? 'tier--active' : ''}`}
                    data-level={t.toLowerCase()}
                    onClick={() => setTargetModel(t)}
                  >
                    <span className="tier__bubble">
                      <span className="tier__bars">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    <span className="tier__text">
                      <span className="tier__label">{t}</span>
                      <span className="tier__note">
                        {t === 'Low' ? 'Fastest' : t === 'Medium' ? 'Balanced' : 'Deepest'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>


            <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={askQuestions}
                onChange={(e) => setAskQuestions(e.target.checked)}
                style={{ accentColor: 'var(--primary)', width: 14, height: 14 }}
              />
              <span className="tiny muted">
                Ask clarifying questions when the idea is missing something important
              </span>
            </label>
          </div>

          <div className="generate-bar">
            <Icon name="brain" size={15} />
            <span className="tiny muted nowrap">
              {settings.hasKey || !isDesktop
                ? `${targetModel} capability`
                : 'Local engine'}
            </span>
            <Button
              variant="primary"
              icon={busy ? 'refresh' : 'spark'}
              onClick={generate}
              disabled={!canGenerate}
              className={busy ? '' : ''}
            >
              {stage === 'generating'
                ? 'Forging…'
                : stage === 'clarifying'
                  ? 'Thinking…'
                  : 'Generate prompt'}
            </Button>
          </div>

          {!settings.hasKey && (
            <div style={{ marginTop: 12 }}>
              <Notice kind="warning" icon="key">
                No key configured — prompts are built by the local heuristic engine.{' '}
                <button
                  className="btn btn--ghost btn--sm"
                  style={{ height: 'auto', padding: 0, color: 'var(--primary)' }}
                  onClick={() => navigate('settings')}
                >
                  Connect the engine →
                </button>
              </Notice>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12 }}>
              <Notice kind="error" icon="alert">
                {error}
              </Notice>
            </div>
          )}
        </Card>

        {/* -------------------------------- result ------------------------------- */}
        <div className="stack">
          {stage === 'generating' && <ResultSkeleton live={live} chars={liveChars} />}

          {stage !== 'generating' && !result && (
            <Card className="card--pad-lg">
              <Empty icon="wand" title="Your prompt will appear here">
                Write an idea on the left and hit <b>Generate prompt</b>. You'll get a paste-ready
                prompt, the score breakdown, any assumptions the engine made, and one-click handoff
                to Prompt Lab.
              </Empty>
              <div className="grid grid-2" style={{ marginTop: 16, gap: 10 }}>
                {EXAMPLES.slice(0, 4).map((ex, i) => (
                  <button
                    key={ex}
                    className="suggest-card"
                    onClick={() => setIdea(ex)}
                  >
                    <span className="suggest-card__icon">
                      <Icon
                        name={(['spark', 'image', 'chart', 'pen'] as const)[i % 4]}
                        size={14}
                      />
                    </span>
                    <span className="suggest-card__text">{ex}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {stage !== 'generating' && result && (
            <ResultPanel
              result={result}
              words={stats.words}
              chars={stats.chars}
              onSave={() => saveToLibrary(result)}
              onRegenerate={generate}
              onRefine={refine}
              onAnalyze={() => {
                setHandoff({ target: 'analyzer', prompt: result.prompt })
                navigate('analyzer')
              }}
              onEditInLab={() => {
                setHandoff({ target: 'lab', prompt: result.prompt, title: result.title })
                navigate('lab')
              }}
              saved={library.some((x) => x.prompt === result.prompt)}
            />
          )}
        </div>
      </div>

      {clarifyData && (
        <ClarifyModal
          data={clarifyData}
          answers={answers}
          onChange={(i, v) => setAnswers((a) => ({ ...a, [i]: v }))}
          onSkip={() => {
            setClarifyData(null)
            runGeneration([])
          }}
          onSubmit={submitAnswers}
        />
      )}
    </div>
  )
}

/* ------------------------------- sub-views -------------------------------- */

/* Shown while the engine is writing. As soon as the first fields land we stop
   pretending to load and start showing the real thing, so the wait feels like
   reading rather than waiting. */
function ResultSkeleton({ live, chars }: { live: PartialFields | null; chars: number }) {
  if (!live) {
    return (
      <Card className="card--pad-lg">
        <div className="row" style={{ marginBottom: 16 }}>
          <div className="skeleton" style={{ width: 130, height: 14 }} />
          <div className="right skeleton" style={{ width: 70, height: 14 }} />
        </div>
        <div className="skeleton skeleton-line" style={{ width: '92%' }} />
        <div className="skeleton skeleton-line" style={{ width: '86%' }} />
        <div className="skeleton skeleton-line" style={{ width: '95%' }} />
        <div className="skeleton skeleton-line" style={{ width: '72%' }} />
        <div className="skeleton skeleton-line" style={{ width: '88%' }} />
        <div className="row" style={{ marginTop: 20 }}>
          <div className="pulse-dot" />
          <span className="tiny muted">
            {chars > 0 ? `Receiving the first lines… ${chars} characters` : 'Thinking…'}
          </span>
        </div>
      </Card>
    )
  }

  const preview = live.prompt || live.objective || live.brief || ''

  return (
    <Card className="card--pad-lg live-card">
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="live-badge">
          <span className="pulse-dot" />
          Writing
        </span>
        <span className="right tiny muted">{preview.length.toLocaleString()} characters</span>
      </div>

      <h3 className="live-card__title">{live.title || 'Untitled prompt'}</h3>
      {live.objective && <p className="live-card__objective">{live.objective}</p>}

      {preview && (
        <div className="live-card__body">
          <pre className="live-card__pre">
            {preview}
            <span className="live-caret" />
          </pre>
        </div>
      )}

      {!!live.assumptions?.length && (
        <div className="live-card__list">
          {live.assumptions.map((a, i) => (
            <span key={i} className="live-chip">
              {a}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function ClarifyModal({
  data,
  answers,
  onChange,
  onSkip,
  onSubmit,
}: {
  data: ClarifyResult
  answers: Record<number, string>
  onChange: (i: number, v: string) => void
  onSkip: () => void
  onSubmit: () => void
}) {
  return (
    <Modal
      title="Two quick things"
      onClose={onSkip}
      footer={
        <>
          <Button variant="ghost" onClick={onSkip}>
            Skip — use smart defaults
          </Button>
          <Button variant="primary" icon="spark" onClick={onSubmit}>
            Generate prompt
          </Button>
        </>
      }
    >
      <p className="muted tiny" style={{ marginTop: 0 }}>
        {data.reason || 'These answers will materially change the prompt.'} Leave anything blank and
        the engine will assume a sensible default.
      </p>
      <div className="stack" style={{ marginTop: 14 }}>
        {data.questions.slice(0, 3).map((q, i) => (
          <Field key={i} label={q}>
            <input
              className="input"
              value={answers[i] || ''}
              onChange={(e) => onChange(i, e.target.value)}
              placeholder="Your answer (optional)"
              autoFocus={i === 0}
            />
          </Field>
        ))}
      </div>
    </Modal>
  )
}

function ResultPanel({
  result,
  words,
  chars,
  onSave,
  onRegenerate,
  onRefine,
  onAnalyze,
  onEditInLab,
  saved,
}: {
  result: GeneratedPrompt
  words: number
  chars: number
  onSave: () => void
  onRegenerate: () => void
  onRefine: (a: 'improve' | 'expand' | 'simplify') => void
  onAnalyze: () => void
  onEditInLab: () => void
  saved: boolean
}) {
  const avg = Math.round(
    (result.quality.clarity + result.quality.completeness + result.quality.specificity) / 3
  )

  return (
    <Card className="card--pad-lg">
      <div className="row" style={{ alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div className="grow">
          <h3 style={{ fontSize: 16.5, marginBottom: 5 }}>{result.title}</h3>
          <div className="chips">
            <span className="tag tag--primary">{result.category}</span>
            <span className="tag">{result.targetModel} capability</span>
            {result.source === 'local' && <span className="tag tag--warning">local engine</span>}
          </div>
        </div>
        <div className="score" style={{ alignSelf: 'flex-start', flex: 'none' }} title="Average quality score">
          <Ring value={avg} label="Quality" />
        </div>
      </div>

      {result.objective && <p className="tiny muted" style={{ margin: '0 0 12px' }}>{result.objective}</p>}

      <div className="prompt-box">
        <div className="prompt-box__head">
          <Icon name="layers" size={13} style={{ color: 'var(--primary)' }} />
          <span className="tiny" style={{ fontWeight: 600 }}>
            Generated prompt
          </span>
          <span className="tiny muted right">
            {words} words · {chars} chars
          </span>
        </div>
        <div className="prompt-box__body">{result.prompt}</div>
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <CopyButton text={result.prompt} />
        <Button icon={saved ? 'check' : 'save'} onClick={onSave} disabled={saved}>
          {saved ? 'Saved' : 'Save to library'}
        </Button>
        <Button icon="refresh" onClick={onRegenerate}>
          Regenerate
        </Button>
        <Button
          icon="download"
          variant="ghost"
          onClick={() => download(`${slug(result.title)}.txt`, result.prompt)}
          title="Download as .txt"
        />
      </div>

      <hr className="divider" />

      <div className="stack">
        <div>
          <div className="row row--between" style={{ marginBottom: 8 }}>
            <span className="field__label">Quality breakdown</span>
            <span className="tiny muted">avg {avg}/100</span>
          </div>
          <div className="stack stack-sm">
            <Meter value={result.quality.clarity} label="Clarity" />
            <Meter value={result.quality.completeness} label="Completeness" />
            <Meter value={result.quality.specificity} label="Specificity" />
          </div>
        </div>

        {result.assumptions.length > 0 && (
          <div>
            <div className="field__label" style={{ marginBottom: 6 }}>
              Assumptions made
            </div>
            <ul className="tiny muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.65 }}>
              {result.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {result.tips && result.tips.length > 0 && (
          <div>
            <div className="field__label" style={{ marginBottom: 6 }}>
              Tips
            </div>
            <ul className="tiny muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.65 }}>
              {result.tips.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="btn-row">
          <Button size="sm" icon="lab" onClick={() => onRefine('improve')}>
            Refine in Lab
          </Button>
          <Button size="sm" icon="analyzer" variant="ghost" onClick={onAnalyze}>
            Analyze
          </Button>
          <Button size="sm" icon="edit" variant="ghost" onClick={onEditInLab}>
            Edit prompt
          </Button>
        </div>
      </div>
    </Card>
  )
}
