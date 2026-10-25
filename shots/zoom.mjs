import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:5176', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const feat = page.locator('.hero-features')
await feat.screenshot({ path: 'shots/zoom-features.png' })
console.log('features box:', JSON.stringify(await feat.boundingBox()))

const tier = page.locator('.tier-grid')
await tier.screenshot({ path: 'shots/zoom-tiers.png' })

// measure text overflow inside each feature
const info = await page.evaluate(() => {
  const out = []
  document.querySelectorAll('.hero-feature').forEach((el) => {
    const b = el.getBoundingClientRect()
    const icon = el.querySelector('.hero-feature__icon').getBoundingClientRect()
    const title = el.querySelector('b').getBoundingClientRect()
    const desc = el.querySelector('span:not(.hero-feature__icon)').getBoundingClientRect()
    out.push({
      w: Math.round(b.width), h: Math.round(b.height),
      iconW: Math.round(icon.width),
      titleH: Math.round(title.height),
      descH: Math.round(desc.height),
      gapTitleDesc: Math.round(desc.top - title.bottom),
    })
  })
  return out
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
