import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'
import { designArt } from '../assets/designs'
import type { ScreenId } from '../types/game'

interface ProfileScreenProps {
  onPlay: () => void
  onNavigate: (screen: ScreenId) => void
}

export function ProfileScreen({ onPlay, onNavigate }: ProfileScreenProps) {
  return (
    <ArtScreen src={designArt.profile} alt="Fruit Rush profile">
      <Hotspot top={70} left={22} width={56} height={7} label="Jump back in" onClick={onPlay} />

      <Hotspot top={89} left={0} width={25} height={10} label="Play" onClick={() => onNavigate('home')} />
      <Hotspot top={89} left={25} width={25} height={10} label="Shop" onClick={() => onNavigate('shop')} />
      <Hotspot
        top={89}
        left={50}
        width={25}
        height={10}
        label="Compete"
        onClick={() => onNavigate('tournaments')}
      />
      <Hotspot
        top={89}
        left={75}
        width={25}
        height={10}
        label="Profile"
        onClick={() => onNavigate('profile')}
      />
    </ArtScreen>
  )
}
