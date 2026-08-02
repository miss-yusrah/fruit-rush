import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { WalletState } from '../state/useWallet'

const WalletContext = createContext<WalletState | null>(null)

function noop() {}

/** Guest-safe stub so App can boot before wagmi/viem download. */
function createStubWallet(): WalletState {
  return {
    status: 'disconnected',
    address: null,
    shortAddress: null,
    options: [],
    pendingWallet: null,
    error: null,
    menuOpen: false,
    inMiniPay: false,
    connect: noop,
    disconnect: noop,
    toggleMenu: noop,
    closeMenu: noop,
    requireConnect: () => false,
  }
}

/**
 * Keeps `<App />` mounted while wagmi loads in a sibling tree.
 * Live wallet state is emitted upward into context — no App remount.
 */
export function WalletRoot({ children }: { children: ReactNode }) {
  const stub = useMemo(() => createStubWallet(), [])
  const [live, setLive] = useState<WalletState | null>(null)
  const [bridge, setBridge] = useState<ReactNode>(null)

  useEffect(() => {
    let cancelled = false

    const start = () => {
      void import('./LiveWalletBridge').then(({ LiveWalletBridge }) => {
        if (cancelled) return
        setBridge(<LiveWalletBridge onChange={setLive} />)
      })
    }

    // Prefer idle time after first paint; fall back so MiniPay still connects soon.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 2000 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(id)
      }
    }

    const t = window.setTimeout(start, 100)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [])

  return (
    <WalletContext.Provider value={live ?? stub}>
      {bridge}
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext(): WalletState {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error('useWalletContext must be used within WalletRoot')
  }
  return ctx
}
