import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'
import { designArt } from '../assets/designs'
import type { GameMode } from '../types/game'

interface ModesScreenProps {
  guest?: boolean
  onBack: () => void
  onSelect: (mode: GameMode) => void
}

/**
 * Mode hotspots are intentionally large and contiguous so a thumb tap on a
 * wooden plank can't miss into the wrong mode (that was swapping Classic/Zen).
 */
export function ModesScreen({ guest = false, onBack, onSelect }: ModesScreenProps) {
  return (
    <ArtScreen src={designArt.modes} alt="Choose your cut">
      <Hotspot top={2} left={1} width={14} height={6} label="Back" onClick={onBack} />
      <Hotspot
        top={25}
        left={4}
        width={92}
        height={17}
        label="Classic"
        onClick={() => onSelect('Classic')}
      />
      <Hotspot
        top={42}
        left={4}
        width={92}
        height={12}
        label="Zen"
        onClick={() => onSelect('Zen')}
      />
      <Hotspot
        top={54}
        left={4}
        width={92}
        height={16}
        label="Arcade"
        onClick={() => onSelect('Arcade')}
      />

      {/* Live rules — the PNG text is stale (60s); keep truth on the screen. */}
      <div className="modes-rules" aria-hidden>
        <span>Classic · 1:30 · bombs + hazards</span>
        <span>Zen · endless · no bombs</span>
        <span>Arcade · 2:00 · frenzy</span>
      </div>

      {guest && (
        <div className="modes-guest-note" role="note">
          Playing as guest — connect a wallet for tournaments, the shop and rewards
        </div>
      )}
    </ArtScreen>
  )
}
