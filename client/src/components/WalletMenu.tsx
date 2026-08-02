import type { WalletState } from '../state/useWallet'
import { WalletOptions } from './WalletOptions'

interface WalletMenuProps {
  wallet: WalletState
  className?: string
}

/**
 * Top-right round XL wallet control — corner popover with a real wallet picker.
 */
export function WalletMenu({ wallet, className = '' }: WalletMenuProps) {
  const { status, address, shortAddress, menuOpen, disconnect, toggleMenu, closeMenu } = wallet
  const short = status === 'connected' && address ? address.slice(-4) : null

  return (
    <div className={`wallet-anchor ${className}`.trim()}>
      <button
        type="button"
        className={`wallet-chip-btn${status === 'connected' ? ' is-connected' : ''}${status === 'connecting' ? ' is-busy' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-label={
          status === 'connected' && shortAddress
            ? `Wallet ${shortAddress}`
            : status === 'connecting'
              ? 'Connecting wallet'
              : 'Connect wallet'
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
            aria-label="Close wallet menu"
            onClick={closeMenu}
          />
          <div className="wallet-popover" role="dialog" aria-label="Wallet">
            {status !== 'connected' && (
              <>
                <p className="wallet-popover__title">Connect wallet</p>
                <p className="wallet-popover__hint">
                  Pick a Celo wallet to shop, compete, and mint.
                </p>
                <WalletOptions wallet={wallet} />
              </>
            )}

            {status === 'connected' && address && (
              <>
                <p className="wallet-popover__title">Connected</p>
                <p className="wallet-popover__addr">{shortAddress}</p>
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
                  Copy address
                </button>
                <button
                  type="button"
                  className="wallet-popover__action wallet-popover__action--danger"
                  onClick={disconnect}
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
