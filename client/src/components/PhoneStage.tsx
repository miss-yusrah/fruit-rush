import type { ReactNode } from 'react'

interface PhoneStageProps {
  children: ReactNode
}

/**
 * Aspect-locked stage matching design art (1170×2532).
 * Scales uniformly to fit any phone viewport — design never crops or letterboxes inside the stage.
 */
export function PhoneStage({ children }: PhoneStageProps) {
  return (
    <div className="app-shell">
      <div className="phone-stage">{children}</div>
    </div>
  )
}
