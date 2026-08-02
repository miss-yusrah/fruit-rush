import { useState } from 'react'
import { audio } from '../audio'
import '../styles/settings.css'

interface SettingsScreenProps {
  onClose: () => void
}

/**
 * Settings popup — overlays whatever screen is already underneath,
 * so the green orchard / shop / home art stays as the background.
 */
export function SettingsScreen({ onClose }: SettingsScreenProps) {
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
    if (next) audio.enterMenu()
  }

  const testSlice = async () => {
    await audio.unlock()
    if (!sfx) {
      audio.setSfxEnabled(true)
      setSfx(true)
    }
    audio.playUi('press')
    audio.playSlice('watermelon')
  }

  const close = () => {
    void audio.unlock().then(() => audio.playUi('close'))
    onClose()
  }

  return (
    <section className="settings-screen" role="dialog" aria-modal="true" aria-label="Settings">
      <button
        type="button"
        className="settings-screen__scrim"
        aria-label="Close settings"
        onClick={close}
      />

      <div className="settings-screen__card">
        <button
          type="button"
          className="settings-screen__back"
          aria-label="Close"
          onClick={close}
        >
          ‹
        </button>

        <p className="settings-screen__eyebrow">Fruit Rush</p>
        <h1 className="settings-screen__title">Settings</h1>
        <p className="settings-screen__blurb">Make it juicy. Or keep your own playlist.</p>

        <div className="settings-rows" role="group" aria-label="Audio">
          <button
            type="button"
            className={`settings-row${sfx ? ' is-on' : ''}`}
            onClick={() => void toggleSfx()}
            aria-pressed={sfx}
          >
            <span className="settings-row__copy">
              <strong>Sound effects</strong>
              <span>Slices, bombs, combos</span>
            </span>
            <span className={`settings-toggle${sfx ? ' is-on' : ''}`} aria-hidden>
              <span className="settings-toggle__knob" />
              <span className="settings-toggle__label">{sfx ? 'On' : 'Off'}</span>
            </span>
          </button>

          <button
            type="button"
            className={`settings-row${music ? ' is-on' : ''}`}
            onClick={() => void toggleMusic()}
            aria-pressed={music}
          >
            <span className="settings-row__copy">
              <strong>Game music</strong>
              <span>Off for your own playlist</span>
            </span>
            <span className={`settings-toggle${music ? ' is-on' : ''}`} aria-hidden>
              <span className="settings-toggle__knob" />
              <span className="settings-toggle__label">{music ? 'On' : 'Off'}</span>
            </span>
          </button>
        </div>

        <button type="button" className="btn-primary settings-screen__cta" onClick={() => void testSlice()}>
          Test a slice
        </button>
      </div>
    </section>
  )
}
