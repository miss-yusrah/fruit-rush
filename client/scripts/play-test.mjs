// Plays a full round like a real user: home -> modes -> Classic -> swipes
// until the round ends -> results -> boast -> home -> shop/compete/profile.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const url = () => new URL(page.url()).pathname
const shot = (name) => page.screenshot({ path: `/tmp/play-${name}.png` })

async function swipe() {
  // The play screen renders rotated (landscape) on this portrait viewport:
  // the fruit arc zone runs down the physical screen, so slash vertically.
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

// Pre-seed onboarded + guest so Play skips the connect gate in this test.
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('fruit-rush-onboarded', '1')
  sessionStorage.setItem('fruit-rush-guest', '1')
})

await page.goto('http://localhost:5173/home', { waitUntil: 'networkidle' })
await shot('1-home')
console.log('home:', url())

await page.click('[aria-label="Play"]')
await shot('2-modes')
console.log('modes:', url())

await page.click('[aria-label="Classic"]')
console.log('play:', url())
// Countdown appears once assets load, then disappears when play starts.
await page.waitForSelector('.play-countdown', { timeout: 15_000 })
await page.waitForSelector('.play-countdown', { state: 'detached', timeout: 15_000 })

// Slash until the round ends (Classic = 60s timer, or 3 missed fruit).
const start = Date.now()
let midShotTaken = false
while (Date.now() - start < 75_000) {
  if ((await page.locator('.results-screen').count()) > 0) break
  await swipe()
  if (!midShotTaken && Date.now() - start > 4_000) {
    const score = await page.locator('.play-hud__score').innerText().catch(() => '?')
    console.log('mid-game score:', score)
    await shot('3-gameplay')
    midShotTaken = true
  }
}

await page.waitForSelector('.results-screen', { timeout: 10_000 })
const finalScore = await page.locator('.results-screen__score').innerText()
console.log('results:', url(), '| final score:', finalScore)
await shot('4-results')

const boastBtn = page.locator('text=Boast it')
if ((await boastBtn.count()) > 0) {
  await boastBtn.click()
  await page.waitForTimeout(400)
  console.log('boast:', url())
  await shot('5-boast')
  await page.click('[aria-label="Not now"]')
  await page.waitForTimeout(300)
  console.log('after Not now:', url())
} else {
  console.log('score was 0 — no boast button, going Home')
  await page.click('.results-screen >> text=Home')
  await page.waitForTimeout(300)
}

// Hub navigation: home -> shop -> compete -> profile.
await page.click('[aria-label="Shop"]')
await page.waitForTimeout(300)
console.log('shop:', url())
await shot('6-shop')

await page.click('[aria-label="Compete"]')
await page.waitForTimeout(300)
console.log('tournaments:', url())
await shot('7-tournaments')

await page.click('.art-nav >> text=Profile')
await page.waitForTimeout(300)
console.log('profile:', url())
await shot('8-profile')

await browser.close()
console.log('done')
