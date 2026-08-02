import { useCallback, useMemo, useState } from 'react'
import type { Connector } from 'wagmi'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export type WalletStatus = 'disconnected' | 'connecting' | 'connected'

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
  /** Wallets the user can pick from (real connectors, no auto-select). */
  options: WalletOption[]
  /** Name of the connector currently awaiting user approval, if any. */
  pendingWallet: string | null
  error: string | null
  menuOpen: boolean
  connect: (option: WalletOption) => void
  disconnect: () => void
  toggleMenu: () => void
  closeMenu: () => void
  /** Returns true if connected; otherwise opens the wallet picker. */
  requireConnect: () => boolean
}

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Real Celo wallet via wagmi. Session restore is handled by wagmi itself. */
export function useWallet(): WalletState {
  const account = useAccount()
  const { connectors, connectAsync, isPending, variables, error, reset } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const [menuOpen, setMenuOpen] = useState(false)

  const status: WalletStatus =
    account.status === 'connected'
      ? 'connected'
      : account.status === 'connecting' || account.status === 'reconnecting' || isPending
        ? 'connecting'
        : 'disconnected'

  const options = useMemo<WalletOption[]>(() => {
    // Wallets discovered via EIP-6963 announce themselves individually;
    // hide the generic "injected" fallback when any were found.
    const discovered = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected')
    return connectors
      .filter((c) => (c.id === 'injected' ? discovered.length === 0 : true))
      .map((c) => ({
        id: c.id,
        name: c.id === 'injected' ? 'Browser wallet' : c.name,
        icon: c.icon,
        connector: c,
      }))
  }, [connectors])

  const pendingWallet = useMemo(() => {
    if (!isPending) return null
    const target = variables?.connector
    return target && 'name' in target ? target.name : 'wallet'
  }, [isPending, variables])

  const connect = useCallback(
    (option: WalletOption) => {
      if (isPending) return
      connectAsync({ connector: option.connector }).catch(() => {
        // Rejection/failure surfaces through `error`; keep the picker open.
      })
    },
    [connectAsync, isPending],
  )

  const disconnect = useCallback(() => {
    wagmiDisconnect()
    setMenuOpen(false)
  }, [wagmiDisconnect])

  const toggleMenu = useCallback(() => {
    reset()
    setMenuOpen((o) => !o)
  }, [reset])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const requireConnect = useCallback(() => {
    if (account.status === 'connected') return true
    setMenuOpen(true)
    return false
  }, [account.status])

  const address = account.address ?? null

  return {
    status,
    address,
    shortAddress: address ? shorten(address) : null,
    options,
    pendingWallet,
    error: error ? shortWalletError(error) : null,
    menuOpen,
    connect,
    disconnect,
    toggleMenu,
    closeMenu,
    requireConnect,
  }
}

function shortWalletError(error: Error): string {
  const message = error.message ?? ''
  if (/rejected|denied/i.test(message)) return 'Request rejected in wallet'
  if (/provider not found|not detected/i.test(message)) return 'Wallet not found in this browser'
  return message.split('\n')[0].slice(0, 120) || 'Connection failed'
}
