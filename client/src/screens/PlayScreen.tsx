import { useEffect, useRef, useState } from 'react'
import { designArt } from '../assets/designs'
import { FruitRushGame } from '../game/FruitRushGame'
import type { GameEndPayload, GameHudState } from '../game/types'
import { MODE_CONFIG } from '../game/types'
import type { GameMode } from '../types/game'
import '../styles/screens.css'

/**
 * True while the viewport is portrait. The round always renders landscape:
 * on portrait phones we CSS-rotate the whole play screen 90° so the player
 * turns the phone sideways and swipes with both hands, arcade style.
 */
function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)')
    const onChange = (e: MediaQueryListEvent) => setPortrait(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return portrait
}

interface PlayScreenProps {
  mode: GameMode
  onExit: () => void
  onEnded: (result: GameEndPayload) => void
}

const INITIAL_HUD: GameHudState = {
  score: 0,
  combo: 0,
  multiplier: 1,
  lives: 3,
  timeLeft: 60,
  mode: 'Classic',
  status: 'countdown',
  countdown: 3,
}

export function PlayScreen({ mode, onExit, onEnded }: PlayScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [hud, setHud] = useState<GameHudState>({ ...INITIAL_HUD, mode })
  const portrait = usePortrait()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    const game = new FruitRushGame({
      host,
      mode,
      onHud: (next) => {
        if (!cancelled) setHud(next)
      },
      onEnd: (result) => {
        if (!cancelled) onEnded(result)
      },
    })

    void game.start()
    return () => {
      cancelled = true
      game.destroy()
    }
  }, [mode, onEnded])

  const timerLabel =
    hud.timeLeft === null ? '∞' : `${Math.ceil(hud.timeLeft)}`.padStart(2, '0')
  const timerUrgent = hud.timeLeft !== null && hud.timeLeft <= 10
  const roundInfo = MODE_CONFIG[mode].duration
    ? `${mode} · ${MODE_CONFIG[mode].duration} second round`
    : `${mode} · endless, no timer`

  return (
    <section className={`art-screen play-screen${portrait ? ' play-screen--rotated' : ''}`}>
      <img
        className="art-screen__img play-screen__bg"
        src={designArt.play}
        alt=""
        draggable={false}
        aria-hidden
      />
      <div className="play-screen__canvas" ref={hostRef} />

      <div className="play-hud">
        <div className="play-hud__top">
          <strong className="play-hud__score">{hud.score.toLocaleString()}</strong>
          <div className="play-hud__center">
            <span
              className={`play-hud__timer${timerUrgent ? ' is-urgent' : ''}`}
              aria-label="time left"
            >
              {timerLabel}
            </span>
            <span className="play-hud__mode">{hud.mode.toUpperCase()}</span>
            <span className="play-hud__combo">
              {hud.combo >= 3 ? `x${hud.multiplier} COMBO` : ''}
            </span>
          </div>
          <div className="play-hud__lives" aria-label={`${hud.lives} lives`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`life${i < hud.lives ? ' is-on' : ''}`} />
            ))}
          </div>
        </div>

        <div className="play-hud__meta">
          <span />
          <button type="button" className="play-hud__exit" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>

      {hud.status === 'countdown' && (
        <div className="play-countdown" aria-live="polite">
          <span className="display">
            {hud.countdown > 0.3 ? Math.ceil(hud.countdown) : 'SLASH'}
          </span>
          <span className="play-countdown__info">{roundInfo}</span>
          <span className="play-countdown__hint">
            Swipe through fruit to score · slicing a bomb ends the run
          </span>
        </div>
      )}
    </section>
  )
}
