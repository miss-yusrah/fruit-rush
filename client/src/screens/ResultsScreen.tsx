import { useEffect } from 'react'
import { audio } from '../audio'
import { designArt } from '../assets/designs'
import type { GameSessionResult } from '../types/game'

interface ResultsScreenProps {
  result: GameSessionResult
  personalBest: number
  onPlayAgain: () => void
  onBoast: () => void
  onHome: () => void
}

function endTitle(result: GameSessionResult): { title: string; cue: 'nice' | 'juicy' | 'rush' | 'close' } {
  if (result.score <= 0) return { title: 'SO CLOSE', cue: 'close' }
  if (result.isPersonalBest) return { title: 'RUSH COMPLETE!', cue: 'rush' }
  if (result.comboHighwater >= 8) return { title: 'JUICY RUN!', cue: 'juicy' }
  return { title: 'NICE SLICE!', cue: 'nice' }
}

export function ResultsScreen({
  result,
  personalBest,
  onPlayAgain,
  onBoast,
  onHome,
}: ResultsScreenProps) {
  const sliced = result.score > 0
  const rewardCoins = Math.floor(result.score / 10)
  const { title, cue } = endTitle(result)

  useEffect(() => {
    void audio.unlock().then(() => audio.playGameOver(cue))
  }, [cue])

  return (
    <section className="flow-screen results-screen">
      <img
        className="flow-screen__art flow-screen__art--dim"
        src={designArt.play}
        alt=""
        draggable={false}
        aria-hidden
      />
      <span className="flow-screen__scrim" aria-hidden />

      <div className="flow-card results-screen__card">
        <p className="results-screen__mode">{result.mode.toUpperCase()}</p>
        <h2 className="display results-screen__title">{title}</h2>

        <p className="results-screen__score">{result.score.toLocaleString()}</p>
        {result.isPersonalBest ? (
          <p className="results-screen__pb">Personal best — beat it again</p>
        ) : (
          <p className="results-screen__pb results-screen__pb--dim">
            Best {personalBest.toLocaleString()}
          </p>
        )}

        <dl className="results-screen__stats">
          <div>
            <dt>Top combo</dt>
            <dd>x{result.comboHighwater}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{result.durationSeconds}s</dd>
          </div>
          <div>
            <dt>Juice earned</dt>
            <dd>+{rewardCoins.toLocaleString()}</dd>
          </div>
        </dl>

        <div className="results-screen__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              audio.playUi('pop')
              onPlayAgain()
            }}
          >
            Play again
          </button>
          {sliced && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                audio.playUi('pop')
                onBoast()
              }}
            >
              Boast it
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              audio.playUi('tap')
              onHome()
            }}
          >
            Home
          </button>
        </div>
      </div>
    </section>
  )
}
