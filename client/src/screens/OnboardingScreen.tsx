import { useState } from 'react'
import { designArt } from '../assets/designs'
import { BrandMark } from '../components/BrandMark'

interface OnboardingScreenProps {
  onDone: () => void
}

const SLIDES = [
  {
    key: 'slash',
    glyph: '🍉',
    title: 'Slash everything',
    body: 'Swipe through waves of fruit to stack combos and multipliers. Dodge the bombs — one slip ends the run.',
  },
  {
    key: 'own',
    glyph: '⚔️',
    title: 'Own your loot',
    body: 'Blades, trails, and boasts stay with you. Grab them in the shop — once they’re yours, they’re yours.',
  },
  {
    key: 'compete',
    glyph: '🏆',
    title: 'Compete and earn',
    body: 'Jump into daily tournaments with real prize pools, climb the board, and boast your best runs.',
  },
] as const

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const last = index === SLIDES.length - 1

  return (
    <section className="flow-screen onboarding-screen">
      <img
        className="flow-screen__art flow-screen__art--dim"
        src={designArt.play}
        alt=""
        draggable={false}
        aria-hidden
      />
      <span className="flow-screen__scrim" aria-hidden />

      <header className="onboarding-screen__header">
        <BrandMark size="sm" />
        {!last && (
          <button type="button" className="onboarding-screen__skip" onClick={onDone}>
            Skip
          </button>
        )}
      </header>

      <div className="onboarding-screen__slide" key={slide.key}>
        <span className="onboarding-screen__glyph" aria-hidden>
          {slide.glyph}
        </span>
        <h2 className="display onboarding-screen__title">{slide.title}</h2>
        <p className="onboarding-screen__body">{slide.body}</p>
      </div>

      <footer className="onboarding-screen__footer">
        <div className="onboarding-screen__dots" aria-hidden>
          {SLIDES.map((s, i) => (
            <span key={s.key} className={`dot${i === index ? ' is-active' : ''}`} />
          ))}
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => (last ? onDone() : setIndex((i) => i + 1))}
        >
          {last ? 'Get started' : 'Next'}
        </button>
      </footer>
    </section>
  )
}
