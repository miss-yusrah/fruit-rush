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
    <ArtScreen src={designArt.boast} alt="Boast your score">
      {/* Boast CTA measured at 77.5–83%; Share ~86–90; Not Now ~92–96 */}
      {mintedId == null ? (
        <Hotspot
          top={77.5}
          left={20}
          width={60}
          height={6}
          label={minting ? 'Saving boast…' : 'Save boast'}
          disabled={minting}
          onClick={onMint}
        />
      ) : (
        <Hotspot top={77.5} left={20} width={60} height={6} label="Share" onClick={onShare} />
      )}
      <Hotspot top={86} left={32} width={36} height={4.5} label="Share" onClick={onShare} />
      <Hotspot top={92} left={32} width={36} height={4.5} label="Not now" onClick={onDismiss} />
    </ArtScreen>
  )
}
