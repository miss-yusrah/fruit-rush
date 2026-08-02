import type { ButtonHTMLAttributes, ReactNode } from 'react'

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
  ...rest
}: HotspotProps) {
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
      {...rest}
    >
      {children}
    </button>
  )
}
