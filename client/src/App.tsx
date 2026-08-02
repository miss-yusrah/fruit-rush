import { useCallback, useEffect, useState } from 'react'
import { PhoneStage } from './components/PhoneStage'
import { WalletMenu } from './components/WalletMenu'
import type { GameEndPayload } from './game/types'
import { BoastScreen } from './screens/BoastScreen'
import { ConnectScreen } from './screens/ConnectScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ModesScreen } from './screens/ModesScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { PlayScreen } from './screens/PlayScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { ShopScreen } from './screens/ShopScreen'
import { SplashScreen } from './screens/SplashScreen'
import { TournamentScreen } from './screens/TournamentScreen'
import { useWallet } from './state/useWallet'
import type { GameMode, GameSessionResult, ScreenId } from './types/game'

const ONBOARDED_KEY = 'fruit-rush-onboarded'
const PB_KEY = 'fruit-rush-personal-best'
const GUEST_KEY = 'fruit-rush-guest'

function loadOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}

/** Guest choice lasts one browser session — a fresh visit asks again. */
function loadGuest(): boolean {
  try {
    return sessionStorage.getItem(GUEST_KEY) === '1'
  } catch {
    return false
  }
}

function loadPersonalBest(): number {
  try {
    return Number(localStorage.getItem(PB_KEY)) || 0
  } catch {
    return 0
  }
}

const SCREEN_PATHS: Record<ScreenId, string> = {
  splash: '/',
  onboarding: '/onboarding',
  connect: '/connect',
  home: '/home',
  modes: '/modes',
  play: '/play',
  results: '/results',
  shop: '/shop',
  boast: '/boast',
  tournaments: '/tournaments',
  profile: '/profile',
}

function screenFromPath(pathname: string): ScreenId | null {
  const match = (Object.keys(SCREEN_PATHS) as ScreenId[]).find(
    (id) => SCREEN_PATHS[id] === pathname,
  )
  return match ?? null
}

function initialScreen(): ScreenId {
  const fromPath = screenFromPath(window.location.pathname)
  if (!fromPath) return 'splash'
  // These need an in-memory game result, which a fresh load never has.
  if (fromPath === 'results' || fromPath === 'boast') return 'home'
  return fromPath
}

