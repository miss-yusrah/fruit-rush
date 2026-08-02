# Fruit Rush Client

Mobile-first PWA for **Fruit Rush** — PixiJS gameplay + React UI chrome.

## Stack

- React 19 + TypeScript + Vite
- PixiJS 8 (slice loop)
- Framer Motion-ready (CSS motion in v1)
- PWA via `vite-plugin-pwa`

## Design

**Midnight Orchard** — dusk teal stage, tangerine CTAs, lime combos, cream brand type.
Desktop uses a **centered phone-stage** so tournament play stays fair vs mobile.

## Scripts

```bash
cd client
npm install
npm run dev
npm run build
```

Open `http://localhost:5173` on a phone or use Chrome DevTools device mode.

## Screens

| Screen | Route state | Notes |
|--------|-------------|-------|
| Home | `home` | Brand hero + Play |
| Modes | `modes` | Classic / Zen / Arcade |
| Play | `play` | Pixi stage + HUD |
| Armory | `shop` | Cosmetics mock catalog |
| Compete | `tournaments` | cUSD entry stubs |
| Boast | `boast` | Post-PB mint/share stub |
| Profile | `profile` | Wallet whisper + PB |

## Game modes

See `src/game/types.ts` (`MODE_CONFIG`). Tournament mode disables power-ups (enforced when power-ups land).

## Next integrations

- Magic.link auth (`Prompt 4`)
- Real checkout / boast mint / tournament enter
- Server session upload (`ISessionUploader`)
