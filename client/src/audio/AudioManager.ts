import type { FruitKind } from '../game/types'
import { envGain, jitter, noiseBuffer, now, pick, playNoise, playTone, type Ctx } from './synth'

type Edible = Exclude<FruitKind, 'bomb' | 'spike' | 'ice'>

const SFX_KEY = 'fruit-rush-sfx'
const MUSIC_KEY = 'fruit-rush-music'
/** Legacy single mute — migrated once into SFX+Music both off. */
const MUTE_KEY = 'fruit-rush-muted'
const BPM = 122
const BEAT = 60 / BPM

export interface AudioSettings {
  /** Slice, bomb, combo, UI taps, countdown voice. */
  sfx: boolean
  /** In-game Juicy Arcade loop. Off = use your own playlist while playing. */
  music: boolean
}

/** Per-fruit slice “personality” — base freqs + noise colour. */
const FRUIT_VOICE: Record<
  Edible,
  { freqs: number[]; noisePeak: number; lowpass: number; label: string }
> = {
  watermelon: { freqs: [90, 140, 220], noisePeak: 0.22, lowpass: 1800, label: 'SHLOPP' },
  orange: { freqs: [260, 420], noisePeak: 0.16, lowpass: 3200, label: 'PCHAK' },
  apple: { freqs: [520, 780], noisePeak: 0.12, lowpass: 4500, label: 'CHK' },
  coconut: { freqs: [180, 240, 90], noisePeak: 0.18, lowpass: 1400, label: 'TOK' },
  pear: { freqs: [340, 480], noisePeak: 0.13, lowpass: 3600, label: 'CHK' },
  pineapple: { freqs: [160, 300, 520], noisePeak: 0.2, lowpass: 2400, label: 'KRAK' },
  mango: { freqs: [220, 360], noisePeak: 0.15, lowpass: 3000, label: 'PCHAK' },
  kiwi: { freqs: [400, 620], noisePeak: 0.11, lowpass: 4800, label: 'CHK' },
  lemon: { freqs: [480, 720], noisePeak: 0.12, lowpass: 5200, label: 'CHK' },
  passionfruit: { freqs: [300, 500, 700], noisePeak: 0.14, lowpass: 4000, label: 'PCHAK' },
}

/**
 * Juicy Arcade audio — all procedural Web Audio.
 * Gameplay never touches the AudioContext directly; call these methods.
 */
export class AudioManager {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private sfx: GainNode | null = null
  private musicBus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private unlocked = false
  private sfxEnabled = true
  private musicEnabled = true
  private musicOn = false
  private musicTimer: number | null = null
  private beat = 0
  /** Layer gains: 0 bed · 1 drums · 2 bass · 3 synth · 4 melody */
  private layers: GainNode[] = []