export default function App() {
  const wallet = useWallet()
  const [screen, setScreen] = useState<ScreenId>(initialScreen)
  const [guest, setGuest] = useState(loadGuest)
  // Where the connect screen should land after connect / continue-as-guest.
  const [connectNext, setConnectNext] = useState<ScreenId>('home')
  const [mode, setMode] = useState<GameMode>('Classic')
  const [lastResult, setLastResult] = useState<GameSessionResult | null>(null)
  const [personalBest, setPersonalBest] = useState(loadPersonalBest)
  const [mintedId, setMintedId] = useState<number | null>(null)
  const [minting, setMinting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const { closeMenu } = wallet

  /** Navigate to a screen and keep the browser URL in sync. */
  const navigate = useCallback(
    (next: ScreenId, opts: { replace?: boolean } = {}) => {
      closeMenu()
      const path = SCREEN_PATHS[next]
      if (window.location.pathname !== path) {
        if (opts.replace) window.history.replaceState(null, '', path)
        else window.history.pushState(null, '', path)
      }
      setScreen(next)
    },
    [closeMenu],
  )

  const go = navigate

  // Normalize the URL once on boot (e.g. unknown path, or /results without a run).
  useEffect(() => {
    window.history.replaceState(null, '', SCREEN_PATHS[screen])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Browser/hardware back and forward buttons.
  useEffect(() => {
    const onPopState = () => {
      closeMenu()
      const next = screenFromPath(window.location.pathname) ?? 'home'
      if ((next === 'results' || next === 'boast') && !lastResult) {
        window.history.replaceState(null, '', SCREEN_PATHS.home)
        setScreen('home')
        return
      }
      setScreen(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [closeMenu, lastResult])

  const handleSplashDone = useCallback(() => {
    if (!loadOnboarded()) {
      navigate('onboarding', { replace: true })
    } else if (wallet.status === 'connected' || guest) {
      navigate('home', { replace: true })
    } else {
      setConnectNext('home')
      navigate('connect', { replace: true })
    }
  }, [navigate, wallet.status, guest])

  const handleOnboardingDone = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {
      /* ignore */
    }
    if (wallet.status === 'connected' || guest) {
      navigate('home', { replace: true })
    } else {
      setConnectNext('home')
      navigate('connect', { replace: true })
    }
  }, [navigate, wallet.status, guest])

  const handleGameEnd = useCallback(
    (payload: GameEndPayload) => {
      const isPersonalBest = payload.score > personalBest && payload.score > 0
      if (isPersonalBest) {
        setPersonalBest(payload.score)
        try {
          localStorage.setItem(PB_KEY, String(payload.score))
        } catch {
          /* ignore */
        }
      }

      setLastResult({
        playerId: wallet.address ?? 'guest',
        score: payload.score,
        mode: payload.mode,
        comboHighwater: payload.comboHighwater,
        durationSeconds: payload.durationSeconds,
        timestamp: Date.now(),
        isPersonalBest,
      })
      setMintedId(null)
      // Replace /play in history so Back from results returns to modes, not a new game.
      navigate('results', { replace: true })
    },
    [navigate, personalBest, wallet.address],
  )

  const showWallet =
    screen === 'home' ||
    screen === 'shop' ||
    screen === 'tournaments' ||
    screen === 'profile' ||
    screen === 'boast' ||
    (wallet.menuOpen && screen !== 'connect')

  return (
    <PhoneStage>
      {screen === 'splash' && <SplashScreen onDone={handleSplashDone} />}

      {screen === 'onboarding' && <OnboardingScreen onDone={handleOnboardingDone} />}

      {screen === 'connect' && (
        <ConnectScreen
          wallet={wallet}
          onDone={() => navigate(connectNext, { replace: true })}
          onGuest={() => {
            setGuest(true)
            try {
              sessionStorage.setItem(GUEST_KEY, '1')
            } catch {
              /* ignore */
            }
            navigate(connectNext, { replace: true })
          }}
        />
      )}

      {screen === 'home' && (
        <HomeScreen
          onPlay={() => {
            // Play gates through connect-or-guest until a choice is made.
            if (wallet.status === 'connected' || guest) {
              go('modes')
            } else {
              setConnectNext('modes')
              go('connect')
            }
          }}
          onShop={() => go('shop')}
          onCompete={() => go('tournaments')}
        />
      )}

      {screen === 'modes' && (
        <ModesScreen
          guest={guest && wallet.status !== 'connected'}
          onBack={() => go('home')}
          onSelect={(selected) => {
            // Set mode first, then enter play in the same tick (batched).
            setMode(selected)
            go('play')
          }}
        />
      )}

      {screen === 'play' && (
        <PlayScreen
          key={mode}
          mode={mode}
          onExit={() => go('modes')}
          onEnded={handleGameEnd}
        />
      )}

      {screen === 'results' && lastResult && (
        <ResultsScreen
          result={lastResult}
          personalBest={personalBest}
          onPlayAgain={() => go('play')}
          onBoast={() => go('boast')}
          onHome={() => go('home')}
        />
      )}

      {screen === 'shop' && (
        <ShopScreen
          onBuy={(name) => {
            if (!wallet.requireConnect()) {
              showToast('Connect wallet to buy')
              return
            }
            showToast(`Checkout stub · ${name}`)
          }}
          onNavigate={go}
        />
      )}

      {screen === 'tournaments' && (
        <TournamentScreen
          onEnter={(id) => {
            if (!wallet.requireConnect()) {
              showToast('Connect wallet to enter')
              return
            }
            showToast(`Entered ${id} · cUSD stub`)
            setMode('Tournament')
            go('play')
          }}
          onNavigate={go}
        />
      )}

      {screen === 'boast' && lastResult && (
        <BoastScreen
          mintedId={mintedId}
          minting={minting}
          onMint={() => {
            if (!wallet.requireConnect()) {
              showToast('Connect wallet to mint')
              return
            }
            setMinting(true)
            window.setTimeout(() => {
              setMintedId(Math.floor(1000 + Math.random() * 9000))
              setMinting(false)
              showToast('Boast minted on Celo (demo)')
            }, 900)
          }}
          onShare={async () => {
            const url = `https://fruitrush.gg/boast/${mintedId ?? 'demo'}`
            try {
              if (navigator.share) {
                await navigator.share({
                  title: 'Fruit Rush Boast',
                  text: `I scored ${lastResult.score.toLocaleString()} in Fruit Rush`,
                  url,
                })
              } else {
                await navigator.clipboard.writeText(url)
                showToast('Boast link copied')
              }
            } catch {
              showToast('Share cancelled')
            }
          }}
          onDismiss={() => go('home')}
        />
      )}

      {screen === 'profile' && <ProfileScreen onPlay={() => go('modes')} onNavigate={go} />}

      {showWallet && (
        <div className="wallet-global">
          <WalletMenu wallet={wallet} />
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </PhoneStage>
  )
}
