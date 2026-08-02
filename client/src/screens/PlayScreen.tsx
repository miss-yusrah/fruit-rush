import { memo, useEffect, useRef, useState } from 'react'
import { audio } from '../audio'
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
  if (mode === 'Classic') {
    return {
      info: 'CLASSIC · endless survival',
      hint: 'Misses cost lives · bombs end the run',
    }
  }
  if (mode === 'Zen') {
    return {
      info: 'ZEN · 1:30 chill slice',
      hint: 'No bombs. No hazards. Beat the clock.',
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

export const PlayScreen = memo(function PlayScreen({ mode, onExit, onEnded }: PlayScreenProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<FruitRushGame | null>(null)
  const cfg = MODE_CONFIG[mode]
  const endless = cfg.duration === null
  const [hud, setHud] = useState<GameHudState>({
    ...INITIAL_HUD,
    mode,
    timeLeft: cfg.duration,
    lives: Math.min(cfg.lives, 3),
  })
  const [musicOn, setMusicOn] = useState(() => audio.isMusicEnabled)
  const portrait = usePortrait()
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const paused = hud.status === 'paused'
  const canPause = hud.status === 'playing' || hud.status === 'countdown' || paused

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    // Keep trying — useEffect itself is not a gesture, but unlock after mode tap
    // may still be in-flight; resume again once the round boots.
    void audio.unlock()
    const game = new FruitRushGame({
      host,
      mode,
      onHud: (next) => {
        if (!cancelled) setHud(next)
      },
      onEnd: (result) => {
        if (!cancelled) onEndedRef.current(result)
      },
    })
    gameRef.current = game

    void game.start().then(() => {
      if (cancelled) return
      void audio.unlock().then(() => {
        // Arena ambience should already be running from mode select;
        // recover if the player jumped straight into play.
        if (audio.isMusicEnabled && audio.currentTheme !== 'gameplay') {
          audio.enterGameplay()
        }
      })
    })
    return () => {
      cancelled = true
      gameRef.current = null
      game.destroy()
    }
  }, [mode])

  // Auto-pause when the tab/app is hidden mid-round.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) gameRef.current?.pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Esc toggles pause (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const game = gameRef.current
      if (!game) return
      if (game.isPaused) game.resume()
      else game.pause()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const timerLabel = formatTimeLeft(hud.timeLeft)
  const timerUrgent = hud.timeLeft !== null && hud.timeLeft <= 15
  const blurb = roundBlurb(mode)
  // Zen is chill timed practice — lives aren't the focus. Classic/Arcade show lives.
  const showLives = mode !== 'Zen'

  const togglePause = () => {
    const game = gameRef.current
    if (!game) return
    void audio.unlock().then(() => audio.playUi('tap'))
    if (game.isPaused) game.resume()
    else game.pause()
  }

  return (
    <section className={`art-screen play-screen${portrait ? ' play-screen--rotated' : ''}`}>
      <div className="play-screen__canvas" ref={hostRef} />

      <div className="play-hud">
        <div className="play-hud__top">
          <div className="play-hud__score-wrap">
            <span className="play-hud__label">Score</span>
            <strong className="play-hud__score">{hud.score.toLocaleString()}</strong>
          </div>

          <div className="play-hud__center">
            <div className={`play-hud__timer-wrap${timerUrgent ? ' is-urgent' : ''}`}>
              <span className="play-hud__label">{endless ? 'Survive' : 'Time'}</span>
              <span
                className="play-hud__timer"
                aria-label={endless ? 'endless' : 'time left'}
              >
                {timerLabel}
              </span>
            </div>
            <span className="play-hud__mode">{hud.mode.toUpperCase()}</span>
            <span className="play-hud__combo">
              {hud.combo >= 3 ? `x${hud.multiplier} COMBO` : ''}
            </span>
          </div>

          <div className="play-hud__lives-wrap">
            {showLives ? (
              <>
                <span className="play-hud__label">Lives</span>
                <div className="play-hud__lives" aria-label={`${hud.lives} lives`}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`life${i < hud.lives ? ' is-on' : ''}`} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <span className="play-hud__label">Focus</span>
                <strong className="play-hud__score" style={{ fontSize: '1.1rem' }}>
                  Chill
                </strong>
              </>
            )}
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
                if (next) audio.playTheme('gameplay', 300)
                else audio.playUi('tap')
              })
            }}
          >
            {musicOn ? 'Music on' : 'Music off'}
          </button>
          <div className="play-hud__meta-right">
            {canPause && (
              <button
                type="button"
                className="play-hud__pause"
                aria-label={paused ? 'Resume game' : 'Pause game'}
                onClick={togglePause}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
            )}
            <button
              type="button"
              className="play-hud__exit"
              onClick={() => {
                audio.playUi('close')
                onExit()
              }}
            >
              Exit
            </button>
          </div>
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

      {paused && (
        <div className="play-pause" role="dialog" aria-label="Game paused">
          <span className="play-pause__title display">Paused</span>
          <span className="play-pause__hint">
            {mode === 'Zen'
              ? 'Chill timed slice — no bombs or hazards.'
              : mode === 'Classic'
                ? 'Endless survival — watch the bombs.'
                : 'Take a breath, then continue.'}
          </span>
          <div className="play-pause__actions">
            <button
              type="button"
              className="play-pause__btn play-pause__btn--primary"
              onClick={() => {
                void audio.unlock().then(() => audio.playUi('press'))
                gameRef.current?.resume()
              }}
            >
              Continue
            </button>
            <button
              type="button"
              className="play-pause__btn"
              onClick={() => {
                audio.playUi('close')
                onExit()
              }}
            >
              Exit to modes
            </button>
          </div>
        </div>
      )}
    </section>
  )
})
