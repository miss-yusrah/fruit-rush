import type { GameSessionResult } from '../../types/game'

const XP_KEY = 'fruit-rush-xp'
const LEVEL_KEY = 'fruit-rush-level'
const COINS_KEY = 'fruit-rush-coins'
const GAMES_KEY = 'fruit-rush-games'
const STREAK_KEY = 'fruit-rush-win-streak'
const BEST_RANK_KEY = 'fruit-rush-best-rank'
const DAILY_KEY = 'fruit-rush-daily-bonus'
const HIGHEST_SCORE_KEY = 'fruit-rush-personal-best'

export interface BonusFlag {
  id: 'daily' | 'combo' | 'accuracy' | 'speed' | 'nobomb'
  label: string
  xp: number
  coins: number
  earned: boolean
}

export interface LevelReward {
  name: string
  kind: 'blade' | 'trail' | 'splash' | 'badge'
  blurb: string
}

export interface RoundRewards {
  baseXp: number
  baseCoins: number
  bonuses: BonusFlag[]
  xpEarned: number
  coinsEarned: number
  levelBefore: number
  xpBefore: number
  levelAfter: number
  xpAfter: number
  xpToNextBefore: number
  xpToNextAfter: number
  leveledUp: boolean
  levelReward: LevelReward | null
  gamesPlayed: number
  winStreak: number
  bestRank: number
  currentRank: number
}

const LEVEL_REWARDS: LevelReward[] = [
  { name: 'Reed Blade', kind: 'blade', blurb: 'Clean orchard steel.' },
  { name: 'Citrus Wake', kind: 'trail', blurb: 'Tangerine afterimage.' },
  { name: 'Pulp Burst', kind: 'splash', blurb: 'Juicier wall stains.' },
  { name: 'Grove Badge', kind: 'badge', blurb: 'Mark of a slicer.' },
  { name: 'Ember Edge', kind: 'blade', blurb: 'Warm citrus trail.' },
  { name: 'Silver Arc', kind: 'trail', blurb: 'Crisp blade ribbon.' },
  { name: 'Neon Splash', kind: 'splash', blurb: 'High-contrast juice.' },
  { name: 'Sensei Seal', kind: 'badge', blurb: 'Dojo recognition.' },
]

