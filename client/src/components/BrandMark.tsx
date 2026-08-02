interface BrandMarkProps {
  size?: 'sm' | 'md' | 'hero'
  as?: 'h1' | 'p' | 'div'
}

export function BrandMark({ size = 'md', as: Tag = 'div' }: BrandMarkProps) {
  const fontSize =
    size === 'hero' ? 'clamp(3.4rem, 18vw, 4.6rem)' : size === 'md' ? '1.55rem' : '1.05rem'

  return (
    <Tag
      className="display"
      style={{
        fontSize,
        color: 'var(--cream)',
        margin: 0,
        textShadow: '0 2px 0 rgba(255, 107, 26, 0.35)',
      }}
    >
      FRUIT RUSH
    </Tag>
  )
}
