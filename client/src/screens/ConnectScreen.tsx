import { useEffect } from 'react'
import { audio } from '../audio'
import { designArt } from '../assets/designs'
import { WalletOptions } from '../components/WalletOptions'
import type { WalletState } from '../state/useWallet'

interface ConnectScreenProps {
  wallet: WalletState
  onDone: () => void
  onGuest: () => void
}

/**
 * Account gate after onboarding.
 * Inside MiniPay: auto-connects (no connect button). Elsewhere: friendly save-progress picker.
 */
export function ConnectScreen({ wallet, onDone, onGuest }: ConnectScreenProps) {
  useEffect(() => {
    if (wallet.status === 'connected') onDone()
  }, [wallet.status, onDone])

  const miniPay = wallet.inMiniPay

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
          <h2 className="display connect-screen__title">
            {miniPay ? 'Almost ready' : 'Save your progress'}
          </h2>
          <p className="connect-screen__hint">
            {miniPay
              ? wallet.status === 'connecting' || wallet.status === 'disconnected'
                ? 'Linking your MiniPay so shop, tournaments, and boasts stay with you…'
                : 'You’re in — let’s rush.'
              : 'Link MiniPay to buy blades, join tournaments, and keep your boasts. Or play as a guest.'}
          </p>

          {miniPay ? (
            <p className="wallet-options__status" aria-live="polite">
              {wallet.status === 'connected'
                ? 'Connected'
                : wallet.error
                  ? wallet.error
                  : 'Opening MiniPay…'}
            </p>
          ) : (
            <WalletOptions wallet={wallet} />
          )}
        </div>

        {!miniPay && (
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                void audio.unlock().then(() => audio.playUi('pop'))
                onGuest()
              }}
            >
              Continue as guest
            </button>
            <p className="connect-screen__fine">
              Guests can play Classic, Zen and Arcade. Shop, tournaments and boasts need a linked
              account — you can add one later from any screen. Best in{' '}
              <strong>MiniPay</strong>.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
