import { useEffect, useRef } from 'react'
import { celo } from 'wagmi/chains'
import { useAccount, useConnect, useConnectors } from 'wagmi'
import { isMiniPay } from './minipay'

/**
 * MiniPay Mini Apps must connect on load — never show a “Connect wallet” CTA
 * inside MiniPay (see https://docs.minipay.xyz/getting-started/wallet-connection.html).
 */
export function useMiniPayAutoConnect() {
  const { status } = useAccount()
  const { connect, isPending } = useConnect()
  const connectors = useConnectors()
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    if (!isMiniPay()) return
    if (status === 'connected' || status === 'connecting' || status === 'reconnecting') return
    if (isPending) return

    const injected =
      connectors.find((c) => c.id === 'injected') ??
      connectors.find((c) => c.type === 'injected') ??
      connectors[0]

    if (!injected) return

    attempted.current = true
    connect({ connector: injected, chainId: celo.id })
  }, [connect, connectors, isPending, status])
}
