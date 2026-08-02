// Verify the stage fills the viewport on common phone sizes (no side bars).
import { chromium } from 'playwright-core'

const devices = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'Galaxy S20', width: 360, height: 800 },
  { name: 'Galaxy Fold cover', width: 280, height: 653 },
  { name: 'iPad Mini', width: 768, height: 1024 },
]

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })

for (const d of devices) {
  const page = await browser.newPage({ viewport: { width: d.width, height: d.height } })
  await page.goto('http://localhost:5173/home', { waitUntil: 'networkidle' })
  const box = await page.evaluate(() => {
    const stage = document.querySelector('.phone-stage')
    const r = stage.getBoundingClientRect()
    return {
      stageW: Math.round(r.width),
      stageH: Math.round(r.height),
      vw: innerWidth,
      vh: innerHeight,
    }
  })
  const fillsW = Math.abs(box.stageW - box.vw) <= 1
  const fillsH = Math.abs(box.stageH - box.vh) <= 1
  console.log(
    `${fillsW && fillsH ? 'OK' : 'FAIL'}  ${d.name.padEnd(18)} viewport ${box.vw}x${box.vh}  stage ${box.stageW}x${box.stageH}`,
  )
  await page.screenshot({ path: `/tmp/fill-${d.name.replace(/\s+/g, '-')}.png` })
  await page.close()
}

await browser.close()
