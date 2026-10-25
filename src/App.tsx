import { useEffect } from 'react'
import { useApp } from './lib/appState'
import wallpaperUrl from './assets/spark-bg.jpg'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Icon } from './components/Icon'
import { Studio } from './views/Studio'
import { PromptLab } from './views/PromptLab'
import { Library } from './views/Library'
import { History } from './views/History'
import { Templates } from './views/Templates'
import { Analyzer } from './views/Analyzer'
import { Settings } from './views/Settings'

function Toasts() {
  const { toasts } = useApp()
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <Icon
            name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'}
            size={15}
          />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { route } = useApp()

  // The wallpaper ships with the app bundle, so it works offline and inside
  // the packaged exe (no remote URL, no CSP exceptions).
  useEffect(() => {
    document.documentElement.style.setProperty('--wallpaper', `url("${wallpaperUrl}")`)
  }, [])

  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />
      <TitleBar />
      <div className="workspace">
        <Sidebar />
        <main className="main">
          <div className="view" key={route}>
            {route === 'studio' && <Studio />}
            {route === 'lab' && <PromptLab />}
            {route === 'library' && <Library />}
            {route === 'history' && <History />}
            {route === 'templates' && <Templates />}
            {route === 'analyzer' && <Analyzer />}
            {route === 'settings' && <Settings />}
          </div>
        </main>
      </div>
      <Toasts />
    </div>
  )
}
