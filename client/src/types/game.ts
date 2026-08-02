export type GameMode = 'Classic' | 'Zen' | 'Arcade' | 'Tournament'

export type ScreenId =
  | 'splash'
  | 'onboarding'
  | 'connect'
  | 'home'
  | 'modes'
  | 'play'
  | 'results'
  | 'shop'
  | 'boast'
  | 'tournaments'
  | 'profile'
  | 'settings'

export type CosmeticCategory = 'knife' | 'fruit' | 'trail' | 'background'
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary'

export interface CosmeticItem {
  id: string
  name: string
  category: CosmeticCategory
  rarity: Rarity
  priceCusd: number
  owned: boolean
  equipped?: boolean
  blurb: string
  accent: string
}

export interface TournamentInfo {
  id: string
  name: string
  entryFeeCusd: number
  prizePoolCusd: number
  entrants: number
  endsInSeconds: number
  featured?: boolean
  splits: { place: string; share: string }[]
}

export interface GameSessionResult {
  playerId: string
  score: number
  mode: GameMode
  comboHighwater: number
  durationSeconds: number
  timestamp: number
  isPersonalBest: boolean
}

export interface PlayerProfile {
  address: string
  displayName: string
  personalBest: number
  ownedCosmeticIds: string[]
}
