import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Connector } from 'wagmi'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import {
  isMagicConfigured,
  loginWithEmail as magicLoginWithEmail,
  logout as magicLogout,
  restoreSession,
} from '../auth/magicAuth'
import { useWalletContext } from '../wallet/WalletRoot'
import { isMiniPay } from '../wallet/minipay'
import { useMiniPayAutoConnect } from '../wallet/useMiniPayAutoConnect'

export type WalletStatus = 'disconnected' | 'connecting' | 'connected'

/**
 * How the player got their address — one session shape for the whole app.
 * `'magic'` = email OTP embedded wallet; otherwise a wallet id (`minipay`, `metamask`, …).
 */
export type LoginMethod = 'magic' | string | null

export interface WalletOption {
  id: string
  name: string
  icon?: string
  connector: Connector
}

export interface WalletState {
  status: WalletStatus
  /** Full 0x address of the connected account. */
  address: string | null
  /** Shortened address for display, e.g. 0x1a2b…9cF2. */
  shortAddress: string | null
  /**
   * How the address was obtained — game code should only care about `address` + connected.
   * Examples: `'magic'`, `'minipay'`, `'metamask'`, `'walletconnect'`.
   */
  loginMethod: LoginMethod
  /** Human label for the menu, e.g. "Signed in with Email" / "MiniPay". */
  loginLabel: string | null
  /** Email when signed in via Magic (null for wallet / guest). */
  email: string | null
  /** True when Magic publishable key is present. */
  magicAvailable: boolean
  /** Wallets the user can pick from (real connectors, no auto-select). */
  options: WalletOption[]
  /** Name of the connector currently awaiting user approval, if any. */
  pendingWallet: string | null
  error: string | null
  menuOpen: boolean
  /** True when opened inside MiniPay — connect is automatic, no picker. */
  inMiniPay: boolean
  connect: (option: WalletOption) => void
  /** Email OTP via Magic — provisions an embedded Celo wallet. */
  loginWithEmail: (email: string) => Promise<void>
  disconnect: () => void
  toggleMenu: () => void
  closeMenu: () => void
  /** Returns true if connected; otherwise opens the wallet picker. */
  requireConnect: () => boolean
}

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** App-facing hook — reads deferred-or-live state from WalletRoot. */
export function useWallet(): WalletState {
  return useWalletContext()
}

