import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'
import { designArt } from '../assets/designs'
import type { GameMode } from '../types/game'

interface ModesScreenProps {
  guest?: boolean
  onBack: () => void
  onSelect: (mode: GameMode) => void
}

export function ModesScreen({ guest = false, onBack, onSelect }: ModesScreenProps) {
  return (
    <ArtScreen src={designArt.modes} alt="Choose your cut">
      <Hotspot top={2} left={1} width={14} height={6} label="Back" onClick={onBack} />
      <Hotspot top={28} left={5} width={90} height={14} label="Classic" onClick={() => onSelect('Classic')} />
      <Hotspot top={44} left={5} width={90} height={10} label="Zen" onClick={() => onSelect('Zen')} />
      <Hotspot top={54} left={5} width={90} height={14} label="Arcade" onClick={() => onSelect('Arcade')} />

      {guest && (
        <div className="modes-guest-note" role="note">
          Playing as guest — connect a wallet for tournaments, the shop and rewards
        </div>
      )}
    </ArtScreen>
  )
}
