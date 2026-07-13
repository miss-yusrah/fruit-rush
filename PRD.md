# Product Requirements Document
## "Fruit Rush" — A Play-to-Earn Fruit-Slicing Game on Celo

**Document owner:** Senior Product Manager
**Status:** Draft v1.0
**Date:** July 13, 2026

---

## 1. Executive Summary

Fruit Rush is a mobile-first, arcade-style fruit-slicing game (Fruit Ninja-style) built on **Celo**, an Ethereum Layer 2 optimized for low-cost, mobile-friendly payments. The game combines addictive skill-based gameplay with real-money spending mechanics — cosmetic shop items, power-up boosts, tournament entry, and social "boasting" (leaderboards, flexing skins/scores on-chain) — monetized through Celo's stablecoin rails (cUSD/USDC/USDT), which let players pay with near-zero gas fees without needing to understand crypto.

Celo is a strong fit here specifically because: it's currently the #1 Ethereum L2 by daily active users, transaction fees average roughly half a cent, users can pay gas in stablecoins instead of a native token, and it already has significant reach in emerging markets via Opera's MiniPay wallet (16M+ wallets across 65+ countries) — a natural acquisition channel for a casual mobile game with a spending loop.

---

## 2. Problem Statement & Opportunity

**Problem:** Traditional mobile arcade games monetize through app-store IAP (Apple/Google take 15–30%), opaque loot boxes, and ad networks — all of which cap margins, invite regulatory scrutiny (gambling-adjacent loot mechanics), and give players no real ownership of what they buy.

**Opportunity:** Build the same addictive core loop (swipe-to-slice, combos, near-misses, bombs) but:
- Settle purchases directly on-chain in stablecoins, bypassing app-store fees where possible (web/PWA distribution) or ring-fencing them where required (native app stores).
- Give players verifiable, ownable cosmetics and provable leaderboard/boast records (on-chain score attestations), which is a genuine differentiator vs. traditional games.
- Tap Celo's existing mobile-first, emerging-market user base (MiniPay) as a low-CAC acquisition channel.

---

## 3. Goals & Success Metrics

### Business Goals
1. Launch a free-to-play game with a real-money spending loop generating positive unit economics within 2 quarters of launch.
2. Achieve Day-30 retention ≥ 20% and a paying-user rate ≥ 5% (mobile F2P benchmarks: D30 retention 15–25%, payer conversion 2–5%, so we target the upper end via the on-chain ownership hook).
3. Establish Fruit Rush as a flagship consumer app in the Celo ecosystem (co-marketing potential with Celo Foundation / MiniPay).

### Non-Goals (v1)
- No speculative token ($FRUIT token, yield farming) at launch — avoid gambling/securities classification risk.
- No player-vs-player wagering of stablecoins in v1 (regulatory complexity) — tournaments use a rake/entry-fee model instead, not peer-to-peer betting pools.

### Success Metrics (KPIs)
| Metric | Target (Month 6) |
|---|---|
| MAU | 250,000 |
| D1 / D7 / D30 retention | 40% / 22% / 20% |
| Paying user % | 5–8% |
| ARPPU (avg revenue per paying user/mo) | $6–9 |
| ARPDAU | $0.08–0.12 |
| Avg on-chain tx cost per purchase | < $0.01 |
| Gross margin per transaction (after infra + gateway) | > 90% |

---

## 4. Target Users & Personas

1. **Casual Mobile Gamer (primary, global)** — plays arcade games for 5–10 min sessions, spends small amounts on cosmetics/lives; may not know or care it's "on Celo" — the wallet is invisible to them.
2. **MiniPay / Emerging-Market Stablecoin User (acquisition wedge)** — already has a Celo-based wallet via Opera MiniPay in Africa/LatAm/SE Asia, holds cUSD/USDT, low data cost sensitivity, values near-zero fees.
3. **Crypto-native Competitive Player** — cares about provable high scores, on-chain flex/boast, leaderboard NFTs, tournament prize pools.

---

## 5. Core Gameplay (Feature Scope)

### 5.1 Core Loop (v1 — table stakes, must match Fruit Ninja quality bar)
- Swipe/slice mechanics (touch trail rendering, physics-based fruit arcs)
- Combo multipliers, critical hits, bombs (instant game-over on hit unless shielded)
- Game modes: Classic (timed), Zen (no bombs, practice), Arcade (power-ups, frenzy mode)
- Daily challenges & streaks
- Local + global leaderboards

