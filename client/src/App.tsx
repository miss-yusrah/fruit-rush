import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { audio } from './audio'
import { PhoneStage } from './components/PhoneStage'
import { WalletMenu } from './components/WalletMenu'
import type { GameEndPayload } from './game/types'
import { LoadingScreen } from './screens/LoadingScreen'
import { useWallet } from './state/useWallet'
import type { GameMode, GameSessionResult, ScreenId } from './types/game'

/** Lazy screens — keep Pixi, shop, results, etc. out of the boot JS graph. */
const ConnectScreen = lazy(() =>
  import('./screens/ConnectScreen').then((m) => ({ default: m.ConnectScreen })),
)
const HomeScreen = lazy(() =>
  import('./screens/HomeScreen').then((m) => ({ default: m.HomeScreen })),
)
const ModesScreen = lazy(() =>
  import('./screens/ModesScreen').then((m) => ({ default: m.ModesScreen })),
)
const OnboardingScreen = lazy(() =>
  import('./screens/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })),
)
const PlayScreen = lazy(() =>
  import('./screens/PlayScreen').then((m) => ({ default: m.PlayScreen })),
)
const ProfileScreen = lazy(() =>
  import('./screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen })),
)
const ResultsScreen = lazy(() =>
  import('./screens/ResultsScreen').then((m) => ({ default: m.ResultsScreen })),
)
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)
const ShopScreen = lazy(() =>
  import('./screens/ShopScreen').then((m) => ({ default: m.ShopScreen })),
)
const BoastScreen = lazy(() =>
  import('./screens/BoastScreen').then((m) => ({ default: m.BoastScreen })),
)
const TournamentScreen = lazy(() =>
  import('./screens/TournamentScreen').then((m) => ({ default: m.TournamentScreen })),
)

function ScreenFallback() {
  return <div className="screen-fallback" aria-hidden />
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ScreenFallback />}>{children}</Suspense>
}

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
  settings: '/settings',
}

function screenFromPath(pathname: string): ScreenId | null {
  const match = (Object.keys(SCREEN_PATHS) as ScreenId[]).find(
    (id) => SCREEN_PATHS[id] === pathname,
  )
  return match ?? null
}

function initialScreen(): ScreenId {
  const fromPath = screenFromPath(window.location.pathname)
  // Always boot through the asset loader first (maps to splash path).
  if (!fromPath || fromPath === 'splash') return 'splash'
  // Settings is a modal now — land on home if someone opens /settings cold.
  if (fromPath === 'settings') return 'splash'
  // These need an in-memory game result, which a fresh load never has.
  if (fromPath === 'results' || fromPath === 'boast') return 'splash'
  // Deep links still show the loader, then jump to the requested screen.
  return 'splash'
}

/** Path the user asked for before the loader ran (deep link restore). */
function pendingDeepLink(): ScreenId | null {
  const fromPath = screenFromPath(window.location.pathname)
  if (!fromPath || fromPath === 'splash') return null
  if (fromPath === 'settings') return 'home'
  if (fromPath === 'results' || fromPath === 'boast') return null
  return fromPath
}

function initialSettingsOpen(): boolean {
  return window.location.pathname === SCREEN_PATHS.settings
}

