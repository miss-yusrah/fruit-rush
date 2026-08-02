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
      <Hotspot
        top={69.5}
        left={20}
        width={60}
        height={6.5}
        label="Enter Daily Slash"
        onClick={() => onEnter('daily-slash')}
      />
      <Hotspot
        top={82}
        left={4}
        width={92}
        height={5}
        label="Enter Fruit Frenzy"
        onClick={() => onEnter('fruit-frenzy')}
      />
      <Hotspot
        top={87.5}
        left={4}
        width={92}
        height={5}
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
