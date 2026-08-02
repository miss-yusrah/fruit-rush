import { createConfig, http } from 'wagmi'
import { celo, celoAlfajores } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

/**
 * Optional WalletConnect project id (get one free at https://cloud.reown.com).
 * MiniPay does not need this — it injects window.ethereum and auto-connects.
 */
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as
  | string
  | undefined

export const wagmiConfig = createConfig({
  // Celo mainnet first — MiniPay users live here. Alfajores kept for local testing.
  chains: [celo, celoAlfajores],
  connectors: [
    // MiniPay + browser extensions surface through injected / EIP-6963.
    injected(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: 'Fruit Rush',
              description: 'Slash fruit, stack combos, win rewards.',
              url: typeof window !== 'undefined' ? window.location.origin : 'https://fruitrush.gg',
              icons: ['https://fruitrush.gg/favicon.svg'],
            },
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    [celo.id]: http(),
    [celoAlfajores.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
