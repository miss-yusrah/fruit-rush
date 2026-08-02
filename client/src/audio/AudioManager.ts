import type { FruitKind } from '../game/types'
import { FRUIT_VOICE, type Edible, type SpecialFruit } from './fruitVoices'
import {
  envGain,
  jitter,
  noiseBuffer,
  now,
  pick,
  playBass,
  playClap,
  playKick,
  playNoise,
  playSweep,
  playTone,
  startLoopNoise,
  type Ctx,
} from './synth'

const SFX_KEY = 'fruit-rush-sfx'
const MUSIC_KEY = 'fruit-rush-music'
const MUTE_KEY = 'fruit-rush-muted'
const VOL_MUSIC_KEY = 'fruit-rush-vol-music'
const VOL_SFX_KEY = 'fruit-rush-vol-sfx'

export type MusicTheme = 'menu' | 'gameplay' | 'hype' | 'none'

export type UiCue =
  | 'hover'
  | 'tap'
  | 'press'
  | 'pop'
  | 'open'
  | 'close'
  | 'reward'
  | 'leaderboard'
  | 'levelUp'
  | 'whoosh'
  | 'count'

export type AudioChannel = 'music' | 'sfx' | 'ui' | 'ambient'

export interface AudioSettings {
  /** Slice, bomb, combo, UI taps, countdown. */
  sfx: boolean
  /** Background themes + ambience. */
  music: boolean
}

type ThemeState = {
  gain: GainNode
  timer: number | null
  beat: number
  bpm: number
}

/**
 * Premium Fruit Rush audio — procedural Web Audio across independent buses.
 * Gameplay never touches AudioContext directly; call these methods.
 */
export class AudioManager {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private uiBus: GainNode | null = null
  private ambientBus: GainNode | null = null

  private noise: AudioBuffer | null = null
  private longNoise: AudioBuffer | null = null
  private unlocked = false
  private suspendedByVisibility = false

  private sfxEnabled = true
  private musicEnabled = true
  private musicVolume = 0.75
  private sfxVolume = 1

  private theme: MusicTheme = 'none'
  private themes: Partial<Record<Exclude<MusicTheme, 'none'>, ThemeState>> = {}
  private comboLayers: GainNode[] = []
  private ambientLoop: { stop: (fadeSec?: number) => void } | null = null
  private iceAmbience: { stop: (fadeSec?: number) => void } | null = null

  private lastPlay = new Map<string, number>()
  private coinStreak = 0
  private coinStreakTimer: number | null = null
  private visibilityBound = false

  constructor() {
    try {
      if (localStorage.getItem(MUTE_KEY) === '1') {
        localStorage.setItem(SFX_KEY, '0')
        localStorage.setItem(MUSIC_KEY, '0')
        localStorage.removeItem(MUTE_KEY)
      }
      if (localStorage.getItem(SFX_KEY) === '0') this.sfxEnabled = false
      if (localStorage.getItem(MUSIC_KEY) === '0') this.musicEnabled = false
      // getItem returns null when missing — Number(null) === 0, which would
      // mute every bus. Only apply stored volumes when the key actually exists
      // and is > 0. Also scrub any accidental 0s left by the earlier bug.
      const vmRaw = localStorage.getItem(VOL_MUSIC_KEY)
      const vsRaw = localStorage.getItem(VOL_SFX_KEY)
      if (vmRaw != null) {
        const vm = Number(vmRaw)
        if (Number.isFinite(vm) && vm > 0 && vm <= 1) this.musicVolume = vm
        else localStorage.removeItem(VOL_MUSIC_KEY)
      }
      if (vsRaw != null) {
        const vs = Number(vsRaw)
        if (Number.isFinite(vs) && vs > 0 && vs <= 1) this.sfxVolume = vs
        else localStorage.removeItem(VOL_SFX_KEY)
      }
    } catch {
      /* ignore */
    }
  }

  get settings(): AudioSettings {
    return { sfx: this.sfxEnabled, music: this.musicEnabled }
  }

  get isMusicEnabled() {
    return this.musicEnabled
  }

  get isSfxEnabled() {
    return this.sfxEnabled
  }

  get isUnlocked() {
    return this.unlocked
  }

  get currentTheme() {
    return this.theme
  }

  get contextState() {
    return this.ctx?.state ?? 'none'
  }

  getVolume(channel: AudioChannel): number {
    if (channel === 'music' || channel === 'ambient') return this.musicVolume
    return this.sfxVolume
  }

  // ── Bootstrap / unlock ────────────────────────────────────

  private bootstrap() {
    if (this.ctx) return
    const CtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!CtxClass) return
    this.ctx = new CtxClass()
    this.master = this.ctx.createGain()
    this.master.gain.value = 1
    this.master.connect(this.ctx.destination)

    this.musicBus = this.ctx.createGain()
    this.musicBus.gain.value = this.musicEnabled ? this.musicVolume : 0
    this.musicBus.connect(this.master)

    this.sfxBus = this.ctx.createGain()
    this.sfxBus.gain.value = this.sfxEnabled ? this.sfxVolume : 0
    this.sfxBus.connect(this.master)

    this.uiBus = this.ctx.createGain()
    this.uiBus.gain.value = this.sfxEnabled ? this.sfxVolume * 0.95 : 0
    this.uiBus.connect(this.master)

    this.ambientBus = this.ctx.createGain()
    this.ambientBus.gain.value = this.musicEnabled ? this.musicVolume * 0.55 : 0
    this.ambientBus.connect(this.master)

