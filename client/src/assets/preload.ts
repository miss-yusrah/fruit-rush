import { designArt, type DesignScreen } from './designs'
import fruitSheetUrl from './fruits/sheet.webp'
import fruitSheetData from './fruits/sheet.json' with { type: 'json' }

export type LoadPhase = 'ui' | 'fruits' | 'sounds' | 'background' | 'done'

export interface LoadProgress {
  phase: LoadPhase
  label: string
  /** 0–1 overall */
  progress: number
  /** 0–1 within the current phase */
  phaseProgress: number
}

type ProgressFn = (p: LoadProgress) => void

const PHASE_WEIGHT: Record<Exclude<LoadPhase, 'done'>, number> = {
  ui: 0.35,
  fruits: 0.45,
  sounds: 0.1,
  background: 0.1,
}

/** Re-export hashed design URLs for call sites that need the map. */
export const designUrls = designArt

type FruitSheet = {
  textures: Record<string, import('pixi.js').Texture>
}

let bootPromise: Promise<void> | null = null
let fruitSheet: FruitSheet | null = null
let listeners = new Set<ProgressFn>()

function emit(p: LoadProgress) {
  for (const fn of listeners) fn(p)
}

export function onLoadProgress(fn: ProgressFn): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function weightedProgress(
  completedWeight: number,
  phase: Exclude<LoadPhase, 'done'>,
  phaseProgress: number,
  label: string,
): LoadProgress {
  const overall = Math.min(
    1,
    completedWeight + PHASE_WEIGHT[phase] * Math.max(0, Math.min(1, phaseProgress)),
  )
  return { phase, label, progress: overall, phaseProgress }
}

/** Browser decode — no Pixi dependency on the critical path. */
function loadBrowserImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Failed to load ${url}`))
    img.src = url
  })
}

async function loadUiBundle(onPhase: (done: number, total: number) => void) {
  const urls = Object.values(designArt) as string[]
  let done = 0
  const total = urls.length
  onPhase(0, total)
  await Promise.all(
    urls.map(async (url) => {
      await loadBrowserImage(url)
      done += 1
      onPhase(done, total)
    }),
  )
}

async function loadFruitSheet(): Promise<FruitSheet> {
  if (fruitSheet) return fruitSheet
  const { Assets, Spritesheet } = await import('pixi.js')
  const baseTexture = await Assets.load(fruitSheetUrl)
  const data = {
    ...fruitSheetData,
    meta: { ...fruitSheetData.meta, image: fruitSheetUrl },
  }
  const sheet = new Spritesheet(baseTexture, data)
  await sheet.parse()
  fruitSheet = sheet
  return sheet
}

async function warmAudio() {
  const { audio } = await import('../audio')
  // Build the procedural graph + noise buffers only.
  // Never await unlock()/resume() here — without a user gesture many browsers
  // leave AudioContext.resume() pending forever, which froze the loader at 80%.
  audio.kick()
}

/**
 * Boot preload: UI art + fruit atlas + audio warm-up + wood module.
 * Safe to call multiple times — shares one promise.
 */
export function preloadBoot(onProgress?: ProgressFn): Promise<void> {
  if (onProgress) listeners.add(onProgress)
  if (!bootPromise) {
    bootPromise = (async () => {
      let completed = 0

      emit(weightedProgress(completed, 'ui', 0, 'Loading UI…'))
      await loadUiBundle((done, total) => {
        emit(weightedProgress(completed, 'ui', total ? done / total : 1, 'Loading UI…'))
      })
      completed += PHASE_WEIGHT.ui

      emit(weightedProgress(completed, 'fruits', 0, 'Loading Fruits…'))
      await loadFruitSheet()
      emit(weightedProgress(completed, 'fruits', 1, 'Loading Fruits…'))
      completed += PHASE_WEIGHT.fruits

      emit(weightedProgress(completed, 'sounds', 0, 'Loading Sounds…'))
      await warmAudio()
      emit(weightedProgress(completed, 'sounds', 1, 'Loading Sounds…'))
      completed += PHASE_WEIGHT.sounds

      emit(weightedProgress(completed, 'background', 0, 'Loading Background…'))
      await import('../game/woodBackground')
      emit(weightedProgress(completed, 'background', 1, 'Loading Background…'))

      emit({ phase: 'done', label: 'Ready', progress: 1, phaseProgress: 1 })
    })().finally(() => {
      if (onProgress) listeners.delete(onProgress)
    })
  } else if (onProgress) {
    bootPromise.finally(() => listeners.delete(onProgress))
  }
  return bootPromise
}

/** Ensure fruit atlas is parsed (idempotent). */
export function preloadGameAssets(): Promise<void> {
  return loadFruitSheet().then(() => undefined)
}

export function getFruitTexture(frame: string): import('pixi.js').Texture {
  const tex = fruitSheet?.textures[frame]
  if (!tex) {
    throw new Error(`Fruit frame not loaded: ${frame}. Call preloadBoot() first.`)
  }
  return tex
}

export function isBootReady(): boolean {
  return fruitSheet !== null
}

export type { DesignScreen }
