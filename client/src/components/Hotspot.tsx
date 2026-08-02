import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { audio } from '../audio'

interface HotspotProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** top % of design frame */
  top: number
  /** left % of design frame */
  left: number
  /** width % of design frame */
  width: number
  /** height % of design frame */
  height: number
  label: string
  children?: ReactNode
  /** Skip the wood-tap UI sound (rare). */
  silent?: boolean
}

/** Invisible hit target positioned in % of the art frame — keeps visuals = design PNG. */
export function Hotspot({
  top,
  left,
  width,
  height,
  label,
  className = '',
  children,
  silent = false,
  onClick,
  onPointerEnter,
  ...rest
}: HotspotProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!silent) {
      void audio.unlock().then(() => audio.playUi('press'))
    }
    onClick?.(e)
  }

  return (
    <button
      type="button"
      className={`hotspot ${className}`.trim()}
      style={{
        top: `${top}%`,
        left: `${left}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      aria-label={label}
      onClick={handleClick}
      onPointerEnter={(e) => {
        // Hover must not bootstrap AudioContext — browsers only unlock on
        // click/tap/key. Play the soft tick only after a real unlock.
        if (!silent && audio.isUnlocked) audio.playUi('hover')
        onPointerEnter?.(e)
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
