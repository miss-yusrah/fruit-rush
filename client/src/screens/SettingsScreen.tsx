import { useState } from 'react'
import { audio } from '../audio'
import { designArt } from '../assets/designs'
import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'

interface SettingsScreenProps {
  onBack: () => void
}

/**
 * Settings on the painted design asset.
 * Toggle hotspots are measured to the green ON pills in settings.png;
 * a live switch fills each hotspot so On/Off always moves with the tap.
 */
export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [sfx, setSfx] = useState(() => audio.isSfxEnabled)
  const [music, setMusic] = useState(() => audio.isMusicEnabled)

  const toggleSfx = async () => {
    await audio.unlock()
    const next = !sfx
    audio.setSfxEnabled(next)
    setSfx(next)
    if (next) audio.playUi('pop')
  }

  const toggleMusic = async () => {
    await audio.unlock()
    const next = !music
    audio.setMusicEnabled(next)
    setMusic(next)
    if (sfx) audio.playUi('tap')
    if (next) audio.startMusic()
  }

  const testSlice = async () => {
    await audio.unlock()
    if (!sfx) {
      audio.setSfxEnabled(true)
      setSfx(true)
    }
    audio.playSlice('watermelon')
  }

  return (
    <ArtScreen src={designArt.settings} alt="Fruit Rush settings" className="settings-art">
      <Hotspot top={1.5} left={1} width={14} height={6} label="Back" onClick={onBack} />

      {/* Measured green toggle pills on settings.png */}
      <Hotspot
        top={50.3}
        left={67.5}
        width={15.5}
        height={4.8}
        label="Toggle sound effects"
        silent
        className="settings-switch-hit"
        onClick={() => void toggleSfx()}
      >
        <span className={`settings-live-switch${sfx ? ' is-on' : ''}`} aria-hidden />
      </Hotspot>

      <Hotspot
        top={61.7}
        left={67.5}
        width={15.5}
        height={4.8}
        label="Toggle game music"
        silent
        className="settings-switch-hit"
        onClick={() => void toggleMusic()}
      >
        <span className={`settings-live-switch${music ? ' is-on' : ''}`} aria-hidden />
      </Hotspot>

      {/* Also allow tapping the whole label row */}
      <Hotspot
        top={49.5}
        left={8}
        width={58}
        height={6.5}
        label="Toggle sound effects row"
        silent
        onClick={() => void toggleSfx()}
      />
      <Hotspot
        top={60.8}
        left={8}
        width={58}
        height={6.5}
        label="Toggle game music row"
        silent
        onClick={() => void toggleMusic()}
      />

      <Hotspot
        top={72.2}
        left={14}
        width={72}
        height={8.2}
        label="Test a slice"
        silent
        className="settings-plank-hit"
        onClick={() => void testSlice()}
      />
    </ArtScreen>
  )
}
