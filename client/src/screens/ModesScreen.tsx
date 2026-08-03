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
    // Unlock inside the mode-tap gesture, fade menu → arena whoosh + ambience.
    void audio.unlock().then(() => {
      audio.enterGameplay()
    })
    onSelect(mode)
  }

  return (
    <ArtScreen src={designArt.modes} alt="Choose your cut">
          <Hotspot
        top={2}
        left={1}
        width={14}
        height={6}
        label="Back"
        silent
        onClick={() => {
          void audio.unlock().then(() => audio.playUi('close'))
          onBack()
        }}
      />

      <Hotspot
        top={34}
        left={5}
        width={90}
        height={15}
        label="Classic — endless survival, bombs live"
        onClick={() => pick('Classic')}
      />
      <Hotspot
        top={51}
        left={5}
        width={90}
        height={17}
        label="Zen — 90 seconds, no bombs"
        onClick={() => pick('Zen')}
      />
      <Hotspot
        top={70}
        left={5}
        width={90}
        height={16}
        label="Arcade — frenzy with hazards"
        onClick={() => pick('Arcade')}
      />

      {/* Correct the baked art subtitles (old art had Classic/Zen rules swapped). */}
      <p className="modes-rule modes-rule--classic" aria-hidden>
        Endless. Bombs live.
      </p>
      <p className="modes-rule modes-rule--zen" aria-hidden>
        90 seconds. No bombs.
      </p>

      {guest && (
        <div className="modes-guest-note" role="note">
          Playing as guest — sign in to shop, compete, and keep rewards
        </div>
      )}
    </ArtScreen>
  )
}
