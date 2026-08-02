import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js'
import { audio } from '../audio'
import type { GameMode } from '../types/game'
import {
  MODE_CONFIG,
  comboMultiplier,
  type FruitKind,
  type GameEndPayload,
  type GameHudState,
} from './types'

import watermelonUrl from '../assets/fruits/watermelon.png'
import watermelonHalfUrl from '../assets/fruits/watermelon-half.png'
import orangeUrl from '../assets/fruits/orange.png'
import orangeHalfUrl from '../assets/fruits/orange-half.png'
import appleUrl from '../assets/fruits/apple.png'
import appleHalfUrl from '../assets/fruits/apple-half.png'
import coconutUrl from '../assets/fruits/coconut.png'
import coconutHalfUrl from '../assets/fruits/coconut-half.png'
import pearUrl from '../assets/fruits/pear.png'
import pearHalfUrl from '../assets/fruits/pear-half.png'
import pineappleUrl from '../assets/fruits/pineapple.png'
import pineappleHalfUrl from '../assets/fruits/pineapple-half.png'
import mangoUrl from '../assets/fruits/mango.png'
import mangoHalfUrl from '../assets/fruits/mango-half.png'
import kiwiUrl from '../assets/fruits/kiwi.png'
import kiwiHalfUrl from '../assets/fruits/kiwi-half.png'
import lemonUrl from '../assets/fruits/lemon.png'
import lemonHalfUrl from '../assets/fruits/lemon-half.png'
import passionfruitUrl from '../assets/fruits/passionfruit.png'
import passionfruitHalfUrl from '../assets/fruits/passionfruit-half.png'
import bombUrl from '../assets/fruits/bomb.png'

type EdibleKind = Exclude<FruitKind, 'bomb' | 'spike' | 'ice'>
type HazardKind = 'bomb' | 'spike' | 'ice'

interface FruitSpec {
  whole: string
  half: string
  radius: number
  points: number
  juice: number
  seeds: number
  weight: number
}

const FRUIT_SPECS: Record<EdibleKind, FruitSpec> = {
  watermelon: { whole: watermelonUrl, half: watermelonHalfUrl, radius: 62, points: 15, juice: 0xff4d4d, seeds: 5, weight: 10 },
  orange: { whole: orangeUrl, half: orangeHalfUrl, radius: 48, points: 10, juice: 0xff9f1c, seeds: 0, weight: 12 },
  apple: { whole: appleUrl, half: appleHalfUrl, radius: 48, points: 10, juice: 0xfff2c8, seeds: 2, weight: 12 },
  coconut: { whole: coconutUrl, half: coconutHalfUrl, radius: 52, points: 14, juice: 0xf7f3ec, seeds: 0, weight: 7 },
  pear: { whole: pearUrl, half: pearHalfUrl, radius: 50, points: 10, juice: 0xf3ecb0, seeds: 2, weight: 10 },
  pineapple: { whole: pineappleUrl, half: pineappleHalfUrl, radius: 58, points: 14, juice: 0xffd166, seeds: 0, weight: 8 },
  mango: { whole: mangoUrl, half: mangoHalfUrl, radius: 50, points: 12, juice: 0xffb703, seeds: 0, weight: 10 },
  kiwi: { whole: kiwiUrl, half: kiwiHalfUrl, radius: 42, points: 12, juice: 0x9acd32, seeds: 4, weight: 9 },
  lemon: { whole: lemonUrl, half: lemonHalfUrl, radius: 42, points: 10, juice: 0xffe86b, seeds: 2, weight: 10 },
  passionfruit: { whole: passionfruitUrl, half: passionfruitHalfUrl, radius: 40, points: 16, juice: 0xf4a423, seeds: 6, weight: 5 },
}

const EDIBLE_KINDS = Object.keys(FRUIT_SPECS) as EdibleKind[]
const TOTAL_WEIGHT = EDIBLE_KINDS.reduce((s, k) => s + FRUIT_SPECS[k].weight, 0)
const BOMB_RADIUS = 40
const SPIKE_RADIUS = 36
const ICE_RADIUS = 38
const GRAVITY = 1150
const TRAIL_LIFE_MS = 170
const PRAISE: Array<{ streak: number; word: string; tint: number }> = [
  { streak: 10, word: 'Perfect!', tint: 0xffd166 },
  { streak: 6, word: 'Awesome!', tint: 0xff9f1c },
  { streak: 3, word: 'Great!', tint: 0x9be564 },
]

