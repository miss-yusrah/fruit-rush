import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'
import { designArt } from '../assets/designs'

interface HomeScreenProps {
  onPlay: () => void
  onShop: () => void
  onCompete: () => void
}

/**
 * Hotspots measured on home.png with a 2% grid:
 *  - PLAY button: 71–83.5% tall, 29–73% wide
 *  - "Shop · Tournaments" text row: 85.5–88% (thumb-padded below)
 */
export function HomeScreen({ onPlay, onShop, onCompete }: HomeScreenProps) {
  return (
    <ArtScreen src={designArt.home} alt="Fruit Rush home">
      <Hotspot top={71} left={28} width={46} height={12.5} label="Play" onClick={onPlay} />

      <Hotspot top={84.5} left={29} width={14} height={5} label="Shop" onClick={onShop} />
      <Hotspot
        top={84.5}
        left={44}
        width={26}
        height={5}
        label="Tournaments"
        onClick={onCompete}
      />
    </ArtScreen>
  )
}
