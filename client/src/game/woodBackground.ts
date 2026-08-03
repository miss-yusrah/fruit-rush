import { Texture } from 'pixi.js'

/**
 * Procedural cutting-board / dojo-wall texture.
 * Warm vertical planks, matte grain, knife scratches — no external art.
 */

const BASE_W = 1280
const BASE_H = 720

function rand(seed: { v: number }) {
  seed.v = (seed.v * 1664525 + 1013904223) >>> 0
  return seed.v / 0xffffffff
}

function leanColor(r: number, g: number, b: number, dr: number, dg: number, db: number) {
  return `rgb(${Math.round(r + dr)},${Math.round(g + dg)},${Math.round(b + db)})`
}

export function createWoodTexture(width = BASE_W, height = BASE_H): Texture {
  // Phones don't need a 1280×720 procedural board — half res is plenty at DPR≤1.5.
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  if (coarse) {
    width = Math.round(width * 0.5)
    height = Math.round(height * 0.5)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const seed = { v: 0x9e3779b9 }

  // Base warm brown fill
  ctx.fillStyle = '#3a2416'
  ctx.fillRect(0, 0, width, height)

  const plankCount = 7 + Math.floor(rand(seed) * 2)
  const plankW = width / plankCount

  for (let i = 0; i < plankCount; i++) {
    const x0 = i * plankW
    const shade = (rand(seed) - 0.5) * 28
    const r = 78 + shade
    const g = 48 + shade * 0.7
    const b = 28 + shade * 0.45

    // Plank body with soft vertical gradient (top slightly lit)
    const grad = ctx.createLinearGradient(x0, 0, x0, height)
    grad.addColorStop(0, leanColor(r, g, b, 14, 10, 6))
    grad.addColorStop(0.45, leanColor(r, g, b, 0, 0, 0))
    grad.addColorStop(1, leanColor(r, g, b, -18, -14, -10))
    ctx.fillStyle = grad
    ctx.fillRect(x0, 0, plankW + 1, height)

    // Soft seam shadow between planks
    if (i > 0) {
      const seam = ctx.createLinearGradient(x0 - 4, 0, x0 + 5, 0)
      seam.addColorStop(0, 'rgba(0,0,0,0)')
      seam.addColorStop(0.45, 'rgba(18,8,4,0.55)')
      seam.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = seam
      ctx.fillRect(x0 - 4, 0, 9, height)
    }

    // Highlight along left edge of plank
    const edge = ctx.createLinearGradient(x0, 0, x0 + 10, 0)
    edge.addColorStop(0, 'rgba(160,110,70,0.14)')
    edge.addColorStop(1, 'rgba(160,110,70,0)')
    ctx.fillStyle = edge
    ctx.fillRect(x0, 0, 10, height)

    // Vertical grain strokes
    const grains = 28 + Math.floor(rand(seed) * 18)
    for (let gLine = 0; gLine < grains; gLine++) {
      const gx = x0 + 4 + rand(seed) * (plankW - 8)
      const wobble = (rand(seed) - 0.5) * 3
      ctx.beginPath()
      ctx.strokeStyle = `rgba(${30 + rand(seed) * 25},${16 + rand(seed) * 14},${8 + rand(seed) * 10},${0.08 + rand(seed) * 0.16})`
      ctx.lineWidth = 0.6 + rand(seed) * 1.4
      ctx.moveTo(gx, 0)
      for (let y = 0; y <= height; y += 28) {
        ctx.lineTo(gx + Math.sin(y * 0.018 + wobble) * (1.5 + rand(seed) * 2.2), y)
      }
      ctx.stroke()
    }

    // Occasional knot
    if (rand(seed) < 0.45) {
      const kx = x0 + plankW * (0.25 + rand(seed) * 0.5)
      const ky = height * (0.15 + rand(seed) * 0.7)
      const kr = 8 + rand(seed) * 16
      const knot = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr)
      knot.addColorStop(0, 'rgba(42,24,14,0.85)')
      knot.addColorStop(0.55, 'rgba(62,36,20,0.45)')
      knot.addColorStop(1, 'rgba(62,36,20,0)')
      ctx.fillStyle = knot
      ctx.beginPath()
      ctx.ellipse(kx, ky, kr * 0.7, kr, rand(seed) * Math.PI, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(28,14,8,0.35)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.ellipse(kx, ky, kr * 0.45, kr * 0.65, rand(seed) * Math.PI, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Knife scratches & slash marks etched into the wood
  const scratches = 55
  for (let i = 0; i < scratches; i++) {
    const x = rand(seed) * width
    const y = rand(seed) * height
    const len = 18 + rand(seed) * 90
    const ang = -0.7 + rand(seed) * 1.4
    const deep = rand(seed) < 0.22
    ctx.beginPath()
    ctx.strokeStyle = deep
      ? `rgba(12,6,3,${0.35 + rand(seed) * 0.35})`
      : `rgba(22,12,6,${0.12 + rand(seed) * 0.22})`
    ctx.lineWidth = deep ? 1.4 + rand(seed) * 1.8 : 0.7 + rand(seed) * 1.1
    ctx.lineCap = 'round'
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    ctx.stroke()

    // Occasional X mark
    if (deep && rand(seed) < 0.35) {
      const ang2 = ang + Math.PI / 2 + (rand(seed) - 0.5) * 0.4
      const len2 = len * (0.45 + rand(seed) * 0.4)
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(ang) * len * 0.3, y + Math.sin(ang) * len * 0.3)
      ctx.lineTo(
        x + Math.cos(ang) * len * 0.3 + Math.cos(ang2) * len2,
        y + Math.sin(ang) * len * 0.3 + Math.sin(ang2) * len2,
      )
      ctx.stroke()
    }
  }

  // Soft matte vignette — darker corners, no gloss
  const vig = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    Math.min(width, height) * 0.25,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72,
  )
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(0.7, 'rgba(20,10,4,0.12)')
  vig.addColorStop(1, 'rgba(8,4,2,0.48)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, width, height)

  // Subtle film grain for matte surface (no specular shine)
  const grainData = ctx.getImageData(0, 0, width, height)
  const d = grainData.data
  for (let i = 0; i < d.length; i += 16) {
    const n = (rand(seed) - 0.5) * 10
    d[i] = Math.max(0, Math.min(255, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.85))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.7))
  }
  ctx.putImageData(grainData, 0, 0)

  return Texture.from(canvas)
}
