import { useEffect, useMemo, useState } from 'react'
import { audio } from '../audio'
import { designArt } from '../assets/designs'
import {
  computeRoundRewards,
  headlineFor,
  type RoundRewards,
} from '../components/results/resultsRewards'
import { buildMockLeaderboard } from '../data/leaderboard'
import type { GameSessionResult } from '../types/game'
import '../styles/results.css'

const BONUS_ICON = {
  daily: '◆',
  combo: '✕',
  accuracy: '◎',
  speed: '›',
  nobomb: '○',
} as const

const SHORT_LABEL = {
  daily: 'Daily',
  combo: 'Combo',
  accuracy: 'Accuracy',
  speed: 'Speed',
  nobomb: 'No Bomb',
} as const

interface ResultsScreenProps {
  result: GameSessionResult
  personalBest: number
  onPlayAgain: () => void
  onBoast: () => void
  onHome: () => void
  onShop?: () => void
  onToast?: (message: string) => void
}

export function ResultsScreen({
  result,
  personalBest,
  onPlayAgain,
  onBoast,
  onHome,
}: ResultsScreenProps) {
  const youRank = useMemo(
    () => buildMockLeaderboard(result.score).entries.find((e) => e.isYou)?.rank ?? 99,
    [result.score],
  )
  const headline = headlineFor(result)
  const [rewards, setRewards] = useState<RoundRewards | null>(null)

  useEffect(() => {
    setRewards(computeRoundRewards(result, youRank))
    const cue =
      result.score <= 0
        ? 'close'
        : result.isPersonalBest
          ? 'rush'
          : result.comboHighwater >= 8
            ? 'juicy'
            : 'nice'
    void audio.unlock().then(() => {
      audio.playGameOver(cue)
    })
  }, [result, youRank])

  useEffect(() => {
    if (!rewards?.leveledUp) return
    const id = window.setTimeout(() => audio.playLevelUp(), 700)
    return () => window.clearTimeout(id)
  }, [rewards?.leveledUp])

  useEffect(() => {
    if (!rewards) return
    // Soft counting ticks synced with the score/loot reveal.
    const ticks = [180, 320, 460, 600]
    const timers = ticks.map((ms, i) =>
      window.setTimeout(() => {
        audio.playCount(i % 2 === 0 ? 'xp' : 'coin')
      }, ms),
    )
    const coinTimer = window.setTimeout(() => {
      for (let i = 0; i < Math.min(5, Math.ceil(rewards.coinsEarned / 8)); i++) {
        window.setTimeout(() => audio.playCoin(), i * 70)
      }
    }, 520)
    return () => {
      timers.forEach(clearTimeout)
      window.clearTimeout(coinTimer)
    }
  }, [rewards])

  if (!rewards) return null

  return (
    <section className="rs-screen">
      <img
        className="rs-screen__art"
        src={designArt.modes}
        alt=""
        draggable={false}
        aria-hidden
      />
      <span className="rs-screen__scrim" aria-hidden />

      <div className="rs-card">
        <p className="rs-card__mode">{result.mode}</p>
        <h2 className="rs-card__title">{headline}</h2>

        <p className="rs-card__score">{result.score.toLocaleString()}</p>
        <p className={`rs-card__pb${result.isPersonalBest ? '' : ' is-dim'}`}>
          {result.isPersonalBest ? 'Personal best' : `Best ${personalBest.toLocaleString()}`}
        </p>

        <div className="rs-card__stats">
          <div>
            <span>Combo</span>
            <strong>x{result.comboHighwater}</strong>
          </div>
          <div>
            <span>Accuracy</span>
            <strong>{result.accuracy}%</strong>
          </div>
          <div>
            <span>Time</span>
            <strong>{result.durationSeconds}s</strong>
          </div>
        </div>

        <div className="rs-card__loot">
          <span>+{rewards.xpEarned} XP</span>
          <span>+{rewards.coinsEarned} ★</span>
        </div>

        <ul className="rs-card__bonuses" aria-label="Bonuses">
          {rewards.bonuses.map((b) => (
            <li
              key={b.id}
              className={`rs-bonus${b.earned ? ' is-on' : ' is-off'}`}
              title={b.earned ? `+${b.xp} XP · +${b.coins} ★` : 'Not earned'}
            >
              <span className="rs-bonus__icon" aria-hidden>
                {BONUS_ICON[b.id]}
              </span>
              <span className="rs-bonus__name">{SHORT_LABEL[b.id]}</span>
              <span className="rs-bonus__gain">
                {b.earned ? `+${b.xp}` : '—'}
              </span>
            </li>
          ))}
        </ul>

        <div className="rs-card__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              audio.playUi('press')
              void audio.unlock().then(() => audio.enterGameplay())
              onPlayAgain()
            }}
          >
            Play again
          </button>
          {result.score > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                audio.playUi('reward')
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
              audio.playUi('close')
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
