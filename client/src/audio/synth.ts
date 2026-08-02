/** Tiny Web Audio helpers — envelopes, noise, pitched blips. */

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
  // Drop graph nodes after playback — avoids phone hitch from orphaned nodes.
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

/** Random pitch jitter in cents (~ ±5% ≈ ±85 cents). */
export function jitter(amount = 0.05): number {
  return (Math.random() * 2 - 1) * amount * 100
}

export function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}