  constructor() {
    try {
      // Migrate old "mute all" flag once.
      if (localStorage.getItem(MUTE_KEY) === '1') {
        localStorage.setItem(SFX_KEY, '0')
        localStorage.setItem(MUSIC_KEY, '0')
        localStorage.removeItem(MUTE_KEY)
      }
      const sfx = localStorage.getItem(SFX_KEY)
      const music = localStorage.getItem(MUSIC_KEY)
      if (sfx === '0') this.sfxEnabled = false
      if (music === '0') this.musicEnabled = false
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

  /** Must run inside a user gesture (tap/click). Safe to call repeatedly. */
  async unlock() {
    if (this.unlocked && this.ctx?.state === 'running') return
    const CtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!CtxClass) return
    if (!this.ctx) {
      this.ctx = new CtxClass()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.85
      this.master.connect(this.ctx.destination)

      this.sfx = this.ctx.createGain()
      this.sfx.gain.value = this.sfxEnabled ? 0.9 : 0
      this.sfx.connect(this.master)

      this.musicBus = this.ctx.createGain()
      this.musicBus.gain.value = this.musicEnabled ? 0.55 : 0
      this.musicBus.connect(this.master)

      this.noise = noiseBuffer(this.ctx, 0.5)
      this.buildMusicLayers()
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.unlocked = true
  }

  setSfxEnabled(next: boolean) {
    this.sfxEnabled = next
    this.persist()
    if (this.sfx) this.sfx.gain.value = next ? 0.9 : 0
  }

  setMusicEnabled(next: boolean) {
    this.musicEnabled = next
    this.persist()
    if (this.musicBus) this.musicBus.gain.value = next ? 0.55 : 0
    if (!next) this.stopMusic()
  }

  private persist() {
    try {
      localStorage.setItem(SFX_KEY, this.sfxEnabled ? '1' : '0')
      localStorage.setItem(MUSIC_KEY, this.musicEnabled ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  // ── Music (adaptive tropical arcade loop) ─────────────────

  startMusic() {
    if (!this.ctx || !this.unlocked || !this.musicEnabled || this.musicOn) return
    this.musicOn = true
    this.beat = 0
    this.scheduleMusic()
  }

  stopMusic() {
    this.musicOn = false
    if (this.musicTimer != null) {
      window.clearTimeout(this.musicTimer)
      this.musicTimer = null
    }
    // Soft-fade layers down so a miss / exit feels like the party leaving.
    this.setComboIntensity(0)
  }

  /** Combo builds the soundtrack — extra layers fade in with skill. */
  setComboIntensity(combo: number) {
    if (!this.ctx || this.layers.length < 5) return
    const t = now(this.ctx)
    const targets = [
      0.55, // bed always
      combo >= 5 ? 0.7 : 0.15, // drums
      combo >= 10 ? 0.55 : 0.08, // bass
      combo >= 15 ? 0.45 : 0.05, // synth
      combo >= 20 ? 0.4 : 0.04, // melody
    ]
    this.layers.forEach((g, i) => {
      g.gain.cancelScheduledValues(t)
      g.gain.setTargetAtTime(targets[i]!, t, 0.18)
    })
  }

  private buildMusicLayers() {
    if (!this.ctx || !this.musicBus) return
    this.layers = [0, 1, 2, 3, 4].map((i) => {
      const g = this.ctx!.createGain()
      g.gain.value = i === 0 ? 0.55 : 0.08
      g.connect(this.musicBus!)
      return g
    })
  }

  private scheduleMusic() {
    if (!this.musicOn || !this.ctx) return
    const ctx = this.ctx
    const t0 = now(ctx)

    // Schedule 2 beats at a time — keeps the audio thread light on phones.
    for (let i = 0; i < 2; i++) {
      const when = t0 + i * BEAT
      const step = (this.beat + i) % 16
      this.hitBed(when, step)
      if (this.layerAudible(1)) this.hitDrums(when, step)
      if (this.layerAudible(2)) this.hitBass(when, step)
      if (this.layerAudible(3)) this.hitSynth(when, step)
      if (this.layerAudible(4)) this.hitMelody(when, step)
    }
    this.beat = (this.beat + 2) % 16
    this.musicTimer = window.setTimeout(() => this.scheduleMusic(), BEAT * 2 * 1000 - 20)
  }

  private layerAudible(index: number) {
    const g = this.layers[index]
    return Boolean(g && g.gain.value > 0.12)
  }

  private hitBed(when: number, step: number) {
    const dest = this.layers[0]
    if (!this.ctx || !dest) return
    if (step % 4 === 0) {
      playTone(this.ctx, dest, { type: 'triangle', freq: 220, peak: 0.045, decay: 0.22, when })
    }
    if (step % 4 === 2) {
      playNoise(this.ctx, dest, {
        buffer: this.noise!,
        peak: 0.05,
        decay: 0.07,
        when,
        highpass: 1500,
        lowpass: 5000,
      })
    }
  }

  private hitDrums(when: number, step: number) {
    const dest = this.layers[1]
    if (!this.ctx || !dest) return
    if (step % 4 === 0) {
      playTone(this.ctx, dest, { type: 'sine', freq: 70, peak: 0.2, attack: 0.002, decay: 0.16, when })
    }
    if (step % 4 === 2) {
      playNoise(this.ctx, dest, {
        buffer: this.noise!,
        peak: 0.1,
        decay: 0.09,
        when,
        highpass: 2000,
        lowpass: 7000,
      })
    }
  }

  private hitBass(when: number, step: number) {
    const dest = this.layers[2]
    if (!this.ctx || !dest) return
    const notes = [55, 55, 65, 49, 55, 55, 73, 49]
    if (step % 4 === 0) {
      const f = notes[(step / 4) % notes.length]!
      playTone(this.ctx, dest, { type: 'sawtooth', freq: f, peak: 0.09, attack: 0.01, decay: 0.32, when })
    }
  }

  private hitSynth(when: number, step: number) {
    const dest = this.layers[3]
    if (!this.ctx || !dest) return
    const notes = [330, 392, 440, 392]
    if (step % 4 === 2) {
      playTone(this.ctx, dest, {
        type: 'triangle',
        freq: notes[(step / 4) % notes.length]!,
        peak: 0.06,
        decay: 0.2,
        when,
        detune: jitter(0.02),
      })
    }
  }

  private hitMelody(when: number, step: number) {
    const dest = this.layers[4]
    if (!this.ctx || !dest) return
    if (step === 3 || step === 11) {
      playTone(this.ctx, dest, {
        type: 'sine',
        freq: pick([659, 784, 880]),
        peak: 0.07,
        decay: 0.28,
        when,
        detune: jitter(0.03),
      })
    }
  }

  // ── Slice / splash ────────────────────────────────────────

  playSlice(kind: FruitKind) {
    if (!this.ready() || kind === 'bomb' || kind === 'spike' || kind === 'ice') return
    const ctx = this.ctx!
    const dest = this.sfx!
    const voice = FRUIT_VOICE[kind]
    const t = now(ctx)
    const pitch = 1 + (Math.random() * 2 - 1) * 0.05

    // One body thunk + blade noise (kept lean so rapid slices don't hitch phones).
    const f = voice.freqs[0]!
    playTone(ctx, dest, {
      type: 'triangle',
      freq: f * pitch,
      peak: 0.16,
      attack: 0.002,
      decay: 0.14,
      when: t,
      detune: jitter(0.04),
    })
    if (voice.freqs[1]) {
      playTone(ctx, dest, {
        type: 'sine',
        freq: voice.freqs[1]! * pitch,
        peak: 0.08,
        attack: 0.002,
        decay: 0.1,
        when: t,
      })
    }
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: voice.noisePeak * (0.85 + Math.random() * 0.3),
      attack: 0.001,
      decay: 0.07 + Math.random() * 0.04,
      when: t,
      highpass: 1200,
      lowpass: voice.lowpass,
    })
    this.playSplash(t + 0.02)
  }

  playSplash(when?: number) {
    if (!this.ready()) return
    const ctx = this.ctx!
    const dest = this.sfx!
    const t = when ?? now(ctx)
    playTone(ctx, dest, {
      type: 'sine',
      freq: 800 + Math.random() * 700,
      peak: 0.045,
      decay: 0.07,
      when: t,
      detune: jitter(0.06),
    })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.055,
      decay: 0.08,
      when: t,
      highpass: 2500,
      lowpass: 9000,
    })
  }

  // ── Combos ────────────────────────────────────────────────

  playCombo(combo: number) {
    if (!this.ready()) return
    this.setComboIntensity(combo)
    const ctx = this.ctx!
    const dest = this.sfx!
    const t = now(ctx)

    if (combo === 3) {
      playTone(ctx, dest, { type: 'sine', freq: 880, peak: 0.12, decay: 0.15, when: t })
      playTone(ctx, dest, { type: 'sine', freq: 1320, peak: 0.08, decay: 0.18, when: t + 0.04 })
      return
    }
    if (combo === 5) {
      ;[0, 0.07].forEach((off, i) => {
        playTone(ctx, dest, {
          type: 'triangle',
          freq: 990 + i * 220,
          peak: 0.12,
          decay: 0.16,
          when: t + off,
        })
      })
      return
    }
    if (combo === 8) {
      // WOOOOSH
      playNoise(ctx, dest, {
        buffer: this.noise!,
        peak: 0.2,
        attack: 0.01,
        decay: 0.35,
        when: t,
        highpass: 400,
        lowpass: 4000,
      })
      playTone(ctx, dest, { type: 'sawtooth', freq: 220, peak: 0.1, decay: 0.4, when: t })
      playTone(ctx, dest, { type: 'sine', freq: 880, peak: 0.1, decay: 0.3, when: t + 0.05 })
      return
    }
    if (combo >= 10 && (combo === 10 || combo % 5 === 0)) {
      // Crowd-ish cheer: filtered noise + sparkle arpeggio
      playNoise(ctx, dest, {
        buffer: this.noise!,
        peak: 0.16,
        attack: 0.02,
        decay: 0.55,
        when: t,
        highpass: 600,
        lowpass: 2800,
      })
      ;[523, 659, 784, 1046].forEach((f, i) => {
        playTone(ctx, dest, {
          type: 'sine',
          freq: f,
          peak: 0.09,
          decay: 0.25,
          when: t + 0.05 + i * 0.05,
        })
      })
    }
  }

  // ── Hazards ───────────────────────────────────────────────

  playBomb() {
    if (!this.ready()) return
    const ctx = this.ctx!
    const dest = this.sfx!
    const t = now(ctx)

    // Fuse crackle
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.08,
      attack: 0.01,
      decay: 0.28,
      when: t,
      highpass: 3000,
      lowpass: 8000,
    })
    // Quick inhale (rising sine)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, t + 0.22)
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.38)
    const g = envGain(ctx, 0.1, 0.02, 0.18, t + 0.22)
    osc.connect(g)
    g.connect(dest)
    osc.start(t + 0.22)
    osc.stop(t + 0.45)

    // BOOM
    playTone(ctx, dest, { type: 'sine', freq: 55, peak: 0.45, attack: 0.005, decay: 0.55, when: t + 0.4 })
    playTone(ctx, dest, { type: 'triangle', freq: 90, peak: 0.25, decay: 0.4, when: t + 0.4 })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.3,
      attack: 0.002,
      decay: 0.45,
      when: t + 0.4,
      highpass: 100,
      lowpass: 1200,
    })
    // Low rumble
    playTone(ctx, dest, { type: 'sine', freq: 40, peak: 0.2, decay: 0.9, when: t + 0.5 })

    this.setComboIntensity(0)
  }

  playSpike() {
    if (!this.ready()) return
    const ctx = this.ctx!
    const dest = this.sfx!
    const t = now(ctx)
    playTone(ctx, dest, { type: 'square', freq: 160, peak: 0.14, decay: 0.12, when: t })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.14,
      decay: 0.15,
      when: t,
      highpass: 800,
      lowpass: 3000,
    })
    this.setComboIntensity(0)
  }

  playIce() {
    if (!this.ready()) return
    const ctx = this.ctx!
    const dest = this.sfx!
    const t = now(ctx)
    ;[1200, 1600, 2100].forEach((f, i) => {
      playTone(ctx, dest, {
        type: 'sine',
        freq: f,
        peak: 0.08,
        decay: 0.2,
        when: t + i * 0.03,
      })
    })
    playNoise(ctx, dest, {
      buffer: this.noise!,
      peak: 0.08,
      decay: 0.18,
      when: t,
      highpass: 4000,
      lowpass: 10000,
    })
    this.setComboIntensity(0)
  }

  // ── UI / voice / rewards ──────────────────────────────────

  playUi(kind: 'tap' | 'pop' = 'tap') {
    if (!this.ready()) return
    const ctx = this.ctx!
    const dest = this.sfx!
    const t = now(ctx)
    if (kind === 'tap') {
      // Tiny wood tap
      playTone(ctx, dest, { type: 'triangle', freq: 420, peak: 0.08, decay: 0.06, when: t })
      playNoise(ctx, dest, {
        buffer: this.noise!,
        peak: 0.05,
        decay: 0.04,
        when: t,
        highpass: 1800,
        lowpass: 4500,
      })
    } else {
      playTone(ctx, dest, { type: 'sine', freq: 660, peak: 0.09, decay: 0.1, when: t })
      playTone(ctx, dest, { type: 'sine', freq: 990, peak: 0.06, decay: 0.12, when: t + 0.03 })
    }
  }

  /** Deep arcade countdown: 3 · 2 · 1 · SLICE! */
  playCountdown(step: 3 | 2 | 1 | 'slice') {
    if (!this.ready()) return
    const ctx = this.ctx!
    const dest = this.sfx!
    const t = now(ctx)
    if (step === 'slice') {
      // Signature callout
      playTone(ctx, dest, { type: 'sawtooth', freq: 180, peak: 0.16, decay: 0.25, when: t })
      playTone(ctx, dest, { type: 'square', freq: 360, peak: 0.12, decay: 0.22, when: t })
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
        peak: 0.12,
        decay: 0.2,
        when: t,
        highpass: 1000,
        lowpass: 5000,
      })
      return
    }
    // Descending arcade voice-ish tones (formant-ish stacked)
    const base = step === 3 ? 220 : step === 2 ? 196 : 165
    playTone(ctx, dest, { type: 'sawtooth', freq: base, peak: 0.14, decay: 0.28, when: t })
    playTone(ctx, dest, { type: 'square', freq: base * 1.5, peak: 0.06, decay: 0.22, when: t })
    playTone(ctx, dest, { type: 'sine', freq: base * 2.2, peak: 0.05, decay: 0.2, when: t })
  }

  playReward() {
    if (!this.ready()) return
    const ctx = this.ctx!
    const dest = this.sfx!
    const t = now(ctx)
    // Juicy pops + fresh chimes (not metallic coins)
    ;[0, 1, 2, 3, 4].forEach((i) => {
      playTone(ctx, dest, {
        type: 'sine',
        freq: 520 + i * 110,
        peak: 0.08,
        decay: 0.22,
        when: t + i * 0.06,
      })
      playTone(ctx, dest, {
        type: 'triangle',
        freq: 780 + i * 90,
        peak: 0.04,
        decay: 0.12,
        when: t + 0.02 + i * 0.06,
      })
    })
  }

  playGameOver(kind: 'nice' | 'juicy' | 'rush' | 'close' = 'nice') {
    if (!this.ready()) return
    this.setComboIntensity(0)
    const ctx = this.ctx!
    const dest = this.sfx!
    const t = now(ctx)
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
        peak: 0.1,
        decay: 0.45,
        when: t + i * 0.07,
      })
    })
    this.playReward()
  }

  // ── internals ─────────────────────────────────────────────

  private ready() {
    return Boolean(this.unlocked && this.ctx && this.sfx && this.sfxEnabled)
  }
}

export const audio = new AudioManager()
