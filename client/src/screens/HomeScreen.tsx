import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'
import { designArt } from '../assets/designs'

interface HomeScreenProps {
  onPlay: () => void
  onShop: () => void
  onCompete: () => void
}

export function HomeScreen({ onPlay, onShop, onCompete }: HomeScreenProps) {
  return (
    <ArtScreen src={designArt.home} alt="Fruit Rush home">
      {/* PLAY — ends before Shop/Tournaments so links stay clickable */}
      <Hotspot top={70.5} left={12} width={76} height={7} label="Play" onClick={onPlay} />

      {/* Shop · Tournaments — measured on home.png */}
      <Hotspot top={77.5} left={36} width={30} height={6} label="Shop" onClick={onShop} />
      <Hotspot top={77.5} left={64} width={22} height={6} label="Tournaments" onClick={onCompete} />
    </ArtScreen>
  )
}
