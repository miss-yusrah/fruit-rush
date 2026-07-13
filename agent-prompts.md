# Fruit Rush — Agent Prompt Batch
**Generated:** 2026-07-13 | **Source:** PRD v1.0

---

## Workstream 1 — Smart Contracts

---

### Prompt 1
**Title:** Smart Contracts — ERC-1155 Cosmetics Contract
**Target executor:** Claude Code (Solidity / Foundry)
**Dependencies:** None — run first.

---

**Prompt:**

You are a senior Solidity smart-contract engineer. Your task is to implement and fully test an ERC-1155 cosmetics contract for a mobile arcade game called "Fruit Rush" on Celo (an EVM-equivalent Ethereum L2).

**Task:**
Write a Foundry project containing:
1. A `FruitRushCosmetics.sol` ERC-1155 contract using OpenZeppelin's latest audited ERC-1155 base.
2. Token IDs organized by category (knife skins, fruit skins, trail effects, backgrounds) and rarity tier (Common, Rare, Epic, Legendary) — encode rarity in token metadata URI convention.
3. A minter role (granted to the game's backend hot wallet and the shop contract) that can mint items to players on purchase.
4. A secondary-sale royalty of exactly **5%**, implemented via ERC-2981 (`royaltyInfo`).
5. An owner-controlled function to add new item types (ID + max supply + base URI).
6. Events: `CosmeticMinted(address indexed to, uint256 indexed tokenId, uint256 amount)`.
7. Foundry test suite covering: mint by authorized minter, mint rejection by unauthorized caller, royalty calculation, URI resolution, supply cap enforcement.

**Constraints:**
- Cosmetics are transferable and tradeable (players can resell them).
- No randomized loot boxes — items are sold directly at a fixed price (pricing is handled off-chain; this contract only handles minting and ownership).
- Contract must be upgradeable via OpenZeppelin's UUPS proxy pattern so a post-audit fix can be deployed without migrating all token balances.
- Target Solidity `^0.8.24`; use Foundry for build, test, and script.
- Include a `Deploy.s.sol` Foundry script that deploys the proxy and implementation, logs the deployed addresses, and verifies on Celoscan (assume `CELOSCAN_API_KEY` is in `.env`).

**Output / Definition of Done:**
- `src/FruitRushCosmetics.sol` — full implementation.
- `test/FruitRushCosmetics.t.sol` — Foundry tests, all passing (`forge test -vv`).
- `script/Deploy.s.sol` — deployment script.
- `README.md` in the `contracts/` folder documenting the token-ID schema and role addresses.

State any assumptions you make (e.g. OpenZeppelin version pinned) explicitly in the README.

---

### Prompt 2
**Title:** Smart Contracts — Boast Attestation Contract
**Target executor:** Claude Code (Solidity / Foundry)
**Dependencies:** Prompt 1 (shares the Foundry project; run after Prompt 1 to reuse the project scaffold, but the contract itself has no code dependency on Prompt 1).

---

**Prompt:**

You are a senior Solidity smart-contract engineer. Your task is to implement the "Boast" attestation contract for Fruit Rush, a Fruit Ninja-style arcade game on Celo (EVM-equivalent Ethereum L2).

**Context — Boast feature:**
Players can pay a small fee in cUSD (Celo's stablecoin, ERC-20 at a known mainnet address) to mint an immutable, timestamped on-chain attestation of a high score or perfect-combo run. The attestation is shareable as a verifiable proof link. This is a cosmetic/vanity feature — it confers no in-game advantage. Price range: $0.49–$1.99 cUSD per attestation.

**Task:**
Write `FruitRushBoast.sol` inside the existing Foundry project:
1. Accepts a cUSD payment (ERC-20 `transferFrom`) from the player.
2. Stores an attestation struct: `{ address player, uint256 score, string gameMode, bytes32 serverSignatureHash, uint256 timestamp, uint256 boastId }`.
3. The `serverSignatureHash` is an ECDSA signature hash produced by the game backend (trusted signer address set by owner) over `(player, score, gameMode, nonce)` — the contract must verify this signature on-chain before accepting the attestation, to prevent players from self-minting fake scores.
4. Emits `BoastMinted(uint256 indexed boastId, address indexed player, uint256 score, string gameMode, uint256 timestamp)`.
5. Owner can withdraw accumulated cUSD fees to a treasury address.
6. Owner can update the fee amount and the trusted signer address.
7. Each `(player, nonce)` pair can only be used once (replay protection).
8. Full Foundry test suite: valid mint, invalid signature rejected, replay rejected, fee withdrawal, fee underpayment rejected.

**Constraints:**
- No on-chain storage of raw scores beyond what's in the struct (keep gas lean).
- Non-upgradeable is acceptable for this contract (simpler audit surface); state this assumption explicitly.
- Use OpenZeppelin `ECDSA` and `Ownable` libraries.
- Target Solidity `^0.8.24`.

**Output / Definition of Done:**
- `src/FruitRushBoast.sol`
- `test/FruitRushBoast.t.sol` — all Foundry tests passing.
- `script/DeployBoast.s.sol` — deployment script.
- Inline NatSpec comments on all public/external functions.

---

### Prompt 3
**Title:** Smart Contracts — Tournament Escrow & Payout Contract
**Target executor:** Claude Code (Solidity / Foundry)
**Dependencies:** Prompt 1 (reuses Foundry project). Deploy before Prompt 10 (backend tournament service needs the contract ABI and deployed address).

---

**Prompt:**

You are a senior Solidity smart-contract engineer. Your task is to implement a tournament escrow and automated payout contract for Fruit Rush on Celo (EVM-equivalent Ethereum L2).

**Context — Tournament model:**
- Players pay a fixed cUSD entry fee ($1–$25) to enter a timed leaderboard competition.
- At tournament close, the game backend (trusted operator) submits the ranked list of finishers.
- The contract pays out prize shares to top finishers automatically and retains a **15–20% house rake** for the studio.
- Tournament mode is **boost-free** — no in-game boosts are usable; this is enforced off-chain by the game server, but the contract should not accept entries after the tournament's registered end time.
- No peer-to-peer wagering — the contract is house-run (the studio sets the prize pool structure).

**Task:**
Write `FruitRushTournament.sol`:
1. Owner can create a tournament: `createTournament(uint256 tournamentId, uint256 entryFee, uint256 startTime, uint256 endTime, uint256[] calldata prizeSharesBps)` where `prizeSharesBps` are basis-point shares for 1st, 2nd, 3rd, etc. (must sum to ≤ 8500 bps, i.e. max 85% of pool — leaving ≥ 15% rake).
2. Players call `enter(uint256 tournamentId)` — contract pulls `entryFee` cUSD via `transferFrom`; rejects entries after `endTime`.
3. Trusted operator (owner-set address) calls `finalize(uint256 tournamentId, address[] calldata rankedWinners)` after `endTime` — contract distributes prize shares to winners, sends rake to treasury, marks tournament closed.
4. Emergency `refund(uint256 tournamentId)` callable by owner if a tournament is cancelled before finalization.
5. Events: `TournamentCreated`, `PlayerEntered`, `TournamentFinalized(uint256 indexed tournamentId, address[] winners, uint256[] payouts, uint256 rake)`, `TournamentRefunded`.
6. Full Foundry test suite: entry, double-entry prevention, late entry rejection, finalization with correct payout math, rake math, refund path.

**Constraints:**
- No randomness needed (winners determined off-chain by server; this PRD explicitly defers Chainlink VRF to a later version).
- Guard against re-entrancy (use OpenZeppelin `ReentrancyGuard`).
- Upgradeable via UUPS (real money flows through this contract; post-audit patches must be possible).
- State your assumption on cUSD mainnet contract address (use a constructor parameter so it's configurable).

**Output / Definition of Done:**
- `src/FruitRushTournament.sol`
- `test/FruitRushTournament.t.sol` — all passing.
- `script/DeployTournament.s.sol`.
- Payout math documented in NatSpec and README.

---

## Workstream 2 — Wallet & Auth Integration

---

### Prompt 4
**Title:** Wallet & Auth — Magic.link Embedded Wallet Integration (TypeScript SDK)
**Target executor:** Claude Code (Node.js / TypeScript)
**Dependencies:** None — can run in parallel with Prompts 1–3. Backend service from Prompt 9 will import the patterns established here.

---

**Prompt:**

You are a senior full-stack TypeScript engineer specializing in Web3 auth flows. Your task is to implement a reusable Magic.link embedded-wallet integration module for Fruit Rush, a mobile arcade game on Celo.

**Context:**
- Players must never see a seed phrase or be asked to understand crypto. Wallet creation is invisible: they log in via email OTP, SMS, social login, or passkey and a non-custodial wallet is provisioned automatically (Magic's key-management system).
- Celo is an EVM-equivalent Ethereum L2. Magic supports Celo; configure the Magic SDK to point at the Celo mainnet RPC (`https://forno.celo.org`) and Alfajores testnet for dev/test.
- The game backend is Node.js/TypeScript; the game client is PixiJS (PWA) and auth is handled in a browser shell.

**Task:**
Create a TypeScript module `src/auth/magicAuth.ts` (and supporting files) that:
1. Initializes the Magic SDK for Celo mainnet/testnet (selected by `NODE_ENV`).
2. Exports `loginWithEmail(email: string): Promise<WalletSession>` — triggers Magic's email OTP flow and returns `{ address, token, provider }`.
3. Exports `loginWithSocial(provider: 'google' | 'apple' | 'twitter'): Promise<WalletSession>`.
4. Exports `getWalletAddress(): Promise<string>` — returns the player's Celo address from the active Magic session.
5. Exports `signMessage(message: string): Promise<string>` — used by the backend to produce the server-side ECDSA signature for Boast attestations (see Boast contract).
6. Exports `sendCUSD(to: string, amountUSD: string): Promise<TransactionReceipt>` — wraps an ERC-20 `transfer` call on the cUSD contract.
7. A `logout()` function.
8. Jest unit tests mocking the Magic SDK.

**Constraints:**
- The studio must never custody player private keys — do not extract or log private key material anywhere.
- If Magic does not natively support gas payment in cUSD (fee abstraction) out of the box, document this gap and stub a `// TODO: integrate paymaster` comment at the relevant call site rather than silently ignoring it.
- State your assumption on which Magic SDK package and version you are pinning (`@magic-sdk/...`), and note if Privy/Dynamic are worth evaluating as alternatives given the PRD's own caveat about Magic's gas-sponsorship limitations.
- All secrets (`MAGIC_PUBLISHABLE_KEY`, `CELO_RPC_URL`) must be read from environment variables — never hardcoded.

**Output / Definition of Done:**
- `src/auth/magicAuth.ts` — full implementation with JSDoc.
- `src/auth/__tests__/magicAuth.test.ts` — Jest tests, all passing.
- `.env.example` with all required env vars.
- `docs/auth-flow.md` — sequence diagram (Mermaid) of the login → wallet-provisioned → in-game flow.

---

## Workstream 3 — On-Chain Data & Indexing

---

### Prompt 5
**Title:** On-Chain Indexing — Goldsky Subgraph Schema & Handlers
**Target executor:** Claude Code (AssemblyScript / The Graph / Goldsky CLI)
**Dependencies:** Prompts 1, 2, 3 — needs the deployed contract ABIs and addresses.

---

**Prompt:**

You are a senior blockchain data engineer. Your task is to build a Goldsky Subgraph that indexes all relevant on-chain events for Fruit Rush on Celo.

**Context:**
Fruit Rush has three smart contracts on Celo:
- `FruitRushCosmetics` (ERC-1155): emits `CosmeticMinted(address indexed to, uint256 indexed tokenId, uint256 amount)` and standard ERC-1155 transfer events.
- `FruitRushBoast`: emits `BoastMinted(uint256 indexed boastId, address indexed player, uint256 score, string gameMode, uint256 timestamp)`.
- `FruitRushTournament`: emits `TournamentCreated`, `PlayerEntered`, `TournamentFinalized(uint256 indexed tournamentId, address[] winners, uint256[] payouts, uint256 rake)`, `TournamentRefunded`.

You will be given placeholder contract addresses; replace them with real addresses when available (mark them `# REPLACE_ME` in the manifest).

**Task:**
1. Write a complete Goldsky/The Graph subgraph project:
   - `subgraph.yaml` — manifest declaring all three data sources, their ABIs, start blocks, and event handlers.
   - `schema.graphql` — entities: `Cosmetic`, `CosmeticOwner`, `Boast`, `Tournament`, `TournamentEntry`, `TournamentPayout`.
   - `src/mappings/cosmetics.ts`, `src/mappings/boast.ts`, `src/mappings/tournament.ts` — AssemblyScript handlers that populate the entities.
2. Ensure the `Boast` entity stores: `boastId`, `player`, `score`, `gameMode`, `timestamp`, `txHash` — sufficient for the shareable proof-link feature.
3. Ensure the `Tournament` entity has a derived field listing all entries and all payouts.
4. Write a `queries.graphql` file with sample GraphQL queries: player's cosmetics inventory, player's boast history, live tournament leaderboard (entries by entry time), tournament payout history.
5. Include Goldsky CLI deploy instructions in `README.md` (`goldsky subgraph deploy fruit-rush/v1 --path .`).

**Constraints:**
- Use Goldsky-compatible Graph Protocol tooling (AssemblyScript, `graph-cli`).
- Do not store any PII — only wallet addresses and on-chain data.
- Schema must be forward-compatible: adding new event types in v2 should not require a full re-sync from block 0 (document the Goldsky `--startBlock` strategy for incremental upgrades).

**Output / Definition of Done:**
- Full subgraph project directory ready to `goldsky subgraph deploy`.
- Sample queries file.
- README with deploy steps and `--startBlock` guidance.

---

### Prompt 6
**Title:** On-Chain Indexing — Goldsky Mirror Pipeline to Postgres/ClickHouse
**Target executor:** Claude Code (Goldsky Mirror config / SQL / TypeScript)
**Dependencies:** Prompt 5 (shares contract event schema). Feeds analytics for Prompt 10 (backend).

---

**Prompt:**

You are a senior data engineer. Your task is to configure a Goldsky Mirror pipeline that streams on-chain events from Fruit Rush's Celo contracts into a Postgres analytics database in real time.

**Context:**
Goldsky Mirror lets you define a pipeline in YAML/JSON that streams indexed blockchain events into a target sink (Postgres, ClickHouse, Kafka, etc.) with automatic reorg handling. The game studio needs real-time on-chain data in Postgres for:
- BI dashboards (MAU, revenue by stream, ARPPU).
- Fraud detection (unusual score/boast patterns).
- Finance reconciliation (tournament rake received, cosmetic revenue).

**Task:**
1. Write a `mirror-pipeline.json` Goldsky Mirror config that:
   - Sources: the three Fruit Rush contracts on Celo mainnet (use placeholder addresses marked `REPLACE_ME`).
   - Sink: Postgres (connection string from env var `DATABASE_URL`).
   - Streams: `cosmetic_mints`, `boast_mints`, `tournament_entries`, `tournament_payouts`, `tournament_refunds`.
   - Handles chain reorgs gracefully (Goldsky Mirror's built-in reorg handling — document which config flag enables this).
2. Write the `CREATE TABLE` SQL DDL for each stream's target table, including a `_goldsky_ingested_at` metadata column.
3. Write three example analytics SQL queries:
   - Daily revenue by stream (cosmetics vs. boasts vs. tournament rake) in cUSD.
   - 7-day rolling player retention cohort (players who entered ≥1 tournament in week N and also in week N+1).
   - Top-10 boasters by total score attested (leaderboard).
4. Write a brief `docs/mirror-setup.md` explaining how to run `goldsky mirror start` and how to add a ClickHouse sink as an alternative.

**Constraints:**
- No PII beyond wallet addresses.
- All credentials (Postgres DSN, Goldsky API key) must come from environment variables.
- The DDL must include indexes on `player_address` and `timestamp` columns for query performance.

**Output / Definition of Done:**
- `mirror-pipeline.json`
- `db/schema.sql` — DDL for all tables.
- `db/analytics-queries.sql` — three example queries.
- `docs/mirror-setup.md`.

---

## Workstream 4 — Game Client (PixiJS / PWA)

---

### Prompt 7
**Title:** Game Client — PixiJS Core Loop: Slice Mechanics & Physics
**Target executor:** Claude Code (PixiJS / TypeScript)
**Dependencies:** None — can start immediately. Integrates with Prompt 8 (shop UI) and Prompt 4 (wallet overlay) later.

---

**Prompt:**

You are a senior browser-game engineer specializing in mobile arcade games. Your task is to implement the core fruit-slicing gameplay loop for Fruit Rush, a Fruit Ninja-style game targeting iOS, Android, and the web as a PWA.

**Task:**
Implement the following PixiJS + TypeScript systems:

1. **FruitSpawner.ts** — Spawns fruit sprites on physics arcs (randomized launch angle, speed, spin) from screen-bottom offsets. Spawns bombs at a configurable frequency. Supports three game modes passed via a `GameMode` enum:
   - `Classic` — timed (60 s), bombs enabled.
   - `Zen` — no time limit, no bombs (practice/tutorial).
   - `Arcade` — shorter rounds with frenzy-mode bursts (20% higher spawn rate for 5 s intervals); power-ups active (see constraints).

2. **SliceDetector.ts** — Reads touch/mouse input, builds a velocity-weighted trail, raycasts against fruit/bomb colliders. On hit: triggers slice animation, spawns juice particle system, calculates combo streak. On bomb hit: triggers game-over (unless BombShield power-up active).

3. **ComboSystem.ts** — Tracks consecutive hits within a 1.2 s window; multipliers: 2× at 3 combo, 3× at 6 combo, 5× at 10+ combo. Emits a `ComboEvent(int streak, float multiplier)` via a `GameEvents` event bus.

4. **GameModeController.ts** — Orchestrates a game session: countdown, score tracking, mode-specific rules, session-end → posts `GameSessionResult { playerId, score, mode, comboHighwater, durationSeconds, timestamp }` to the `ISessionUploader` interface (stub the implementation — the real uploader is built in Prompt 9).

5. **PowerUpManager.ts** — Manages active power-up states: `SlowMotion` (0.5× Time.timeScale for 5 s), `ScoreMultiplier2x` (doubles score for 10 s), `BombShield` (absorbs one bomb hit), `ExtraLife` (revives once on game-over). **Power-ups are DISABLED when `GameMode == Tournament`** — enforce this with an assertion/guard in `PowerUpManager`.

**Constraints:**
- Boost/power-ups must be completely disabled in Tournament mode — this is a hard product requirement to preserve competitive integrity.
- Slice physics must feel responsive: slice detection latency target < 16 ms on a mid-range Android (Snapdragon 6 Gen 1 class).
- No hardcoded player IDs — use a `PlayerContext` ScriptableObject injected at runtime (filled by the auth layer in Prompt 4).
- Use PixiJS asset loading and a manifest-driven sprite pipeline so new cosmetic skins (Prompt 1) can be hot-swapped without a client update.

**Output / Definition of Done:**

- TypeScript source files for the gameplay systems, fully commented.
- A runnable PWA demo page with the systems wired up and placeholder fruit assets.
- A `README.md` documenting the `GameMode` enum values and the `ISessionUploader` interface contract.
- No TypeScript or browser console errors in the PWA demo.

---

### Prompt 8
**Title:** Game Client — PixiJS Shop UI & Boast-Sharing UI
**Target executor:** Claude Code (PixiJS / TypeScript)
**Dependencies:** Prompt 7 (needs `GameMode` enum and `PlayerContext`); Prompt 4 (wallet/auth session for purchase calls); Prompts 1 & 2 (cosmetic and boast contract ABIs needed for display data). Full integration deferred until those are ready — stub the data layer with interfaces.

---

**Prompt:**

You are a senior browser UI engineer. Your task is to build the cosmetic shop screen and the Boast-sharing screen for Fruit Rush (mobile-first PWA).

**Context:**
- The shop sells knife skins, fruit skins, trail effects, and backgrounds as ERC-1155 NFTs (Common → Legendary rarity). Prices are $0.99–$9.99 cUSD. Purchases route through the web/PWA checkout flow to avoid app-store fees — the PWA opens a deep-linked URL, completes the purchase, and signals back through a browser-friendly return handler.
- The Boast screen lets players who just set a personal best pay $0.49–$1.99 to mint an on-chain attestation. It shows a preview "Boast card" with their score, game mode, timestamp, and a shareable URL.

**Task:**

**A. Shop Screen (`ShopScreen.ts` + UI markup/components):**
1. Grid layout of cosmetic items, each showing: thumbnail, name, rarity badge (color-coded), price in cUSD, and an "Own" badge if already owned.
2. Item detail modal: larger preview, description, rarity, price, "Buy on Web" button → calls `IShopCheckout.OpenWebCheckout(itemId)` (interface stub).
3. Filter tabs: All / Knife / Fruit / Trail / Background.
4. Inventory tab showing owned items with an "Equip" button → updates `PlayerLoadout` ScriptableObject.
5. `IShopDataProvider` interface for feeding item catalog and ownership data (stub implementation returning mock data).

**B. Boast Screen (`BoastScreen.ts` + prefab):**
1. Shown automatically when player beats their personal best in Classic or Arcade mode.
2. Displays: score, combo high-water, game mode, date, and a rendered "Boast Card" (RenderTexture export as PNG for sharing).
3. "Mint Boast" button → calls `IBoastService.MintBoast(sessionResult)` (interface stub); shows a loading spinner, then a success state with the on-chain boast ID and a copyable share URL `https://fruitrush.gg/boast/{boastId}`.
4. "Share" button → native share sheet (iOS/Android) or clipboard copy (WebGL).
5. "Not Now" button to dismiss.

**Constraints:**
- All price displays must show the cUSD symbol and amount (e.g. "1.99 cUSD") — never raw token amounts or wei.
- Shop must not hard-block the game loop — load item data asynchronously; show skeleton loaders while fetching.
- UI must be legible at 375 × 667 px (iPhone SE) and 428 × 926 px (iPhone 14 Pro Max) — test both in Game view.

**Output / Definition of Done:**

- `ShopScreen.ts`, `BoastScreen.ts`, associated UI markup/components.
- `IShopCheckout.ts`, `IShopDataProvider.ts`, `IBoastService.ts` interface definitions.
- `DeepLinkManager.ts` stub that receives the post-purchase callback from the PWA.
- Screenshots of both screens in the PWA at 375 × 667 and 428 × 926.
- No TypeScript or browser console errors in the PWA demo.

---

## Workstream 5 — Backend Services

---

### Prompt 9
**Title:** Backend — Session Validation & Anti-Cheat Score Verification Service
**Target executor:** Claude Code (Node.js / TypeScript)
**Dependencies:** Prompt 7 (needs `GameSessionResult` schema and `ISessionUploader` interface contract). Prompt 4 (auth token verification). Deploy before Prompt 3's tournament contract is used in prod (the backend signs score attestations needed by the Boast contract).

---

**Prompt:**

You are a senior backend engineer specializing in game server architecture and anti-cheat systems. Your task is to build the session validation and score verification microservice for Fruit Rush.

**Context:**
The game client (PixiJS PWA) sends a `GameSessionResult` to this service at the end of each game session:
```ts
interface GameSessionResult {
  playerId: string;       // Celo wallet address
  score: number;
  gameMode: 'Classic' | 'Zen' | 'Arcade' | 'Tournament';
  comboHighwater: number;
  durationSeconds: number;
  clientTimestamp: number; // Unix ms
  inputEventLog: InputEvent[]; // see below
}

interface InputEvent {
  t: number;       // ms offset from session start
  x: number;       // normalized 0–1
  y: number;       // normalized 0–1
  velocity: number; // px/ms
}
```

The server must **replay-validate** the session: re-simulate the score from `inputEventLog` and reject sessions where the server-computed score diverges from `clientScore` by more than 2% (tolerance for floating-point drift).

**Task:**
Build a Node.js/TypeScript Express microservice:

1. `POST /session/validate` — accepts `GameSessionResult` (JWT-authenticated via Magic.link token in `Authorization: Bearer` header), runs the replay validator, stores valid sessions in Postgres, returns `{ valid: boolean, serverScore: number, sessionId: string }`.
2. `POST /boast/sign` — for valid sessions only: generates an ECDSA signature over `(playerAddress, serverScore, gameMode, nonce)` using a server-held private key (the "trusted signer" registered in the Boast contract from Prompt 2). Returns the signature for the client to pass to the Boast contract. **Never expose the signing private key in logs or responses.**
3. `GET /leaderboard/:gameMode` — returns top 100 scores for the given mode, with player address, score, timestamp, and a boolean `hasBoast` (whether an on-chain boast exists — queried from Goldsky via GraphQL).
4. `POST /tournament/:id/enter` — validates player eligibility (not already entered, tournament open, no boosts requested in this mode) and records intent; actual on-chain entry (calling the tournament contract) happens client-side after this call returns `{ eligible: true, tournamentId }`.
5. Rate limiting: 10 session submissions per player per hour (Redis-backed).

**Constraints:**
- Server-authoritative scoring: client score is untrusted input; always use `serverScore` for leaderboard storage and boast signing.
- Signing key must be in an env var (`BOAST_SIGNER_PRIVATE_KEY`) and should be rotatable without a code deploy.
- Tournament mode sessions must have `boostEventsCount === 0` in the input log — reject otherwise.
- Use `zod` for all request validation.
- Include OpenAPI 3.0 spec (`openapi.yaml`).

**Output / Definition of Done:**
- `src/` — full Express service.
- `src/validator/replaySimulator.ts` — the score replay engine (document its simulation assumptions clearly, since exact parity with the browser physics loop is not feasible — document the accepted divergence tolerance and why).
- `openapi.yaml`.
- Jest integration tests for all four endpoints, using a real Postgres container via `testcontainers`.
- `Dockerfile` for containerized deployment.

---

### Prompt 10
**Title:** Backend — Tournament Matchmaking & Lifecycle Service
**Target executor:** Claude Code (Node.js / TypeScript)
**Dependencies:** Prompt 3 (tournament contract ABI + deployed address needed), Prompt 9 (shares Postgres/Redis, auth middleware).

---

**Prompt:**

You are a senior backend engineer. Your task is to build the tournament lifecycle management service for Fruit Rush.

**Context:**
Tournaments are timed leaderboard competitions. A tournament has: `{ id, entryFee (cUSD), startTime, endTime, prizeSharesBps[], status }`. Entry fees and payouts flow through the `FruitRushTournament` smart contract (Prompt 3). The backend orchestrates creation, monitors entries, and triggers on-chain finalization.

**Task:**
Build the following Node.js/TypeScript modules (can live in the same Express service as Prompt 9 or as a separate service — state your assumption):

1. **Tournament scheduler (`src/tournament/scheduler.ts`):** A cron job (using `node-cron`) that:
   - Creates new recurring tournaments (e.g. daily $1 tournament, weekly $10 tournament) by calling `FruitRushTournament.createTournament(...)` via `ethers.js` with the operator wallet.
   - At `endTime`, fetches the ranked leaderboard from Postgres (server-validated scores only, from Prompt 9), calls `FruitRushTournament.finalize(tournamentId, rankedWinners)`.
   - Handles finalization failure (retry with exponential backoff, alert via webhook if 3 retries fail).

2. **`GET /tournament/active`** — lists currently open tournaments with entry fee, prize pool (entry count × fee), time remaining, and the calling player's entry status.

3. **`GET /tournament/:id/leaderboard`** — live rankings during the tournament (from Postgres, refreshed every 10 s via Redis cache).

4. **`POST /tournament/:id/refund`** (admin only) — triggers `FruitRushTournament.refund(...)` on-chain for cancelled tournaments.

5. Prize-pool math validation: before calling `finalize`, assert that `sum(prizeSharesBps) ≤ 8500` (max 85% to winners, minimum 15% rake) — hard-error if violated.

**Constraints:**
- Operator wallet private key in env var `TOURNAMENT_OPERATOR_PRIVATE_KEY` — never logged.
- All on-chain calls must be wrapped in try/catch with structured error logging (include tx hash if available).
- Use `ethers.js v6` for contract interactions.
- State your assumption on whether this runs as a separate service or is merged with the Prompt 9 service.

**Output / Definition of Done:**
- All source files with JSDoc.
- Jest tests for scheduler logic (mock ethers.js provider).
- `Dockerfile` (or note if shared with Prompt 9 service).

---

## Workstream 6 — Web/PWA Checkout Flow

---

### Prompt 11
**Title:** Web/PWA — Out-of-App Purchase Checkout (cUSD Payment Flow)
**Target executor:** Claude Code (Next.js / TypeScript / wagmi + viem)
**Dependencies:** Prompt 4 (Magic.link auth module), Prompt 1 (cosmetics contract ABI). Prompt 8 (browser return handler) receives the post-purchase callback from this app.

---

**Prompt:**

You are a senior full-stack TypeScript engineer. Your task is to build the web/PWA checkout flow for Fruit Rush — the mechanism that lets players buy cosmetics and boosts via a browser-based flow instead of native app-store IAP, preserving the studio's margin (avoiding 15–30% store fees).

**Context:**
When a player taps "Buy on Web" in the PWA shop, the game opens a deep link to `https://shop.fruitrush.gg/checkout?item={itemId}&playerId={address}&returnScheme=fruitrush://`. The player authenticates (Magic.link, already logged in via the game), approves a cUSD spend, the shop mints the item to their wallet, and the browser deep-links back to the game with a success/failure result.

**Task:**
Build a Next.js 14 (App Router) PWA:

1. **`/checkout` page:** Displays item name, thumbnail, rarity, and price in cUSD. Requires Magic.link session (redirect to `/login` if not authenticated). On "Confirm Purchase": calls the game backend (`POST /shop/purchase`) which verifies stock, then signs a mint authorization; the page then calls `FruitRushCosmetics.mint(...)` via wagmi/viem. Shows transaction status (pending → confirmed → deep-link redirect).
2. **`/login` page:** Magic.link email OTP flow using the `magicAuth` module (Prompt 4). After login, redirects back to `/checkout`.
3. **`/boast/:boastId` page:** Public shareable page showing a Boast card (player address truncated, score, game mode, timestamp, and a link to the on-chain tx). Fetches data from the Goldsky subgraph (Prompt 5). No auth required.
4. **`/inventory` page:** Shows the connected player's owned cosmetics (fetched from Goldsky subgraph). Auth required.
5. **PWA manifest + service worker** for "Add to Home Screen" installability.
6. **`POST /api/shop/purchase`** Next.js API route: validates the item ID, checks the player doesn't already own it (Goldsky query), and returns a backend-signed mint authorization. **Does not** execute the mint itself — client executes on-chain.

**Constraints:**
- Do not collect or store payment card data — all payments are cUSD on-chain.
- The checkout page must clearly display the cUSD amount and Celo network name before the player confirms — no hidden fees.
- Deep-link return must work on both iOS (Universal Links) and Android (App Links) — include the `apple-app-site-association` and `assetlinks.json` stub files with `# REPLACE_ME` for bundle IDs.
- If the player's wallet has insufficient cUSD balance, show a clear "Insufficient cUSD balance" error with a link to top-up options — do not silently fail.
- App-store policy compliance: state your assumption explicitly (this prompt assumes Apple's StoreKit 2 External Purchase Entitlement / "reader app" exemption or equivalent is in scope; actual legal review is required before shipping).

**Output / Definition of Done:**
- Next.js project with all four pages and the API route.
- PWA manifest and stub service worker.
- `apple-app-site-association` and `assetlinks.json` stubs.
- Jest + React Testing Library tests for the checkout page (mock wagmi hooks).
- `README.md` documenting the deep-link URL schema and the return-scheme protocol.

---

## Workstream 7 — Security & Compliance

---

### Prompt 12
**Title:** Security — Smart Contract Audit Preparation Checklist & Findings Template
**Target executor:** Smart contract auditor / security engineer
**Dependencies:** Prompts 1, 2, 3 must be complete (auditor needs final source code). Run before any mainnet deployment.

---

**Prompt:**

You are a senior smart contract security auditor. Your task is to produce a comprehensive audit preparation package for the Fruit Rush smart contract suite on Celo. You are **not** being asked to write new contracts — you are preparing documentation and a findings template that will be handed to a third-party audit firm.

**Contracts in scope:**
1. `FruitRushCosmetics.sol` — ERC-1155 cosmetics, ERC-2981 royalties, UUPS upgradeable, minter role.
2. `FruitRushBoast.sol` — cUSD payment acceptance, ECDSA signature verification, replay protection, fee withdrawal.
3. `FruitRushTournament.sol` — cUSD escrow, multi-winner payout, house rake, UUPS upgradeable, operator-controlled finalization.

**Task:**
Produce the following documents:

1. **`audit/scope.md`** — Audit scope document: contract names, Solidity version, compiler settings, OpenZeppelin version, external dependencies, which functions touch player funds (prioritize for critical review), known design decisions and their rationale (e.g. "tournament finalization is operator-controlled by design — trust model is documented here").

2. **`audit/threat-model.md`** — Threat model covering:
   - Reentrancy attack vectors (specifically in tournament payout and cUSD withdrawal flows).
   - Signature replay attacks (Boast contract).
   - Operator key compromise (tournament finalization, boast signer).
   - Upgrade proxy abuse (UUPS `upgradeToAndCall`).
   - Front-running (tournament entry just before `endTime`).
   - Integer overflow/underflow (prize share basis-point math).
   - ERC-1155 callback reentrancy via `onERC1155Received`.

3. **`audit/findings-template.md`** — Blank findings report template the auditor firm should fill in, with severity levels (Critical / High / Medium / Low / Informational), reproducible PoC format, and remediation guidance fields.

4. **`audit/checklist.md`** — Pre-audit internal checklist: fuzzing results (Foundry fuzz), test coverage %, static analysis output (Slither/Aderyn), known TODOs resolved, natspec completeness, event emission completeness.

**Constraints:**
- Do not produce a "findings" section with fabricated vulnerabilities — produce only the template structure and blank fields. The actual findings must come from a real audit.
- Do not suggest skipping or deferring the audit for any reason.
- Note explicitly that the Boast contract's trusted-signer model and the Tournament contract's operator-controlled finalization are centralization risks that the audit firm should flag and that the team must document as accepted risks with mitigations (e.g. multi-sig operator, timelocks).

**Output / Definition of Done:**
- `audit/scope.md`, `audit/threat-model.md`, `audit/findings-template.md`, `audit/checklist.md`.
- Each document self-contained and ready to attach to a request-for-proposal (RFP) sent to audit firms.

---

### Prompt 13
**Title:** Security & Compliance — KYC/AML Integration Points & Responsible Spending Guardrails
**Target executor:** Claude Code (Node.js / TypeScript) + compliance review
**Dependencies:** Prompt 9 (backend service — guardrails are implemented there). Legal review required separately before enabling real-money tournaments in any jurisdiction.

---

**Prompt:**

You are a senior backend engineer with experience in fintech compliance. Your task is to design and implement the KYC/AML integration points and responsible-spending guardrails for Fruit Rush's real-money features.

**Context:**
Fruit Rush accepts real-money payments (cUSD stablecoin) for cosmetics ($0.29–$9.99), boasts ($0.49–$1.99), and tournament entries ($1–$25). Tournament cash payouts above regulatory thresholds may require KYC. The studio must implement responsible-spending controls to reduce regulatory exposure and protect players.

**Task:**

**A. KYC/AML Integration Points (`src/compliance/kyc.ts`):**
1. Define a `KycStatus` enum: `NOT_REQUIRED | PENDING | APPROVED | REJECTED`.
2. Implement `getKycStatus(walletAddress: string): Promise<KycStatus>` — stubs to a pluggable `IKycProvider` interface, so the actual KYC vendor (Magic's identity tooling, Persona, Synaps, or equivalent) can be swapped without changing call sites.
3. Implement `requireKycForPayout(walletAddress: string, amountUSD: number): Promise<void>` — throws `KycRequiredError` if `amountUSD >= KYC_THRESHOLD_USD` (configurable env var, default `600`) and KYC status is not `APPROVED`.
4. Integrate this check into the tournament payout path in Prompt 10's scheduler: block on-chain `finalize()` for winners above threshold until KYC clears; store a `pending_kyc_payouts` table in Postgres.
5. Implement a webhook handler `POST /compliance/kyc/webhook` that receives status updates from the KYC provider and re-triggers blocked payouts.

**B. Responsible Spending Guardrails (`src/compliance/spendingLimits.ts`):**
1. `checkSpendingLimit(walletAddress: string, amountUSD: number): Promise<void>` — throws `SpendingLimitExceededError` if the player would exceed their configured daily or weekly cap.
2. Default limits: $50/day, $200/week (configurable per player via a self-service UI stub — document the UI flow, do not implement the full UI here).
3. `POST /compliance/limits` — authenticated endpoint for players to set their own lower limits (self-exclusion).
4. `GET /compliance/limits` — returns current limits and spend-to-date for the authenticated player.
5. Soft warning at 80% of limit (return `{ warningThreshold: true }` in the purchase API response); hard block at 100%.
6. Store all limit checks and overrides in Postgres with a tamper-evident append-only log (use `INSERT`-only, no `UPDATE/DELETE` on the audit table).

**Constraints:**
- This implementation is infrastructure only — it does not constitute legal advice or guarantee regulatory compliance. Add a `COMPLIANCE_DISCLAIMER` comment at the top of both files explicitly stating this.
- State your assumption on KYC threshold ($600 default is based on US BSA/FinCEN informal guidance for low-value digital goods — confirm with counsel for each jurisdiction).
- No loot-box / randomized paid cosmetics are permitted in this game (the PRD is explicit) — add an assertion in the shop purchase API route that the item type is `FIXED_PRICE` and log an error + reject if anything else is attempted.

**Output / Definition of Done:**
- `src/compliance/kyc.ts`, `src/compliance/spendingLimits.ts`.
- `IKycProvider.ts` interface.
- Postgres DDL for `kyc_status`, `spending_limit`, `spending_limit_audit_log`, `pending_kyc_payouts` tables.
- Jest tests for all guardrail paths (limit exceeded, KYC block, soft warning).
- `docs/compliance-integration.md` documenting how to swap in a real KYC vendor.

---

## Workstream 8 — Go-to-Market

---

### Prompt 14
**Title:** Go-to-Market — MiniPay Co-Marketing Outreach Package
**Target executor:** Growth marketer / BD lead
**Dependencies:** None — can run in parallel. Timing: target during Alpha (Weeks 1–8 per PRD rollout plan).

---

**Prompt:**

You are a senior growth marketer and BD strategist with experience in Web3 mobile games and emerging-market distribution. Your task is to create a co-marketing outreach package targeting Opera MiniPay for Fruit Rush.

**Context:**
MiniPay is Opera's mobile wallet app with 16M+ wallets across 65+ countries, primarily in Africa, Latin America, and Southeast Asia. It is built on Celo and uses cUSD/USDT for everyday payments — making its users the ideal low-CAC acquisition channel for a Celo-native game with stablecoin spend mechanics. The studio wants a MiniPay editorial placement ("Discover" section or equivalent) timed with the Public Launch (Week 16 per the roadmap).

**Task:**
Produce the following:

1. **`gtm/minipay-outreach-email.md`** — A cold outreach email (≤300 words) to the MiniPay / Opera Dapps partnership team. Include: one-line pitch, user-fit rationale (shared Celo/cUSD user base, mobile-first, emerging market), specific co-marketing ask (editorial placement, Discover section feature, joint blog post), and a clear next-step CTA. Tone: professional, direct, peer-to-peer (not a sales pitch).

2. **`gtm/minipay-one-pager.md`** — A one-page partnership brief (for an async Slack/email send alongside the outreach) covering: game overview, why MiniPay users are the target audience, proposed co-marketing mechanics (e.g. MiniPay users get an exclusive launch-week cosmetic skin, bonus tournament entry credit), metrics the studio will share back (installs sourced from MiniPay, GMV through MiniPay wallet), and brand-safe commitments (no gambling, stablecoin-only spend, GDPR-aligned data handling).

3. **`gtm/minipay-talking-points.md`** — Five sharp talking points for a 15-minute intro call with the MiniPay team, each with a "so what" that ties back to MiniPay's own KPIs (engagement, transaction volume, new dapp categories on their platform).

**Constraints:**
- Do not make claims about MiniPay's internal metrics that can't be verified from public sources (the 16M+ wallet figure is from public Celo/Opera announcements — use it; do not invent others).
- Do not promise features that are flagged as post-v1 (e.g. $FRUIT token, P2P wagering) — stick to v1 scope.
- If MiniPay's partnership process is unknown, state the assumption (e.g. "assuming outreach goes to dapps@opera.com or a public partnership form — confirm current contact before sending") rather than inventing a contact.

**Output / Definition of Done:**
- Three markdown files as described.
- All claims tied to publicly sourced data or marked as "internal estimate."

---

### Prompt 15
**Title:** Go-to-Market — App Store Listing Copy (iOS & Google Play)
**Target executor:** Copywriter / growth marketer
**Dependencies:** Prompt 7 (core gameplay must be defined to write accurate feature bullets). Can be drafted in parallel and refined post-Alpha.

---

**Prompt:**

You are a senior mobile app copywriter with experience writing top-charting App Store and Google Play listings. Your task is to write the full store listing copy for Fruit Rush.

**Context:**
Fruit Rush is a free-to-play fruit-slicing arcade game (Fruit Ninja-style) with a Web3 twist: players can own their cosmetic items (knife skins, fruit skins, trail effects) as on-chain assets, share verified high-score "Boast" proofs, and compete in cash tournaments with stablecoin entry fees. The blockchain layer is invisible to casual players — they log in with email and buy with cUSD like any stablecoin payment. Target markets: global casual gamers, with a particular push in Africa, LatAm, and SE Asia via MiniPay.

**Task:**
Write:

1. **App name:** (max 30 characters, must include "Fruit Rush")
2. **Subtitle / short description:** (30 characters for iOS subtitle; 80 characters for Google Play short description)
3. **Long description:** (up to 4,000 characters, iOS + Google Play — can share the same copy)
   - Hook paragraph (first 255 characters visible before "more" fold — critical).
   - Feature bullets: core gameplay, game modes, ownership angle, Boast/flex angle, tournaments.
   - Responsible-spending note (brief, non-alarming — acknowledge real-money tournament entry).
   - Closing CTA.
4. **Keywords (iOS ASO):** 100-character keyword field — comma-separated, no spaces after commas, maximizing relevant search coverage.
5. **Promotional text (iOS):** 170-character rotating promo (e.g. for launch week).
6. **Content rating justification notes:** Guidance on which content rating categories to select (both stores) given real-money tournament mechanics — note this requires store policy review and is not legal advice.

**Constraints:**
- Do not claim the game is "free" without disclosing in-app purchases — both stores require disclosure; include the standard IAP disclosure.
- Do not use the word "gambling" — tournament entries are skill-based competitions with fixed entry fees.
- Do not promise features not in v1 scope (no $FRUIT token, no P2P wagering).
- Keep the blockchain/crypto language minimal in the casual-gamer copy; lead with gameplay fun. Use "own your items" and "verifiable high scores" rather than "NFT" or "on-chain" in the primary copy (A/B test candidates can use the crypto angle in a separate variant).
- Flag any claim that needs legal or compliance sign-off before going live (e.g. tournament prize language).

**Output / Definition of Done:**
- All copy elements in a single `gtm/store-listing.md` file, clearly labeled by platform/field.
- One alternate "crypto-native" variant of the hook paragraph and subtitle for A/B testing.

---

### Prompt 16
**Title:** Go-to-Market — Launch Messaging Framework & Press Kit
**Target executor:** Growth marketer / PR lead
**Dependencies:** Prompt 15 (store listing copy informs messaging hierarchy). Time with Week 16 public launch.

---

**Prompt:**

You are a senior growth marketer and PR strategist with experience in Web3 gaming launches. Your task is to build the launch messaging framework and press kit outline for Fruit Rush.

**Context:**
Fruit Rush launches publicly at Week 16 (see rollout plan). Key differentiators vs. traditional mobile arcade games: on-chain cosmetic ownership (resellable, not locked to one app store), verifiable high-score "Boast" attestations, skill-based stablecoin tournaments, and Celo/MiniPay distribution reach. Celo is the #1 Ethereum L2 by daily active users; MiniPay has 16M+ wallets.

**Task:**

1. **`gtm/messaging-framework.md`** — A messaging hierarchy document:
   - Core brand promise (one sentence).
   - Primary message for each of three audiences: (a) casual mobile gamers, (b) MiniPay/emerging-market stablecoin users, (c) crypto-native competitive players.
   - Three proof points per audience message.
   - One-liner for social bios (Twitter/X, TikTok, Instagram).

2. **`gtm/press-kit-outline.md`** — Press kit structure (not full copy, but a detailed outline with content placeholders) containing:
   - Boilerplate paragraph (game, studio, Celo, MiniPay context).
   - Key stats to include at launch (MAU target, number of countries at launch, tournament prize pool size for launch event — use PRD targets; mark as "targets, not guarantees").
   - Suggested journalist angles: three distinct story hooks for crypto/Web3 press, gaming press, and fintech/emerging-market press respectively.
   - Asset list: screenshots, GIFs, trailer specs, logo files needed (list only — do not generate images).
   - Contact block template.

3. **`gtm/launch-week-social-calendar.md`** — A 7-day social post calendar for launch week (Day -1 through Day 6), with one post per day per channel (Twitter/X, TikTok/Reels, Discord). Each entry: channel, copy (≤280 chars for Twitter), content type (video/image/text), and goal (awareness / engagement / conversion).

**Constraints:**
- All KPI figures (MAU 250K, ARPPU $6–9, etc.) cited from the PRD must be labeled "targets" — do not present as guarantees.
- Do not reference the $FRUIT token, P2P wagering, or any v2+ features.
- Tournament prize language must be flagged for legal review before publishing externally.

**Output / Definition of Done:**
- Three markdown files as described.
- Messaging framework approved as the single source of truth for all launch copy.

---

---

## Execution Order

```
Phase 0 — Foundations (parallel, no dependencies)
  Prompt 1  — ERC-1155 Cosmetics Contract
  Prompt 2  — Boast Attestation Contract
  Prompt 3  — Tournament Escrow Contract
  Prompt 4  — Magic.link Auth Module
   Prompt 7  — PixiJS Core Loop & Slice Mechanics
  Prompt 14 — MiniPay Outreach Package
  Prompt 15 — App Store Copy (draft)

Phase 1 — Depends on Phase 0 contracts + auth
  Prompt 5  — Goldsky Subgraph (needs contract ABIs from 1, 2, 3)
  Prompt 9  — Session Validation & Anti-Cheat Backend (needs interface from 7, auth from 4)
   Prompt 8  — PixiJS Shop & Boast UI (needs interface from 7; stubs for 4, 1, 2)

Phase 2 — Depends on Phase 1
  Prompt 6  — Goldsky Mirror Pipeline (needs event schema from 5)
  Prompt 10 — Tournament Matchmaking Service (needs contract from 3, backend from 9)
  Prompt 11 — Web/PWA Checkout (needs auth from 4, contract ABI from 1, subgraph from 5)
  Prompt 13 — KYC/AML & Spending Guardrails (needs backend from 9)

Phase 3 — Audit & GTM (gate on Phase 2 completion)
  Prompt 12 — Audit Prep Package (all contracts must be final — 1, 2, 3)
  Prompt 16 — Launch Messaging & Press Kit (refine store copy from 15)

Phase 4 — Mainnet Deployment (gate on external audit completion from Prompt 12)
  Deploy contracts → capture addresses → update Prompt 5 subgraph manifest
  → update Prompt 6 Mirror pipeline → update Prompt 10 scheduler config
```

> **Critical path gate:** No contract may be deployed to mainnet before the third-party audit (Prompt 12) is complete and findings remediated. This is non-negotiable given real-money flows.
