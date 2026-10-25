import { useMemo, useState } from 'react'
import { useApp } from '../lib/appState'
import { CATEGORIES, TEMPLATES } from '../lib/templates'
import type { Category } from '../lib/types'
import { Icon } from '../components/Icon'
import { Button, Card, CopyButton, Modal } from '../components/ui'

export function Templates() {
  const { navigate, setHandoff } = useApp()
  const [filter, setFilter] = useState<'All' | Category>('All')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const items = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const okCat = filter === 'All' || t.category === filter
      const q = query.trim().toLowerCase()
      const okQ =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.blurb.toLowerCase().includes(q) ||
        t.tags.join(' ').includes(q) ||
        t.idea.toLowerCase().includes(q)
      return okCat && okQ
    })
  }, [filter, query])

  const open = TEMPLATES.find((t) => t.id === openId) || null

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">
          <Icon name="templates" size={12} /> Templates
        </div>
        <h1>Reusable starting points</h1>
        <p>
          Sixteen seeds across every category. Load one into Studio and the engine builds the full
          prompt — these are ideas, not finished answers.
        </p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="grow row" style={{ gap: 8, minWidth: 200 }}>
            <Icon name="search" size={15} style={{ color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ border: 0, background: 'transparent', paddingLeft: 0 }}
              placeholder="Search templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="chips">
            <button className={`chip ${filter === 'All' ? 'chip--active' : ''}`} onClick={() => setFilter('All')}>
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`chip ${filter === c.id ? 'chip--active' : ''}`}
                onClick={() => setFilter(c.id as Category)}
              >
                {c.id}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-3">
        {items.map((t) => (
          <Card key={t.id} className="stack" onClick={() => setOpenId(t.id)}>
            <div className="row" style={{ gap: 6 }}>
              <span className="tag tag--primary">{t.category}</span>
              <span className="tag">{t.targetModel}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
            <div className="tiny muted" style={{ minHeight: 34 }}>
              {t.blurb}
            </div>
            <div className="row" style={{ gap: 5 }}>
              {t.tags.map((tag) => (
                <span key={tag} className="chip chip--static">
                  #{tag}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {!items.length && (
        <Card>
          <div className="tiny muted text-center" style={{ padding: 24 }}>
            No templates match that search.
          </div>
        </Card>
      )}

      {open && (
        <Modal
          title={open.name}
          onClose={() => setOpenId(null)}
          footer={
            <>
              <CopyButton text={open.idea} label="Copy seed idea" size="lg" />
              <Button
                variant="primary"
                icon="spark"
                onClick={() => {
                  setHandoff({ target: 'studio', idea: open.idea })
                  setOpenId(null)
                  navigate('studio')
                }}
              >
                Use in Studio
              </Button>
            </>
          }
        >
          <div className="row" style={{ gap: 6, marginBottom: 12 }}>
            <span className="tag tag--primary">{open.category}</span>
            <span className="tag">{open.targetModel}</span>
          </div>
          <p className="tiny muted" style={{ marginTop: 0 }}>
            {open.blurb}
          </p>
          <div className="prompt-box">
            <div className="prompt-box__body">{open.idea}</div>
          </div>
          <div className="notice notice--info" style={{ marginTop: 14 }}>
            <Icon name="info" size={15} />
            <div>
              This is the raw idea. Studio will expand it into a structured prompt with role,
              constraints and output format.
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