/** Real account via wagmi + optional Magic email session. Only used inside LiveWalletBridge. */
export function useWalletImpl(): WalletState {
  useMiniPayAutoConnect()

  const account = useAccount()
  const { connectors, connectAsync, isPending, variables, error, reset } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const [menuOpen, setMenuOpen] = useState(false)
  const [magicAddress, setMagicAddress] = useState<string | null>(null)
  const [magicEmail, setMagicEmail] = useState<string | null>(null)
  const [magicBusy, setMagicBusy] = useState(false)
  const [magicError, setMagicError] = useState<string | null>(null)
  const inMiniPay = isMiniPay()
  const magicAvailable = isMagicConfigured()

  useEffect(() => {
    if (!magicAvailable) return
    let cancelled = false
    void restoreSession().then((session) => {
      if (cancelled || !session) return
      setMagicAddress(session.address)
      setMagicEmail(session.email ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [magicAvailable])

  const magicConnected = Boolean(magicAddress)
  const wagmiConnected = account.status === 'connected'

  const status: WalletStatus =
    wagmiConnected || magicConnected
      ? 'connected'
      : account.status === 'connecting' ||
          account.status === 'reconnecting' ||
          isPending ||
          magicBusy
        ? 'connecting'
        : 'disconnected'

  const loginMethod: LoginMethod = wagmiConnected
    ? resolveWalletLoginMethod(account.connector?.name, inMiniPay)
    : magicConnected
      ? 'magic'
      : null

  const loginLabel = loginMethod ? labelForLoginMethod(loginMethod) : null
  const address = (wagmiConnected ? account.address : magicAddress) ?? null

  const options = useMemo<WalletOption[]>(() => {
    // Inside MiniPay the account attaches automatically — no picker list.
    if (inMiniPay) return []

    // Wallets discovered via EIP-6963 announce themselves individually;
    // hide the generic "injected" fallback when any were found.
    const discovered = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected')
    return connectors
      .filter((c) => (c.id === 'injected' ? discovered.length === 0 : true))
      .map((c) => ({
        id: c.id,
        name: c.id === 'injected' ? 'Browser account' : friendlyWalletName(c.name),
        icon: c.icon,
        connector: c,
      }))
  }, [connectors, inMiniPay])

  const pendingWallet = useMemo(() => {
    if (magicBusy) return 'Email'
    if (!isPending) return null
    const target = variables?.connector
    return target && 'name' in target ? target.name : 'wallet'
  }, [isPending, magicBusy, variables])

  const clearMagicLocal = useCallback(() => {
    setMagicAddress(null)
    setMagicEmail(null)
    setMagicError(null)
  }, [])

  const connect = useCallback(
    (option: WalletOption) => {
      if (isPending || magicBusy) return
      setMagicError(null)
      // One active session — drop Magic if linking an external wallet.
      if (magicAddress) {
        void magicLogout().finally(() => {
          clearMagicLocal()
        })
      }
      connectAsync({ connector: option.connector }).catch(() => {
        // Rejection/failure surfaces through `error`; keep the picker open.
      })
    },
    [clearMagicLocal, connectAsync, isPending, magicAddress, magicBusy],
  )

  const loginWithEmail = useCallback(
    async (email: string) => {
      if (magicBusy || isPending) return
      setMagicBusy(true)
      setMagicError(null)
      try {
        if (wagmiConnected) wagmiDisconnect()
        const session = await magicLoginWithEmail(email)
        setMagicAddress(session.address)
        setMagicEmail(session.email ?? email.trim())
        setMenuOpen(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Email sign-in failed'
        if (!/cancel|closed/i.test(message)) {
          setMagicError(shortMagicError(message))
        }
        throw err
      } finally {
        setMagicBusy(false)
      }
    },
    [isPending, magicBusy, wagmiConnected, wagmiDisconnect],
  )

  const disconnect = useCallback(() => {
    // Unified logout — Magic or external wallet; UI only calls this once.
    if (wagmiConnected) wagmiDisconnect()
    if (magicAddress) {
      void magicLogout()
      clearMagicLocal()
    }
    setMenuOpen(false)
  }, [clearMagicLocal, magicAddress, wagmiConnected, wagmiDisconnect])

  const toggleMenu = useCallback(() => {
    reset()
    setMagicError(null)
    setMenuOpen((o) => !o)
  }, [reset])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const requireConnect = useCallback(() => {
    if (wagmiConnected || magicConnected) return true
    setMenuOpen(true)
    return false
  }, [magicConnected, wagmiConnected])

  const combinedError = magicError ?? (error ? shortWalletError(error) : null)

  return {
    status,
    address,
    shortAddress: address ? shorten(address) : null,
    loginMethod,
    loginLabel,
    email: magicConnected ? magicEmail : null,
    magicAvailable,
    options,
    pendingWallet,
    error: combinedError,
    menuOpen,
    inMiniPay,
    connect,
    loginWithEmail,
    disconnect,
    toggleMenu,
    closeMenu,
    requireConnect,
  }
}

function resolveWalletLoginMethod(connectorName: string | undefined, inMiniPay: boolean): string {
  if (inMiniPay) return 'minipay'
  if (!connectorName) return 'wallet'
  if (/minipay/i.test(connectorName)) return 'minipay'
  if (/metamask/i.test(connectorName)) return 'metamask'
  if (/walletconnect|reown/i.test(connectorName)) return 'walletconnect'
  if (/valora/i.test(connectorName)) return 'valora'
  return connectorName.toLowerCase().replace(/\s+/g, '')
}

/** Menu / chip copy — address is separate; this is the method line only. */
export function labelForLoginMethod(method: string): string {
  if (method === 'magic') return 'Signed in with Email'
  if (method === 'minipay') return 'MiniPay'
  if (method === 'metamask') return 'MetaMask'
  if (method === 'walletconnect') return 'WalletConnect'
  if (method === 'valora') return 'Valora'
  if (method === 'wallet') return 'Wallet'
  return method
}

function friendlyWalletName(name: string): string {
  if (/minipay/i.test(name)) return 'MiniPay'
  if (/metamask/i.test(name)) return 'MetaMask'
  if (/valora/i.test(name)) return 'Valora'
  return name
}

function shortWalletError(error: Error): string {
  const message = error.message ?? ''
  if (/rejected|denied/i.test(message)) return 'Request cancelled'
  if (/provider not found|not detected/i.test(message)) {
    return 'Open Fruit Rush inside MiniPay, or install a phone wallet'
  }
  return message.split('\n')[0].slice(0, 120) || 'Couldn’t connect — try again'
}

function shortMagicError(message: string): string {
  if (/Missing VITE_MAGIC/i.test(message)) return 'Email sign-in isn’t configured yet'
  if (/valid email/i.test(message)) return 'Enter a valid email address'
  return message.split('\n')[0].slice(0, 120) || 'Email sign-in failed — try again'
}
