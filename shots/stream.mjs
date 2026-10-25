/* Streaming UI check.
 *
 * The packaged app gets its data over Electron IPC, which Playwright cannot
 * drive, so we install a stand-in bridge that behaves exactly like the real
 * one: it pushes deltas slowly and then resolves with the parsed answer. If the
 * live panel renders during the stream and the finished panel replaces it, the
 * wiring is correct.
 */
import { chromium } from 'playwright'

const CANDIDATE = JSON.stringify({
  title: 'iOS Habit Tracker — Build Prompt',
  category: 'Apps',
  objective:
    'Ship a native iOS habit tracker with streaks, smart reminders and an offline-first data layer, built for one-handed daily use.',
  brief: 'Native iOS, SwiftUI, local-first storage, reminders tuned to the user’s routine.',
  prompt:
    'ROLE\nYou are a senior iOS engineer and product designer building a habit tracker for iPhone.\n\nGOAL\nDeliver a native SwiftUI app where a user can create a habit in under 10 seconds and keep a visible streak without effort.\n\nCONTEXT\nAudience: busy adults aged 25–45 who abandon trackers because logging feels like homework.\nConstraints: iOS 17+, offline-first, no account required, App Store review compliant.\n\nREQUIREMENTS\n1. Onboarding: three screens maximum, one habit created before the first launch ends.\n2. Habit model: id, title, icon, cadence (daily/weekly), target count, reminder time, streak, history.\n3. Logging: one tap from the lock screen or widget; haptics on success; undo within five seconds.\n4. Reminders: local notifications that adapt to the user’s average completion hour.\n5. States: empty, loading, offline, error, and a completed-today state for every screen.\n6. Accessibility: VoiceOver labels, dynamic type up to XXL, 44pt minimum tap targets.\n\nOUTPUT FORMAT\nReturn SwiftUI view hierarchy, the data model, notification scheduling logic, and acceptance tests as a numbered build plan.',
  assumptions: [
    'Targets iPhone first; iPad layout deferred.',
    'No cloud sync in v1 — local storage only.',
    'Reminder timing is learned from completion history.',
  ],
  tips: ['Log a habit in one tap from the widget.', 'Keep the streak visible on the home screen.'],
  quality: { clarity: 9, completeness: 8, specificity: 9 },
})

const SETTINGS = {
  hasKey: true,
  keyHint: 'AQ.Ab8••••f3Qd',
  keySource: 'builtin',
  tier: 'medium',
  temperature: 0.7,
  theme: 'obsidian',
  defaultCategory: 'General',
  dataDir: 'C:/Users/you/AppData/Roaming/Spark',
  encryption: 'AES-sealed vault',
  hasBuiltIn: true,
  tiers: [
    { id: 'low', label: 'Low', note: 'Fastest responses, lightest reasoning' },
    { id: 'medium', label: 'Medium', note: 'Balanced depth and speed — recommended' },
    { id: 'high', label: 'High', note: 'Deepest reasoning, slower and more thorough' },
  ],
}

const browser = await chromium.launch({
  executablePath: '/home/user/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
})
const [vw, vh] = (process.argv[2] || '1440x900').split('x').map(Number)
const page = await browser.newPage({ viewport: { width: vw, height: vh } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

await page.addInitScript(
  ({ settings, answer }) => {
    const store = { ...settings }
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    window.spark = {
      isDesktop: true,
      settings: {
        get: async () => store,
        setKey: async () => store,
        update: async (p) => Object.assign(store, p),
        testKey: async () => ({ ok: true, message: 'Connection is healthy — Spark is ready.' }),
      },
      // Emit the answer in 40-character slices, then resolve like the real bridge.
      engineStream: async (kind, payload, onEvent) => {
        if (kind === 'clarify') return { ok: true, data: { needsClarification: false, questions: [] } }
        await sleep(250)
        for (let i = 0; i < answer.length; i += 40) {
          const delta = answer.slice(i, i + 40)
          onEvent({ delta, received: Math.min(answer.length, i + 40) })
          await sleep(28)
        }
        return { ok: true, data: JSON.parse(answer) }
      },
      engine: async (kind, payload) => window.spark.engineStream(kind, payload, () => {}),
      app: {
        info: async () => ({ version: '1.0.0', platform: 'win32', dataDir: 'C:/x', electron: '33' }),
        openExternal: async () => {},
        clearLocalData: async () => ({ ok: true }),
      },
      win: { minimize() {}, maximize() {}, close() {} },
    }
  },
  { settings: SETTINGS, answer: CANDIDATE }
)

await page.goto('http://127.0.0.1:5176', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.fill('textarea', 'Build a habit tracking app for iOS with streaks and reminders')
await page.waitForTimeout(300)
await page.click('button:has-text("Generate prompt")')

// Mid-stream: the live panel must be visible with real text in it.
await page.waitForTimeout(900)
const mid = await page.evaluate(() => {
  const card = document.querySelector('.live-card')
  const pre = document.querySelector('.live-card__pre')
  return {
    liveVisible: !!card,
    chars: pre ? pre.textContent.length : 0,
    badge: document.querySelector('.live-badge')?.textContent?.trim() || '',
    title: document.querySelector('.live-card__title')?.textContent || '',
    studioScroll: (() => {
      const el = document.querySelector('.view') || document.scrollingElement
      return el ? el.scrollHeight - el.clientHeight : -1
    })(),
  }
})
await page.screenshot({ path: `shots/stream-live-${vw}x${vh}.png` })

// Finished: the live panel must give way to the structured result.
await page.waitForTimeout(2600)
const done = await page.evaluate(() => ({
  liveGone: !document.querySelector('.live-card'),
  hasResult: !!document.querySelector('.result-card, .rp, .result-panel') ||
    document.body.innerText.includes('iOS Habit Tracker'),
  bodyChars: document.body.innerText.length,
}))
await page.screenshot({ path: `shots/stream-done-${vw}x${vh}.png` })
console.log(JSON.stringify({ mid, done, errs }, null, 2))
await browser.close()
