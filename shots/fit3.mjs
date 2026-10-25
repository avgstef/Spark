import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME })
for (const [w,h] of [[1440,900],[1280,800],[1366,768],[1100,700],[1600,1000]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto('http://127.0.0.1:5176', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  const m = await page.evaluate(() => {
    const main = document.querySelector('.main')
    return { excess: main.scrollHeight - main.clientHeight }
  })
  console.log(`${w}x${h}`, m.excess > 2 ? `OVERFLOW +${m.excess}px` : 'fits')
  await page.close()
}
await browser.close()
