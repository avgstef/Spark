import type { SVGProps } from 'react'

export type IconName =
  | 'spark'
  | 'studio'
  | 'lab'
  | 'library'
  | 'history'
  | 'templates'
  | 'analyzer'
  | 'settings'
  | 'search'
  | 'copy'
  | 'check'
  | 'download'
  | 'trash'
  | 'star'
  | 'plus'
  | 'x'
  | 'min'
  | 'max'
  | 'close'
  | 'code'
  | 'globe'
  | 'apps'
  | 'image'
  | 'pen'
  | 'chart'
  | 'shield'
  | 'key'
  | 'brain'
  | 'arrowRight'
  | 'refresh'
  | 'wand'
  | 'alert'
  | 'info'
  | 'chevron'
  | 'external'
  | 'tag'
  | 'save'
  | 'edit'
  | 'lock'
  | 'zap'
  | 'send'
  | 'grid'
  | 'clock'
  | 'user'
  | 'layers'
  | 'sliders'
  | 'compass'
  | 'flask'
  | 'archive'
  | 'timeline'
  | 'gallery'
  | 'gauge'
  | 'gear'
  | 'boltSpark'

const PATHS: Record<IconName, JSX.Element> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5 4.5-1.9z" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3h5M11 3v4.2L5.8 16a3.2 3.2 0 0 0 2.8 4.8h6.8a3.2 3.2 0 0 0 2.8-4.8L13 7.2V3" />
      <path d="M8 13.5h8" />
      <circle cx="10.5" cy="16.5" r=".8" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="17.8" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4.5" rx="1.5" />
      <path d="M4.5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h12A1.5 1.5 0 0 0 19.5 19V8.5" />
      <path d="M10 12.5h4" />
    </>
  ),
  timeline: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3.2 1.9" />
      <path d="M12 3v1.5M21 12h-1.5M12 21v-1.5M3 12h1.5" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="3" width="8.2" height="8.2" rx="2" />
      <rect x="12.8" y="3" width="8.2" height="5" rx="2" />
      <rect x="12.8" y="9.8" width="8.2" height="11.2" rx="2" />
      <rect x="3" y="12.8" width="8.2" height="8.2" rx="2" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 18a8.5 8.5 0 1 1 16 0" />
      <path d="m12 14 3.6-3.6" />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none" />
      <path d="M4 18h2M18 18h2M12 5.5V4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.2 13.9a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 0 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 0 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a1.9 1.9 0 0 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a1.9 1.9 0 0 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 0 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  boltSpark: (
    <>
      <path d="M12 2.5 13.9 8 19 9.5l-4.4 3.6.4 5.4-3-2.3-3 2.3.4-5.4L5 9.5 10.1 8 12 2.5z" />
    </>
  ),

  spark: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />,
  studio: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 9v11" />
    </>
  ),
  lab: (
    <>
      <path d="M9 3h6M10 3v5.5L5.6 16a3 3 0 0 0 2.6 4.5h7.6a3 3 0 0 0 2.6-4.5L14 8.5V3" />
      <path d="M7.5 14h9" />
    </>
  ),
  library: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  templates: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </>
  ),
  analyzer: (
    <>
      <path d="M12 21a9 9 0 1 1 9-9" />
      <path d="M12 12l4.5-3.2" />
      <path d="M21 12h-3" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="18" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
  check: <path d="m4 12.5 5 5L20 6.5" />,
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  star: <path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9L12 3.5z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  min: <path d="M5 12h14" />,
  max: <rect x="5.5" y="5.5" width="13" height="13" rx="1.6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  code: (
    <>
      <path d="m9 17-5-5 5-5" />
      <path d="m15 7 5 5-5 5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
    </>
  ),
  apps: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
    </>
  ),
  pen: (
    <>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z" />
      <path d="m14 6 4 4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 9 9M17 17l2-2M20 14l1.5 1.5" />
    </>
  ),
  brain: (
    <>
      <path d="M9.5 4.5A3 3 0 0 0 6.5 7.5 3 3 0 0 0 5 13a3 3 0 0 0 1.6 4.6A3 3 0 0 0 12 19V5.5a2 2 0 0 0-2.5-1z" />
      <path d="M14.5 4.5a3 3 0 0 1 3 3A3 3 0 0 1 19 13a3 3 0 0 1-1.6 4.6A3 3 0 0 1 12 19" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 6" />
      <path d="M20 4v7h-7" />
    </>
  ),
  wand: (
    <>
      <path d="M4 20 16 8" />
      <path d="M14 4h.01M19 9h.01M20 4h.01M9 4h.01" />
      <path d="m15 3 1.2 2.8L19 7l-2.8 1.2L15 11l-1.2-2.8L11 7l2.8-1.2L15 3z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 12 22 2 12V3h9l9.6 9.6a1.4 1.4 0 0 1 0 2z" />
      <circle cx="7" cy="8" r="1.4" />
    </>
  ),
  save: (
    <>
      <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4z" />
      <path d="M8 4v6h7V4M8 20v-5h8v5" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
  send: (
    <>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3z" />
    </>
  ),
  grid: (
    <>
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  sliders: (
    <>
      <path d="M6 4v6M6 14v6M12 4v10M12 18v2M18 4v2M18 10v10" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="12" cy="16" r="2" />
      <circle cx="18" cy="8" r="2" />
    </>
  ),
}

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  filled?: boolean
}

export function Icon({ name, size = 16, filled, strokeWidth = 1.7, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}

/** The Spark mark — a faceted four-point star with a glowing core. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="spark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff4de" />
          <stop offset="45%" stopColor="#ffd166" />
          <stop offset="100%" stopColor="#b8791f" />
        </linearGradient>
        <radialGradient id="spark-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#ffd68c" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#c8891f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#spark-core)" />
      <path
        d="M16 2c.5 5.4 3.3 9.9 7.6 12.3 3.7 2 6.6 2.4 6.6 2.7 0 .3-2.9.7-6.6 2.7C19.3 22.1 16.5 26.6 16 32c-.5-5.4-3.3-9.9-7.6-12.3C4.7 17.7 1.8 17.3 1.8 17c0-.3 2.9-.7 6.6-2.7C12.7 11.9 15.5 7.4 16 2z"
        fill="url(#spark-g)"
        transform="scale(0.94) translate(1 1)"
      />
      <circle cx="24.6" cy="7.4" r="1.5" fill="#fff1cf" opacity="0.95" />
    </svg>
  )
}
