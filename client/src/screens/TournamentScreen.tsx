import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'
import { designArt } from '../assets/designs'
import type { ScreenId } from '../types/game'

interface TournamentScreenProps {
  onEnter: (id: string) => void
  onNavigate: (screen: ScreenId) => void
}

export function TournamentScreen({ onEnter, onNavigate }: TournamentScreenProps) {
  return (
    <ArtScreen src={designArt.compete} alt="Fruit Rush compete">
      <Hotspot top={68} left={8} width={84} height={8} label="Enter Daily Slash" onClick={() => onEnter('daily-slash')} />
      <Hotspot
        top={78}
        left={4}
        width={92}
        height={5.5}
        label="Enter Fruit Frenzy"
        onClick={() => onEnter('fruit-frenzy')}
      />
      <Hotspot
        top={84}
        left={4}
        width={92}
        height={5.5}
        label="Enter Orchard Open"
        onClick={() => onEnter('orchard-open')}
      />

      <div className="art-nav" role="navigation" aria-label="Primary">
        <button type="button" onClick={() => onNavigate('home')}>
          Play
        </button>
        <button type="button" onClick={() => onNavigate('shop')}>
          Shop
        </button>
        <button type="button" className="is-active" onClick={() => onNavigate('tournaments')}>
          Compete
        </button>
        <button type="button" onClick={() => onNavigate('profile')}>
          Profile
        </button>
      </div>
    </ArtScreen>
  )
}
