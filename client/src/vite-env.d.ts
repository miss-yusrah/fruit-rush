/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAGIC_PUBLISHABLE_KEY?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_CELO_RPC_URL?: string
  readonly VITE_CELO_TESTNET_RPC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