function isHazard(kind: FruitKind): kind is HazardKind {
  return kind === 'bomb' || kind === 'spike' || kind === 'ice'
}

interface FruitTextures {
  whole: Texture
  halfL: Texture
  halfR: Texture
}

interface FruitEntity {
  view: Container
  kind: FruitKind
  radius: number
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  alive: boolean
}

interface HalfEntity {
  view: Container
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  life: number
}

interface Particle {
  view: Graphics
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  life: number
  maxLife: number
  drag: number
}

interface SplatEntity {
  view: Graphics
  life: number
  maxLife: number
}

interface FloatText {
  view: Text
  life: number
  maxLife: number
  vy: number
}

interface TrailPoint {
  x: number
  y: number
  t: number
}

interface PendingSpawn {
  delay: number
  kind: 'fruit' | HazardKind
}

interface FruitRushGameOptions {
  host: HTMLElement
  mode: GameMode
  onHud: (hud: GameHudState) => void
  onEnd: (result: GameEndPayload) => void
}

export class FruitRushGame {
  private app: Application | null = null
  private world = new Container()
  private splatLayer = new Container()
  private fruitLayer = new Container()
  private particleLayer = new Container()
  private textLayer = new Container()
  private trailGfx = new Graphics()
  private flashGfx = new Graphics()

  private textures = new Map<FruitKind, FruitTextures>()

  private fruits: FruitEntity[] = []
  private halves: HalfEntity[] = []
  private particles: Particle[] = []
  private splats: SplatEntity[] = []
  private floatTexts: FloatText[] = []
  private pendingSpawns: PendingSpawn[] = []
  private trail: TrailPoint[] = []

  private slicing = false
  private lastPointer = { x: 0, y: 0 }
  private score = 0
  private combo = 0
  private comboHigh = 0
  private comboTimer = 0
  private lives = 3
  private timeLeft: number | null = 60
  private status: GameHudState['status'] = 'countdown'
  private countdown = 3
  /** Last spoken countdown cue so we don't re-trigger every frame. */
  private lastCountdownCue = 4
  private elapsed = 0
  private waveTimer = 0.4
  private frenzyTimer = 0
  private inFrenzy = false
  /** Fruits launched since the last bomb — drives the guaranteed cadence. */
  private sinceBomb = 0
  /** Launches since the last non-bomb hazard (spike / ice). */
  private sinceHazard = 0
  private freeze = 0
  private shake = 0
  private flash = 0
  private endDelay = -1
  private burstCount = 0
  private burstTimer = 0
  private destroyed = false
  private sessionStart = 0

  private readonly mode: GameMode
  private readonly config: (typeof MODE_CONFIG)[GameMode]
  private readonly onHud: FruitRushGameOptions['onHud']
  private readonly onEnd: FruitRushGameOptions['onEnd']
  private readonly host: HTMLElement
  private boundPointerDown = (e: PointerEvent) => this.onPointerDown(e)
  private boundPointerMove = (e: PointerEvent) => this.onPointerMove(e)
  private boundPointerUp = () => this.onPointerUp()

  constructor(opts: FruitRushGameOptions) {
    this.host = opts.host
    this.mode = opts.mode
    this.config = MODE_CONFIG[opts.mode]
    this.lives = this.config.lives
    this.timeLeft = this.config.duration
    this.onHud = opts.onHud
    this.onEnd = opts.onEnd
  }

