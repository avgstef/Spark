import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto('http://127.0.0.1:5176', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shots/g-studio.png' })

// generate locally to show a result panel
await page.fill('textarea', 'Build a Windows game optimisation app that scans installed games and recommends graphics settings')
await page.click('button:has-text("Generate prompt")')
await page.waitForTimeout(1800)
if (await page.locator('button:has-text("Skip")').count()) {
  await page.click('button:has-text("Skip")'); await page.waitForTimeout(1800)
}
await page.screenshot({ path: 'shots/g-result.png' })

for (const [label, file] of [['Templates','g-templates'],['Prompt Lab','g-lab'],['Library','g-library'],['Settings','g-settings']]) {
  await page.click(`.nav-link:has-text("${label}")`)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `shots/${file}.png` })
}
console.log(JSON.stringify({ errs }))
await browser.close()