### 5.2 Web3-Native Features (differentiators)
- **Invisible wallet onboarding**: wallet created automatically via Magic.link on first login (email/social/phone) — player never sees a seed phrase.
- **On-chain "Boast" system**: player can pay a small fee to mint an immutable, timestamped attestation of a high score or perfect-combo run to a smart contract; shareable as a card/link with a verifiable on-chain proof (this is the core "boast" monetization feature the user described).
- **Cosmetic ownership**: knife skins, fruit skins, slice-trail effects, backgrounds sold as ERC-1155 items — tradeable/resellable (with a marketplace royalty back to the studio) rather than app-store-locked IAP.
- **Boosts/Power-ups**: consumable, non-transferable boosts (extra life, slow-motion, score multiplier, bomb shield) sold as micro-transactions.
- **Tournaments**: entry-fee based (cUSD) cash tournaments with automated smart-contract payout to top finishers, rake taken by the house.
- **Battle Pass / Season Pass**: subscription-style cUSD purchase unlocking a cosmetic/reward track over a 4–6 week season.

---

## 6. Business Model & Monetization

### 6.1 Revenue Streams
| Stream | Mechanic | Price range (cUSD) | Notes |
|---|---|---|---|
| Cosmetic shop | Knife/fruit/trail/background skins (ERC-1155) | $0.99–$9.99 | Rarity tiers: Common → Legendary |
| Boosts (consumables) | Extra life, 2x score, slow-mo, bomb shield | $0.29–$1.99 | Sold in bundles for margin |
| Boast/Flex minting | On-chain proof-of-score NFT/attestation | $0.49–$1.99 | Low marginal cost, high margin — pure "vanity" spend |
| Tournament entry | Timed leaderboard competitions | $1–$25 entry | House rake 15–20% of prize pool |
| Battle Pass | Seasonal reward track | $4.99 / season | Recurring revenue anchor |
| Marketplace royalty | Secondary sale of cosmetic NFTs | 5% royalty | Passive long-tail revenue |
| Ads (opt-in, rewarded only) | Watch-to-earn extra life/currency | eCPM-based | Fallback for non-payers, no forced interstitials |

### 6.2 Why On-Chain Improves the Business Model
- **Lower payment-processing cost**: Celo transaction fees run near $0.0005–$0.001; stablecoin settlement avoids card-network interchange (2–3%) when purchases happen via web/PWA checkout rather than native app store IAP.
- **App-store fee avoidance**: Route purchases through a web-based checkout (PWA / "buy on web" flow) for cosmetics and boosts where store policy allows, keeping the native app store purely for app installs — this is the single biggest margin lever (15–30% saved vs. IAP).
- **True ownership drives spend**: cosmetic NFTs a player can resell (with a royalty back to you) lower the psychological barrier to spending vs. a pure sunk-cost IAP.
- **Boast-to-acquire loop**: shareable on-chain proof of scores is inherently viral marketing (each boast link is a mini-ad), lowering CAC.

### 6.3 Pricing & Economy Guardrails
- No purchasable competitive advantage that breaks fairness in ranked/tournament modes — boosts usable only in Arcade/Casual modes; Tournament mode is boost-free to preserve integrity and avoid a pay-to-win/skill-gambling classification.
- Cap daily tournament entry-fee spend per user with a soft warning (responsible-spending UX), and a self-exclusion/limit-setting option, given real-money stakes.
- Legal review required before launch in each target jurisdiction to confirm tournament/rake model does not trigger gambling regulation (skill-based competitions with fixed entry fees are generally treated differently from wagering, but this varies by country — confirm with counsel, this PRD is not legal advice).

---

## 7. Tech Stack Recommendation

### 7.1 Blockchain Layer — **Celo (L2)**
- Celo migrated from a standalone L1 to a full Ethereum L2 (OP Stack + EigenDA) in March 2025 and is EVM-equivalent, so standard Solidity/Hardhat/Foundry tooling works unmodified.
- Fee abstraction lets players pay gas in cUSD/USDC/USDT directly — critical for a "buy a skin for $0.99" flow where you don't want to explain gas tokens.
- Block times ~1 second, so purchases and boast-mints confirm fast enough for a game UX loop.
- Distribution advantage: MiniPay (Opera) gives access to 16M+ existing Celo wallets in emerging markets — a real acquisition channel, not just infrastructure choice.

**Smart contract stack:** Solidity + Foundry (testing/fuzzing) or Hardhat, OpenZeppelin ERC-1155 for cosmetics, a simple escrow/attestation contract for the Boast feature, and a tournament-payout contract with a Chainlink VRF or Celo-native randomness source only if any randomized reward mechanic is added later.

### 7.2 Wallet & Auth — **Magic.link**
- Use **Magic's embedded/dedicated wallet SDK** for invisible onboarding: email OTP, SMS, social login, or passkeys — a player logs in like any web2 game and a non-custodial wallet is provisioned behind the scenes (50–100ms wallet creation/signing latency).
- Non-custodial: Magic's key-management system means the studio never custodies player funds — reduces regulatory and security burden.
- Multi-chain SDK support means Celo is supported alongside other EVM chains if you expand later.
- Note (do your own current diligence before committing): several competitors (Privy/Stripe, Dynamic/Fireblocks, thirdweb, Openfort) now bundle native smart-account/gas-sponsorship features that Magic's core SDK does not include out of the box — you may need to pair Magic with a separate paymaster/session-key solution if you want fully gasless in-game transactions. Confirm current feature parity directly with Magic before finalizing.

