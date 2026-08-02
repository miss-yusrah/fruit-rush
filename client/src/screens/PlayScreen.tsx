import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio'
import { designArt } from '../assets/designs'
import { FruitRushGame } from '../game/FruitRushGame'
import type { GameEndPayload, GameHudState } from '../game/types'
import { MODE_CONFIG, formatTimeLeft } from '../game/types'
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
  timeLeft: 90,
  mode: 'Classic',
  status: 'countdown',
  countdown: 3,
}

function roundBlurb(mode: GameMode): { info: string; hint: string } {
  const cfg = MODE_CONFIG[mode]
  if (mode === 'Zen') {
    return {
      info: 'ZEN · endless practice',
      hint: 'No bombs. No hazards. Slice forever.',
    }
  }
  const mins = cfg.duration ? formatTimeLeft(cfg.duration) : '∞'
  const threats = [
    cfg.bombs ? 'bombs end the run' : null,
    cfg.hazards ? 'spikes cost a life · ice steals points' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    info: `${mode.toUpperCase()} · ${mins} round`,
    hint: `Swipe fruit to score · ${threats}`,
  }
}

export function PlayScreen({ mode, onExit, onEnded }: PlayScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [hud, setHud] = useState<GameHudState>({
    ...INITIAL_HUD,
    mode,
    timeLeft: MODE_CONFIG[mode].duration,
    lives: Math.min(MODE_CONFIG[mode].lives, 3),
  })
  const [musicOn, setMusicOn] = useState(() => audio.isMusicEnabled)
  const portrait = usePortrait()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    void audio.unlock()
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

  const timerLabel = formatTimeLeft(hud.timeLeft)
  const timerUrgent = hud.timeLeft !== null && hud.timeLeft <= 15
  const blurb = roundBlurb(mode)

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
          <div className="play-hud__score-wrap">
            <span className="play-hud__label">Score</span>
            <strong className="play-hud__score">{hud.score.toLocaleString()}</strong>
          </div>

          <div className="play-hud__center">
            <div className={`play-hud__timer-wrap${timerUrgent ? ' is-urgent' : ''}`}>
              <span className="play-hud__label">Time</span>
              <span className="play-hud__timer" aria-label="time left">
                {timerLabel}
              </span>
            </div>
            <span className="play-hud__mode">{hud.mode.toUpperCase()}</span>
            <span className="play-hud__combo">
              {hud.combo >= 3 ? `x${hud.multiplier} COMBO` : ''}
            </span>
          </div>

          <div className="play-hud__lives-wrap">
            <span className="play-hud__label">Lives</span>
            <div className="play-hud__lives" aria-label={`${hud.lives} lives`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={`life${i < hud.lives ? ' is-on' : ''}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="play-hud__meta">
          <button
            type="button"
            className="play-hud__mute"
            aria-label={musicOn ? 'Turn game music off' : 'Turn game music on'}
            onClick={() => {
              void audio.unlock().then(() => {
                const next = !audio.isMusicEnabled
                audio.setMusicEnabled(next)
                setMusicOn(next)
                if (next) audio.startMusic()
                else audio.playUi('tap')
              })
            }}
          >
            {musicOn ? 'Music on' : 'Music off'}
          </button>
          <button
            type="button"
            className="play-hud__exit"
            onClick={() => {
              audio.playUi('tap')
              onExit()
            }}
          >
            Exit
          </button>
        </div>
      </div>

      {hud.status === 'countdown' && (
        <div className="play-countdown" aria-live="polite">
          <span className="display">
            {hud.countdown > 0.3 ? Math.ceil(hud.countdown) : 'SLICE!'}
          </span>
          <span className="play-countdown__info">{blurb.info}</span>
          <span className="play-countdown__hint">{blurb.hint}</span>
        </div>
      )}
    </section>
  )
}
