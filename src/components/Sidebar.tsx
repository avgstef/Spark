import { Icon, Logo } from './Icon'
import type { IconName } from './Icon'
import { useApp } from '../lib/appState'
import type { Route } from '../lib/appState'

interface NavEntry {
  id: Route
  label: string
  icon: IconName
}

interface NavSection {
  title: string
  items: NavEntry[]
}

/* Grouped by intent: make something, keep track of it, tune the app. */
const SECTIONS: NavSection[] = [
  {
    title: 'Create',
    items: [
      { id: 'studio', label: 'Studio', icon: 'boltSpark' },
      { id: 'lab', label: 'Prompt Lab', icon: 'flask' },
    ],
  },
  {
    title: 'Collect',
    items: [
      { id: 'library', label: 'Library', icon: 'archive' },
      { id: 'history', label: 'History', icon: 'timeline' },
    ],
  },
  {
    title: 'Explore',
    items: [
      { id: 'templates', label: 'Templates', icon: 'gallery' },
      { id: 'analyzer', label: 'Quality Analyzer', icon: 'gauge' },
    ],
  },
  {
    title: 'System',
    items: [{ id: 'settings', label: 'Settings', icon: 'gear' }],
  },
]

export function Sidebar() {
  const { route, navigate, library, history, settings } = useApp()

  const badgeFor = (id: Route) =>
    id === 'library' ? library.length : id === 'history' ? history.length : 0

  const activeTier =
    settings.tiers?.find((t) => t.id === settings.tier)?.label ??
    settings.tier.charAt(0).toUpperCase() + settings.tier.slice(1)

  let delay = 0

  return (
    <aside className="sidebar">
      <div className="side-brand">
        <div className="side-brand__mark">
          <Logo size={21} />
        </div>
        <div>
          <div className="side-brand__text">Spark</div>
          <span className="side-brand__sub">Prompt Studio</span>
        </div>
      </div>

      <button className="side-new" onClick={() => navigate('studio')}>
        <Icon name="plus" size={15} strokeWidth={2.4} />
        New prompt
      </button>

      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="side-group">{section.title}</div>
          <div className="side-nav">
            {section.items.map((item) => {
              const count = badgeFor(item.id)
              delay += 0.045
              return (
                <button
                  key={item.id}
                  className={`nav-link ${route === item.id ? 'nav-link--active' : ''}`}
                  onClick={() => navigate(item.id)}
                  title={item.label}
                  style={{ animationDelay: `${delay}s` }}
                >
                  <span className="nav-link__icon">
                    <Icon name={item.icon} size={15} />
                  </span>
                  <span>{item.label}</span>
                  {count > 0 && <span className="nav-link__badge">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="side-status">
        {settings.hasKey ? (
          <>
            <div className="side-status__row">
              <span className="live-dot" />
              Engine ready
            </div>
            <div className="side-status__meta">
              Capability: <strong style={{ color: 'var(--text-2)' }}>{activeTier}</strong>
              {settings.keySource === 'built-in' && ' · built-in'}
            </div>
          </>
        ) : (
          <>
            <div className="side-status__row">
              <Icon name="key" size={13} style={{ color: 'var(--warning)' }} />
              Local mode
            </div>
            <div className="side-status__meta">
              Running on the offline engine until a key is added.
            </div>
            <button className="side-status__link" onClick={() => navigate('settings')}>
              Connect engine
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