  async start() {
    const app = new Application()
    // Cap DPR on phones — full 3x Retina + juice particles hitch mid-swipe.
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const dprCap = coarse ? 1.5 : 2
    await app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: !coarse,
      resolution: Math.min(window.devicePixelRatio || 1, dprCap),
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'high-performance',
    })
    app.ticker.maxFPS = 60

    await this.loadTextures()
    // Asset load often leaves AudioContext suspended — wake it before countdown.
    await audio.unlock()

    if (this.destroyed) {
      app.destroy(true)
      return
    }

    this.app = app
    this.host.appendChild(app.canvas)
    app.canvas.style.width = '100%'
    app.canvas.style.height = '100%'
    app.canvas.style.touchAction = 'none'
    app.canvas.style.display = 'block'

    this.world.addChild(this.splatLayer, this.fruitLayer, this.particleLayer, this.textLayer)
    app.stage.addChild(this.world, this.trailGfx, this.flashGfx)

    this.host.addEventListener('pointerdown', this.boundPointerDown)
    window.addEventListener('pointermove', this.boundPointerMove)
    window.addEventListener('pointerup', this.boundPointerUp)
    window.addEventListener('pointercancel', this.boundPointerUp)

    this.emitHud()
    app.ticker.add((ticker) => this.update(ticker.deltaMS / 1000))
  }

  private async loadTextures() {
    const urls: string[] = [bombUrl]
    for (const kind of EDIBLE_KINDS) {
      urls.push(FRUIT_SPECS[kind].whole, FRUIT_SPECS[kind].half)
    }
    const loaded = await Assets.load<Texture>(urls)

    const splitHalves = (half: Texture): { halfL: Texture; halfR: Texture } => {
      const w = half.source.width
      const h = half.source.height
      return {
        halfL: new Texture({ source: half.source, frame: new Rectangle(0, 0, w / 2, h) }),
        halfR: new Texture({ source: half.source, frame: new Rectangle(w / 2, 0, w / 2, h) }),
      }
    }

    for (const kind of EDIBLE_KINDS) {
      const whole = loaded[FRUIT_SPECS[kind].whole]
      const half = loaded[FRUIT_SPECS[kind].half]
      this.textures.set(kind, { whole, ...splitHalves(half) })
    }
    const bombTex = loaded[bombUrl]
    this.textures.set('bomb', { whole: bombTex, halfL: bombTex, halfR: bombTex })
  }

  destroy() {
    this.destroyed = true
    audio.stopMusic()
    this.host.removeEventListener('pointerdown', this.boundPointerDown)
    window.removeEventListener('pointermove', this.boundPointerMove)
    window.removeEventListener('pointerup', this.boundPointerUp)
    window.removeEventListener('pointercancel', this.boundPointerUp)
    if (this.app) {
      this.app.destroy(true, { children: true })
      this.app = null
    }
    this.host.replaceChildren()
  }

  private emitHud() {
    this.onHud({
      score: this.score,
      combo: this.combo,
      multiplier: comboMultiplier(this.combo),
      lives: Math.min(this.lives, 3),
      timeLeft: this.timeLeft,
      mode: this.mode,
      status: this.status,
      countdown: this.countdown,
    })
  }

  // ------------------------------------------------------------- main loop

  private update(rawDt: number) {
    if (!this.app || this.destroyed) return
    const realDt = Math.min(rawDt, 0.05)

    // Hit-stop: world time pauses, but the trail and shake stay live.
    let dt = realDt
    if (this.freeze > 0) {
      this.freeze -= realDt
      dt = 0
    }

    if (this.status === 'countdown') {
      this.countdown -= realDt
      const cue = this.countdown > 2.2 ? 3 : this.countdown > 1.2 ? 2 : this.countdown > 0.3 ? 1 : 0
      if (cue > 0 && cue !== this.lastCountdownCue) {
        this.lastCountdownCue = cue
        audio.playCountdown(cue as 3 | 2 | 1)
      }
      if (this.countdown <= 0) {
        this.status = 'playing'
        this.countdown = 0
        this.sessionStart = performance.now()
        this.waveTimer = 0.35
        audio.playCountdown('slice')
        audio.startMusic()
      }
      this.emitHud()
      return
    }

    if (this.status === 'playing') {
      this.elapsed += dt

      if (this.endDelay < 0 && this.timeLeft !== null) {
        this.timeLeft = Math.max(0, this.timeLeft - dt)
        if (this.timeLeft <= 0) {
          this.finish()
          return
        }
      }

      if (this.endDelay >= 0) {
        this.endDelay -= realDt
        if (this.endDelay <= 0) {
          this.finish()
          return
        }
      } else {
        this.updateSpawning(dt)
      }

      if (this.combo > 0) {
        this.comboTimer -= dt
        if (this.comboTimer <= 0) {
          this.combo = 0
          audio.setComboIntensity(0)
        }
      }
      if (this.burstTimer > 0) {
        this.burstTimer -= realDt
        if (this.burstTimer <= 0) this.burstCount = 0
      }

      this.stepFruits(dt)
      this.stepHalves(dt)
      this.stepParticles(dt)
      this.stepSplats(dt)
      this.stepTexts(dt)
    }

    this.stepShake(realDt)
    this.stepFlash(realDt)
    this.drawTrail()
    this.emitHud()
  }

  // ------------------------------------------------------------- spawning

  private updateSpawning(dt: number) {
    if (this.config.frenzy) {
      this.frenzyTimer += dt
      if (!this.inFrenzy && this.frenzyTimer > 12) {
        this.inFrenzy = true
        this.frenzyTimer = 0
      } else if (this.inFrenzy && this.frenzyTimer > 5) {
        this.inFrenzy = false
        this.frenzyTimer = 0
      }
    }

    // Staggered launches inside a wave.
    for (const spawn of this.pendingSpawns) spawn.delay -= dt
    while (this.pendingSpawns.length && this.pendingSpawns[0].delay <= 0) {
      const spawn = this.pendingSpawns.shift()!
      this.launchFruit(spawn.kind)
    }

    this.waveTimer -= dt
    if (this.waveTimer > 0) return

    // Waves ramp up over the round: gentle 1-2 fruit openers, chaos later.
    const ramp = Math.min(1, this.elapsed / 40)
    const baseSize = 1 + Math.random() * (0.8 + ramp * 3.2)
    const size = Math.min(5, Math.round(baseSize) + (this.inFrenzy ? 2 : 0))

    for (let i = 0; i < size; i++) {
      this.pendingSpawns.push({
        delay: i * (0.09 + Math.random() * 0.12),
        kind: this.pickSpawnKind(),
      })
    }

    const gapScale = this.inFrenzy ? 0.55 : 1
    const min = this.config.spawnMinMs * gapScale
    const max = this.config.spawnMaxMs * gapScale
    // Wave gap: base gap plus room for the wave itself to play out.
    this.waveTimer = (min + Math.random() * (max - min)) / 1000 + size * 0.22
  }

  /** Decide fruit vs bomb vs spike/ice for the next launch. */
  private pickSpawnKind(): PendingSpawn['kind'] {
    // Zen is pure practice — never throw hazards.
    if (!this.config.bombs && !this.config.hazards) return 'fruit'

    // Guaranteed bomb cadence so Classic always feels the threat.
    if (this.config.bombs && this.elapsed > 4 && this.sinceBomb >= 5) {
      return 'bomb'
    }

    // Guaranteed spike/ice between bombs.
    if (this.config.hazards && this.elapsed > 3 && this.sinceHazard >= 4) {
      return Math.random() < 0.55 ? 'spike' : 'ice'
    }

    if (this.config.bombs) {
      const bombChance = this.inFrenzy ? 0.22 : 0.16
      if (Math.random() < bombChance) return 'bomb'
    }

    if (this.config.hazards) {
      const hazardChance = this.inFrenzy ? 0.18 : 0.12
      if (Math.random() < hazardChance) return Math.random() < 0.55 ? 'spike' : 'ice'
    }

    return 'fruit'
  }

  private pickKind(): EdibleKind {
    let roll = Math.random() * TOTAL_WEIGHT
    for (const kind of EDIBLE_KINDS) {
      roll -= FRUIT_SPECS[kind].weight
      if (roll <= 0) return kind
    }
    return 'watermelon'
  }

  private launchFruit(spawnKind: PendingSpawn['kind']) {
    if (!this.app) return
    const w = this.app.screen.width
    const h = this.app.screen.height

    let kind: FruitKind
    if (spawnKind === 'bomb' && this.config.bombs) kind = 'bomb'
    else if (spawnKind === 'spike' && this.config.hazards) kind = 'spike'
    else if (spawnKind === 'ice' && this.config.hazards) kind = 'ice'
    else kind = this.pickKind()

    if (kind === 'bomb') {
      this.sinceBomb = 0
      this.sinceHazard += 1
    } else if (kind === 'spike' || kind === 'ice') {
      this.sinceHazard = 0
      this.sinceBomb += 1
    } else {
      this.sinceBomb += 1
      this.sinceHazard += 1
    }

    const radius =
      kind === 'bomb' ? BOMB_RADIUS : kind === 'spike' ? SPIKE_RADIUS : kind === 'ice' ? ICE_RADIUS : FRUIT_SPECS[kind].radius

    let view: Container
    if (kind === 'spike') {
      view = this.makeSpikeView(radius)
    } else if (kind === 'ice') {
      view = this.makeIceView(radius)
    } else {
      const tex = this.textures.get(kind)!
      const sprite = new Sprite(tex.whole)
      sprite.anchor.set(0.5)
      const scale = (radius * 2) / Math.max(sprite.texture.width, sprite.texture.height)
      sprite.scale.set(scale)
      view = sprite
    }

    const x = w * (0.1 + Math.random() * 0.8)
    const y = h + radius + 10

    // Explosive launch: 60-120 degrees, apex between 45% and 82% of the screen.
    const apex = h * (0.45 + Math.random() * 0.37)
    const vyMag = Math.sqrt(2 * GRAVITY * apex)
    const angleDeg = 60 + Math.random() * 60
    let vx = vyMag / Math.tan((angleDeg * Math.PI) / 180)

    // Keep the landing spot on screen.
    const flightTime = (2 * vyMag) / GRAVITY
    const landX = x + vx * flightTime
    if (landX < w * 0.06) vx = (w * 0.06 - x) / flightTime
    if (landX > w * 0.94) vx = (w * 0.94 - x) / flightTime

    view.x = x
    view.y = y
    this.fruitLayer.addChild(view)

    this.fruits.push({
      view,
      kind,
      radius,
      x,
      y,
      vx,
      vy: -vyMag,
      spin: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 2.8),
      alive: true,
    })
  }

  private makeSpikeView(radius: number): Container {
    const g = new Graphics()
    const spikes = 8
    g.moveTo(radius, 0)
    for (let i = 0; i <= spikes; i++) {
      const a = (i / spikes) * Math.PI * 2
      const r = i % 2 === 0 ? radius : radius * 0.55
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    g.fill({ color: 0x2a1a14 })
    g.circle(0, 0, radius * 0.42)
    g.fill({ color: 0x5a2a1a })
    g.circle(-radius * 0.12, -radius * 0.12, radius * 0.12)
    g.fill({ color: 0x8a4a2a })
    return g
  }

  private makeIceView(radius: number): Container {
    const g = new Graphics()
    const hex = (r: number, rot = 0) => {
      const pts: number[] = []
      for (let i = 0; i < 6; i++) {
        const a = rot + (i / 6) * Math.PI * 2
        pts.push(Math.cos(a) * r, Math.sin(a) * r)
      }
      return pts
    }
    g.poly(hex(radius))
    g.fill({ color: 0x7ec8ff })
    g.poly(hex(radius * 0.62, Math.PI / 6))
    g.fill({ color: 0xd8f0ff })
    g.circle(-radius * 0.18, -radius * 0.2, radius * 0.14)
    g.fill({ color: 0xffffff, alpha: 0.85 })
    return g
  }

  // ------------------------------------------------------------- physics

  private stepFruits(dt: number) {
    if (!this.app) return
    const h = this.app.screen.height

    for (const fruit of this.fruits) {
      if (!fruit.alive) continue
      fruit.vy += GRAVITY * dt
      fruit.x += fruit.vx * dt
      fruit.y += fruit.vy * dt
      fruit.view.x = fruit.x
      fruit.view.y = fruit.y
      fruit.view.rotation += fruit.spin * dt

      if (fruit.vy > 0 && fruit.y - fruit.radius > h + 60) {
        fruit.alive = false
        fruit.view.destroy()
        // Hazards falling away are free — only missing edible fruit costs a life.
        if (
          !isHazard(fruit.kind) &&
          this.mode !== 'Zen' &&
          this.elapsed > 3.5 &&
          this.endDelay < 0
        ) {
          this.lives -= 1
          this.combo = 0
          if (this.lives <= 0) {
            this.finish()
            return
          }
        }
      }
    }
    this.fruits = this.fruits.filter((f) => f.alive)
  }

  private stepHalves(dt: number) {
    if (!this.app) return
    const h = this.app.screen.height
    for (const half of this.halves) {
      half.life -= dt
      half.vy += GRAVITY * dt
      half.x += half.vx * dt
      half.y += half.vy * dt
      half.view.x = half.x
      half.view.y = half.y
      half.view.rotation += half.spin * dt
      if (half.life < 0.35) half.view.alpha = Math.max(0, half.life / 0.35)
      if (half.life <= 0 || half.y > h + 160) {
        half.life = 0
        half.view.destroy()
      }
    }
    this.halves = this.halves.filter((p) => p.life > 0)
  }

  private stepParticles(dt: number) {
    if (!this.app) return
    const h = this.app.screen.height
    for (const p of this.particles) {
      p.life -= dt
      p.vx *= 1 - p.drag * dt
      p.vy += GRAVITY * 0.8 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.view.x = p.x
      p.view.y = p.y
      p.view.rotation += p.spin * dt
      p.view.alpha = Math.max(0, Math.min(1, (p.life / p.maxLife) * 1.6))
      if (p.life <= 0 || p.y > h + 40) {
        p.life = 0
        p.view.destroy()
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  private stepSplats(dt: number) {
    for (const s of this.splats) {
      s.life -= dt
      const k = Math.max(0, s.life / s.maxLife)
      s.view.alpha = k * 0.4
      if (s.life <= 0) s.view.destroy()
    }
    this.splats = this.splats.filter((s) => s.life > 0)
  }

  private stepTexts(dt: number) {
    for (const t of this.floatTexts) {
      t.life -= dt
      const age = t.maxLife - t.life
      t.view.y += t.vy * dt
      const pop = age < 0.14 ? 0.5 + (age / 0.14) * 0.62 : 1.12 - Math.min(0.12, (age - 0.14) * 0.3)
      t.view.scale.set(pop)
      if (t.life < 0.3) t.view.alpha = Math.max(0, t.life / 0.3)
      if (t.life <= 0) t.view.destroy()
    }
    this.floatTexts = this.floatTexts.filter((t) => t.life > 0)
  }

  private stepShake(dt: number) {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 26)
      this.world.x = (Math.random() - 0.5) * 2 * this.shake
      this.world.y = (Math.random() - 0.5) * 2 * this.shake
    } else {
      this.world.x = 0
      this.world.y = 0
    }
  }

  private stepFlash(dt: number) {
    if (!this.app) return
    this.flashGfx.clear()
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.4)
      this.flashGfx.rect(0, 0, this.app.screen.width, this.app.screen.height)
      this.flashGfx.fill({ color: 0xffffff, alpha: Math.min(0.85, this.flash) })
    }
  }

  // ------------------------------------------------------------- input

  private onPointerDown(e: PointerEvent) {
    // Phones suspend AudioContext after async texture load — re-kick on every swipe.
    audio.kick()
    if (this.status !== 'playing') return
    const p = this.toLocal(e)
    this.slicing = true
    this.lastPointer = p
    this.trail.push({ ...p, t: performance.now() })
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.slicing || this.status !== 'playing') return
    const p = this.toLocal(e)
    this.trail.push({ ...p, t: performance.now() })
    this.trySlice(this.lastPointer.x, this.lastPointer.y, p.x, p.y)
    this.lastPointer = p
  }

  private onPointerUp() {
    this.slicing = false
  }

  private toLocal(e: PointerEvent) {
    const rect = this.host.getBoundingClientRect()
    const w = this.app?.screen.width ?? this.host.clientWidth
    const h = this.app?.screen.height ?? this.host.clientHeight

    // Portrait phones render the round through a 90° CSS rotation
    // (.play-screen--rotated), which swaps the bounding box axes relative to
    // the layout size. Undo that rotation when mapping pointer coordinates.
    const rotated =
      Math.abs(rect.width - this.host.clientHeight) <
      Math.abs(rect.width - this.host.clientWidth)
    if (rotated) {
      return {
        x: ((e.clientY - rect.top) / rect.height) * w,
        y: ((rect.left + rect.width - e.clientX) / rect.width) * h,
      }
    }

    return {
      x: ((e.clientX - rect.left) / rect.width) * w,
      y: ((e.clientY - rect.top) / rect.height) * h,
    }
  }

  // ------------------------------------------------------------- slicing

  private trySlice(x1: number, y1: number, x2: number, y2: number) {
    if (this.endDelay >= 0) return
    const speed = Math.hypot(x2 - x1, y2 - y1)
    if (speed < 5) return
    const angle = Math.atan2(y2 - y1, x2 - x1)

    for (const fruit of this.fruits) {
      if (!fruit.alive) continue
      if (!segmentHitsCircle(x1, y1, x2, y2, fruit.x, fruit.y, fruit.radius * 0.95)) continue

      fruit.alive = false
      fruit.view.destroy()

      if (fruit.kind === 'bomb') {
        this.explodeBomb(fruit)
        return
      }

      if (fruit.kind === 'spike') {
        this.hitSpike(fruit)
        continue
      }

      if (fruit.kind === 'ice') {
        this.hitIce(fruit)
        continue
      }

      const spec = FRUIT_SPECS[fruit.kind as EdibleKind]
      this.spawnHalves(fruit, angle)
      this.spawnJuice(fruit.x, fruit.y, spec, angle)
      this.spawnSplat(fruit.x, fruit.y, spec)

      this.combo += 1
      this.comboHigh = Math.max(this.comboHigh, this.combo)
      this.comboTimer = 1.5
      this.score += spec.points * comboMultiplier(this.combo)

      this.burstCount += 1
      this.burstTimer = 0.4

      this.shake = Math.max(this.shake, 3.5)
      this.freeze = Math.max(this.freeze, this.burstCount >= 3 ? 0.07 : 0.038)

      audio.playSlice(fruit.kind)
      audio.playCombo(this.combo)

      this.announceSlice(fruit.x, fruit.y)
    }

    this.fruits = this.fruits.filter((f) => f.alive)
  }

  private announceSlice(x: number, y: number) {
    if (this.burstCount === 3 || this.burstCount === 5 || this.burstCount === 8) {
      this.spawnText(`Combo x${this.burstCount}`, x, y - 40, 0x6be3ff, 34)
      return
    }
    for (const praise of PRAISE) {
      if (this.combo === praise.streak) {
        this.spawnText(praise.word, x, y - 40, praise.tint, 38)
        return
      }
    }
  }

  private explodeBomb(fruit: FruitEntity) {
    this.flash = 1
    this.shake = 22
    this.freeze = 0.12
    this.endDelay = 0.95
    audio.playBomb()
    audio.stopMusic()

    // Fiery burst.
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 160 + Math.random() * 420
      this.pushParticle(
        fruit.x,
        fruit.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 80,
        Math.random() < 0.5 ? 0xff6b1a : 0xffd166,
        3 + Math.random() * 5,
        0.5 + Math.random() * 0.4,
      )
    }
    this.spawnText('BOOM', fruit.x, fruit.y - 30, 0xff5252, 46)
  }

  /** Spike mine: lose a life, break combo — run continues unless lives hit 0. */
  private hitSpike(fruit: FruitEntity) {
    this.shake = Math.max(this.shake, 10)
    this.freeze = 0.08
    this.combo = 0
    this.lives -= 1
    audio.playSpike()
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 120 + Math.random() * 280
      this.pushParticle(
        fruit.x,
        fruit.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 40,
        0x5a2a1a,
        2 + Math.random() * 4,
        0.4 + Math.random() * 0.35,
      )
    }
    this.spawnText('SPIKE −1', fruit.x, fruit.y - 28, 0xff6b1a, 32)
    if (this.lives <= 0) this.endDelay = 0.7
  }

  /** Ice orb: break combo and deduct points — does not end the run. */
  private hitIce(fruit: FruitEntity) {
    this.shake = Math.max(this.shake, 6)
    this.freeze = 0.05
    this.combo = 0
    this.score = Math.max(0, this.score - 40)
    audio.playIce()
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 90 + Math.random() * 240
      this.pushParticle(
        fruit.x,
        fruit.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 30,
        Math.random() < 0.5 ? 0x7ec8ff : 0xffffff,
        2 + Math.random() * 3.5,
        0.45 + Math.random() * 0.35,
      )
    }
    this.spawnText('ICE −40', fruit.x, fruit.y - 28, 0x7ec8ff, 30)
  }

  private spawnHalves(fruit: FruitEntity, sliceAngle: number) {
    const tex = this.textures.get(fruit.kind)!
    const spec = FRUIT_SPECS[fruit.kind as EdibleKind]
    // Normal to the swipe: halves fly apart along it.
    const nx = -Math.sin(sliceAngle)
    const ny = Math.cos(sliceAngle)

    for (const side of [-1, 1] as const) {
      const texture = side < 0 ? tex.halfL : tex.halfR
      const sprite = new Sprite(texture)
      // Anchor on the cut edge so the halves visually separate along the cut.
      sprite.anchor.set(side < 0 ? 1 : 0, 0.5)
      const scale = (spec.radius * 2) / Math.max(texture.width * 2, texture.height)
      sprite.scale.set(scale)

      const view = new Container()
      view.addChild(sprite)
      view.x = fruit.x
      view.y = fruit.y
      // Align the cut line with the swipe direction.
      view.rotation = sliceAngle - Math.PI / 2
      this.fruitLayer.addChild(view)

      const kick = 110 + Math.random() * 90
      this.halves.push({
        view,
        x: fruit.x,
        y: fruit.y,
        vx: fruit.vx * 0.6 + nx * kick * side,
        vy: Math.min(fruit.vy * 0.55, 40) - 60 + ny * kick * side * 0.4,
        spin: side * (2.2 + Math.random() * 3),
        life: 1.9,
      })
    }
  }

  private pushParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: number,
    size: number,
    life: number,
    shape: 'drop' | 'seed' = 'drop',
  ) {
    const g = new Graphics()
    if (shape === 'seed') {
      g.ellipse(0, 0, size, size * 0.62)
      g.fill(color)
    } else {
      g.circle(0, 0, size)
      g.fill(color)
    }
    g.x = x
    g.y = y
    this.particleLayer.addChild(g)
    this.particles.push({
      view: g,
      x,
      y,
      vx,
      vy,
      spin: (Math.random() - 0.5) * 8,
      life,
      maxLife: life,
      drag: 1.6,
    })
  }

  private spawnJuice(x: number, y: number, spec: FruitSpec, sliceAngle: number) {
    // Juice sprays mostly perpendicular to the swipe.
    const nx = -Math.sin(sliceAngle)
    const ny = Math.cos(sliceAngle)
    const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    const drops = coarse ? 7 : 14
    const seeds = coarse ? Math.min(2, spec.seeds) : spec.seeds
    for (let i = 0; i < drops; i++) {
      const side = Math.random() < 0.5 ? -1 : 1
      const spread = (Math.random() - 0.5) * 1.6
      const dirX = nx * side + Math.cos(sliceAngle) * spread
      const dirY = ny * side + Math.sin(sliceAngle) * spread
      const len = Math.hypot(dirX, dirY) || 1
      const speed = 90 + Math.random() * 260
      this.pushParticle(
        x,
        y,
        (dirX / len) * speed,
        (dirY / len) * speed - 60,
        spec.juice,
        2 + Math.random() * 3.6,
        0.38 + Math.random() * 0.3,
      )
    }
    for (let i = 0; i < seeds; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 120 + Math.random() * 220
      this.pushParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 90,
        0x2b1d12,
        2.4,
        0.55 + Math.random() * 0.3,
        'seed',
      )
    }
  }

  private spawnSplat(x: number, y: number, spec: FruitSpec) {
    const g = new Graphics()
    const blobs = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 4 : 7
    for (let i = 0; i < blobs; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * spec.radius * 0.9
      g.circle(Math.cos(angle) * dist, Math.sin(angle) * dist, 5 + Math.random() * spec.radius * 0.4)
    }
    g.fill(spec.juice)
    g.x = x
    g.y = y
    g.alpha = 0.4
    this.splatLayer.addChild(g)
    this.splats.push({ view: g, life: 0.8, maxLife: 0.8 })
  }

  private spawnText(content: string, x: number, y: number, tint: number, size: number) {
    if (!this.app) return
    const style = new TextStyle({
      fontFamily: '"Arial Black", "Segoe UI", sans-serif',
      fontSize: size,
      fontWeight: '900',
      fill: tint,
      stroke: { color: 0x1a0f08, width: 6 },
      letterSpacing: 1,
    })
    const text = new Text({ text: content, style })
    text.anchor.set(0.5)
    text.x = Math.min(Math.max(x, 80), this.app.screen.width - 80)
    text.y = Math.max(y, 70)
    this.textLayer.addChild(text)
    this.floatTexts.push({ view: text, life: 0.9, maxLife: 0.9, vy: -46 })
  }

  // ------------------------------------------------------------- trail

  private drawTrail() {
    const now = performance.now()
    this.trail = this.trail.filter((pt) => now - pt.t < TRAIL_LIFE_MS)
    this.trailGfx.clear()
    if (this.trail.length < 2) return

    // Layered glow, tapered by point age: wide soft glow, mid glow, hot core.
    const passes: Array<{ width: number; color: number; alpha: number }> = [
      { width: 22, color: 0xff9f1c, alpha: 0.16 },
      { width: 11, color: 0xffd166, alpha: 0.34 },
      { width: 4.5, color: 0xffffff, alpha: 0.95 },
    ]
    for (const pass of passes) {
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1]
        const b = this.trail[i]
        const age = 1 - (now - b.t) / TRAIL_LIFE_MS
        this.trailGfx.moveTo(a.x, a.y)
        this.trailGfx.lineTo(b.x, b.y)
        this.trailGfx.stroke({
          width: Math.max(0.5, pass.width * age),
          color: pass.color,
          alpha: pass.alpha * age,
          cap: 'round',
          join: 'round',
        })
      }
    }
  }

  // ------------------------------------------------------------- finish

  private finish() {
    if (this.status === 'ended') return
    this.status = 'ended'
    this.slicing = false
    audio.stopMusic()
    this.emitHud()
    const durationSeconds = Math.max(1, Math.round((performance.now() - this.sessionStart) / 1000))
    this.onEnd({
      score: this.score,
      comboHighwater: this.comboHigh,
      durationSeconds,
      mode: this.mode,
    })
  }
}

function segmentHitsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(cx - x1, cy - y1) <= r
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const px = x1 + t * dx
  const py = y1 + t * dy
  return Math.hypot(cx - px, cy - py) <= r
}
