import type { WalletState } from '../state/useWallet'

interface WalletOptionsProps {
  wallet: WalletState
}

/** Account picker for browsers outside MiniPay. MiniPay never shows this list. */
export function WalletOptions({ wallet }: WalletOptionsProps) {
  const { options, connect, status, pendingWallet, error, inMiniPay } = wallet

  if (inMiniPay) return null

  if (options.length === 0) {
    return (
      <p className="wallet-options__empty">
        Nothing to link here. Open Fruit Rush inside <strong>MiniPay</strong> for the smoothest
        play — or refresh after installing a supported app.
      </p>
    )
  }

  return (
    <div className="wallet-options">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="wallet-option"
          disabled={status === 'connecting'}
          onClick={() => connect(option)}
        >
          {option.icon ? (
            <img className="wallet-option__icon" src={option.icon} alt="" aria-hidden />
          ) : (
            <span className="wallet-option__icon wallet-option__icon--fallback" aria-hidden>
              ◈
            </span>
          )}
          <span className="wallet-option__name">{option.name}</span>
          {status === 'connecting' && pendingWallet === option.name && (
            <span className="wallet-option__spinner" aria-hidden />
          )}
        </button>
      ))}

      {status === 'connecting' && (
        <p className="wallet-options__status">Approve in {pendingWallet}…</p>
      )}
      {error && status !== 'connecting' && (
        <p className="wallet-options__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
