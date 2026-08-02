// 1. Desktop landscape viewport: play screen must fill the window unrotated.
// 2. Swipe through a Classic round and screenshot periodically to confirm
//    bombs show up at the guaranteed cadence.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('fruit-rush-onboarded', '1')
  sessionStorage.setItem('fruit-rush-guest', '1')
})
await page.goto('http://localhost:5173/modes', { waitUntil: 'networkidle' })
await page.click('[aria-label="Classic"]')
await page.waitForSelector('.play-countdown', { timeout: 15_000 })
console.log('rotated on desktop:', (await page.locator('.play-screen--rotated').count()) > 0)
await page.waitForSelector('.play-countdown', { state: 'detached', timeout: 15_000 })
await page.waitForTimeout(600)

async function swipe() {
  const yMid = 380 + Math.random() * 240
  await page.mouse.move(30, yMid)
  await page.mouse.down()
  let up = true
  for (let x = 30; x <= 1250; x += 120) {
    await page.mouse.move(x, yMid + (up ? -100 : 100), { steps: 3 })
    up = !up
  }
  await page.mouse.up()
}

const start = Date.now()
let shots = 0
while (Date.now() - start < 22_000 && shots < 10) {
  if ((await page.locator('.results-screen').count()) > 0) break
  await swipe()
  shots += 1
  await page.screenshot({ path: `/tmp/desk-${shots}.png` })
  const score = await page.locator('.play-hud__score').innerText().catch(() => 'ended')
  console.log(`desk shot ${shots} | score ${score} | t=${Math.round((Date.now() - start) / 1000)}s`)
}
const onResults = (await page.locator('.results-screen').count()) > 0
console.log('on results:', onResults)
if (onResults) await page.screenshot({ path: '/tmp/desk-results.png' })
await browser.close()
console.log('done')
