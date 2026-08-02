import { useEffect } from 'react'
import { designArt } from '../assets/designs'
import { WalletOptions } from '../components/WalletOptions'
import type { WalletState } from '../state/useWallet'

interface ConnectScreenProps {
  wallet: WalletState
  onDone: () => void
  onGuest: () => void
}

/** Wallet gate after onboarding and before play. Advances automatically once connected. */
export function ConnectScreen({ wallet, onDone, onGuest }: ConnectScreenProps) {
  useEffect(() => {
    if (wallet.status === 'connected') onDone()
  }, [wallet.status, onDone])

  return (
    <section className="flow-screen connect-screen">
      <img
        className="flow-screen__art"
        src={designArt.home}
        alt=""
        draggable={false}
        aria-hidden
      />
      <span className="flow-screen__scrim flow-screen__scrim--bottom" aria-hidden />

      <div className="connect-screen__sheet">
        <div className="flow-card">
          <h2 className="display connect-screen__title">Connect a wallet</h2>
          <p className="connect-screen__hint">
            Fruit Rush runs on Celo. Connect to buy blades, enter tournaments, and mint
            boasts.
          </p>
          <WalletOptions wallet={wallet} />
        </div>

        <button type="button" className="btn-ghost" onClick={onGuest}>
          Continue as guest
        </button>
        <p className="connect-screen__fine">
          Guests can play Classic, Zen and Arcade. Tournaments, the shop and boast
          minting need a wallet — you can connect later from any screen.
        </p>
      </div>
    </section>
  )
}
