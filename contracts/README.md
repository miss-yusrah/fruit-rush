# FruitRush Contracts

Foundry project containing the ERC-1155 cosmetics smart contract for **Fruit Rush** — a mobile arcade game deployed on **Celo** (EVM-compatible L2).

---

## Assumptions & Pinned Versions

| Component | Version | Notes |
|-----------|---------|-------|
| Solidity | `^0.8.24` | Custom errors, no `using for` ABI-breaking change |
| OpenZeppelin Contracts Upgradeable | **5.6.1** | Latest audited release at time of writing |
| Foundry (forge) | latest stable | `forge install` used for dependency management |
| Proxy pattern | **ERC-1967 / UUPS** | `UUPSUpgradeable` from OZ v5 |

> **Why UUPS over Transparent Proxy?**  
> UUPS stores upgrade logic in the implementation, keeping the proxy contract minimal and cheaper to deploy. The trade-off is that a buggy implementation that removes `_authorizeUpgrade` could brick upgradeability — mitigated here by gating upgrades on `UPGRADER_ROLE` and the OpenZeppelin `UUPSUpgradeable` base.

---

## Contract Architecture

```
contracts/
├── src/
│   └── FruitRushCosmetics.sol   <- ERC-1155 + ERC-2981 + UUPS + AccessControl
├── test/
│   └── FruitRushCosmetics.t.sol <- Foundry test suite (40+ tests)
├── script/
│   └── Deploy.s.sol              <- Deployment + verification script
├── lib/
│   ├── forge-std/
│   └── openzeppelin-contracts-upgradeable/
├── foundry.toml
├── remappings.txt
└── README.md                     <- (this file)
```

### Inheritance Chain

```
FruitRushCosmetics
  ├── Initializable
  ├── ERC1155Upgradeable
  ├── ERC1155SupplyUpgradeable    (tracks totalSupply per token)
  ├── ERC1155URIStorageUpgradeable (per-token URI overrides)
  ├── ERC2981Upgradeable          (royaltyInfo - 5%)
  ├── AccessControlUpgradeable    (MINTER_ROLE, UPGRADER_ROLE)
  └── UUPSUpgradeable
```

---

## Token-ID Schema

Token IDs are **256-bit integers** with three packed fields:

```
 [255 ------- 248][247 ------- 240][239 ----------------------------- 0]
  Category (8 bit)  Rarity (8 bit)     Serial (240 bit)
```

### Category Values

| Value | Category |
|-------|----------|
| `1` | Knife Skin |
| `2` | Fruit Skin |
| `3` | Trail Effect |
| `4` | Background |

### Rarity Values

| Value | Rarity | Default Supply Cap | URI Path Segment |
|-------|--------|--------------------|-----------------|
| `1` | Common | 5 000 | `common/` |
| `2` | Rare | 1 000 | `rare/` |
| `3` | Epic | 250 | `epic/` |
| `4` | Legendary | 50 | `legendary/` |

### Worked Examples

| Token ID (hex) | Breakdown | Meaning |
|----------------|-----------|---------|
| `0x010100...0001` | Cat=1 Rar=1 Serial=1 | Knife Skin - Common #1 |
| `0x010200...0001` | Cat=1 Rar=2 Serial=1 | Knife Skin - Rare #1 |
| `0x020300...0001` | Cat=2 Rar=3 Serial=1 | Fruit Skin - Epic #1 |
| `0x040400...0001` | Cat=4 Rar=4 Serial=1 | Background - Legendary #1 |

### Helper Functions

```solidity
// Encode from parts
uint256 id = cosmetics.encodeTokenId(category, rarity, serial);

// Decode back
(uint256 category, uint256 rarity, uint256 serial) = cosmetics.decodeTokenId(id);
```

---

## Metadata URI Convention

Each token's metadata URI is set individually when the item type is registered via `addItemType`. The URI should point to a JSON file conforming to the [ERC-1155 Metadata JSON Schema](https://eips.ethereum.org/EIPS/eip-1155#erc-1155-metadata-uri-json-schema).

**Recommended naming structure:**

```
{BASE_URI}/{category}/{rarity}/{serial}/metadata.json

e.g. https://meta.fruitrush.io/knife/legendary/1/metadata.json
```

**Rarity is encoded in the `properties` field of the metadata JSON:**

