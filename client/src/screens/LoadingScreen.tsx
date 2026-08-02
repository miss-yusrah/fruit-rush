import { useEffect, useState } from 'react'
import type { LoadProgress } from '../assets/preload'

interface LoadingScreenProps {
  onDone: () => void
}

/**
 * First paint is CSS-only (no multi-MB poster, no Pixi in the critical JS path).
 * The preload module is dynamically imported so Vite does not modulepreload
 * the 500KB+ Pixi chunk before this screen can render.
 */
export function LoadingScreen({ onDone }: LoadingScreenProps) {
  const [progress, setProgress] = useState<LoadProgress>({
    phase: 'ui',
    label: 'Loading…',
    progress: 0,
    phaseProgress: 0,
  })

  useEffect(() => {
    let cancelled = false
    let off: (() => void) | undefined

    void import('../assets/preload').then(({ onLoadProgress, preloadBoot }) => {
      if (cancelled) return
      off = onLoadProgress(setProgress)
      void preloadBoot().then(() => {
        if (!cancelled) onDone()
      })
    })

    return () => {
      cancelled = true
      off?.()
    }
  }, [onDone])

  const pct = Math.round(progress.progress * 100)

  return (
    <section className="flow-screen loading-screen" aria-busy="true" aria-live="polite">
      <div className="loading-screen__panel">
        <p className="loading-screen__brand display">Fruit Rush</p>
        <p className="loading-screen__label">{progress.label}</p>
        <div
          className="loading-screen__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="loading-screen__fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="loading-screen__pct">{pct}%</p>
      </div>
    </section>
  )
}
