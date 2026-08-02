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
}

export const MODE_CONFIG: Record<
  GameMode,
  {
    duration: number | null
    bombs: boolean
    spawnMinMs: number
    spawnMaxMs: number
    frenzy?: boolean
    lives: number
  }
> = {
  Classic: { duration: 60, bombs: true, spawnMinMs: 550, spawnMaxMs: 1100, lives: 3 },
  Zen: { duration: null, bombs: false, spawnMinMs: 700, spawnMaxMs: 1300, lives: 99 },
  Arcade: {
    duration: 45,
    bombs: true,
    spawnMinMs: 420,
    spawnMaxMs: 900,
    frenzy: true,
    lives: 3,
  },
  Tournament: { duration: 60, bombs: true, spawnMinMs: 550, spawnMaxMs: 1100, lives: 3 },
}

export function comboMultiplier(streak: number): number {
  if (streak >= 10) return 5
  if (streak >= 6) return 3
  if (streak >= 3) return 2
  return 1
}
