import { useMemo, useState } from 'react'
import { useApp } from '../lib/appState'
import { Icon } from '../components/Icon'
import { Button, Card, CopyButton, Empty, Modal, Segmented } from '../components/ui'

function relTime(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(ts).toLocaleDateString()
}

export function History() {
  const { history, clearHistory, removeHistory, saveToLibrary, navigate, setHandoff } = useApp()
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<'all' | 'today'>('all')
  const [open, setOpen] = useState<string | null>(null)

  const items = useMemo(() => {
    let list = history
    if (range === 'today') {
      const start = new Date().setHours(0, 0, 0, 0)
      list = list.filter((h) => h.createdAt >= start)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (h) => h.idea.toLowerCase().includes(q) || h.result.title.toLowerCase().includes(q)
      )
    }
    return list
  }, [history, query, range])

  const selected = history.find((h) => h.id === open) || null

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">
          <Icon name="history" size={12} /> History
        </div>
        <h1>Recent generations</h1>
        <p>
          Every run is recorded locally so you can jump back, restore an earlier version, or promote
          something into the library.
        </p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="grow row" style={{ gap: 8, minWidth: 200 }}>
            <Icon name="search" size={15} style={{ color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ border: 0, background: 'transparent', paddingLeft: 0 }}
              placeholder="Search past ideas…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Segmented
            options={[{ id: 'all' as const }, { id: 'today' as const }]}
            value={range}
            onChange={setRange}
          />
          <Button
            variant="danger"
            size="sm"
            icon="trash"
            onClick={clearHistory}
            disabled={!history.length}
          >
            Clear history
          </Button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Empty icon="clock" title="Nothing here yet">
          Generate a prompt in Studio and it will show up here, newest first.
        </Empty>
      ) : (
        <div className="stack">
          {items.map((h) => (
            <div key={h.id} className="list-row" style={{ padding: '12px 14px' }}>
              <div className="grow" style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => setOpen(h.id)}>
                <div className="row" style={{ gap: 7, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{h.result.title}</span>
                  <span className="tag tag--primary">{h.category}</span>
                  <span className="tag">{h.outputStyle}</span>
                </div>
                <div className="list-row__sub">{h.idea}</div>
              </div>
              <span className="tiny muted nowrap hide-sm">{relTime(h.createdAt)}</span>
              <Button
                size="sm"
                variant="ghost"
                icon="external"
                onClick={() => {
                  setHandoff({ target: 'studio', idea: h.idea })
                  navigate('studio')
                }}
                title="Reuse this idea"
              >
                Reuse
              </Button>
              <button
                className="btn btn--ghost btn--icon"
                title="Delete"
                onClick={() => removeHistory(h.id)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Modal
          title={selected.result.title}
          onClose={() => setOpen(null)}
          footer={
            <>
              <Button
                icon="save"
                onClick={() => {
                  saveToLibrary(selected.result)
                  setOpen(null)
                }}
              >
                Save to library
              </Button>
              <Button
                icon="lab"
                variant="ghost"
                onClick={() => {
                  setHandoff({ target: 'lab', prompt: selected.result.prompt, title: selected.result.title })
                  navigate('lab')
                }}
              >
                Open in Lab
              </Button>
              <CopyButton text={selected.result.prompt} size="lg" />
            </>
          }
        >
          <div className="tiny muted" style={{ marginBottom: 10 }}>
            <b style={{ color: 'var(--text-2)' }}>Idea:</b> {selected.idea}
          </div>
          <div className="prompt-box">
            <div className="prompt-box__body">{selected.result.prompt}</div>
          </div>
        </Modal>
      )}
    </div>
  )
}
