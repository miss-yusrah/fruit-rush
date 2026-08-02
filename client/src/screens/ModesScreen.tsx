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
 * Hotspots are measured to the wooden planks on modes.png and must NOT overlap.
 * Classic used to end at 42% while its plank continues lower — Zen sat on top of
 * Classic's subtitle, so tapping Classic started Zen (endless, no bombs).
 * Classic is rendered last so it wins any edge-pixel fight.
 */
export function ModesScreen({ guest = false, onBack, onSelect }: ModesScreenProps) {
  return (
    <ArtScreen src={designArt.modes} alt="Choose your cut">
      <Hotspot top={2} left={1} width={14} height={6} label="Back" onClick={onBack} />

      <Hotspot
        top={48}
        left={5}
        width={90}
        height={10}
        label="Zen"
        onClick={() => onSelect('Zen')}
      />
      <Hotspot
        top={59}
        left={5}
        width={90}
        height={12}
        label="Arcade"
        onClick={() => onSelect('Arcade')}
      />
      <Hotspot
        top={31}
        left={5}
        width={90}
        height={16}
        label="Classic"
        onClick={() => onSelect('Classic')}
      />

      {guest && (
        <div className="modes-guest-note" role="note">
          Playing as guest — connect a wallet for tournaments, the shop and rewards
        </div>
      )}
    </ArtScreen>
  )
}
