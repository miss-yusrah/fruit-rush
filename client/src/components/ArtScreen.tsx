import type { ReactNode } from 'react'

interface ArtScreenProps {
  src: string
  alt: string
  children?: ReactNode
  className?: string
}

/**
 * Full-bleed design art inside the aspect-locked phone stage.
 * Image fills the stage 1:1 (same aspect) — no contain/cover/mirror.
 */
export function ArtScreen({ src, alt, children, className = '' }: ArtScreenProps) {
  return (
    <section className={`art-screen ${className}`.trim()}>
      <img className="art-screen__img" src={src} alt={alt} draggable={false} />
      <div className="art-screen__hits">{children}</div>
    </section>
  )
}
