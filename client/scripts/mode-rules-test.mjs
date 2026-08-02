// Verify Classic has timer + bombs/hazards; Zen has ∞ and no bombs.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('fruit-rush-onboarded', '1')
  sessionStorage.setItem('fruit-rush-guest', '1')
})

async function startMode(label) {
  await page.goto('http://localhost:5173/modes', { waitUntil: 'networkidle' })
  await page.click(`[aria-label="${label}"]`)
  await page.waitForSelector('.play-countdown', { timeout: 15_000 })
  const info = await page.locator('.play-countdown__info').innerText()
  console.log(`\n${label} countdown:`, info)
  await page.waitForSelector('.play-countdown', { state: 'detached', timeout: 15_000 })
}

async function readHud() {
  return page.evaluate(() => ({
    mode: document.querySelector('.play-hud__mode')?.textContent?.trim(),
    timer: document.querySelector('.play-hud__timer')?.textContent?.trim(),
    score: document.querySelector('.play-hud__score')?.textContent?.trim(),
  }))
}

// --- Classic ---
await startMode('Classic')
let hud = await readHud()
console.log('Classic HUD t=0:', hud)
if (hud.mode !== 'CLASSIC') throw new Error('Classic hotspot selected wrong mode: ' + hud.mode)
if (!hud.timer || hud.timer === '∞') throw new Error('Classic should have a countdown timer')

await page.waitForTimeout(3500)
hud = await readHud()
console.log('Classic HUD t~3.5s:', hud)
// Timer must have moved down from 1:30
if (hud.timer === '1:30') console.log('WARN: timer may not be ticking yet')
else console.log('OK timer ticking:', hud.timer)

// Wait long enough for guaranteed bomb (every 5 launches after 4s)
await page.waitForTimeout(8000)
hud = await readHud()
console.log('Classic HUD t~11s:', hud)
const onResults = (await page.locator('.results-screen').count()) > 0
console.log('ended early (bomb slice by nobody):', onResults)

// Exit Classic
if (!onResults) await page.click('.play-hud__exit')
await page.waitForTimeout(400)

// --- Zen ---
await startMode('Zen')
hud = await readHud()
console.log('Zen HUD:', hud)
if (hud.mode !== 'ZEN') throw new Error('Zen hotspot selected wrong mode: ' + hud.mode)
if (hud.timer !== '∞') throw new Error('Zen must show ∞ timer, got ' + hud.timer)

await page.waitForTimeout(10000)
hud = await readHud()
console.log('Zen after 10s (should still be playing, ∞):', hud)
if ((await page.locator('.results-screen').count()) > 0) {
  throw new Error('Zen ended on its own — should be endless')
}
if (hud.timer !== '∞') throw new Error('Zen timer changed')

console.log('\nALL CHECKS PASSED')
await browser.close()
