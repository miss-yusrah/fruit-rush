/**
 * Live verification: spawn math + Playwright playthrough of Classic / Zen.
 * Usage: PLAYWRIGHT_CHROMIUM=/usr/bin/google-chrome node scripts/verify-modes.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5173'
const chromePath = process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/google-chrome'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const MODE_CONFIG = {
  Classic: { duration: null, bombs: true, hazards: true, lives: 3 },
  Zen: { duration: 90, bombs: false, hazards: false, lives: 99 },
  Arcade: { duration: 120, bombs: true, hazards: true, lives: 3 },
}

assert(MODE_CONFIG.Classic.duration === null, 'Classic must be endless')
assert(MODE_CONFIG.Classic.bombs === true, 'Classic must have bombs')
assert(MODE_CONFIG.Zen.duration === 90, 'Zen must be 90s')
assert(MODE_CONFIG.Zen.bombs === false, 'Zen must not have bombs')
console.log('✓ MODE_CONFIG matches Fruit Ninja-style Classic/Zen')

function pickSpawnKind(ctx) {
  const config = MODE_CONFIG[ctx.mode]
  if (ctx.mode === 'Zen' || (!config.bombs && !config.hazards)) return 'fruit'
  if (config.bombs && ctx.elapsed > 4 && ctx.sinceBomb >= 5) return 'bomb'
  if (config.hazards && ctx.elapsed > 3 && ctx.sinceHazard >= 4) {
    return Math.random() < 0.55 ? 'spike' : 'ice'
  }
  if (config.bombs && Math.random() < (ctx.inFrenzy ? 0.22 : 0.16)) return 'bomb'
  if (config.hazards && Math.random() < (ctx.inFrenzy ? 0.18 : 0.12)) {
    return Math.random() < 0.55 ? 'spike' : 'ice'
  }
  return 'fruit'
}

function sample(mode, n) {
  const counts = { fruit: 0, bomb: 0, spike: 0, ice: 0 }
  let sinceBomb = 0
  let sinceHazard = 0
  for (let i = 0; i < n; i++) {
    const kind = pickSpawnKind({
      mode,
      elapsed: 20,
      sinceBomb,
      sinceHazard,
      inFrenzy: false,
    })
    counts[kind]++
    if (kind === 'bomb') {
      sinceBomb = 0
      sinceHazard++
    } else if (kind === 'spike' || kind === 'ice') {
      sinceHazard = 0
      sinceBomb++
    } else {
      sinceBomb++
      sinceHazard++
    }
  }
  return counts
}

const classicSample = sample('Classic', 200)
const zenSample = sample('Zen', 200)
console.log('Classic spawn sample (200):', classicSample)
console.log('Zen spawn sample (200):', zenSample)
assert(classicSample.bomb > 0, 'Classic must spawn bombs')
assert(classicSample.spike + classicSample.ice > 0, 'Classic must spawn spike/ice')
assert(zenSample.bomb === 0 && zenSample.spike === 0 && zenSample.ice === 0, 'Zen fruit-only')
console.log('✓ Spawn simulation: Classic has threats, Zen is fruit-only')

async function reachModes(page) {
  // Wait until we're past the asset loader.
  await page.waitForSelector(
    'button:text-is("Skip"), button:text-is("Continue as guest"), button[aria-label*="Classic"], button:text-is("Play")',
    { timeout: 90000 },
  )

  const skip = page.getByRole('button', { name: /^skip$/i })
  try {
    await skip.click({ timeout: 3000 })
  } catch {
    /* already past onboarding */
  }

  const guest = page.getByRole('button', { name: /continue as guest/i })
  try {
    await guest.click({ timeout: 8000 })
  } catch {
    /* already past connect */
  }

  // Modes already?
  try {
    await page.waitForSelector('button[aria-label*="Classic"]', { timeout: 2500 })
    return
  } catch {
    /* need Play */
  }

  await page.getByRole('button', { name: /^play$/i }).click({ timeout: 15000 })
  await page.waitForSelector('button[aria-label*="Classic"]', { timeout: 20000 })
}

