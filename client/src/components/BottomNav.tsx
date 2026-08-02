import type { ReactNode } from 'react'
import type { ScreenId } from '../types/game'

interface BottomNavProps {
  active: ScreenId
  onNavigate: (screen: ScreenId) => void
}

const ITEMS: { id: ScreenId; label: string; icon: ReactNode }[] = [
  {
    id: 'home',
    label: 'Play',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 12l7-8 7 8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 12v7h8v-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'shop',
    label: 'Shop',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 8h16l-1.2 11H5.2L4 8z" strokeLinejoin="round" />
        <path d="M9 8V6a3 3 0 016 0v2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'tournaments',
    label: 'Compete',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 4h8v4a4 4 0 01-8 0V4z" />
        <path d="M8 6H5a2 2 0 002 3.5M16 6h3a2 2 0 01-2 3.5" strokeLinecap="round" />
        <path d="M12 12v3M9 20h6M12 15h0" strokeLinecap="round" />
        <path d="M10 20c0-2 4-2 4 0" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="9" r="3.5" />
        <path d="M5.5 19c1.5-3 4-4.5 6.5-4.5S17 16 18.5 19" strokeLinecap="round" />
      </svg>
    ),
  },
]

export function BottomNav({ active, onNavigate }: BottomNavProps) {
  const resolved = active === 'modes' || active === 'play' || active === 'boast' ? 'home' : active

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav__item${resolved === item.id ? ' is-active' : ''}`}
          onClick={() => onNavigate(item.id === 'home' ? 'home' : item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
