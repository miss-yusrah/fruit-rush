interface BladeButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost'
  block?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function BladeButton({
  children,
  onClick,
  variant = 'primary',
  block = false,
  disabled = false,
  type = 'button',
}: BladeButtonProps) {
  const classes = [
    'blade-btn',
    variant === 'ghost' ? 'blade-btn--ghost' : '',
    block ? 'blade-btn--block' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
