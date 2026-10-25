import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/home/user/.cache/ms-playwright/chromium-1140/chrome-linux/chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto('http://127.0.0.1:5176', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
await page.screenshot({ path: 'shots/gold-studio.png' })
const nav = async (label, file) => {
  await page.click(`.nav-link:has-text("${label}")`)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `shots/${file}` })
}
await nav('Templates', 'gold-templates.png')
await nav('Quality Analyzer', 'gold-analyzer.png')
await nav('Settings', 'gold-settings.png')
console.log(JSON.stringify({ errs }))
await browser.close()
