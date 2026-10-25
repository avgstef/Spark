import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

/* ------------------------------- primitives ------------------------------- */

export function Card({
  children,
  className = '',
  onClick,
  selected,
  style,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  selected?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      className={`card ${onClick ? 'card--hover' : ''} ${selected ? 'card--selected' : ''} ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}

type BtnVariant = 'default' | 'primary' | 'ghost' | 'danger'

export function Button({
  children,
  onClick,
  variant = 'default',
  size,
  icon,
  disabled,
  title,
  type = 'button',
  className = '',
  style,
}: {
  children?: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  size?: 'sm' | 'lg'
  icon?: IconName
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
  className?: string
  style?: CSSProperties
}) {
  return (
    <button
      type={type}
      className={`btn ${variant !== 'default' ? `btn--${variant}` : ''} ${size ? `btn--${size}` : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={style}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  onClick,
  title,
  size = 15,
}: {
  icon: IconName
  onClick?: () => void
  title: string
  size?: number
}) {
  return (
    <button className="btn btn--ghost btn--icon" onClick={onClick} title={title} aria-label={title}>
      <Icon name={icon} size={size} />
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  icons,
}: {
  options: readonly { id: T; hint?: string }[]
  value: T
  onChange: (v: T) => void
  icons?: Partial<Record<T, IconName>>
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.id}
          className={`chip ${value === o.id ? 'chip--active' : ''}`}
          onClick={() => onChange(o.id)}
          title={o.hint}
        >
          {icons?.[o.id] && <Icon name={icons[o.id]!} size={13} />}
          {o.id}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; hint?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.id}
          data-active={value === o.id}
          onClick={() => onChange(o.id)}
          title={o.hint}
        >
          {o.id}
        </button>
      ))}
    </div>
  )
}

export function Ring({
  value,
  size = 'md',
  label,
}: {
  value: number
  size?: 'sm' | 'md'
  label?: string
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={`ring ${size === 'sm' ? 'ring--sm' : ''}`}
      style={{ ['--p' as string]: v }}
      title={label ? `${label}: ${v}` : `${v}`}
    >
      <span>{v}</span>
    </div>
  )
}

export function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="score-row">
      <span className="muted tiny">{label}</span>
      <div className="meter">
        <i style={{ width: `${v}%` }} />
      </div>
      <b>{v}</b>
    </div>
  )
}

export function Notice({
  children,
  kind = 'info',
  icon = 'info',
}: {
  children: ReactNode
  kind?: 'info' | 'warning' | 'error' | 'success'
  icon?: IconName
}) {
  return (
    <div className={`notice notice--${kind}`}>
      <Icon name={icon} size={15} />
      <div>{children}</div>
    </div>
  )
}

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} />
      <h4>{title}</h4>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="row row--between" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16 }}>{title}</h3>
          <IconButton icon="x" title="Close" onClick={onClose} />
        </div>
        {children}
        {footer && <div className="btn-row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  )
}

/* --------------------------------- copy ----------------------------------- */

export function CopyButton({
  text,
  label = 'Copy',
  size = 'sm',
}: {
  text: string
  label?: string
  size?: 'sm' | 'lg'
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
  }

  return (
    <Button
      icon={copied ? 'check' : 'copy'}
      onClick={copy}
      variant={copied ? 'default' : 'primary'}
      size={size === 'sm' ? 'sm' : undefined}
      title="Copy to clipboard"
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}
