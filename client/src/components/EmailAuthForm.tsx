import { useState, type FormEvent } from 'react'
import type { WalletState } from '../state/useWallet'

interface EmailAuthFormProps {
  wallet: WalletState
  /** Compact layout for the account popover. */
  compact?: boolean
}

/** Email OTP via Magic — same session shape as a linked wallet. */
export function EmailAuthForm({ wallet, compact = false }: EmailAuthFormProps) {
  const { loginWithEmail, status, magicAvailable } = wallet
  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const busy = status === 'connecting'
  const emailBusy = busy && wallet.pendingWallet === 'Email'

  if (!magicAvailable) return null

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLocalError(null)
    try {
      await loginWithEmail(email)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email sign-in failed'
      if (!/cancel|closed/i.test(message)) {
        setLocalError(message.split('\n')[0].slice(0, 120))
      }
    }
  }

  return (
    <form className={`email-auth${compact ? ' email-auth--compact' : ''}`} onSubmit={onSubmit}>
      <label className="email-auth__label" htmlFor={compact ? 'magic-email-menu' : 'magic-email'}>
        Email
      </label>
      <div className="email-auth__row">
        <input
          id={compact ? 'magic-email-menu' : 'magic-email'}
          className="email-auth__input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <button
        type="submit"
        className="btn-primary email-auth__continue"
        disabled={busy || !email.trim()}
      >
        {emailBusy ? 'Check your email…' : 'Continue with email'}
      </button>
      {localError && (
        <p className="wallet-options__error" role="alert">
          {localError}
        </p>
      )}
      {!compact && emailBusy && (
        <p className="wallet-options__status" aria-live="polite">
          Magic is sending a one-time code…
        </p>
      )}
    </form>
  )
}