export default function App() {
  const wallet = useWallet()
  const [screen, setScreen] = useState<ScreenId>(initialScreen)
  const [guest, setGuest] = useState(loadGuest)
  // Where the connect screen should land after connect / continue-as-guest.
  const [connectNext, setConnectNext] = useState<ScreenId>('home')
  const [mode, setMode] = useState<GameMode>('Classic')
  /** Bumps on every Play entry so the round always mounts with the mode just picked. */
  const [playEpoch, setPlayEpoch] = useState(0)
  const [lastResult, setLastResult] = useState<GameSessionResult | null>(null)
  const [personalBest, setPersonalBest] = useState(loadPersonalBest)
  const [mintedId, setMintedId] = useState<number | null>(null)
  const [minting, setMinting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen)
  const [deepLink] = useState(pendingDeepLink)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const { closeMenu } = wallet

  const openSettings = useCallback(() => {
    closeMenu()
    setSettingsOpen(true)
  }, [closeMenu])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
  }, [])

  /** Navigate to a screen and keep the browser URL in sync. */
  const navigate = useCallback(
    (next: ScreenId, opts: { replace?: boolean } = {}) => {
      closeMenu()
      setSettingsOpen(false)
      // Settings is a popup, not a route destination.
      if (next === 'settings') {
        setSettingsOpen(true)
        return
      }
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

  // Browsers require a user gesture before audio can start — unlock on first tap,
  // then start the catchy menu theme if Game Music is on.
  useEffect(() => {
    const unlock = () => {
      void audio.unlock().then(() => {
        if (audio.isMusicEnabled) audio.enterMenu()
      })
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Route the two dance grooves by section; leave play audio alone.
  useEffect(() => {
    if (!audio.isUnlocked || !audio.isMusicEnabled) return
    if (screen === 'play') return
    // Results / boast keep the party going with the main menu groove.
    if (
      screen === 'results' ||
      screen === 'boast' ||
      screen === 'home' ||
      screen === 'modes' ||
      screen === 'connect' ||
      screen === 'profile' ||
      screen === 'onboarding' ||
      screen === 'splash'
    ) {
      if (audio.currentTheme !== 'menu') audio.enterMenu()
      return
    }
    // Shop & tournaments get the hotter alternate dance groove.
    if (screen === 'shop' || screen === 'tournaments') {
      if (audio.currentTheme !== 'hype') audio.enterHype(600)
    }
  }, [screen])

  // Esc closes the settings popup.
  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen, closeSettings])

  // Browser/hardware back and forward buttons.
  useEffect(() => {
    const onPopState = () => {
      closeMenu()
      setSettingsOpen(false)
      const next = screenFromPath(window.location.pathname) ?? 'home'
      if (next === 'settings') {
        setScreen('home')
        setSettingsOpen(true)
        window.history.replaceState(null, '', SCREEN_PATHS.home)
        return
      }
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
    if (deepLink) {
      navigate(deepLink, { replace: true })
      return
    }
    if (!loadOnboarded()) {
      navigate('onboarding', { replace: true })
    } else if (wallet.status === 'connected' || guest) {
      navigate('home', { replace: true })
    } else {
      setConnectNext('home')
      navigate('connect', { replace: true })
    }
  }, [navigate, wallet.status, guest, deepLink])

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
        fruitsSliced: payload.fruitsSliced,
        fruitsMissed: payload.fruitsMissed,
        bombsHit: payload.bombsHit,
        criticalSlices: payload.criticalSlices,
        accuracy: payload.accuracy,
      })
      setMintedId(null)
      // Replace /play in history so Back from results returns to modes, not a new game.
      navigate('results', { replace: true })
    },
    [navigate, personalBest, wallet.address],
  )

  const showWallet =
    !settingsOpen &&
    (screen === 'home' ||
      screen === 'shop' ||
      screen === 'tournaments' ||
      screen === 'profile' ||
      screen === 'boast' ||
      (wallet.menuOpen && screen !== 'connect'))

  const showSettingsChip =
    !settingsOpen &&
    (screen === 'home' || screen === 'profile' || screen === 'shop' || screen === 'tournaments')

  return (
    <PhoneStage>
      {screen === 'splash' && <LoadingScreen onDone={handleSplashDone} />}

      {screen === 'onboarding' && (
        <Lazy>
          <OnboardingScreen onDone={handleOnboardingDone} />
        </Lazy>
      )}

      {screen === 'connect' && (
        <Lazy>
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
        </Lazy>
      )}

      {screen === 'home' && (
        <Lazy>
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
        </Lazy>
      )}

      {screen === 'modes' && (
        <Lazy>
          <ModesScreen
            guest={guest && wallet.status !== 'connected'}
            onBack={() => go('home')}
            onSelect={(selected) => {
              // Lock mode + remount key in the same tick as navigation so the
              // round never boots with a stale mode config.
              setMode(selected)
              setPlayEpoch((n) => n + 1)
              go('play')
            }}
          />
        </Lazy>
      )}

      {screen === 'play' && (
        <Lazy>
          <PlayScreen
            key={`${mode}-${playEpoch}`}
            mode={mode}
            onExit={() => go('modes')}
            onEnded={handleGameEnd}
          />
        </Lazy>
      )}

      {screen === 'results' && lastResult && (
        <Lazy>
          <ResultsScreen
            result={lastResult}
            personalBest={personalBest}
            onPlayAgain={() => {
              setPlayEpoch((n) => n + 1)
              go('play')
            }}
            onBoast={() => go('boast')}
            onHome={() => go('home')}
            onShop={() => go('shop')}
            onToast={showToast}
          />
        </Lazy>
      )}

      {screen === 'shop' && (
        <Lazy>
          <ShopScreen
            onBuy={(name) => {
              if (!wallet.requireConnect()) {
                showToast(wallet.inMiniPay ? 'Opening MiniPay…' : 'Link MiniPay to buy')
                return
              }
              showToast(`Checkout stub · ${name}`)
            }}
            onNavigate={go}
          />
        </Lazy>
      )}

      {screen === 'tournaments' && (
        <Lazy>
          <TournamentScreen
            onEnter={(id) => {
              if (!wallet.requireConnect()) {
                showToast(wallet.inMiniPay ? 'Opening MiniPay…' : 'Link MiniPay to enter')
                return
              }
              showToast(`Entered ${id}`)
              setMode('Tournament')
              setPlayEpoch((n) => n + 1)
              void audio.unlock().then(() => audio.enterGameplay())
              go('play')
            }}
            onNavigate={go}
          />
        </Lazy>
      )}

      {screen === 'boast' && lastResult && (
        <Lazy>
          <BoastScreen
            mintedId={mintedId}
            minting={minting}
            onMint={() => {
              if (!wallet.requireConnect()) {
                showToast(wallet.inMiniPay ? 'Opening MiniPay…' : 'Link MiniPay to save your boast')
                return
              }
              setMinting(true)
              window.setTimeout(() => {
                setMintedId(Math.floor(1000 + Math.random() * 9000))
                setMinting(false)
                showToast('Boast saved (demo)')
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
        </Lazy>
      )}

      {screen === 'profile' && (
        <Lazy>
          <ProfileScreen onPlay={() => go('modes')} onNavigate={go} />
        </Lazy>
      )}

      {settingsOpen && (
        <Lazy>
          <SettingsScreen onClose={closeSettings} />
        </Lazy>
      )}

      {showSettingsChip && (
        <button
          type="button"
          className="settings-chip"
          aria-label="Settings"
          onClick={() => {
            void audio.unlock().then(() => audio.playUi('open'))
            openSettings()
          }}
        >
          <span className="settings-chip__icon" aria-hidden />
        </button>
      )}

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
