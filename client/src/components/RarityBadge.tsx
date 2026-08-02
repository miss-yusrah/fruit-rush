import { RARITY_COLOR } from '../data/mock'
import type { Rarity } from '../types/game'

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const color = RARITY_COLOR[rarity]
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color,
        borderBottom: `1px solid ${color}`,
        paddingBottom: 1,
      }}
    >
      {rarity}
    </span>
  )
}
