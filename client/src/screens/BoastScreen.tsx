import { ArtScreen } from '../components/ArtScreen'
import { Hotspot } from '../components/Hotspot'
import { designArt } from '../assets/designs'

interface BoastScreenProps {
  onMint: () => void
  onShare: () => void
  onDismiss: () => void
  mintedId?: number | null
  minting?: boolean
}

export function BoastScreen({
  onMint,
  onShare,
  onDismiss,
  mintedId = null,
  minting = false,
}: BoastScreenProps) {
  return (
    <ArtScreen src={designArt.boast} alt="Prove it on-chain">
      {/* Mint — measured ~76.7–79% */}
      {mintedId == null ? (
        <Hotspot
          top={75.5}
          left={8}
          width={84}
          height={5}
          label={minting ? 'Minting' : 'Mint Boast'}
          disabled={minting}
          onClick={onMint}
        />
      ) : (
        <Hotspot top={75.5} left={8} width={84} height={5} label="Share" onClick={onShare} />
      )}
      <Hotspot top={81.5} left={28} width={44} height={4} label="Share" onClick={onShare} />
      <Hotspot top={86.5} left={28} width={44} height={4.5} label="Not now" onClick={onDismiss} />
    </ArtScreen>
  )
}
