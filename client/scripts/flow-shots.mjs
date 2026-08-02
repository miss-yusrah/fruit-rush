// Walks the boot flow in headless Chrome, screenshots each step, checks URLs.
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const url = () => new URL(page.url()).pathname

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.screenshot({ path: '/tmp/flow-1-splash.png' })
console.log('splash:', url())

await page.waitForSelector('.onboarding-screen', { timeout: 8000 })
await page.screenshot({ path: '/tmp/flow-2-onboarding.png' })
console.log('onboarding:', url())

await page.click('text=Next')
await page.click('text=Next')
await page.click('text=Get started')
await page.waitForSelector('.connect-screen', { timeout: 5000 })
await page.screenshot({ path: '/tmp/flow-3-connect.png' })
console.log('connect:', url())

await page.click('text=Continue as guest')
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/flow-4-home.png' })
console.log('home:', url())

// Back button should be a no-op trap-free exit point (splash was replaced).
// Navigate home -> modes via the Play hotspot, then go back.
await page.click('[aria-label="Play"]')
await page.waitForTimeout(300)
console.log('after Play tap:', url())
await page.goBack()
await page.waitForTimeout(300)
console.log('after browser Back:', url())

// Deep link straight to the shop.
await page.goto('http://localhost:5173/shop', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/flow-5-shop-deeplink.png' })
console.log('deep link /shop:', url())

await browser.close()
console.log('done')
