import { audio } from '../audio'
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
 * Hotspots measured on modes.png with a 2% grid — they sit exactly on the
 * wooden planks (x 6–94%):
 *  Classic 35–50.5% · Zen 53–69% · Arcade 71–85.5%
 */
export function ModesScreen({ guest = false, onBack, onSelect }: ModesScreenProps) {
  const pick = (mode: GameMode) => {
    // Unlock inside the mode-tap gesture so play countdown/SFX aren't silent.
    void audio.unlock().then(() => {
      if (audio.isMusicEnabled) audio.startMusic()
    })
    onSelect(mode)
  }

  return (
    <ArtScreen src={designArt.modes} alt="Choose your cut">
      <Hotspot top={2} left={1} width={14} height={6} label="Back" onClick={onBack} />

      <Hotspot
        top={35}
        left={6}
        width={88}
        height={15.5}
        label="Classic"
        onClick={() => pick('Classic')}
      />
      <Hotspot
        top={53}
        left={6}
        width={88}
        height={16}
        label="Zen"
        onClick={() => pick('Zen')}
      />
      <Hotspot
        top={71}
        left={6}
        width={88}
        height={14.5}
        label="Arcade"
        onClick={() => pick('Arcade')}
      />

      {guest && (
        <div className="modes-guest-note" role="note">
          Playing as guest — connect a wallet for tournaments, the shop and rewards
        </div>
      )}
    </ArtScreen>
  )
}
