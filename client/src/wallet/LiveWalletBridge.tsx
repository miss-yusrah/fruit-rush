import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { WagmiProvider } from 'wagmi'
import { useWalletImpl, type WalletState } from '../state/useWallet'
import { wagmiConfig } from './config'

const queryClient = new QueryClient()

function Emitter({ onChange }: { onChange: (state: WalletState) => void }) {
  const state = useWalletImpl()
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    onChangeRef.current(state)
  }, [state])
  return null
}

/** Mounts wagmi off to the side and streams wallet state to WalletRoot. */
export function LiveWalletBridge({ onChange }: { onChange: (state: WalletState) => void }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Emitter onChange={onChange} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