```json
{
  "name": "Dragon Blade",
  "description": "A legendary knife skin wreathed in flame.",
  "image": "ipfs://Qm.../image.png",
  "animation_url": "ipfs://Qm.../animation.mp4",
  "properties": {
    "category": "KnifeSkin",
    "rarity": "Legendary",
    "serial": 1
  }
}
```

---

## Roles

| Role | `bytes32` | Holder(s) | Capabilities |
|------|-----------|-----------|--------------|
| `DEFAULT_ADMIN_ROLE` | `0x00` | Owner multisig | Grant/revoke all roles, `addItemType`, `setRoyaltyReceiver` |
| `MINTER_ROLE` | `keccak256("MINTER_ROLE")` | Game backend hot wallet + Shop contract | `mint`, `mintBatch` |
| `UPGRADER_ROLE` | `keccak256("UPGRADER_ROLE")` | Owner multisig | `upgradeToAndCall` |

> **Security Note:** The game backend hot wallet should hold `MINTER_ROLE` only - it must never hold `DEFAULT_ADMIN_ROLE` or `UPGRADER_ROLE`. Rotate the hot wallet key regularly and revoke old minter addresses promptly.

### Role Addresses (to be filled post-deployment)

| Role | Address |
|------|---------|
| `DEFAULT_ADMIN_ROLE` | `TBD - Gnosis Safe multisig` |
| `MINTER_ROLE` (backend) | `TBD` |
| `MINTER_ROLE` (shop) | `TBD` |
| `UPGRADER_ROLE` | `TBD - same as admin` |
| Royalty Receiver | `TBD - treasury wallet` |

---

## Royalties

- **Standard:** ERC-2981
- **Rate:** Exactly **5%** (500 basis points of `salePrice`)
- **Receiver:** Set at deploy time; updatable by `DEFAULT_ADMIN_ROLE` via `setRoyaltyReceiver`

```solidity
(address receiver, uint256 amount) = cosmetics.royaltyInfo(tokenId, salePrice);
// amount == salePrice * 500 / 10_000
```

Marketplaces that honour ERC-2981 (OpenSea, Rarible, etc.) will automatically route royalties.

---

## Building & Testing

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Dependencies already in `lib/` - re-install with:

```bash
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-git
```

### Run Tests

```bash
# From contracts/ directory
forge test -vv
```

Expected output: all tests **PASS**.

```bash
# With gas report
forge test -vv --gas-report

# Run a specific test
forge test -vv --match-test test_royalty_fivePercent
```

### Build

```bash
forge build
```

---

## Deployment

### 1. Copy and fill `.env`

```bash
cp .env.example .env
# Edit .env with real values
```

### 2. Deploy to Alfajores testnet

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url celo_testnet \
  --broadcast \
  --verify \
  --etherscan-api-key $CELOSCAN_API_KEY \
  -vvv
```

### 3. Deploy to Celo Mainnet

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url celo_mainnet \
  --broadcast \
  --verify \
  --etherscan-api-key $CELOSCAN_API_KEY \
  -vvv
```

Deployed addresses are logged to stdout and recorded in `broadcast/`.

---

## Upgrading the Contract

1. Deploy a new implementation contract (do NOT call `initialize` on it).
2. Call `cosmetics.upgradeToAndCall(newImplAddress, "")` from an `UPGRADER_ROLE` address.
3. Storage layout **must** be preserved - new variables must be appended, never inserted.
4. Use `forge-storage-layout-check` or OZ's upgrade safety checker before upgrading on mainnet.

```bash
# Check storage layout
forge inspect FruitRushCosmetics storage-layout
```

---

## Security Considerations

- The implementation constructor calls `_disableInitializers()` - prevents direct initialisation of the logic contract.
- The `MINTER_ROLE` is separate from `DEFAULT_ADMIN_ROLE` - a compromised backend wallet cannot upgrade or register new item types.
- Supply caps are enforced on-chain - the backend cannot over-mint.
- Royalty fraction is hardcoded at 500 bps (5%) in both `initialize` and `setRoyaltyReceiver` - cannot be silently changed.
- No randomness, no loot boxes - deterministic minting only.

---

## Celo-Specific Notes

- Celo is EVM-equivalent; no Solidity changes are required.
- Gas is paid in CELO (or cUSD via fee abstraction) - set `--gas-price` appropriately.
- Celoscan verification uses the `[etherscan.celo_mainnet]` config in `foundry.toml`.
- Celo RPC: `https://forno.celo.org` (mainnet) / `https://alfajores-forno.celo-testnet.org` (testnet).
