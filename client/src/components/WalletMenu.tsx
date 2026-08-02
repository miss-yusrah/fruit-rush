import { useState } from 'react'
import { EmailAuthForm } from './EmailAuthForm'
import { WalletOptions } from './WalletOptions'
import type { WalletState } from '../state/useWallet'

interface WalletMenuProps {
  wallet: WalletState
  className?: string
}

type MenuPanel = 'choices' | 'email' | 'wallet'

/**
 * Top-right account chip. Disconnected: three paths (email / wallet / later).
 * Wallet options only appear after “Connect wallet” is tapped.
 */
export function WalletMenu({ wallet, className = '' }: WalletMenuProps) {
  const {
    status,
    address,
    shortAddress,
    loginMethod,
    loginLabel,
    email,
    menuOpen,
    disconnect,
    toggleMenu,
    closeMenu,
    inMiniPay,
    magicAvailable,
  } = wallet
  const [panel, setPanel] = useState<MenuPanel>('choices')
  const short = status === 'connected' && address ? address.slice(-4) : null
  const busy = status === 'connecting'

  // MiniPay: hide the chip until connected (auto-connect is in flight).
  if (inMiniPay && status !== 'connected') {
    return null
  }

  const handleToggle = () => {
    setPanel('choices')
    toggleMenu()
  }

  const handleClose = () => {
    setPanel('choices')
    closeMenu()
  }

  return (
    <div className={`wallet-anchor ${className}`.trim()}>
      <button
        type="button"
        className={`wallet-chip-btn${status === 'connected' ? ' is-connected' : ''}${status === 'connecting' ? ' is-busy' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-label={
          status === 'connected' && shortAddress
            ? `Account ${shortAddress}`
            : status === 'connecting'
              ? 'Linking account'
              : 'Save progress'
        }
        onClick={handleToggle}
      >
        <span className="wallet-chip-btn__icon" aria-hidden>
          {status === 'connecting' ? '…' : short ? short : '◈'}
        </span>
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="wallet-popover__scrim"
            aria-label="Close account menu"
            onClick={handleClose}
          />
          <div className="wallet-popover" role="dialog" aria-label="Account">
            {status !== 'connected' && !inMiniPay && (
              <>
                {panel === 'email' ? (
                  <div className="connect-panel">
                    <button
                      type="button"
                      className="connect-panel__back"
                      onClick={() => setPanel('choices')}
                      disabled={busy && wallet.pendingWallet === 'Email'}
                    >
                      ← Back
                    </button>
                    <EmailAuthForm wallet={wallet} compact />
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
                    <p className="wallet-popover__section">Choose a wallet</p>
                    <WalletOptions wallet={wallet} />
                  </div>
                ) : (
                  <>
                    <p className="wallet-popover__title">Save your progress</p>
                    <p className="wallet-popover__hint">
                      Sign in with email or connect a wallet.
                    </p>
                    <div className="connect-choices">
                      {magicAvailable && (
                        <button
                          type="button"
                          className="connect-choice connect-choice--primary"
                          disabled={busy}
                          onClick={() => setPanel('email')}
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
                        onClick={() => setPanel('wallet')}
                      >
                        <span className="connect-choice__title">Connect wallet</span>
                        <span className="connect-choice__sub">MetaMask and other browsers</span>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {status === 'connected' && address && (
              <>
                <p className="wallet-popover__addr">{shortAddress}</p>
                <p className="wallet-popover__title">{loginLabel}</p>
                {loginMethod === 'magic' && email && (
                  <p className="wallet-popover__hint">{email}</p>
                )}
                {inMiniPay && (
                  <p className="wallet-popover__hint">Shop, tournaments, and boasts stay with you.</p>
                )}
                {!inMiniPay && (
                  <>
                    <button
                      type="button"
                      className="wallet-popover__action wallet-popover__action--ghost"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(address)
                        } catch {
                          /* ignore */
                        }
                        handleClose()
                      }}
                    >
                      Copy ID
                    </button>
                    <button
                      type="button"
                      className="wallet-popover__action wallet-popover__action--danger"
                      onClick={disconnect}
                    >
                      Log out
                    </button>
                  </>
                )}
                {inMiniPay && (
                  <button
                    type="button"
                    className="wallet-popover__action wallet-popover__action--ghost"
                    onClick={handleClose}
                  >
                    Got it
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
