import { Logo, Icon } from './Icon'
import { isDesktop, bridge } from '../lib/api'

export function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar__brand">
        <Logo size={18} />
        <span>
          Spark
        </span>
        <span
          className="tag"
          style={{ height: 17, fontSize: 9.5, padding: '0 6px', letterSpacing: '0.06em' }}
        >
          BETA
        </span>
      </div>
      <div className="titlebar__spacer" />
      {isDesktop ? (
        <div className="win-actions">
          <button className="win-btn" onClick={() => bridge?.win.minimize()} aria-label="Minimize">
            <Icon name="min" size={14} />
          </button>
          <button className="win-btn" onClick={() => bridge?.win.maximize()} aria-label="Maximize">
            <Icon name="max" size={12} />
          </button>
          <button
            className="win-btn win-btn--close"
            onClick={() => bridge?.win.close()}
            aria-label="Close"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
