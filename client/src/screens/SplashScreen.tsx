import { useEffect } from 'react'
import { designArt } from '../assets/designs'

interface SplashScreenProps {
  onDone: () => void
}

const SPLASH_MS = 2000

/** Cinematic boot screen — the home poster art with a slow zoom and loader. */
export function SplashScreen({ onDone }: SplashScreenProps) {
  useEffect(() => {
    const t = window.setTimeout(onDone, SPLASH_MS)
    return () => window.clearTimeout(t)
  }, [onDone])

  return (
    <button type="button" className="flow-screen splash-screen" onClick={onDone}>
      <img
        className="flow-screen__art splash-screen__art"
        src={designArt.home}
        alt=""
        draggable={false}
        aria-hidden
      />
      <span className="splash-screen__scrim" aria-hidden />
      <span className="splash-screen__loader" aria-hidden />
    </button>
  )
}
