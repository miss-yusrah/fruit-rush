import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoginWithEmailOTP,
  mockLoginWithPopup,
  mockGetInfo,
  mockIsLoggedIn,
  mockLogout,
  mockGetIdToken,
  mockWriteContract,
  mockWaitForReceipt,
  mockSignMessage,
} = vi.hoisted(() => ({
  mockLoginWithEmailOTP: vi.fn(),
  mockLoginWithPopup: vi.fn(),
  mockGetInfo: vi.fn(),
  mockIsLoggedIn: vi.fn(),
  mockLogout: vi.fn(),
  mockGetIdToken: vi.fn(),
  mockWriteContract: vi.fn(),
  mockWaitForReceipt: vi.fn(),
  mockSignMessage: vi.fn(),
}))

vi.mock('magic-sdk', () => {
  class Magic {
    auth = { loginWithEmailOTP: mockLoginWithEmailOTP }
    oauth2 = { loginWithPopup: mockLoginWithPopup }
    user = {
      getInfo: mockGetInfo,
      isLoggedIn: mockIsLoggedIn,
      logout: mockLogout,
      getIdToken: mockGetIdToken,
    }
    rpcProvider = { request: vi.fn() }
    constructor(_key: string, _opts?: unknown) {}
  }
  return { Magic }
})

vi.mock('@magic-ext/oauth2', () => ({
  OAuthExtension: class OAuthExtension {},
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createWalletClient: () => ({
      signMessage: mockSignMessage,
      writeContract: mockWriteContract,
    }),
    createPublicClient: () => ({
      waitForTransactionReceipt: mockWaitForReceipt,
    }),
  }
})

import {
  __resetMagicForTests,
  getWalletAddress,
  isMagicConfigured,
  loginWithEmail,
  loginWithSocial,
  logout,
  restoreSession,
  sendCUSD,
  signMessage,
} from '../magicAuth'

describe('magicAuth', () => {
  beforeEach(() => {
    __resetMagicForTests()
    vi.clearAllMocks()
    vi.stubEnv('VITE_MAGIC_PUBLISHABLE_KEY', 'pk_test_fruit_rush')
    vi.stubEnv('PROD', false)
  })

  it('reports configured when publishable key is set', () => {
    expect(isMagicConfigured()).toBe(true)
    vi.stubEnv('VITE_MAGIC_PUBLISHABLE_KEY', '')
    __resetMagicForTests()
    expect(isMagicConfigured()).toBe(false)
  })

  it('loginWithEmail returns address, DID token, and provider', async () => {
    mockLoginWithEmailOTP.mockResolvedValue('did:token:abc')
    mockGetInfo.mockResolvedValue({
      email: 'player@fruitrush.gg',
      wallets: { ethereum: { publicAddress: '0x1111111111111111111111111111111111111111' } },
    })

    const session = await loginWithEmail('player@fruitrush.gg')

    expect(mockLoginWithEmailOTP).toHaveBeenCalledWith({
      email: 'player@fruitrush.gg',
      showUI: true,
    })
    expect(session.address).toBe('0x1111111111111111111111111111111111111111')
    expect(session.token).toBe('did:token:abc')
    expect(session.email).toBe('player@fruitrush.gg')
    expect(session.provider).toBeTruthy()
  })

  it('loginWithEmail rejects invalid email before calling Magic', async () => {
    await expect(loginWithEmail('not-an-email')).rejects.toThrow(/valid email/i)
    expect(mockLoginWithEmailOTP).not.toHaveBeenCalled()
  })

  it('loginWithSocial maps oauth popup result into a session', async () => {
    mockLoginWithPopup.mockResolvedValue({
      magic: {
        idToken: 'did:oauth',
        userMetadata: {
          email: 'g@x.com',
          wallets: { ethereum: { publicAddress: '0x2222222222222222222222222222222222222222' } },
        },
      },
      oauth: { userInfo: { email: 'g@x.com' } },
    })

    const session = await loginWithSocial('google')
    expect(session.token).toBe('did:oauth')
    expect(session.address).toBe('0x2222222222222222222222222222222222222222')
  })

  it('getWalletAddress reads ethereum wallet from Magic metadata', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetInfo.mockResolvedValue({
      wallets: { ethereum: { publicAddress: '0x3333333333333333333333333333333333333333' } },
    })
    await expect(getWalletAddress()).resolves.toBe('0x3333333333333333333333333333333333333333')
  })

  it('signMessage delegates to the Magic wallet client', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetInfo.mockResolvedValue({
      wallets: { ethereum: { publicAddress: '0x3333333333333333333333333333333333333333' } },
    })
    mockSignMessage.mockResolvedValue('0xsig')

    await expect(signMessage('boast:1')).resolves.toBe('0xsig')
    expect(mockSignMessage).toHaveBeenCalledWith({ message: 'boast:1' })
  })

  it('sendCUSD writes an ERC-20 transfer and waits for receipt', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetInfo.mockResolvedValue({
      wallets: { ethereum: { publicAddress: '0x3333333333333333333333333333333333333333' } },
    })
    mockWriteContract.mockResolvedValue('0xhash')
    mockWaitForReceipt.mockResolvedValue({ status: 'success', transactionHash: '0xhash' })

    const receipt = await sendCUSD('0x4444444444444444444444444444444444444444', '1.50')
    expect(mockWriteContract).toHaveBeenCalled()
    expect(receipt.transactionHash).toBe('0xhash')
  })

  it('logout calls Magic logout when signed in', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockLogout.mockResolvedValue(true)
    await logout()
    expect(mockLogout).toHaveBeenCalled()
  })

  it('restoreSession returns null when logged out', async () => {
    mockIsLoggedIn.mockResolvedValue(false)
    await expect(restoreSession()).resolves.toBeNull()
  })

  it('restoreSession hydrates a live session', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetIdToken.mockResolvedValue('did:restored')
    mockGetInfo.mockResolvedValue({
      email: 'back@fruitrush.gg',
      wallets: { ethereum: { publicAddress: '0x5555555555555555555555555555555555555555' } },
    })

    const session = await restoreSession()
    expect(session?.token).toBe('did:restored')
    expect(session?.address).toBe('0x5555555555555555555555555555555555555555')
  })
})