### 7.3 Blockchain Data / Indexing — **Goldsky**
- Use **Goldsky Subgraphs** to index on-chain events (cosmetic mints/transfers, boast attestations, tournament results) into a queryable GraphQL API for the game backend and leaderboard service — sub-second indexing latency, fully managed (no node ops).
- Use **Goldsky Mirror** to stream the same on-chain events directly into your Postgres/ClickHouse analytics warehouse in real time for BI, fraud detection, and finance reconciliation, with automatic reorg handling.
- Both are Graph-compatible, so if the team has any existing subgraph work it migrates with a single CLI command.

### 7.4 Game Client

- **PixiJS (PWA)** for the primary game client — lightweight, fast to ship, and a natural fit for a browser-first arcade loop with web checkout and share flows.
  - If the team wants a framework layer around the game shell, use **PixiJS + React** for UI chrome, routing, wallet state, and purchase surfaces.
- Build the game as a PWA-first experience so the core loop, shop, Boast flow, and tournament entry all live in the browser and can route payments outside app-store IAP where policy allows.

### 7.5 Backend
- **Node.js/TypeScript** services (game session validation, anti-cheat score verification, matchmaking for tournaments) — pairs naturally with Goldsky's GraphQL/webhook outputs and Magic's SDK (also TS-native).
- **Postgres** (via Goldsky Mirror sink) as the source of truth for indexed on-chain data joined with off-chain game-session data.
- **Redis** for real-time leaderboard caching and rate limiting.

### 7.6 Infra / DevOps
- AWS or GCP for backend hosting; Cloudflare for CDN/edge (asset delivery, DDoS protection).
- CI/CD: GitHub Actions; contracts tested via Foundry fuzzing + a third-party audit before mainnet deployment (non-negotiable given real money flows).

### 7.7 Summary Stack Table
| Layer | Choice |
|---|---|
| Blockchain | Celo (Ethereum L2) |
| Wallet/Auth | Magic.link (embedded wallets, passwordless) |
| On-chain data indexing | Goldsky (Subgraphs + Mirror) |
| Smart contracts | Solidity, Foundry, OpenZeppelin |
| Game client | PixiJS (PWA) + React shell |
| Backend | Node.js/TypeScript, Postgres, Redis |
| Hosting | AWS/GCP + Cloudflare |

---

## 8. Security, Compliance & Risk

- **Smart contract audit** mandatory before mainnet launch (any contract touching player funds — shop, tournament payouts).
- **KYC/AML**: tournament cash payouts above regulatory thresholds may require KYC — plan for a KYC provider integration (many embedded-wallet vendors, including Magic, support pluggable identity/compliance tooling) before scaling tournament stakes.
- **Anti-cheat**: server-authoritative score validation (client sends inputs, server computes score) to prevent fraudulent boast/tournament submissions.
- **Regulatory review per country** on the tournament entry-fee/rake model (skill-game vs. gambling classification varies globally).
- **Responsible spending**: daily/weekly spend caps, cooldowns, and clear odds/no-loot-box-randomness in paid cosmetics (avoid gacha-style randomized paid loot to reduce regulatory exposure).

---

## 9. Rollout Plan

| Phase | Scope | Timeline |
|---|---|---|
| Alpha | Core gameplay + wallet onboarding (Magic) + cosmetic shop, testnet | Weeks 1–8 |
| Closed Beta | Add Boast minting, Goldsky indexing/leaderboards, mainnet with real cUSD | Weeks 9–14 |
| Public Launch | Tournaments, Battle Pass, MiniPay co-marketing push | Week 16 |
| Post-launch | Marketplace/resale, expand to additional chains if warranted | Ongoing |

---

## 10. Open Questions for Stakeholder Sign-off
1. Which app stores (Apple/Google) will we distribute through, and how do we structure the web-checkout flow to stay compliant with their payment policies?
2. What jurisdictions are in scope for launch, and has legal confirmed the tournament/rake model in each?
3. Do we want Magic alone for wallets, or pair it with a smart-account/paymaster provider for gasless UX — needs a technical spike before Beta.
4. What's the initial marketing budget/timeline for a MiniPay co-marketing placement?

---

*This PRD reflects product and business strategy recommendations current as of July 2026. Blockchain infrastructure details (Celo, Goldsky, Magic.link feature sets and pricing) should be reconfirmed against current vendor documentation before final engineering commitment, as these platforms update frequently.*