// Tap the VISUAL Classic plank (including its subtitle area) — must start Classic, not Zen.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('fruit-rush-onboarded', '1')
  sessionStorage.setItem('fruit-rush-guest', '1')
})

async function tapAtPercent(topPct, label) {
  await page.goto('http://localhost:5173/modes', { waitUntil: 'networkidle' })
  const box = await page.locator('.phone-stage').boundingBox()
  const x = box.x + box.width * 0.5
  const y = box.y + box.height * (topPct / 100)
  await page.mouse.click(x, y)
  await page.waitForSelector('.play-countdown__info', { timeout: 10_000 })
  const info = await page.locator('.play-countdown__info').innerText()
  const mode = await page.locator('.play-hud__mode').innerText()
  const timer = await page.locator('.play-hud__timer').innerText()
  console.log(`tap ${label} @ ${topPct}% → info="${info}" mode=${mode} timer=${timer}`)
  return { info, mode, timer }
}

// Classic title area ~36%, Classic subtitle "60 seconds" ~42%, Zen center ~52%, Arcade ~64%
const classicTitle = await tapAtPercent(36, 'Classic title')
const classicSub = await tapAtPercent(42, 'Classic subtitle')
const zen = await tapAtPercent(52, 'Zen center')
const arcade = await tapAtPercent(64, 'Arcade center')

const fails = []
if (classicTitle.mode !== 'CLASSIC' || classicTitle.timer === '∞') fails.push('Classic title')
if (classicSub.mode !== 'CLASSIC' || classicSub.timer === '∞') fails.push('Classic subtitle')
if (zen.mode !== 'ZEN' || zen.timer !== '∞') fails.push('Zen')
if (arcade.mode !== 'ARCADE' || arcade.timer === '∞') fails.push('Arcade')

if (fails.length) {
  console.error('FAILED:', fails.join(', '))
  process.exit(1)
}
console.log('ALL MODE TAPS CORRECT')
await browser.close()
