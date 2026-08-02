import { createConfig, http } from 'wagmi'
import { celo, celoAlfajores } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

/**
 * Optional WalletConnect project id (get one free at https://cloud.reown.com).
 * Without it, only injected browser wallets (MetaMask, Rabby, …) are offered.
 */
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as
  | string
  | undefined

export const wagmiConfig = createConfig({
  chains: [celo, celoAlfajores],
  // EIP-6963 discovery (on by default) surfaces every installed browser
  // wallet as its own connector; `injected()` is the generic fallback.
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: 'Fruit Rush',
              description: 'Slash fruit, stack combos, win cUSD on Celo.',
              url: 'https://fruitrush.gg',
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
