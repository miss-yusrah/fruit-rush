import type { GameMode } from '../types/game'
import { MODE_CONFIG } from './types'

export type SpawnKind = 'fruit' | 'bomb' | 'spike' | 'ice'

export interface SpawnContext {
  mode: GameMode
  elapsed: number
  sinceBomb: number
  sinceHazard: number
  inFrenzy: boolean
}

/**
 * Pure spawn picker — same rules the live game uses.
 * Classic/Arcade: bombs + hazards. Zen: fruit only.
 */
export function pickSpawnKind(ctx: SpawnContext): SpawnKind {
  const config = MODE_CONFIG[ctx.mode]

  if (ctx.mode === 'Zen' || (!config.bombs && !config.hazards)) {
    return 'fruit'
  }

  if (config.bombs && ctx.elapsed > 4 && ctx.sinceBomb >= 5) {
    return 'bomb'
  }

  if (config.hazards && ctx.elapsed > 3 && ctx.sinceHazard >= 4) {
    return Math.random() < 0.55 ? 'spike' : 'ice'
  }

  if (config.bombs) {
    const bombChance = ctx.inFrenzy ? 0.22 : 0.16
    if (Math.random() < bombChance) return 'bomb'
  }

  if (config.hazards) {
    const hazardChance = ctx.inFrenzy ? 0.18 : 0.12
    if (Math.random() < hazardChance) return Math.random() < 0.55 ? 'spike' : 'ice'
  }

  return 'fruit'
}

/** Simulate many picks to assert mode threat rates (deterministic seed via Math.random mock). */
export function sampleSpawnKinds(
  mode: GameMode,
  rolls: number,
  opts: Partial<SpawnContext> = {},
): Record<SpawnKind, number> {
  const counts: Record<SpawnKind, number> = { fruit: 0, bomb: 0, spike: 0, ice: 0 }
  let sinceBomb = opts.sinceBomb ?? 0
  let sinceHazard = opts.sinceHazard ?? 0
  for (let i = 0; i < rolls; i++) {
    const kind = pickSpawnKind({
      mode,
      elapsed: opts.elapsed ?? 20,
      sinceBomb,
      sinceHazard,
      inFrenzy: opts.inFrenzy ?? false,
    })
    counts[kind] += 1
    if (kind === 'bomb') {
      sinceBomb = 0
      sinceHazard += 1
    } else if (kind === 'spike' || kind === 'ice') {
      sinceHazard = 0
      sinceBomb += 1
    } else {
      sinceBomb += 1
      sinceHazard += 1
    }
  }
  return counts
}