    this.noise = noiseBuffer(this.ctx, 0.4)
    this.longNoise = noiseBuffer(this.ctx, 2.2)
    this.buildThemeGains()
    this.bindVisibility()
  }

  private buildThemeGains() {
    if (!this.ctx || !this.musicBus) return
    for (const id of ['menu', 'gameplay', 'hype'] as const) {
      const gain = this.ctx.createGain()
      gain.gain.value = 0.0001
      gain.connect(this.musicBus)
      this.themes[id] = {
        gain,
        timer: null,
        beat: 0,
        // Menu 124 · Hype 128 (hotter dance groove) · Gameplay quiet bed
        bpm: id === 'menu' ? 124 : id === 'hype' ? 128 : 92,
      }
    }
    // Gameplay combo intensity layers sit under the gameplay theme gain.
    this.comboLayers = [0, 1, 2].map(() => {
      const g = this.ctx!.createGain()
      g.gain.value = 0.0001
      g.connect(this.themes.gameplay!.gain)
      return g
    })
  }

  private bindVisibility() {
    if (this.visibilityBound || typeof document === 'undefined') return
    this.visibilityBound = true
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.onAppHidden()
      else void this.onAppVisible()
    })
  }

  private onAppHidden() {
    if (!this.ctx || this.ctx.state !== 'running') return
    this.suspendedByVisibility = true
    void this.ctx.suspend().catch(() => {
      /* ignore */
    })
  }

  private async onAppVisible() {
    if (!this.ctx || !this.suspendedByVisibility) return
    this.suspendedByVisibility = false
    try {
      await this.ctx.resume()
    } catch {
      /* gesture may be required */
    }
  }

  private resumeIfNeeded() {
    if (!this.ctx) return
    if (this.ctx.state === 'suspended' && !this.suspendedByVisibility) {
      void this.ctx.resume().catch(() => {
        /* gesture required */
      })
    }
  }

  async unlock() {
    this.bootstrap()
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* ignore */
      }
    }
    // Only mark unlocked once the context can actually output audio.
    if (this.ctx.state === 'running') this.unlocked = true
  }

  /** Sync kick from pointer handlers — keeps audio alive during a round. */
  kick() {
    this.bootstrap()
    if (!this.ctx) return
    this.resumeIfNeeded()
    if (this.ctx.state === 'running') this.unlocked = true
  }

  // ── Settings ──────────────────────────────────────────────

  setSfxEnabled(next: boolean) {
    this.sfxEnabled = next
    this.persist()
    this.applyBusGains()
  }

  setMusicEnabled(next: boolean) {
    this.musicEnabled = next
    this.persist()
    this.applyBusGains()
    if (!next) this.stopMusic()
  }

  setVolume(channel: AudioChannel, value: number) {
    const v = Math.max(0, Math.min(1, value))
    if (channel === 'music' || channel === 'ambient') this.musicVolume = v
    else this.sfxVolume = v
    this.persist()
    this.applyBusGains()
  }

  private applyBusGains() {
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxEnabled ? this.sfxVolume : 0
    if (this.uiBus) this.uiBus.gain.value = this.sfxEnabled ? this.sfxVolume * 0.95 : 0
    if (this.musicBus) this.musicBus.gain.value = this.musicEnabled ? this.musicVolume : 0
    if (this.ambientBus) {
      this.ambientBus.gain.value = this.musicEnabled ? this.musicVolume * 0.55 : 0
    }
  }

  private persist() {
    try {
      localStorage.setItem(SFX_KEY, this.sfxEnabled ? '1' : '0')
      localStorage.setItem(MUSIC_KEY, this.musicEnabled ? '1' : '0')
      localStorage.setItem(VOL_MUSIC_KEY, String(this.musicVolume))
      localStorage.setItem(VOL_SFX_KEY, String(this.sfxVolume))
    } catch {
      /* ignore */
    }
  }

  // ── Pooling ───────────────────────────────────────────────

  private canPlay(key: string, minGapMs: number): boolean {
    const t = performance.now()
    const last = this.lastPlay.get(key) ?? 0
    if (t - last < minGapMs) return false
    this.lastPlay.set(key, t)
    return true
  }

  // ── Theme control / crossfade ─────────────────────────────

  /** Back-compat: start the catchy menu theme. */
  startMusic() {
    this.playTheme('menu')
  }

  stopMusic() {
    this.stopAmbient(0.35)
    this.stopIceAmbience(0.2)
    this.crossfadeTo('none', 350)
  }

  /**
   * Mode select → arena: fade menu (~1s), cinematic whoosh, gameplay ambience.
   */
  enterGameplay() {
    this.kick()
    this.playUi('whoosh')
    this.crossfadeTo('gameplay', 1000)
    this.setComboIntensity(0)
    this.startAmbient()
  }

  /** Soft return to the tropical menu dance bed. */
  enterMenu() {
    this.stopAmbient(0.5)
    this.stopIceAmbience(0.2)
    this.crossfadeTo('menu', 700)
  }

  /**
   * Hotter alternate dance groove — shop, tournaments, frenzy, hot streaks.
   */
  enterHype(fadeMs = 500) {
    this.kick()
    this.crossfadeTo('hype', fadeMs)
  }

  /** Defeat sting, then the dance menu theme keeps the party going. */
  enterResults(kind: 'nice' | 'juicy' | 'rush' | 'close' = 'nice') {
    this.stopAmbient(0.25)
    this.stopIceAmbience(0.15)
    this.playDefeatSting(kind)
    window.setTimeout(() => this.crossfadeTo('menu', 500), 280)
  }

  playTheme(theme: Exclude<MusicTheme, 'none'>, fadeMs = 500) {
    this.crossfadeTo(theme, fadeMs)
  }

  private crossfadeTo(next: MusicTheme, fadeMs: number) {
    this.kick()
    if (!this.ctx || !this.musicEnabled) {
      if (!this.musicEnabled) this.haltAllThemes()
      return
    }
    if (next !== 'none' && this.theme === next) {
      // Ensure scheduler is alive after unlock.
      this.ensureThemeScheduler(next)
      return
    }

    const t = now(this.ctx)
    const fade = Math.max(0.05, fadeMs / 1000)

    for (const id of ['menu', 'gameplay', 'hype'] as const) {
      const state = this.themes[id]
      if (!state) continue
      state.gain.gain.cancelScheduledValues(t)
      const cur = Math.max(0.0001, state.gain.gain.value)
      state.gain.gain.setValueAtTime(cur, t)
      if (id === next) {
        // Dance themes hit hard; gameplay bed stays supportive.
        const target = id === 'gameplay' ? 0.55 : 1
        state.gain.gain.exponentialRampToValueAtTime(target, t + fade)
      } else {
        state.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade)
        this.clearThemeTimer(id)
      }
    }

    this.theme = next
    if (next !== 'none') this.ensureThemeScheduler(next)
  }

  private haltAllThemes() {
    for (const id of ['menu', 'gameplay', 'hype'] as const) {
      this.clearThemeTimer(id)
      const state = this.themes[id]
      if (state && this.ctx) {
        state.gain.gain.cancelScheduledValues(now(this.ctx))
        state.gain.gain.value = 0.0001
      }
    }
    this.theme = 'none'
  }

  private clearThemeTimer(id: Exclude<MusicTheme, 'none'>) {
    const state = this.themes[id]
    if (state?.timer != null) {
      window.clearTimeout(state.timer)
      state.timer = null
    }
  }

  private ensureThemeScheduler(id: Exclude<MusicTheme, 'none'>) {
    const state = this.themes[id]
    if (!state || state.timer != null) return
    state.beat = 0
    if (id === 'menu') this.scheduleMenu()
    else if (id === 'hype') this.scheduleHype()
    else this.scheduleGameplay()
  }

  // ── Menu theme — danceable tropical house (124 BPM) ───────
  // Built like a real club loop: 4-on-the-floor kick, claps on
  // 2+4, hi-hats, bouncing bass, steel-drum hook, chord stabs.

  private scheduleMenu() {
    const state = this.themes.menu
    if (!state || this.theme !== 'menu' || !this.ctx) return
    this.resumeIfNeeded()
    const ctx = this.ctx
    const dest = state.gain
    // Schedule in 16th-notes so the groove actually swings.
    const sixteenth = 60 / state.bpm / 4
    const t0 = now(ctx)

    // 8 sixteenths ahead keeps phones happy without sounding sparse.
    for (let i = 0; i < 8; i++) {
      const when = t0 + i * sixteenth
      const step = (state.beat + i) % 32 // 2-bar phrase
      this.menuKick(dest, when, step)
      this.menuClap(dest, when, step)
      this.menuHats(dest, when, step)
      this.menuBassline(dest, when, step)
      this.menuHook(dest, when, step)
      this.menuStabs(dest, when, step)
      this.menuFill(dest, when, step)
    }
    state.beat = (state.beat + 8) % 32
    state.timer = window.setTimeout(() => {
      state.timer = null
      this.scheduleMenu()
    }, sixteenth * 8 * 1000 - 12)
  }

  /** Four-on-the-floor — the thing that makes bodies move. */
  private menuKick(dest: GainNode, when: number, step: number) {
    if (!this.ctx) return
    if (step % 4 === 0) {
      playKick(this.ctx, dest, { peak: 0.62, when, decay: 0.3 })
    }
    // Extra pump on the "and" of 4 every other bar — carnival bounce
    if (step === 14 || step === 30) {
      playKick(this.ctx, dest, { peak: 0.28, when, decay: 0.16 })
    }
  }

  private menuClap(dest: GainNode, when: number, step: number) {
    if (!this.ctx || !this.noise) return
    // Backbeat on beats 2 and 4 (steps 4 and 12 inside each bar of 16)
    if (step % 16 === 4 || step % 16 === 12) {
      playClap(this.ctx, dest, this.noise, { peak: 0.32, when })
    }
  }

  private menuHats(dest: GainNode, when: number, step: number) {
    if (!this.ctx || !this.noise) return
    // Closed hats on every off-16th — busy dance energy
    if (step % 2 === 1) {
      playNoise(this.ctx, dest, {
        buffer: this.noise,
        peak: 0.07,
        attack: 0.001,
        decay: 0.04,
        when,
        highpass: 6000,
        lowpass: 14000,
      })
    }
    // Open hat on the "and" of every beat
    if (step % 4 === 2) {
      playNoise(this.ctx, dest, {
        buffer: this.noise,
        peak: 0.12,
        attack: 0.002,
        decay: 0.14,
        when,
        highpass: 4500,
        lowpass: 12000,
      })
    }
    // Shaker / wood layer for tropical color
    if (step % 4 === 3) {
      playTone(this.ctx, dest, {
        type: 'triangle',
        freq: 920,
        peak: 0.035,
        decay: 0.035,
        when,
        detune: jitter(0.03),
      })
    }
  }

  /**
   * Bouncy bass — root notes that lock with the kick.
   * Pattern walks Am → F → C → G (tropical house favourite).
   */
  private menuBassline(dest: GainNode, when: number, step: number) {
    if (!this.ctx) return
    // One chord per half-bar (8 sixteenths)
    const roots = [55, 55, 43.65, 43.65, 65.41, 65.41, 49, 49] // A1 F1 C2 G1
    const root = roots[Math.floor(step / 4) % roots.length]!

    // Driving 8th-note bass with syncopated ghost notes
    if (step % 2 === 0) {
      const ghost = step % 4 === 2
      playBass(this.ctx, dest, {
        freq: ghost ? root * 1.5 : root,
        peak: ghost ? 0.12 : 0.26,
        decay: ghost ? 0.12 : 0.2,
        cutoff: ghost ? 700 : 480,
        when,
      })
    }
    // Off-beat punch every bar
    if (step % 16 === 7 || step % 16 === 15) {
      playBass(this.ctx, dest, {
        freq: root * 2,
        peak: 0.14,
        decay: 0.1,
        cutoff: 900,
        when,
      })
    }
  }

  /**
   * Steel-drum / marimba hook — the earworm you hum after one listen.
   * Syncopated so it dances on top of the kick.
   */
  private menuHook(dest: GainNode, when: number, step: number) {
    if (!this.ctx) return
    // Frequencies: C5 E5 G5 A5 · phrase repeats with a lift in bar 2
    const phraseA: (number | 0)[] = [
      523, 0, 659, 0, 784, 659, 0, 880, // bar 1
      784, 0, 659, 523, 0, 659, 784, 0,
    ]
    const phraseB: (number | 0)[] = [
      523, 0, 659, 784, 0, 880, 784, 0, // bar 2 — climbs
      1046, 880, 0, 784, 659, 0, 784, 880,
    ]
    const phrase = step < 16 ? phraseA : phraseB
    const f = phrase[step % 16]!
    if (!f) return

    // Steel-drum body (triangle + high sine shimmer)
    playTone(this.ctx, dest, {
      type: 'triangle',
      freq: f,
      peak: 0.14,
      attack: 0.003,
      decay: 0.22,
      when,
      detune: jitter(0.012),
    })
    playTone(this.ctx, dest, {
      type: 'sine',
      freq: f * 2.01,
      peak: 0.05,
      attack: 0.003,
      decay: 0.16,
      when,
    })
    // Soft octave sparkle on accents
    if (step % 8 === 0 || step === 22) {
      playTone(this.ctx, dest, {
        type: 'sine',
        freq: f * 3,
        peak: 0.03,
        decay: 0.28,
        when: when + 0.01,
      })
    }
  }

  /** Bright chord stabs — hands-in-the-air moments. */
  private menuStabs(dest: GainNode, when: number, step: number) {
    if (!this.ctx) return
    // Stab on the upbeat before each chord change
    if (step !== 0 && step !== 8 && step !== 16 && step !== 24) return

    const chords: number[][] = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [261.63, 329.63, 392], // C
      [196, 246.94, 293.66], // G
    ]
    const chord = chords[Math.floor(step / 8) % chords.length]!
    chord.forEach((f, i) => {
      playTone(this.ctx!, dest, {
        type: 'sawtooth',
        freq: f,
        peak: 0.055 - i * 0.01,
        attack: 0.01,
        decay: 0.35,
        when,
      })
      playTone(this.ctx!, dest, {
        type: 'sine',
        freq: f * 2,
        peak: 0.025,
        attack: 0.01,
        decay: 0.28,
        when,
      })
    })
  }

  /** End-of-phrase fill so the loop feels like a song, not a metronome. */
  private menuFill(dest: GainNode, when: number, step: number) {
    if (!this.ctx || !this.noise) return
    // Rising tom/clap roll into the loop point
    if (step >= 28) {
      const i = step - 28
      playKick(this.ctx, dest, { peak: 0.2 + i * 0.06, when, decay: 0.12 })
      playNoise(this.ctx, dest, {
        buffer: this.noise,
        peak: 0.08 + i * 0.03,
        decay: 0.05,
        when,
        highpass: 2000,
        lowpass: 8000,
      })
    }
    // Juicy sparkle accent mid-phrase
    if (step === 15) {
      ;[1046, 1318, 1568].forEach((f, i) => {
        playTone(this.ctx!, dest, {
          type: 'sine',
          freq: f,
          peak: 0.06,
          decay: 0.2,
          when: when + i * 0.04,
        })
      })
    }
  }

  // ── Gameplay theme — quiet supportive bed ─────────────────

  private scheduleGameplay() {
    const state = this.themes.gameplay
    if (!state || this.theme !== 'gameplay' || !this.ctx) return
    this.resumeIfNeeded()
    const ctx = this.ctx
    const beat = 60 / state.bpm
    const t0 = now(ctx)

    for (let i = 0; i < 2; i++) {
      const when = t0 + i * beat
      const step = (state.beat + i) % 16
      this.gameBed(when, step)
      this.gameBamboo(when, step)
      this.gameBird(when, step)
    }
    state.beat = (state.beat + 2) % 16
    state.timer = window.setTimeout(() => {
      state.timer = null
      this.scheduleGameplay()
    }, beat * 2 * 1000 - 18)
  }

  private gameBed(when: number, step: number) {
    const dest = this.comboLayers[0]
    if (!this.ctx || !dest) return
    if (step % 4 === 0) {
      playTone(this.ctx, dest, { type: 'sine', freq: 82, peak: 0.07, decay: 0.5, when })
    }
    if (step % 8 === 4) {
      playTone(this.ctx, dest, { type: 'triangle', freq: 164, peak: 0.035, decay: 0.4, when })
    }
  }

  private gameBamboo(when: number, step: number) {
    const dest = this.comboLayers[1]
    if (!this.ctx || !dest || !this.noise) return
    if (step % 4 === 0) {
      playTone(this.ctx, dest, {
        type: 'triangle',
        freq: 220 + (step % 8) * 8,
        peak: 0.03,
        decay: 0.08,
        when,
        detune: jitter(0.03),
      })
    }
    if (step % 4 === 2) {
      playNoise(this.ctx, dest, {
        buffer: this.noise,
        peak: 0.035,
        decay: 0.06,
        when,
        highpass: 1800,
        lowpass: 4500,
      })
    }
  }

  private gameBird(when: number, step: number) {
    const dest = this.comboLayers[2]
    if (!this.ctx || !dest) return
    if (step === 5 || step === 13) {
      const f = pick([1800, 2100, 2400])
      playTone(this.ctx, dest, {
        type: 'sine',
        freq: f,
        peak: 0.025,
        attack: 0.01,
        decay: 0.12,
        when,
      })
      playTone(this.ctx, dest, {
        type: 'sine',
        freq: f * 1.12,
        peak: 0.018,
        attack: 0.01,
        decay: 0.1,
        when: when + 0.07,
      })
    }
  }

  /** Combo builds the gameplay bed — extra layers fade in with skill. */
  setComboIntensity(combo: number) {
    if (!this.ctx || this.comboLayers.length < 3) return
    const t = now(this.ctx)
    const targets = [
      0.9, // soft bed always (under gameplay gain)
      combo >= 4 ? 0.85 : 0.4,
      combo >= 10 ? 0.7 : 0.15,
    ]
    this.comboLayers.forEach((g, i) => {
      g.gain.cancelScheduledValues(t)
      g.gain.setTargetAtTime(targets[i]!, t, 0.22)
    })
  }

  private startAmbient() {
    if (!this.ctx || !this.ambientBus || !this.longNoise || !this.musicEnabled) return
    this.stopAmbient(0.1)
    this.ambientLoop = startLoopNoise(this.ctx, this.ambientBus, this.longNoise, {
      peak: 0.045,
      highpass: 180,
      lowpass: 1600,
    })
  }

  private stopAmbient(fadeSec = 0.4) {
    this.ambientLoop?.stop(fadeSec)
    this.ambientLoop = null
  }

  private startIceAmbience() {
    if (!this.ctx || !this.ambientBus || !this.longNoise || !this.sfxEnabled) return
    this.stopIceAmbience(0.05)
    this.iceAmbience = startLoopNoise(this.ctx, this.ambientBus, this.longNoise, {
      peak: 0.035,
      highpass: 1200,
      lowpass: 5000,
    })
    window.setTimeout(() => this.stopIceAmbience(0.8), 2200)
  }

  private stopIceAmbience(fadeSec = 0.3) {
    this.iceAmbience?.stop(fadeSec)
    this.iceAmbience = null
  }

  // ── Hype theme — hotter alternate dance groove (128 BPM) ──
  // Different key / hook so shop, tournaments, and frenzy feel fresh.

  private scheduleHype() {
    const state = this.themes.hype
    if (!state || this.theme !== 'hype' || !this.ctx) return
    this.resumeIfNeeded()
    const ctx = this.ctx
    const dest = state.gain
    const sixteenth = 60 / state.bpm / 4
    const t0 = now(ctx)

    for (let i = 0; i < 8; i++) {
      const when = t0 + i * sixteenth
      const step = (state.beat + i) % 32
      this.hypeKick(dest, when, step)
      this.hypeClap(dest, when, step)
      this.hypeHats(dest, when, step)
      this.hypeBass(dest, when, step)
      this.hypeHook(dest, when, step)
      this.hypeStabs(dest, when, step)
    }
    state.beat = (state.beat + 8) % 32
    state.timer = window.setTimeout(() => {
      state.timer = null
      this.scheduleHype()
    }, sixteenth * 8 * 1000 - 12)
  }

  private hypeKick(dest: GainNode, when: number, step: number) {
    if (!this.ctx) return
    if (step % 4 === 0) playKick(this.ctx, dest, { peak: 0.64, when, decay: 0.28 })
    // Double-time kicks in the second bar — more urgency
    if (step >= 16 && (step === 18 || step === 22 || step === 26 || step === 30)) {
      playKick(this.ctx, dest, { peak: 0.3, when, decay: 0.14 })
    }
  }

  private hypeClap(dest: GainNode, when: number, step: number) {
    if (!this.ctx || !this.noise) return
    if (step % 16 === 4 || step % 16 === 12) {
      playClap(this.ctx, dest, this.noise, { peak: 0.34, when })
    }
    // Extra clap roll into bar 2
    if (step === 14 || step === 15) {
      playClap(this.ctx, dest, this.noise, { peak: 0.16, when })
    }
  }

  private hypeHats(dest: GainNode, when: number, step: number) {
    if (!this.ctx || !this.noise) return
    // 16th hats — busier than menu
    playNoise(this.ctx, dest, {
      buffer: this.noise,
      peak: step % 2 === 0 ? 0.055 : 0.09,
      attack: 0.001,
      decay: 0.035,
      when,
      highpass: 6500,
      lowpass: 15000,
    })
    if (step % 8 === 6) {
      playNoise(this.ctx, dest, {
        buffer: this.noise,
        peak: 0.14,
        decay: 0.16,
        when,
        highpass: 4000,
        lowpass: 11000,
      })
    }
  }

  /** Em → C → G → D — different colour from the menu Am progression. */
  private hypeBass(dest: GainNode, when: number, step: number) {
    if (!this.ctx) return
    const roots = [82.41, 82.41, 65.41, 65.41, 98, 98, 73.42, 73.42] // E2 C2 G2 D2
    const root = roots[Math.floor(step / 4) % roots.length]!
    if (step % 2 === 0) {
      playBass(this.ctx, dest, {
        freq: root,
        peak: 0.28,
        decay: 0.18,
        cutoff: 560,
        when,
      })
    }
    if (step % 4 === 3) {
      playBass(this.ctx, dest, {
        freq: root * 2,
        peak: 0.16,
        decay: 0.1,
        cutoff: 980,
        when,
      })
    }
  }

  /** Faster, punchier hook — feels like a drop. */
  private hypeHook(dest: GainNode, when: number, step: number) {
    if (!this.ctx) return
    const phraseA: (number | 0)[] = [
      659, 0, 784, 659, 0, 987, 784, 0, // E G E B G
      659, 784, 0, 880, 784, 0, 659, 523,
    ]
    const phraseB: (number | 0)[] = [
      784, 0, 987, 880, 0, 1174, 987, 0, // climbs harder
      1318, 1174, 987, 0, 880, 784, 0, 987,
    ]
    const f = (step < 16 ? phraseA : phraseB)[step % 16]!
    if (!f) return
    playTone(this.ctx, dest, {
      type: 'square',
      freq: f,
      peak: 0.08,
      attack: 0.002,
      decay: 0.12,
      when,
      detune: jitter(0.01),
    })
    playTone(this.ctx, dest, {
      type: 'triangle',
      freq: f,
      peak: 0.11,
      attack: 0.002,
      decay: 0.18,
      when,
    })
    playTone(this.ctx, dest, {
      type: 'sine',
      freq: f * 2,
      peak: 0.04,
      decay: 0.14,
      when,
    })
  }

  private hypeStabs(dest: GainNode, when: number, step: number) {
    if (!this.ctx) return
    if (step !== 0 && step !== 8 && step !== 16 && step !== 24) return
    const chords: number[][] = [
      [164.81, 196, 246.94], // Em
      [130.81, 164.81, 196], // C
      [196, 246.94, 293.66], // G
      [146.83, 185, 220], // D
    ]
    const chord = chords[Math.floor(step / 8) % chords.length]!
    chord.forEach((f, i) => {
      playTone(this.ctx!, dest, {
        type: 'sawtooth',
        freq: f * 2,
        peak: 0.06 - i * 0.012,
        attack: 0.008,
        decay: 0.28,
        when,
      })
    })
  }

  // ── Slice / juice ─────────────────────────────────────────

  playSlice(kind: FruitKind) {
    if (!this.sfxReady() || kind === 'bomb' || kind === 'spike' || kind === 'ice') return
    if (!this.canPlay(`slice:${kind}`, 28)) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const voice = FRUIT_VOICE[kind as Edible]
    const t = now(ctx)
    const pitch = 1 + (Math.random() * 2 - 1) * 0.07
    const variant = pick([0.92, 1, 1.08])

    // Body / pulp
    voice.freqs.forEach((f, i) => {
      playTone(ctx, dest, {
        type: i === 0 ? 'triangle' : 'sine',
        freq: f * pitch * variant,
        peak: (0.28 - i * 0.06) * (0.85 + voice.wet * 0.2),
        attack: 0.002,
        decay: 0.14 + voice.wet * 0.06,
        when: t + i * 0.008,
        detune: jitter(0.04),
      })
    })

    // Blade through flesh
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: voice.noisePeak * 1.35,
      attack: 0.001,
      decay: 0.07 + voice.wet * 0.04,
      when: t,
      highpass: 900,
      lowpass: voice.lowpass,
    })

    if (voice.crack) {
      playTone(ctx, dest, {
        type: 'square',
        freq: voice.freqs[0]! * 1.6 * pitch,
        peak: 0.07,
        decay: 0.05,
        when: t,
      })
      playNoise(ctx, dest, {
        buffer: this.noise!,
        peak: 0.09,
        decay: 0.06,
        when: t + 0.01,
        highpass: 2500,
        lowpass: 8000,
      })
    }

    this.playJuice(t + 0.018, voice)
  }

  private playJuice(when: number, voice: { juiceBright: number; wet: number }) {
    if (!this.ctx || !this.sfxBus || !this.noise) return
    const ctx = this.ctx
    const dest = this.sfxBus

    // Splash body
    playTone(ctx, dest, {
      type: 'sine',
      freq: (700 + Math.random() * 500) * voice.juiceBright,
      peak: 0.05 * voice.wet,
      decay: 0.08,
      when,
      detune: jitter(0.06),
    })
    // Droplets
    for (let i = 0; i < 3; i++) {
      playTone(ctx, dest, {
        type: 'sine',
        freq: 1100 + Math.random() * 900 * voice.juiceBright,
        peak: 0.028,
        decay: 0.05,
        when: when + 0.02 + i * 0.022,
      })
    }
    // Wet impact / splatter
    playNoise(ctx, dest, {
      buffer: this.noise,
      peak: 0.06 * voice.wet,
      decay: 0.09,
      when,
      highpass: 2000,
      lowpass: 9500,
    })
  }

  /** @deprecated splash is folded into playSlice — kept for callers. */
  playSplash(when?: number) {
    if (!this.sfxReady()) return
    this.playJuice(when ?? now(this.ctx!), { juiceBright: 1, wet: 0.8 })
  }

  // ── Blade / swipe ─────────────────────────────────────────

  /** Subtle air movement while swiping — intensity scales with speed. */
  playBlade(speedPx: number) {
    if (!this.sfxReady() || !this.canPlay('blade', 42)) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)
    const intensity = Math.min(1, speedPx / 140)
    if (intensity < 0.12) return

    if (intensity > 0.55) {
      playSweep(ctx, dest, {
        type: 'sawtooth',
        startFreq: 900 + intensity * 600,
        endFreq: 280,
        peak: 0.045 + intensity * 0.05,
        attack: 0.008,
        decay: 0.12 + intensity * 0.08,
        when: t,
        highpass: 400,
        lowpass: 5000,
      })
    } else {
      playNoise(ctx, dest, {
        buffer: this.noise!,
        peak: 0.025 + intensity * 0.04,
        attack: 0.005,
        decay: 0.08,
        when: t,
        highpass: 1500,
        lowpass: 6000,
      })
    }
  }

  // ── Combos ────────────────────────────────────────────────

  playCombo(combo: number) {
    if (!this.sfxReady()) return
    this.setComboIntensity(combo)
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)

    if (combo === 2) {
      playTone(ctx, dest, { type: 'sine', freq: 880, peak: 0.09, decay: 0.14, when: t })
      return
    }
    if (combo === 3) {
      playTone(ctx, dest, { type: 'sine', freq: 990, peak: 0.11, decay: 0.12, when: t })
      playTone(ctx, dest, { type: 'sine', freq: 1320, peak: 0.08, decay: 0.16, when: t + 0.04 })
      playTone(ctx, dest, { type: 'triangle', freq: 660, peak: 0.06, decay: 0.1, when: t + 0.02 })
      return
    }
    if (combo === 5) {
      ;[0, 0.06, 0.12].forEach((off, i) => {
        playTone(ctx, dest, {
          type: 'triangle',
          freq: 880 + i * 220,
          peak: 0.11,
          decay: 0.18,
          when: t + off,
        })
      })
      playNoise(ctx, dest, {
        buffer: this.noise!,
        peak: 0.08,
        decay: 0.15,
        when: t,
        highpass: 1200,
        lowpass: 5000,
      })
      return
    }
    if (combo === 8) {
      playSweep(ctx, dest, {
        type: 'sawtooth',
        startFreq: 180,
        endFreq: 720,
        peak: 0.14,
        attack: 0.02,
        decay: 0.35,
        when: t,
        highpass: 200,
        lowpass: 4500,
      })
      ;[523, 659, 784, 1046].forEach((f, i) => {
        playTone(ctx, dest, {
          type: 'sine',
          freq: f,
          peak: 0.09,
          decay: 0.28,
          when: t + 0.04 + i * 0.05,
        })
      })
      return
    }
    if (combo >= 10 && (combo === 10 || combo % 5 === 0)) {
      if (!this.canPlay('combo-epic', 400)) return
      // Crowd-ish cheer + flourish
      playNoise(ctx, dest, {
        buffer: this.noise!,
        peak: 0.15,
        attack: 0.03,
        decay: 0.6,
        when: t,
        highpass: 500,
        lowpass: 2600,
      })
      ;[523, 659, 784, 988, 1174].forEach((f, i) => {
        playTone(ctx, dest, {
          type: 'sine',
          freq: f,
          peak: 0.1,
          decay: 0.32,
          when: t + 0.05 + i * 0.045,
        })
      })
      playTone(ctx, dest, { type: 'triangle', freq: 196, peak: 0.1, decay: 0.5, when: t })
    }
  }

  // ── Hazards ───────────────────────────────────────────────

  playBombAppear() {
    if (!this.sfxReady() || !this.canPlay('bomb-appear', 200)) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)
    playTone(ctx, dest, { type: 'sine', freq: 120, peak: 0.1, decay: 0.35, when: t })
    playTone(ctx, dest, { type: 'triangle', freq: 90, peak: 0.08, decay: 0.4, when: t })
    playSweep(ctx, dest, {
      type: 'sine',
      startFreq: 200,
      endFreq: 90,
      peak: 0.07,
      attack: 0.05,
      decay: 0.35,
      when: t,
    })
  }

  playBombTick() {
    if (!this.sfxReady() || !this.canPlay('bomb-tick', 180)) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)
    playTone(ctx, dest, { type: 'square', freq: 880, peak: 0.035, decay: 0.04, when: t })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.03,
      decay: 0.03,
      when: t,
      highpass: 3000,
      lowpass: 8000,
    })
  }

  playBomb() {
    if (!this.sfxReady()) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)

    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.08,
      attack: 0.01,
      decay: 0.25,
      when: t,
      highpass: 3000,
      lowpass: 8000,
    })

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, t + 0.18)
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.34)
    const g = envGain(ctx, 0.09, 0.02, 0.16, t + 0.18)
    osc.connect(g)
    g.connect(dest)
    osc.start(t + 0.18)
    osc.stop(t + 0.4)

    // Powerful but not painful boom
    playTone(ctx, dest, { type: 'sine', freq: 48, peak: 0.38, attack: 0.005, decay: 0.55, when: t + 0.36 })
    playTone(ctx, dest, { type: 'triangle', freq: 85, peak: 0.2, decay: 0.4, when: t + 0.36 })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.26,
      attack: 0.002,
      decay: 0.42,
      when: t + 0.36,
      highpass: 80,
      lowpass: 1100,
    })
    // Camera shake / echo rumble
    playTone(ctx, dest, { type: 'sine', freq: 36, peak: 0.16, decay: 0.95, when: t + 0.45 })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.08,
      decay: 0.7,
      when: t + 0.5,
      highpass: 100,
      lowpass: 600,
    })

    this.setComboIntensity(0)
  }

  playSpike() {
    if (!this.sfxReady()) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)
    playTone(ctx, dest, { type: 'square', freq: 150, peak: 0.12, decay: 0.12, when: t })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.13,
      decay: 0.14,
      when: t,
      highpass: 700,
      lowpass: 3200,
    })
    this.setComboIntensity(0)
  }

  playIceAppear() {
    if (!this.sfxReady() || !this.canPlay('ice-appear', 250)) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)
    ;[1400, 1900, 2400].forEach((f, i) => {
      playTone(ctx, dest, {
        type: 'sine',
        freq: f,
        peak: 0.05,
        decay: 0.22,
        when: t + i * 0.04,
      })
    })
  }

  playIce() {
    if (!this.sfxReady()) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)
    // Crystal crack
    ;[1100, 1600, 2200, 2800].forEach((f, i) => {
      playTone(ctx, dest, {
        type: 'sine',
        freq: f,
        peak: 0.07,
        decay: 0.16,
        when: t + i * 0.025,
      })
    })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.09,
      decay: 0.16,
      when: t,
      highpass: 4000,
      lowpass: 11000,
    })
    this.startIceAmbience()
    // Ice shatter tail
    window.setTimeout(() => {
      if (!this.sfxReady()) return
      const t2 = now(this.ctx!)
      playNoise(this.ctx!, this.sfxBus!, {
        buffer: this.noise!,
        peak: 0.1,
        decay: 0.28,
        when: t2,
        highpass: 3500,
        lowpass: 12000,
      })
      ;[1800, 2400].forEach((f, i) => {
        playTone(this.ctx!, this.sfxBus!, {
          type: 'triangle',
          freq: f,
          peak: 0.05,
          decay: 0.2,
          when: t2 + i * 0.04,
        })
      })
    }, 400)
    this.setComboIntensity(0)
  }

  // ── Special fruits ────────────────────────────────────────

  playSpecial(kind: SpecialFruit) {
    if (!this.sfxReady()) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)

    if (kind === 'rainbow') {
      ;[523, 659, 784, 988, 1174, 1396].forEach((f, i) => {
        playTone(ctx, dest, {
          type: 'sine',
          freq: f,
          peak: 0.07,
          decay: 0.3,
          when: t + i * 0.04,
        })
      })
      return
    }
    if (kind === 'golden') {
      ;[0, 1, 2].forEach((i) => {
        playTone(ctx, dest, {
          type: 'triangle',
          freq: 880 + i * 220,
          peak: 0.09,
          decay: 0.2,
          when: t + i * 0.05,
        })
        playTone(ctx, dest, {
          type: 'sine',
          freq: 1320 + i * 110,
          peak: 0.04,
          decay: 0.25,
          when: t + 0.02 + i * 0.05,
        })
      })
      return
    }
    if (kind === 'mystery') {
      playTone(ctx, dest, { type: 'sine', freq: 370, peak: 0.1, decay: 0.35, when: t })
      playTone(ctx, dest, { type: 'sine', freq: 554, peak: 0.08, decay: 0.4, when: t + 0.08 })
      playTone(ctx, dest, { type: 'triangle', freq: 277, peak: 0.06, decay: 0.5, when: t + 0.15 })
      return
    }
    // multiplier — ascending
    ;[440, 554, 659, 880].forEach((f, i) => {
      playTone(ctx, dest, {
        type: 'triangle',
        freq: f,
        peak: 0.09,
        decay: 0.22,
        when: t + i * 0.07,
      })
    })
  }

  // ── Coins / count / level up ──────────────────────────────

  playCoin() {
    if (!this.sfxReady() || !this.canPlay('coin', 40)) return
    this.coinStreak += 1
    if (this.coinStreakTimer != null) window.clearTimeout(this.coinStreakTimer)
    this.coinStreakTimer = window.setTimeout(() => {
      this.coinStreak = 0
      this.coinStreakTimer = null
    }, 280)

    const ctx = this.ctx!
    const dest = this.uiBus!
    const t = now(ctx)
    const pitch = 1 + Math.min(0.35, (this.coinStreak - 1) * 0.04)

    // Metallic hit
    playTone(ctx, dest, {
      type: 'square',
      freq: 980 * pitch,
      peak: 0.055,
      decay: 0.05,
      when: t,
    })
    // Soft bell
    playTone(ctx, dest, {
      type: 'sine',
      freq: 1560 * pitch,
      peak: 0.07,
      decay: 0.22,
      when: t,
    })
    // Tiny sparkle
    playTone(ctx, dest, {
      type: 'sine',
      freq: 2400 * pitch,
      peak: 0.035,
      decay: 0.12,
      when: t + 0.03,
    })
  }

  playCount(_kind: 'xp' | 'coin' | 'star' = 'xp') {
    if (!this.sfxReady() || !this.canPlay('count', 35)) return
    const ctx = this.ctx!
    const dest = this.uiBus!
    const t = now(ctx)
    playTone(ctx, dest, {
      type: 'sine',
      freq: 720 + Math.random() * 180,
      peak: 0.045,
      decay: 0.06,
      when: t,
    })
  }

  playLevelUp() {
    if (!this.sfxReady()) return
    const ctx = this.ctx!
    const dest = this.uiBus!
    const t = now(ctx)
    // Fanfare
    ;[392, 523, 659, 784, 1046].forEach((f, i) => {
      playTone(ctx, dest, {
        type: 'triangle',
        freq: f,
        peak: 0.11,
        decay: 0.35,
        when: t + i * 0.07,
      })
    })
    // Sparkles
    ;[0, 1, 2, 3, 4].forEach((i) => {
      playTone(ctx, dest, {
        type: 'sine',
        freq: 1600 + i * 200,
        peak: 0.05,
        decay: 0.2,
        when: t + 0.15 + i * 0.05,
      })
    })
    // Magical shimmer + reward reveal
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.07,
      attack: 0.02,
      decay: 0.4,
      when: t + 0.1,
      highpass: 4000,
      lowpass: 12000,
    })
    playTone(ctx, dest, {
      type: 'sine',
      freq: 523,
      peak: 0.1,
      attack: 0.02,
      decay: 0.55,
      when: t + 0.35,
    })
  }

  // ── UI ────────────────────────────────────────────────────

  playUi(kind: UiCue = 'tap') {
    if (!this.sfxReady()) return
    if (!this.canPlay(`ui:${kind}`, kind === 'hover' ? 80 : 30)) return
    const ctx = this.ctx!
    const dest = this.uiBus!
    const t = now(ctx)

    switch (kind) {
      case 'hover':
        playTone(ctx, dest, { type: 'triangle', freq: 520, peak: 0.035, decay: 0.04, when: t })
        break
      case 'tap':
        playTone(ctx, dest, { type: 'triangle', freq: 420, peak: 0.08, decay: 0.06, when: t })
        playNoise(ctx, dest, {
          buffer: this.noise!,
          peak: 0.045,
          decay: 0.035,
          when: t,
          highpass: 1800,
          lowpass: 4500,
        })
        break
      case 'press':
      case 'pop':
        playTone(ctx, dest, { type: 'sine', freq: 660, peak: 0.09, decay: 0.1, when: t })
        playTone(ctx, dest, { type: 'sine', freq: 990, peak: 0.06, decay: 0.12, when: t + 0.03 })
        break
      case 'open':
        playSweep(ctx, dest, {
          type: 'triangle',
          startFreq: 200,
          endFreq: 520,
          peak: 0.07,
          attack: 0.02,
          decay: 0.22,
          when: t,
          highpass: 300,
          lowpass: 4000,
        })
        playNoise(ctx, dest, {
          buffer: this.noise!,
          peak: 0.05,
          decay: 0.18,
          when: t,
          highpass: 800,
          lowpass: 3500,
        })
        break
      case 'close':
      case 'whoosh':
        playSweep(ctx, dest, {
          type: 'sawtooth',
          startFreq: kind === 'whoosh' ? 1200 : 700,
          endFreq: kind === 'whoosh' ? 180 : 220,
          peak: kind === 'whoosh' ? 0.12 : 0.08,
          attack: 0.015,
          decay: kind === 'whoosh' ? 0.4 : 0.22,
          when: t,
          highpass: 250,
          lowpass: 5000,
        })
        playNoise(ctx, dest, {
          buffer: this.noise!,
          peak: kind === 'whoosh' ? 0.1 : 0.06,
          attack: 0.01,
          decay: kind === 'whoosh' ? 0.35 : 0.18,
          when: t,
          highpass: 600,
          lowpass: 4500,
        })
        break
      case 'reward':
        this.playReward()
        break
      case 'leaderboard':
        playSweep(ctx, dest, {
          type: 'triangle',
          startFreq: 280,
          endFreq: 640,
          peak: 0.08,
          attack: 0.03,
          decay: 0.32,
          when: t,
        })
        playTone(ctx, dest, { type: 'sine', freq: 880, peak: 0.05, decay: 0.25, when: t + 0.1 })
        break
      case 'levelUp':
        this.playLevelUp()
        break
      case 'count':
        this.playCount()
        break
    }
  }

  playCountdown(step: 3 | 2 | 1 | 'slice') {
    if (!this.sfxReady()) return
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)
    if (step === 'slice') {
      playTone(ctx, dest, { type: 'sawtooth', freq: 180, peak: 0.15, decay: 0.24, when: t })
      playTone(ctx, dest, { type: 'square', freq: 360, peak: 0.1, decay: 0.2, when: t })
      ;[523, 659, 784, 1046].forEach((f, i) => {
        playTone(ctx, dest, {
          type: 'triangle',
          freq: f,
          peak: 0.1,
          decay: 0.2,
          when: t + 0.04 + i * 0.04,
        })
      })
      playNoise(ctx, dest, {
        buffer: this.noise!,
        peak: 0.11,
        decay: 0.2,
        when: t,
        highpass: 1000,
        lowpass: 5000,
      })
      // Ensure gameplay bed is audible after the callout
      this.setComboIntensity(0)
      if (this.theme !== 'gameplay') this.crossfadeTo('gameplay', 400)
      return
    }
    const base = step === 3 ? 220 : step === 2 ? 196 : 165
    playTone(ctx, dest, { type: 'sawtooth', freq: base, peak: 0.13, decay: 0.28, when: t })
    playTone(ctx, dest, { type: 'square', freq: base * 1.5, peak: 0.055, decay: 0.22, when: t })
    playTone(ctx, dest, { type: 'sine', freq: base * 2.2, peak: 0.05, decay: 0.2, when: t })
  }

  playReward() {
    if (!this.sfxReady()) return
    const ctx = this.ctx!
    const dest = this.uiBus!
    const t = now(ctx)
    ;[0, 1, 2, 3, 4].forEach((i) => {
      playTone(ctx, dest, {
        type: 'sine',
        freq: 520 + i * 110,
        peak: 0.075,
        decay: 0.22,
        when: t + i * 0.055,
      })
      playTone(ctx, dest, {
        type: 'triangle',
        freq: 780 + i * 90,
        peak: 0.035,
        decay: 0.12,
        when: t + 0.02 + i * 0.055,
      })
    })
  }

  /** Defeat sting only — prefer enterResults() for the full handoff. */
  playGameOver(kind: 'nice' | 'juicy' | 'rush' | 'close' = 'nice') {
    this.enterResults(kind)
  }

  private playDefeatSting(kind: 'nice' | 'juicy' | 'rush' | 'close') {
    if (!this.sfxReady()) return
    this.setComboIntensity(0)
    const ctx = this.ctx!
    const dest = this.sfxBus!
    const t = now(ctx)

    // Slow wooden drum
    playTone(ctx, dest, { type: 'sine', freq: 70, peak: 0.22, attack: 0.004, decay: 0.45, when: t })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.08,
      decay: 0.12,
      when: t,
      highpass: 300,
      lowpass: 1600,
    })
    playTone(ctx, dest, {
      type: 'triangle',
      freq: 95,
      peak: 0.12,
      decay: 0.35,
      when: t + 0.22,
    })

    const chords =
      kind === 'close'
        ? [196, 247, 294]
        : kind === 'rush'
          ? [262, 330, 392, 523]
          : [294, 370, 440, 587]
    chords.forEach((f, i) => {
      playTone(ctx, dest, {
        type: 'triangle',
        freq: f,
        peak: 0.09,
        decay: 0.48,
        when: t + 0.28 + i * 0.08,
      })
    })
  }

  // ── internals ─────────────────────────────────────────────

  private sfxReady() {
    if (!this.sfxEnabled) return false
    this.kick()
    if (!this.ctx || !this.sfxBus || !this.noise) return false
    return this.unlocked
  }
}

export const audio = new AudioManager()
