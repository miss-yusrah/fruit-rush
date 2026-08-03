import { useEffect, useState } from 'react'
import { audio } from '../audio'
import { designArt } from '../assets/designs'
import { EmailAuthForm } from '../components/EmailAuthForm'
import { WalletOptions } from '../components/WalletOptions'
import type { WalletState } from '../state/useWallet'

interface ConnectScreenProps {
  wallet: WalletState
  onDone: () => void
  onGuest: () => void
}

type ConnectPanel = 'choices' | 'email' | 'wallet'

/**
 * First commit screen — three clear paths.
 * Wallet list stays collapsed until “Connect wallet” is tapped.
 */
export function ConnectScreen({ wallet, onDone, onGuest }: ConnectScreenProps) {
  const [panel, setPanel] = useState<ConnectPanel>('choices')

  useEffect(() => {
    if (wallet.status === 'connected') onDone()
  }, [wallet.status, onDone])

  const miniPay = wallet.inMiniPay
  const busy = wallet.status === 'connecting'

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
            {miniPay ? 'Almost ready' : 'Welcome to Fruit Rush'}
          </h2>
          <p className="connect-screen__hint">
            {miniPay
              ? wallet.status === 'connecting' || wallet.status === 'disconnected'
                ? 'Linking your MiniPay so shop, tournaments, and boasts stay with you…'
                : 'You’re in — let’s rush.'
              : 'Play first. Sign in when you’re ready to save progress.'}
          </p>

          {miniPay ? (
            <p className="wallet-options__status" aria-live="polite">
              {wallet.status === 'connected'
                ? 'Connected'
                : wallet.error
                  ? wallet.error
                  : 'Opening MiniPay…'}
            </p>
          ) : panel === 'email' ? (
            <div className="connect-panel">
              <button
                type="button"
                className="connect-panel__back"
                onClick={() => setPanel('choices')}
                disabled={busy && wallet.pendingWallet === 'Email'}
              >
                ← Back
              </button>
              <EmailAuthForm wallet={wallet} />
            </div>
          ) : panel === 'wallet' ? (
            <div className="connect-panel">
              <button
                type="button"
                className="connect-panel__back"
                onClick={() => setPanel('choices')}
                disabled={busy}
              >
                ← Back
              </button>
              <p className="connect-screen__section">Choose a wallet</p>
              <WalletOptions wallet={wallet} />
            </div>
          ) : (
            <div className="connect-choices">
              {wallet.magicAvailable && (
                <button
                  type="button"
                  className="connect-choice connect-choice--primary"
                  disabled={busy}
                  onClick={() => {
                    void audio.unlock().then(() => audio.playUi('pop'))
                    setPanel('email')
                  }}
                >
                  <span className="connect-choice__title">Continue with email</span>
                  <span className="connect-choice__sub">
                    Create a secure wallet automatically
                  </span>
                </button>
              )}

              <button
                type="button"
                className="connect-choice"
                disabled={busy}
                onClick={() => {
                  void audio.unlock().then(() => audio.playUi('pop'))
                  setPanel('wallet')
                }}
              >
                <span className="connect-choice__title">Connect wallet</span>
                <span className="connect-choice__sub">MetaMask and other browsers</span>
              </button>

              <button
                type="button"
                className="connect-choice connect-choice--ghost"
                disabled={busy}
                onClick={() => {
                  void audio.unlock().then(() => audio.playUi('pop'))
                  onGuest()
                }}
              >
                <span className="connect-choice__title">Play as guest</span>
                <span className="connect-choice__sub">Progress won’t be saved</span>
              </button>
            </div>
          )}
        </div>

        {!miniPay && panel === 'choices' && (
          <p className="connect-screen__fine">
            Guests can play Classic, Zen and Arcade. On Celo, MiniPay connects automatically when
            you open Fruit Rush inside the app. Shop and tournaments need a linked account.
          </p>
        )}
      </div>
    </section>
  )
}
