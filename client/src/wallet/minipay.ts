/** MiniPay injects window.ethereum with an `isMiniPay` flag. */
export interface MiniPayEthereum {
  isMiniPay?: boolean
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

declare global {
  interface Window {
    ethereum?: MiniPayEthereum
  }
}

/** True when Fruit Rush is opened inside the MiniPay in-app browser. */
export function isMiniPay(): boolean {
  try {
    return Boolean(typeof window !== 'undefined' && window.ethereum?.isMiniPay)
  } catch {
    return false
  }
}

/** True when any injected wallet provider is present (MiniPay, MetaMask, …). */
export function hasInjectedProvider(): boolean {
  try {
    return Boolean(typeof window !== 'undefined' && window.ethereum)
  } catch {
    return false
  }
}
