// Taps every visual button at its painted position and verifies where it leads.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const path = () => new URL(page.url()).pathname

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('fruit-rush-onboarded', '1')
  sessionStorage.setItem('fruit-rush-guest', '1')
})

async function tapPct(xPct, yPct) {
  const box = await page.locator('.phone-stage').boundingBox()
  await page.mouse.click(box.x + box.width * (xPct / 100), box.y + box.height * (yPct / 100))
  await page.waitForTimeout(450)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${detail}`)
}

async function exitPlay() {
  await page.locator('.play-hud__exit').click()
  await page.waitForTimeout(400)
}

async function modeHud() {
  await page.waitForSelector('.play-hud__mode', { timeout: 10_000 })
  return {
    mode: await page.locator('.play-hud__mode').innerText(),
    timer: await page.locator('.play-hud__timer').innerText(),
  }
}

// 1. Home: PLAY center and bottom edge → modes
await page.goto('http://localhost:5173/home', { waitUntil: 'networkidle' })
await tapPct(50, 77)
check('PLAY center → modes', path() === '/modes', path())

await page.goto('http://localhost:5173/home', { waitUntil: 'networkidle' })
await tapPct(50, 82)
check('PLAY bottom half → modes (not shop)', path() === '/modes', path())

// 2. Modes: each plank center + Classic subtitle edge
const taps = [
  [42, 'Classic center', 'CLASSIC', '1:30'],
  [48, 'Classic subtitle', 'CLASSIC', '1:30'],
  [61, 'Zen center', 'ZEN', '∞'],
  [78, 'Arcade center', 'ARCADE', '2:00'],
]
for (const [y, name, wantMode, wantTimer] of taps) {
  await page.goto('http://localhost:5173/modes', { waitUntil: 'networkidle' })
  await tapPct(50, y)
  const hud = await modeHud()
  check(`${name} → ${wantMode}`, hud.mode === wantMode && hud.timer === wantTimer,
    `got ${hud.mode} ${hud.timer}`)
  await exitPlay()
}

// 3. Home: Shop text and Tournaments text
await page.goto('http://localhost:5173/home', { waitUntil: 'networkidle' })
await tapPct(36, 86.5)
check('Shop text → /shop', path() === '/shop', path())

await page.goto('http://localhost:5173/home', { waitUntil: 'networkidle' })
await tapPct(56, 86.5)
check('Tournaments text → /tournaments', path() === '/tournaments', path())

// 4. Shop bottom nav quadrants
await page.goto('http://localhost:5173/shop', { waitUntil: 'networkidle' })
await tapPct(60, 93)
check('Shop nav Compete → /tournaments', path() === '/tournaments', path())

await page.goto('http://localhost:5173/shop', { waitUntil: 'networkidle' })
await tapPct(84, 93)
check('Shop nav Profile → /profile', path() === '/profile', path())

// 5. Profile: JUMP BACK IN
await page.goto('http://localhost:5173/profile', { waitUntil: 'networkidle' })
await tapPct(50, 73.5)
check('Profile Jump back in → /modes', path() === '/modes', path())

// 6. Tournaments: ENTER as guest should prompt wallet (toast), not navigate
await page.goto('http://localhost:5173/tournaments', { waitUntil: 'networkidle' })
await tapPct(50, 72.5)
const toast = await page.locator('.toast').count()
const menu = await page.locator('.wallet-anchor').count()
check('Enter Daily Slash (guest) → wallet prompt', toast > 0 || menu > 0, `toast=${toast} menu=${menu}`)

const failed = results.filter((r) => !r.ok)
console.log(failed.length ? `\n${failed.length} FAILURES` : '\nALL TAPS CORRECT')
await browser.close()
process.exit(failed.length ? 1 : 0)
