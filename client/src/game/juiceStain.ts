import { Texture } from 'pixi.js'

/**
 * Soft wet juice stains — feathered edges, translucent soak, pulp flecks.
 * Looks like liquid on wood, not a hard paint blob.
 */

function hexToRgb(hex: number) {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  }
}

function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  peakAlpha: number,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry))
  g.addColorStop(0, color.replace('ALP', String(peakAlpha)))
  g.addColorStop(0.45, color.replace('ALP', String(peakAlpha * 0.55)))
  g.addColorStop(0.78, color.replace('ALP', String(peakAlpha * 0.18)))
  g.addColorStop(1, color.replace('ALP', '0'))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

/** Tapered liquid tendril made of soft overlapping dots. */
function softTendril(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  length: number,
  baseW: number,
  color: string,
  peakAlpha: number,
) {
  const steps = 7 + Math.floor(Math.random() * 5)
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const falloff = (1 - t) * (1 - t)
    const x = cx + Math.cos(angle) * length * t
    const y = cy + Math.sin(angle) * length * t
    // Slight curve so tendrils aren't ruler-straight
    const bend = Math.sin(t * Math.PI) * baseW * 0.35 * (Math.random() > 0.5 ? 1 : -1)
    const px = x + Math.cos(angle + Math.PI / 2) * bend
    const py = y + Math.sin(angle + Math.PI / 2) * bend
    const r = baseW * (0.35 + falloff * 0.9) * (0.7 + Math.random() * 0.5)
    softBlob(ctx, px, py, r, r * (0.75 + Math.random() * 0.4), color, peakAlpha * falloff * 0.85)
  }
}

/** Gravity drip — soft teardrop running downward. */
function softDrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  color: string,
  peakAlpha: number,
) {
  const steps = 5 + Math.floor(Math.random() * 3)
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const yy = y + length * t
    const r = width * (1 - t * 0.55) * (0.8 + Math.random() * 0.35)
    softBlob(ctx, x + (Math.random() - 0.5) * 2, yy, r * 0.7, r, color, peakAlpha * (1 - t * 0.4))
  }
  // Tip bead
  softBlob(ctx, x, y + length, width * 0.55, width * 0.7, color, peakAlpha * 0.7)
}

export interface JuiceStainResult {
  texture: Texture
  /** Half-size of the texture in pixels (anchor center). */
  size: number
}

/**
 * Build one unique wet stain texture for a fruit juice color.
 * Size scales with fruit radius so watermelons leave bigger marks.
 */
export function createJuiceStainTexture(juiceHex: number, fruitRadius: number): JuiceStainResult {
  const size = Math.round(Math.min(280, Math.max(140, fruitRadius * 3.4 + Math.random() * 40)))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size * 0.5
  const cy = size * 0.5

  const { r, g, b } = hexToRgb(juiceHex)
  // Slightly deepen for a soaked-in look; keep hue recognizable
  const dr = Math.round(r * 0.82)
  const dg = Math.round(g * 0.82)
  const db = Math.round(b * 0.82)
  const color = `rgba(${dr},${dg},${db},ALP)`
  // Brighter watery highlights mixed in
  const watery = `rgba(${Math.min(255, r + 30)},${Math.min(255, g + 20)},${Math.min(255, b + 10)},ALP)`

  ctx.clearRect(0, 0, size, size)

  // --- Wet soak pool (large, very soft, wood shows through) ---
  const poolScale = 0.28 + Math.random() * 0.12
  softBlob(
    ctx,
    cx + (Math.random() - 0.5) * size * 0.06,
    cy + (Math.random() - 0.5) * size * 0.06,
    size * poolScale * (1.05 + Math.random() * 0.25),
    size * poolScale * (0.85 + Math.random() * 0.3),
    color,
    0.22 + Math.random() * 0.1,
  )

  // --- Irregular wet lobes (overlapping soft masses) ---
  const lobes = 6 + Math.floor(Math.random() * 5)
  for (let i = 0; i < lobes; i++) {
    const ang = (i / lobes) * Math.PI * 2 + Math.random() * 0.7
    const dist = size * (0.04 + Math.random() * 0.16)
    const rx = size * (0.08 + Math.random() * 0.12)
    const ry = size * (0.07 + Math.random() * 0.11)
    softBlob(
      ctx,
      cx + Math.cos(ang) * dist,
      cy + Math.sin(ang) * dist,
      rx,
      ry,
      Math.random() < 0.35 ? watery : color,
      0.28 + Math.random() * 0.32,
    )
  }

  // --- Splash tendrils (soft, not hard polygon spikes) ---
  const tendrils = 5 + Math.floor(Math.random() * 5)
  for (let i = 0; i < tendrils; i++) {
    const ang = Math.random() * Math.PI * 2
    const len = size * (0.18 + Math.random() * 0.28)
    const baseW = size * (0.035 + Math.random() * 0.045)
    softTendril(ctx, cx, cy, ang, len, baseW, color, 0.35 + Math.random() * 0.25)
  }

  // --- Gravity drips (juice running down the board) ---
  const drips = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < drips; i++) {
    const dx = cx + (Math.random() - 0.5) * size * 0.22
    const dy = cy + size * (0.05 + Math.random() * 0.1)
    softDrip(
      ctx,
      dx,
      dy,
      size * (0.12 + Math.random() * 0.22),
      size * (0.025 + Math.random() * 0.03),
      color,
      0.3 + Math.random() * 0.25,
    )
  }

  // --- Satellite droplets (scattered mist) ---
  const drops = 8 + Math.floor(Math.random() * 10)
  for (let i = 0; i < drops; i++) {
    const ang = Math.random() * Math.PI * 2
    const dist = size * (0.18 + Math.random() * 0.32)
    const rad = size * (0.012 + Math.random() * 0.028)
    softBlob(
      ctx,
      cx + Math.cos(ang) * dist,
      cy + Math.sin(ang) * dist,
      rad,
      rad * (0.7 + Math.random() * 0.5),
      color,
      0.25 + Math.random() * 0.4,
    )
  }

  // --- Pulp / seed flecks (tiny denser dots for texture) ---
  const flecks = 4 + Math.floor(Math.random() * 7)
  for (let i = 0; i < flecks; i++) {
    const fx = cx + (Math.random() - 0.5) * size * 0.28
    const fy = cy + (Math.random() - 0.5) * size * 0.28
    const fr = 0.8 + Math.random() * 2.2
    ctx.fillStyle = `rgba(${Math.max(0, dr - 40)},${Math.max(0, dg - 35)},${Math.max(0, db - 25)},${0.35 + Math.random() * 0.35})`
    ctx.beginPath()
    ctx.ellipse(fx, fy, fr, fr * 0.65, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  // Soft overall edge fade so nothing clips as a hard square
  const vig = ctx.createRadialGradient(cx, cy, size * 0.22, cx, cy, size * 0.48)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'

  return { texture: Texture.from(canvas), size }
}
