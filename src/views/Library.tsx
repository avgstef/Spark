import { useMemo, useState } from 'react'
import { useApp } from '../lib/appState'
import type { SavedPrompt } from '../lib/types'
import { download } from '../lib/storage'
import { Icon } from '../components/Icon'
import { Button, Card, CopyButton, Empty, Field, Modal, Segmented } from '../components/ui'

export function Library() {
  const { library, removeFromLibrary, updateSaved, navigate, setHandoff, toast } = useApp()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'favorites'>('all')
  const [sort, setSort] = useState<'new' | 'az' | 'score'>('new')
  const [open, setOpen] = useState<SavedPrompt | null>(null)
  const [tagDraft, setTagDraft] = useState('')

  const items = useMemo(() => {
    let list = [...library]
    if (filter === 'favorites') list = list.filter((p) => p.favorite)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.prompt.toLowerCase().includes(q) ||
          p.tags.join(' ').toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
    }
    if (sort === 'new') list.sort((a, b) => b.createdAt - a.createdAt)
    if (sort === 'az') list.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'score')
      list.sort(
        (a, b) =>
          b.quality.clarity + b.quality.completeness + b.quality.specificity -
          (a.quality.clarity + a.quality.completeness + a.quality.specificity)
      )
    return list
  }, [library, filter, query, sort])

  const exportAll = () => {
    const md = library
      .map(
        (p) =>
          `# ${p.title}\n\n_${p.category} · ${p.targetModel} · saved ${new Date(p.createdAt).toLocaleDateString()}_\n\n\`\`\`\n${p.prompt}\n\`\`\`\n`
      )
      .join('\n---\n\n')
    download('spark-library.md', `# Spark library\n\n${md}`, 'text/markdown')
    toast('Exported library as Markdown', 'success')
  }

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">
          <Icon name="library" size={12} /> Library
        </div>
        <h1>Your saved prompts</h1>
        <p>
          Everything you save stays on this machine. Tag it, favourite it, and reuse it as a
          starting point.
        </p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="grow row" style={{ gap: 8, minWidth: 220 }}>
            <Icon name="search" size={15} style={{ color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ border: 0, background: 'transparent', paddingLeft: 0 }}
              placeholder="Search titles, prompts, tags…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Segmented
            options={[{ id: 'all' as const }, { id: 'favorites' as const }]}
            value={filter}
            onChange={setFilter}
          />
          <select className="select" style={{ width: 150 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="new">Newest first</option>
            <option value="az">A → Z</option>
            <option value="score">Highest score</option>
          </select>
          <Button icon="download" variant="ghost" onClick={exportAll} disabled={!library.length}>
            Export
          </Button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Empty
          icon="library"
          title={library.length ? 'Nothing matches that filter' : 'No saved prompts yet'}
          action={
            <Button variant="primary" icon="spark" onClick={() => navigate('studio')}>
              Create your first prompt
            </Button>
          }
        >
          {library.length
            ? 'Try a different search term or switch back to All.'
            : 'Generate a prompt in Studio and hit Save to library — it will show up here with its tags and score.'}
        </Empty>
      ) : (
        <div className="grid grid-2">
          {items.map((p) => {
            const avg = Math.round(
              (p.quality.clarity + p.quality.completeness + p.quality.specificity) / 3
            )
            return (
              <Card key={p.id} className="stack" onClick={() => setOpen(p)}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="row" style={{ gap: 6, marginBottom: 5 }}>
                      <span className="tag tag--primary">{p.category}</span>
                      <span className="tag">{avg} score</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>{p.title}</div>
                  </div>
                  <button
                    className="btn btn--ghost btn--icon"
                    title={p.favorite ? 'Unfavourite' : 'Favourite'}
                    onClick={(e) => {
                      e.stopPropagation()
                      updateSaved(p.id, { favorite: !p.favorite })
                    }}
                    style={{ color: p.favorite ? 'var(--warning)' : 'var(--muted)' }}
                  >
                    <Icon name="star" size={15} filled={p.favorite} />
                  </button>
                </div>

                <div
                  className="tiny muted"
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {p.prompt}
                </div>

                <div className="row" style={{ gap: 6 }}>
                  {p.tags.slice(0, 3).map((t) => (
                    <span key={t} className="chip chip--static">
                      #{t}
                    </span>
                  ))}
                  <span className="tiny muted right">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {open && (
        <Modal
          title={open.title}
          onClose={() => setOpen(null)}
          footer={
            <>
              <Button
                variant="danger"
                icon="trash"
                onClick={() => {
                  removeFromLibrary(open.id)
                  setOpen(null)
                }}
              >
                Delete
              </Button>
              <Button
                icon="lab"
                variant="ghost"
                onClick={() => {
                  setHandoff({ target: 'lab', prompt: open.prompt, title: open.title })
                  navigate('lab')
                }}
              >
                Open in Lab
              </Button>
              <CopyButton text={open.prompt} size="lg" />
            </>
          }
        >
          <div className="row" style={{ gap: 6, marginBottom: 12 }}>
            <span className="tag tag--primary">{open.category}</span>
            <span className="tag">{open.targetModel}</span>
            <span className="tag">{open.outputStyle}</span>
            <span className="tag">{open.source === 'local' ? 'local' : 'ai'}</span>
          </div>

          <div className="prompt-box">
            <div className="prompt-box__body">{open.prompt}</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label="Tags" hint="Comma separated. Press Enter to save.">
              <input
                className="input"
                value={tagDraft || open.tags.join(', ')}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const tags = tagDraft
                      .split(',')
                      .map((t) => t.trim().toLowerCase())
                      .filter(Boolean)
                    updateSaved(open.id, { tags })
                    setTagDraft('')
                    setOpen({ ...open, tags })
                  }
                }}
              />
            </Field>
          </div>

          {open.assumptions.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="field__label" style={{ marginBottom: 5 }}>
                Assumptions
              </div>
              <ul className="tiny muted" style={{ margin: 0, paddingLeft: 18 }}>
                {open.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
