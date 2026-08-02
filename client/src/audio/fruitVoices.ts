import type { FruitKind } from '../game/types'

export type Edible = Exclude<FruitKind, 'bomb' | 'spike' | 'ice'>

export type SpecialFruit = 'rainbow' | 'golden' | 'mystery' | 'multiplier'

/** Per-fruit slice personality — body freqs + noise colour + juice character. */
export interface FruitVoice {
  /** Body / pulp fundamentals (Hz). */
  freqs: number[]
  noisePeak: number
  lowpass: number
  /** Juice splash brightness (higher = citrus-ier). */
  juiceBright: number
  /** Extra crack layer for dense fruit. */
  crack?: boolean
  /** Soft wetness vs crisp. */
  wet: number
}

export const FRUIT_VOICE: Record<Edible, FruitVoice> = {
  watermelon: {
    freqs: [78, 130, 210],
    noisePeak: 0.26,
    lowpass: 1600,
    juiceBright: 0.7,
    wet: 0.95,
  },
  orange: {
    freqs: [240, 400, 560],
    noisePeak: 0.18,
    lowpass: 3400,
    juiceBright: 1.15,
    wet: 0.85,
  },
  apple: {
    freqs: [480, 720, 980],
    noisePeak: 0.14,
    lowpass: 5200,
    juiceBright: 0.55,
    crack: true,
    wet: 0.35,
  },
  coconut: {
    freqs: [95, 160, 70],
    noisePeak: 0.22,
    lowpass: 1200,
    juiceBright: 0.4,
    crack: true,
    wet: 0.25,
  },
  pear: {
    freqs: [320, 460],
    noisePeak: 0.14,
    lowpass: 3800,
    juiceBright: 0.75,
    wet: 0.7,
  },
  pineapple: {
    freqs: [150, 280, 480],
    noisePeak: 0.22,
    lowpass: 2200,
    juiceBright: 0.65,
    crack: true,
    wet: 0.55,
  },
  mango: {
    freqs: [200, 340, 480],
    noisePeak: 0.17,
    lowpass: 3000,
    juiceBright: 0.9,
    wet: 0.8,
  },
  kiwi: {
    freqs: [380, 580],
    noisePeak: 0.12,
    lowpass: 4600,
    juiceBright: 0.85,
    wet: 0.75,
  },
  lemon: {
    freqs: [460, 700, 920],
    noisePeak: 0.13,
    lowpass: 5600,
    juiceBright: 1.25,
    wet: 0.7,
  },
  passionfruit: {
    freqs: [280, 460, 640],
    noisePeak: 0.15,
    lowpass: 4000,
    juiceBright: 1.0,
    wet: 0.8,
  },
}
