// Captures gameplay frames: swipes through the fruit zone and screenshots
// immediately after each slash to catch halves, juice, trail, and combo text.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

// Pre-seed onboarded + guest so Play skips the connect gate in this test.
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('fruit-rush-onboarded', '1')
  sessionStorage.setItem('fruit-rush-guest', '1')
})

await page.goto('http://localhost:5173/home', { waitUntil: 'networkidle' })
await page.click('[aria-label="Play"]')
await page.click('[aria-label="Classic"]')
// Countdown appears once assets load, then disappears when play starts.
await page.waitForSelector('.play-countdown', { timeout: 15_000 })
await page.waitForSelector('.play-countdown', { state: 'detached', timeout: 15_000 })
await page.waitForTimeout(700) // let the first wave rise into view

async function swipe() {
  // Rotated landscape play screen on a portrait viewport: slash vertically.
  const xMid = 120 + Math.random() * 160
  await page.mouse.move(xMid, 30)
  await page.mouse.down()
  let out = true
  for (let y = 30; y <= 810; y += 60) {
    await page.mouse.move(xMid + (out ? -85 : 85), y, { steps: 3 })
    out = !out
  }
  await page.mouse.up()
}

const start = Date.now()
let shots = 0
while (Date.now() - start < 30_000 && shots < 6) {
  if ((await page.locator('.results-screen').count()) > 0) break
  await swipe()
  shots += 1
  await page.screenshot({ path: `/tmp/game-${shots}.png` })
  const score = await page.locator('.play-hud__score').innerText().catch(() => '?')
  console.log(`shot ${shots} | score: ${score}`)
}

const endScore = await page.locator('.play-hud__score').innerText().catch(() => 'ended')
console.log('final hud score:', endScore)
await browser.close()
console.log('done')
