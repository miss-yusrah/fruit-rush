import homeArt from './home.png'
import modesArt from './modes.png'
import playArt from './play.png'
import shopArt from './shop.png'
import boastArt from './boast.png'
import competeArt from './compete.png'
import profileArt from './profile.png'

/** Design frame from the phone mockups (vertical-stretch 1170×2532). */
export const DESIGN_WIDTH = 1170
export const DESIGN_HEIGHT = 2532
export const DESIGN_ASPECT = DESIGN_WIDTH / DESIGN_HEIGHT

export const designArt = {
  home: homeArt,
  modes: modesArt,
  play: playArt,
  shop: shopArt,
  boast: boastArt,
  compete: competeArt,
  profile: profileArt,
} as const

export type DesignScreen = keyof typeof designArt
