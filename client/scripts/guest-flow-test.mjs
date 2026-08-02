// Verifies the connect-or-guest gate on Play, the guest note on modes,
// and the rotated (landscape) gameplay on a portrait phone viewport —
// including that swipes still register through the rotated pointer mapping.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

// Fresh session, but already onboarded so we land on the hub flow.
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('fruit-rush-onboarded', '1')
  sessionStorage.clear()
})

// 1. Home → Play must gate through connect.
await page.goto('http://localhost:5173/home', { waitUntil: 'networkidle' })
await page.click('[aria-label="Play"]')
await page.waitForURL('**/connect')
console.log('play gated to:', new URL(page.url()).pathname)
await page.screenshot({ path: '/tmp/flow-1-connect-gate.png' })

// 2. Continue as guest → modes with guest note.
await page.click('text=Continue as guest')
await page.waitForURL('**/modes')
const noteVisible = await page.locator('.modes-guest-note').isVisible()
console.log('modes url:', new URL(page.url()).pathname, '| guest note visible:', noteVisible)
await page.screenshot({ path: '/tmp/flow-2-modes-guest.png' })

// 3. Classic → rotated play screen, countdown shows round info.
await page.click('[aria-label="Classic"]')
await page.waitForSelector('.play-countdown', { timeout: 15_000 })
const rotated = await page.locator('.play-screen--rotated').count()
const info = await page.locator('.play-countdown__info').innerText().catch(() => '?')
console.log('rotated class applied:', rotated > 0, '| countdown info:', JSON.stringify(info))
await page.screenshot({ path: '/tmp/flow-3-countdown.png' })
await page.waitForSelector('.play-countdown', { state: 'detached', timeout: 15_000 })
await page.waitForTimeout(700)

// Rotated swipe: the game's horizontal axis runs down the physical screen,
// so slash by sweeping vertically with a zigzag across screen-x.
async function swipe() {
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

let shots = 0
const start = Date.now()
while (Date.now() - start < 25_000 && shots < 5) {
  if ((await page.locator('.results-screen').count()) > 0) break
  await swipe()
  shots += 1
  await page.screenshot({ path: `/tmp/flow-4-game-${shots}.png` })
  const score = await page.locator('.play-hud__score').innerText().catch(() => 'ended')
  const timer = await page.locator('.play-hud__timer').innerText().catch(() => '?')
  console.log(`swipe ${shots} | score: ${score} | timer: ${timer}`)
}

// 4. Exit → modes → home → Play again should skip connect (guest remembered).
if ((await page.locator('.play-hud__exit').count()) > 0) {
  await page.click('.play-hud__exit')
  await page.waitForURL('**/modes')
  await page.click('[aria-label="Back"]')
  await page.waitForURL('**/home')
  await page.click('[aria-label="Play"]')
  await page.waitForTimeout(400)
  console.log('second play tap lands on:', new URL(page.url()).pathname)
}

await browser.close()
console.log('done')
