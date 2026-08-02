import type { GameMode } from '../types/game'

export type FruitKind =
  | 'watermelon'
  | 'orange'
  | 'apple'
  | 'coconut'
  | 'pear'
  | 'pineapple'
  | 'mango'
  | 'kiwi'
  | 'lemon'
  | 'passionfruit'
  | 'bomb'
  /** Spiked mine — costs a life when sliced. */
  | 'spike'
  /** Ice orb — breaks combo and deducts score when sliced. */
  | 'ice'

export interface GameHudState {
  score: number
  combo: number
  multiplier: number
  lives: number
  timeLeft: number | null
  mode: GameMode
  status: 'countdown' | 'playing' | 'ended'
  countdown: number
}

export interface GameEndPayload {
  score: number
  comboHighwater: number
  durationSeconds: number
  mode: GameMode
  fruitsSliced: number
  fruitsMissed: number
  bombsHit: number
  criticalSlices: number
  accuracy: number
}

export const MODE_CONFIG: Record<
  GameMode,
  {
    /** Round length in seconds. `null` = endless (Zen). */
    duration: number | null
    bombs: boolean
    /** Extra hazards (spike / ice) that punish a slice without ending the run. */
    hazards: boolean
    spawnMinMs: number
    spawnMaxMs: number
    frenzy?: boolean
    lives: number
  }
> = {
  // Classic: timed round with bombs + hazards. 90s reads as 1:30 on the HUD.
  Classic: {
    duration: 90,
    bombs: true,
    hazards: true,
    spawnMinMs: 520,
    spawnMaxMs: 1000,
    lives: 3,
  },
  // Zen: endless practice — no bombs, no hazards, no timer.
  Zen: {
    duration: null,
    bombs: false,
    hazards: false,
    spawnMinMs: 700,
    spawnMaxMs: 1300,
    lives: 99,
  },
  // Arcade: 2-minute frenzy with everything live.
  Arcade: {
    duration: 120,
    bombs: true,
    hazards: true,
    spawnMinMs: 400,
    spawnMaxMs: 850,
    frenzy: true,
    lives: 3,
  },
  Tournament: {
    duration: 90,
    bombs: true,
    hazards: true,
    spawnMinMs: 520,
    spawnMaxMs: 1000,
    lives: 3,
  },
}

export function comboMultiplier(streak: number): number {
  if (streak >= 10) return 5
  if (streak >= 6) return 3
  if (streak >= 3) return 2
  return 1
}

/** Format seconds as M:SS for the in-round timer. */
export function formatTimeLeft(seconds: number | null): string {
  if (seconds === null) return '∞'
  const t = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
