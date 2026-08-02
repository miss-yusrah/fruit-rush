import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'
import { designArt } from '../assets/designs'
import type { ScreenId } from '../types/game'

interface ShopScreenProps {
  onBuy: (name: string) => void
  onNavigate: (screen: ScreenId) => void
}

const ITEMS = [
  { name: 'Starter Blade', top: 27, left: 5, width: 44, height: 28.5 },
  { name: 'Melon Crush', top: 27, left: 51, width: 44, height: 28.5 },
  { name: 'Golden Pine', top: 56.5, left: 5, width: 44, height: 29 },
  { name: 'Dragon Edge', top: 56.5, left: 51, width: 44, height: 29 },
] as const

export function ShopScreen({ onBuy, onNavigate }: ShopScreenProps) {
  return (
    <ArtScreen src={designArt.shop} alt="Fruit Rush armory">
      {ITEMS.map((item) => (
        <Hotspot
          key={item.name}
          top={item.top}
          left={item.left}
          width={item.width}
          height={item.height}
          label={`Buy ${item.name}`}
          onClick={() => onBuy(item.name)}
        />
      ))}

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
