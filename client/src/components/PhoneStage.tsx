import type { ReactNode } from 'react'

interface PhoneStageProps {
  children: ReactNode
}

/**
 * Full-viewport stage for the app.
 * On desktop it sits in a design-aspect phone frame; on phones/tablets the
 * stage goes edge-to-edge (see global.css) so real devices never letterbox.
 */
export function PhoneStage({ children }: PhoneStageProps) {
  return (
    <div className="app-shell">
      <div className="phone-stage">{children}</div>
    </div>
  )
}
