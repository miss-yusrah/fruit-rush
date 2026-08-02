import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'
import { designArt } from '../assets/designs'
import type { ScreenId } from '../types/game'

interface ShopScreenProps {
  onBuy: (name: string) => void
  onNavigate: (screen: ScreenId) => void
}

const ITEMS = [
  { name: 'Starter Blade', top: 26, left: 3, width: 46, height: 28 },
  { name: 'Melon Crush', top: 26, left: 51, width: 46, height: 28 },
  { name: 'Golden Pine', top: 54, left: 3, width: 46, height: 28 },
  { name: 'Dragon Edge', top: 54, left: 51, width: 46, height: 28 },
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