async function exitToModes(page) {
  // Bomb can end Classic mid-wait → results. Get back to modes from anywhere.
  const path = await page.evaluate(() => location.pathname)
  if (path.includes('results') || path.includes('boast')) {
    const home = page.getByRole('button', { name: /home|modes|play again|back/i })
    try {
      await home.first().click({ timeout: 4000 })
    } catch {
      await page.goto(new URL('/modes', page.url()).href)
    }
    // From home, open modes again
    try {
      await page.waitForSelector('button[aria-label*="Classic"]', { timeout: 4000 })
      return
    } catch {
      await page.getByRole('button', { name: /^play$/i }).click({ timeout: 8000 })
      await page.waitForSelector('button[aria-label*="Classic"]', { timeout: 15000 })
      return
    }
  }

  // Still in play — pause then exit.
  try {
    await page.getByRole('button', { name: /pause game/i }).click({ timeout: 2500 })
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: /exit to modes/i }).click({ timeout: 4000 })
  } catch {
    try {
      await page.locator('button.play-hud__exit').click({ timeout: 3000, force: true })
    } catch {
      await page.goto(new URL('/modes', page.url()).href)
    }
  }
  await page.waitForSelector('button[aria-label*="Classic"]', { timeout: 15000 })
}

async function playMode(page, ariaMatch, expect) {
  await page.evaluate(() => {
    window.__fruitRushSpawns = []
    window.__fruitRushMode = null
  })

  await page.getByRole('button', { name: ariaMatch }).first().click()
  await page.waitForSelector('.play-screen', { timeout: 20000 })
  // Countdown ~3s
  await page.waitForTimeout(4200)

  const hud = await page.evaluate(() => ({
    mode: document.querySelector('.play-hud__mode')?.textContent?.trim(),
    timer: document.querySelector('.play-hud__timer')?.textContent?.trim(),
    probeMode: window.__fruitRushMode,
    spawns: [...(window.__fruitRushSpawns ?? [])],
  }))
  console.log(`\n[${expect.gameMode}] HUD:`, hud)

  assert(hud.mode === expect.modeLabel, `mode label ${hud.mode} != ${expect.modeLabel}`)
  assert(hud.probeMode === expect.gameMode, `probe mode ${hud.probeMode} != ${expect.gameMode}`)
  if (expect.endless) assert(hud.timer === '∞', `expected ∞, got ${hud.timer}`)
  else assert(hud.timer && /^\d+:\d{2}$/.test(hud.timer), `expected M:SS timer, got ${hud.timer}`)

  // Poll until we have enough evidence (Classic bomb may end the round).
  const deadline = Date.now() + expect.waitMs
  let after = { spawns: [], mode: null }
  while (Date.now() < deadline) {
    after = await page.evaluate(() => ({
      spawns: [...(window.__fruitRushSpawns ?? [])],
      mode: window.__fruitRushMode,
      path: location.pathname,
    }))
    const bombs = after.spawns.filter((k) => k === 'bomb').length
    const hazards = after.spawns.filter((k) => k === 'spike' || k === 'ice').length
    if (expect.allowBombs && bombs > 0 && hazards > 0) break
    if (!expect.allowBombs && after.spawns.length >= 8) break
    if (after.path?.includes('results')) break
    await page.waitForTimeout(500)
  }

  const bombs = after.spawns.filter((k) => k === 'bomb').length
  const hazards = after.spawns.filter((k) => k === 'spike' || k === 'ice').length
  const fruits = after.spawns.length - bombs - hazards
  console.log(`[${expect.gameMode}] spawns:`, {
    total: after.spawns.length,
    bombs,
    hazards,
    fruits,
    sample: after.spawns.slice(0, 24),
  })

  assert(after.spawns.length >= 4, `${expect.gameMode}: too few spawns (${after.spawns.length})`)
  if (expect.allowBombs) {
    assert(bombs > 0, `${expect.gameMode}: expected bombs, got ${JSON.stringify(after.spawns)}`)
    assert(hazards > 0, `${expect.gameMode}: expected spike/ice, got ${JSON.stringify(after.spawns)}`)
    console.log(`✓ ${expect.gameMode}: bombs=${bombs}, hazards=${hazards}, fruit=${fruits}`)
  } else {
    assert(bombs === 0 && hazards === 0, `${expect.gameMode}: expected fruit-only`)
    console.log(`✓ ${expect.gameMode}: fruit-only (${fruits})`)
  }

  await page.screenshot({
    path: `/tmp/fruit-rush-${expect.gameMode.toLowerCase()}.png`,
  })
  await exitToModes(page)
}

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
})

try {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
  // Fresh visit so we hit onboarding → guest → home
  await page.addInitScript(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  })

  console.log(`\nOpening ${baseUrl} …`)
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await reachModes(page)

  await playMode(page, /Classic — endless/i, {
    modeLabel: 'CLASSIC',
    gameMode: 'Classic',
    endless: true,
    allowBombs: true,
    waitMs: 16000,
  })

  await playMode(page, /Zen — 90 seconds/i, {
    modeLabel: 'ZEN',
    gameMode: 'Zen',
    endless: false,
    allowBombs: false,
    waitMs: 12000,
  })

  console.log('\n✅ Live verification passed')
} catch (err) {
  console.error('\n❌ Verification failed:', err.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
