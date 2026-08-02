type FruitDecor = {
  top: string
  left?: string
  right?: string
  size: number
  color: string
  delay: string
  rind?: string
}

const FRUITS: FruitDecor[] = [
  { top: '18%', left: '8%', size: 72, color: '#e63946', delay: '0s', rind: '#2d6a4f' },
  { top: '28%', right: '6%', size: 58, color: '#f4a261', delay: '0.8s' },
  { top: '52%', left: '12%', size: 48, color: '#c8f542', delay: '1.4s' },
  { top: '62%', right: '14%', size: 64, color: '#e63946', delay: '0.4s', rind: '#1b4332' },
]

export function FloatingFruits() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
      {FRUITS.map((f, i) => (
        <span
          key={i}
          className="float-fruit"
          style={{
            top: f.top,
            left: f.left,
            right: f.right,
            width: f.size,
            height: f.size,
            background: `radial-gradient(circle at 30% 30%, ${f.color}, #07140f)`,
            animationDelay: f.delay,
            boxShadow: f.rind ? `inset 0 0 0 5px ${f.rind}` : undefined,
            opacity: 0.92,
          }}
        />
      ))}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: '36%',
          left: '18%',
          width: '64%',
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(244,237,224,0.55), transparent)',
          transform: 'rotate(-18deg)',
          animation: 'pulse-soft 2.8s ease-in-out infinite',
        }}
      />
    </div>
  )
}