function readInt(key: string, fallback = 0): number {
  try {
    const v = localStorage.getItem(key)
    if (v == null) return fallback
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function writeInt(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* ignore */
  }
}

export function xpForLevel(level: number): number {
  return Math.max(100, level * 180)
}

export function headlineFor(result: GameSessionResult): string {
  if (result.score <= 0) return 'SO CLOSE'
  if (result.isPersonalBest && result.score >= 500) return 'AMAZING!'
  if (result.comboHighwater >= 10 || result.accuracy >= 95) return 'AMAZING!'
  if (result.isPersonalBest || result.score >= 300) return 'WELL DONE!'
  if (result.comboHighwater >= 6) return 'JUICY RUN!'
  return 'NICE SLICE!'
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function computeRoundRewards(
  result: GameSessionResult,
  currentRank: number,
): RoundRewards {
  const levelBefore = Math.max(1, readInt(LEVEL_KEY, 1))
  const xpBefore = Math.max(0, readInt(XP_KEY, 0))
  const coinsBefore = Math.max(0, readInt(COINS_KEY, 0))
  const gamesBefore = Math.max(0, readInt(GAMES_KEY, 0))
  const streakBefore = Math.max(0, readInt(STREAK_KEY, 0))
  const bestRankBefore = readInt(BEST_RANK_KEY, 999)

  const baseXp = Math.max(5, Math.floor(result.score / 6) + result.fruitsSliced)
  const baseCoins = Math.max(3, Math.floor(result.score / 10))

  const dailyClaimed = (() => {
    try {
      return localStorage.getItem(DAILY_KEY) === todayKey()
    } catch {
      return true
    }
  })()

  const hasBombs = result.mode !== 'Zen'
  const bonuses: BonusFlag[] = [
    {
      id: 'daily',
      label: 'Daily Bonus',
      xp: 25,
      coins: 15,
      earned: !dailyClaimed,
    },
    {
      id: 'combo',
      label: 'Combo Bonus',
      xp: 30,
      coins: 18,
      earned: result.comboHighwater >= 6,
    },
    {
      id: 'accuracy',
      label: 'Perfect Accuracy',
      xp: 40,
      coins: 25,
      earned: result.accuracy >= 95 && result.fruitsSliced >= 8,
    },
    {
      id: 'speed',
      label: 'Speed Bonus',
      xp: 22,
      coins: 12,
      earned: result.durationSeconds <= 50 && result.score >= 200,
    },
    {
      id: 'nobomb',
      label: 'No Bomb Bonus',
      xp: 35,
      coins: 20,
      earned: hasBombs && result.bombsHit === 0 && result.score > 0,
    },
  ]

  let bonusXp = 0
  let bonusCoins = 0
  for (const b of bonuses) {
    if (!b.earned) continue
    bonusXp += b.xp
    bonusCoins += b.coins
  }

  const xpEarned = baseXp + bonusXp
  const coinsEarned = baseCoins + bonusCoins

  let level = levelBefore
  let xp = xpBefore + xpEarned
  let leveledUp = false
  let levelReward: LevelReward | null = null

  // Spend XP into levels
  for (;;) {
    const need = xpForLevel(level)
    if (xp < need) break
    xp -= need
    level += 1
    leveledUp = true
    levelReward = LEVEL_REWARDS[(level - 2) % LEVEL_REWARDS.length]
  }

  const winStreak = result.score > 0 ? streakBefore + 1 : 0
  const bestRank = Math.min(bestRankBefore, currentRank)

  // Persist
  writeInt(LEVEL_KEY, level)
  writeInt(XP_KEY, xp)
  writeInt(COINS_KEY, coinsBefore + coinsEarned)
  writeInt(GAMES_KEY, gamesBefore + 1)
  writeInt(STREAK_KEY, winStreak)
  writeInt(BEST_RANK_KEY, bestRank === 999 ? currentRank : bestRank)
  if (!dailyClaimed) {
    try {
      localStorage.setItem(DAILY_KEY, todayKey())
    } catch {
      /* ignore */
    }
  }
  if (result.isPersonalBest) {
    writeInt(HIGHEST_SCORE_KEY, result.score)
  }

  return {
    baseXp,
    baseCoins,
    bonuses,
    xpEarned,
    coinsEarned,
    levelBefore,
    xpBefore,
    levelAfter: level,
    xpAfter: xp,
    xpToNextBefore: xpForLevel(levelBefore),
    xpToNextAfter: xpForLevel(level),
    leveledUp,
    levelReward,
    gamesPlayed: gamesBefore + 1,
    winStreak,
    bestRank: bestRank === 999 ? currentRank : bestRank,
    currentRank,
  }
}

/** Apply watch-ad double without re-running level math from scratch. */
export function applyAdDouble(rewards: RoundRewards): RoundRewards {
  const extraXp = rewards.xpEarned
  const extraCoins = rewards.coinsEarned
  let level = rewards.levelAfter
  let xp = rewards.xpAfter + extraXp
  let leveledUp = rewards.leveledUp
  let levelReward = rewards.levelReward

  for (;;) {
    const need = xpForLevel(level)
    if (xp < need) break
    xp -= need
    level += 1
    leveledUp = true
    levelReward = LEVEL_REWARDS[(level - 2) % LEVEL_REWARDS.length]
  }

  const coinsBefore = readInt(COINS_KEY, 0)
  writeInt(COINS_KEY, coinsBefore + extraCoins)
  writeInt(LEVEL_KEY, level)
  writeInt(XP_KEY, xp)

  return {
    ...rewards,
    xpEarned: rewards.xpEarned * 2,
    coinsEarned: rewards.coinsEarned * 2,
    levelAfter: level,
    xpAfter: xp,
    xpToNextAfter: xpForLevel(level),
    leveledUp,
    levelReward,
  }
}

export function readWalletCoins(): number {
  return readInt(COINS_KEY, 0)
}
