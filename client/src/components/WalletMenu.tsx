import type { WalletState } from '../state/useWallet'
import { WalletOptions } from './WalletOptions'

interface WalletMenuProps {
  wallet: WalletState
  className?: string
}

/**
 * Top-right account chip. Inside MiniPay the account is already linked —
 * we only show status / short id, never a “Connect wallet” CTA.
 */
export function WalletMenu({ wallet, className = '' }: WalletMenuProps) {
  const {
    status,
    address,
    shortAddress,
    menuOpen,
    disconnect,
    toggleMenu,
    closeMenu,
    inMiniPay,
  } = wallet
  const short = status === 'connected' && address ? address.slice(-4) : null

  // MiniPay: hide the chip until connected (auto-connect is in flight).
  if (inMiniPay && status !== 'connected') {
    return null
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
        onClick={toggleMenu}
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
            onClick={closeMenu}
          />
          <div className="wallet-popover" role="dialog" aria-label="Account">
            {status !== 'connected' && !inMiniPay && (
              <>
                <p className="wallet-popover__title">Save your progress</p>
                <p className="wallet-popover__hint">
                  Link MiniPay to shop, compete, and keep your boasts.
                </p>
                <WalletOptions wallet={wallet} />
              </>
            )}

            {status === 'connected' && address && (
              <>
                <p className="wallet-popover__title">
                  {inMiniPay ? 'MiniPay linked' : 'Progress saved'}
                </p>
                {/* MiniPay: never lead with a raw 0x address — keep truncated id secondary. */}
                {!inMiniPay && <p className="wallet-popover__addr">{shortAddress}</p>}
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
                        closeMenu()
                      }}
                    >
                      Copy ID
                    </button>
                    <button
                      type="button"
                      className="wallet-popover__action wallet-popover__action--danger"
                      onClick={disconnect}
                    >
                      Unlink
                    </button>
                  </>
                )}
                {inMiniPay && (
                  <button
                    type="button"
                    className="wallet-popover__action wallet-popover__action--ghost"
                    onClick={closeMenu}
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
