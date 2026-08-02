// Diagnostic: start a Classic round, do deliberate full-width swipes,
// log the HUD score and any page errors.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text())
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto('http://localhost:5173/modes', { waitUntil: 'networkidle' })
await page.click('[aria-label="Classic"]')
await page.waitForTimeout(4200)
await page.screenshot({ path: '/tmp/dbg-1-start.png' })

for (let i = 0; i < 20; i++) {
  const y = 300 + Math.random() * 300
  await page.mouse.move(20, y)
  await page.mouse.down()
  await page.mouse.move(370, y - 60, { steps: 14 })
  await page.mouse.up()
  const score = await page.locator('.play-hud__score').innerText().catch(() => 'gone')
  const lives = await page
    .locator('.play-hud__lives .life.is-on')
    .count()
    .catch(() => -1)
  console.log(`swipe ${i}: score=${score} lives=${lives}`)
  if (i === 6) await page.screenshot({ path: '/tmp/dbg-2-mid.png' })
  if (score === 'gone') break
  await page.waitForTimeout(500)
}

await page.screenshot({ path: '/tmp/dbg-3-end.png' })
await browser.close()
