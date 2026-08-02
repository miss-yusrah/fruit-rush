/** Tiny Web Audio helpers — envelopes, noise, pitched blips, sweeps. */

export type Ctx = AudioContext

export function now(ctx: Ctx): number {
  return ctx.currentTime
}

export function noiseBuffer(ctx: Ctx, seconds = 0.35): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

export function envGain(
  ctx: Ctx,
  peak: number,
  attack: number,
  decay: number,
  when: number,
): GainNode {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay)
  return g
}

export function playTone(
  ctx: Ctx,
  dest: AudioNode,
  {
    type = 'sine',
    freq,
    peak = 0.12,
    attack = 0.005,
    decay = 0.18,
    when = now(ctx),
    detune = 0,
  }: {
    type?: OscillatorType
    freq: number
    peak?: number
    attack?: number
    decay?: number
    when?: number
    detune?: number
  },
) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, when)
  if (detune) osc.detune.setValueAtTime(detune, when)
  const g = envGain(ctx, peak, attack, decay, when)
  osc.connect(g)
  g.connect(dest)
  osc.start(when)
  const stopAt = when + attack + decay + 0.02
  osc.stop(stopAt)
  osc.onended = () => {
    try {
      osc.disconnect()
      g.disconnect()
    } catch {
      /* already gone */
    }
  }
}

export function playNoise(
  ctx: Ctx,
  dest: AudioNode,
  {
    peak = 0.1,
    attack = 0.002,
    decay = 0.12,
    when = now(ctx),
    highpass = 800,
    lowpass = 6000,
    buffer,
  }: {
    peak?: number
    attack?: number
    decay?: number
    when?: number
    highpass?: number
    lowpass?: number
    buffer: AudioBuffer
  },
) {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = highpass
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = lowpass
  const g = envGain(ctx, peak, attack, decay, when)
  src.connect(hp)
  hp.connect(lp)
  lp.connect(g)
  g.connect(dest)
  src.start(when)
  src.stop(when + attack + decay + 0.02)
  src.onended = () => {
    try {
      src.disconnect()
      hp.disconnect()
      lp.disconnect()
      g.disconnect()
    } catch {
      /* already gone */
    }
  }
}

/** Frequency sweep — whooshes, blade air, cinematic transitions. */
export function playSweep(
  ctx: Ctx,
  dest: AudioNode,
  {
    type = 'sawtooth',
    startFreq,
    endFreq,
    peak = 0.12,
    attack = 0.01,
    decay = 0.35,
    when = now(ctx),
    highpass = 200,
    lowpass = 8000,
  }: {
    type?: OscillatorType
    startFreq: number
    endFreq: number
    peak?: number
    attack?: number
    decay?: number
    when?: number
    highpass?: number
    lowpass?: number
  },
) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(20, startFreq), when)
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), when + attack + decay)

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = highpass
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = lowpass

  const g = envGain(ctx, peak, attack, decay, when)
  osc.connect(hp)
  hp.connect(lp)
  lp.connect(g)
  g.connect(dest)
  osc.start(when)
  osc.stop(when + attack + decay + 0.03)
  osc.onended = () => {
    try {
      osc.disconnect()
      hp.disconnect()
      lp.disconnect()
      g.disconnect()
    } catch {
      /* already gone */
    }
  }
}

/** Soft band-limited wind / ambience bed (looping buffer source). */
export function startLoopNoise(
  ctx: Ctx,
  dest: AudioNode,
  buffer: AudioBuffer,
  {
    peak = 0.04,
    highpass = 200,
    lowpass = 1800,
  }: { peak?: number; highpass?: number; lowpass?: number } = {},
): { stop: (fadeSec?: number) => void } {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = highpass
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = lowpass
  const g = ctx.createGain()
  const t = now(ctx)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.6)
  src.connect(hp)
  hp.connect(lp)
  lp.connect(g)
  g.connect(dest)
  src.start(t)

  return {
    stop(fadeSec = 0.5) {
      const end = now(ctx)
      try {
        g.gain.cancelScheduledValues(end)
        g.gain.setValueAtTime(Math.max(0.0002, g.gain.value), end)
        g.gain.exponentialRampToValueAtTime(0.0001, end + fadeSec)
        src.stop(end + fadeSec + 0.05)
      } catch {
        /* already stopped */
      }
    },
  }
}

/** Dance kick — pitch drops hard for that club thump. */
export function playKick(
  ctx: Ctx,
  dest: AudioNode,
  { peak = 0.55, when = now(ctx), decay = 0.32 }: { peak?: number; when?: number; decay?: number } = {},
) {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(160, when)
  osc.frequency.exponentialRampToValueAtTime(42, when + 0.08)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay)
  osc.connect(g)
  g.connect(dest)
  osc.start(when)
  osc.stop(when + decay + 0.02)
  osc.onended = () => {
    try {
      osc.disconnect()
      g.disconnect()
    } catch {
      /* already gone */
    }
  }
}

/** Clap / snare — filtered noise burst for the backbeat. */
export function playClap(
  ctx: Ctx,
  dest: AudioNode,
  buffer: AudioBuffer,
  { peak = 0.28, when = now(ctx) }: { peak?: number; when?: number } = {},
) {
  // Triple flam for a real clap feel
  ;[0, 0.012, 0.024].forEach((off, i) => {
    playNoise(ctx, dest, {
      buffer,
      peak: peak * (i === 1 ? 1 : 0.55),
      attack: 0.001,
      decay: 0.09 + i * 0.02,
      when: when + off,
      highpass: 900,
      lowpass: 6500,
    })
  })
  playTone(ctx, dest, {
    type: 'triangle',
    freq: 210,
    peak: peak * 0.25,
    attack: 0.001,
    decay: 0.08,
    when,
  })
}

/** Filtered saw bass note — body for dance grooves. */
export function playBass(
  ctx: Ctx,
  dest: AudioNode,
  {
    freq,
    peak = 0.22,
    when = now(ctx),
    decay = 0.22,
    cutoff = 520,
  }: { freq: number; peak?: number; when?: number; decay?: number; cutoff?: number },
) {
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(freq, when)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(cutoff, when)
  lp.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.45), when + decay)
  lp.Q.value = 4
  const g = envGain(ctx, peak, 0.01, decay, when)
  osc.connect(lp)
  lp.connect(g)
  g.connect(dest)
  osc.start(when)
  osc.stop(when + decay + 0.03)
  osc.onended = () => {
    try {
      osc.disconnect()
      lp.disconnect()
      g.disconnect()
    } catch {
      /* already gone */
    }
  }
}

/** Random pitch jitter in cents (~ ±5% ≈ ±85 cents). */
export function jitter(amount = 0.05): number {
  return (Math.random() * 2 - 1) * amount * 100
}

export function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}
