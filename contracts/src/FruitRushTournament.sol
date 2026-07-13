// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*──────────────────────────────────────────────────────────────────────────────
  FruitRushTournament.sol
  ───────────────────────
  Tournament escrow and automated payout contract for Fruit Rush on Celo.

  Tournament lifecycle
  ────────────────────
  1. PENDING   — created by owner, not yet open for entries.
  2. OPEN      — startTime reached, players can enter.
  3. CLOSED    — endTime reached, no new entries; awaiting finalization.
  4. FINALIZED — operator submits ranked winners; prizes + rake distributed.
  5. REFUNDED  — owner cancels before finalization; all entrants refunded.

  Payout math (documented per requirement)
  ─────────────────────────────────────────
  Let P = totalPool = entryFee * numberOfEntrants.

  prizeSharesBps[] encodes the % of P each ranked winner receives in basis
  points (1 bps = 0.01%).  The array must sum to ≤ 8 500 bps (85 %), leaving
  ≥ 1 500 bps (15 %) as house rake sent to treasury.

  winner[i] receives:  P * prizeSharesBps[i] / 10_000

  rake = P - sum(all winner payouts)   ← residual; always ≥ 15 % of P
        (rounding dust also flows to rake, never to a winner)

  Example — 3-player tournament, $5 entry, prize split [5000, 2500, 1000]:
    totalPool = $15
    1st place: $15 * 5000/10000 = $7.50
    2nd place: $15 * 2500/10000 = $3.75
    3rd place: $15 * 1000/10000 = $1.50
    rake:      $15 - $12.75     = $2.25  (15%)

  Assumptions
  ───────────
  • cUSD ERC-20 address is a constructor parameter (immutable) — no hardcoded
    mainnet address.  On Celo mainnet use
    0x765DE816845861e75A25fCA122bb6898B8B1282a; on Alfajores
    0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1.
  • Upgradeable via UUPS (real money flows here; post-audit patches possible).
  • ReentrancyGuard from OZ v5 uses StorageSlot internally — safe with UUPS.
  • Winners list from finalize() is trusted (signed off-chain by operator);
    no on-chain randomness required.
  • Celo supports EIP-1153 transient storage but we use the stable
    storage-slot variant of ReentrancyGuard for maximum compatibility.
──────────────────────────────────────────────────────────────────────────────*/

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title  FruitRushTournament
/// @author Fruit Rush team
/// @notice Tournament escrow and automated payout contract.
///         Players enter by paying cUSD; a trusted operator finalizes results
///         and the contract distributes prizes + rake automatically.
/// @dev    UUPS-upgradeable.  ReentrancyGuard uses OZ v5 StorageSlot pattern
///         and is safe with the proxy storage layout.
/// @custom:oz-upgrades-unsafe-allow constructor
contract FruitRushTournament is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    //  ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Can create tournaments and perform emergency refunds.
    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");
    /// @notice Can finalize tournaments (submit ranked winners).
    bytes32 public constant FINALIZER_ROLE = keccak256("FINALIZER_ROLE");
    /// @notice Can authorize UUPS upgrades.
    bytes32 public constant UPGRADER_ROLE  = keccak256("UPGRADER_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    //  CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public constant BPS_DENOMINATOR    = 10_000;
    /// @notice Maximum total prize share — 8 500 bps (85 %). Guarantees ≥ 15 % rake.
    uint256 public constant MAX_PRIZE_SHARE_BPS = 8_500;

    // ═══════════════════════════════════════════════════════════════════════════
    //  TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    enum TournamentStatus { Pending, Open, Closed, Finalized, Refunded }

    struct Tournament {
        uint256  entryFee;          // cUSD entry fee per player (18-dec wei)
        uint256  startTime;         // Unix timestamp — entries open
        uint256  endTime;           // Unix timestamp — entries close
        uint256  totalPool;         // Accumulated cUSD (entryFee * entrants)
        uint256[] prizeSharesBps;   // Basis-point share per ranked place
        address[] entrants;         // All players who entered
        TournamentStatus status;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice cUSD ERC-20 token (immutable after proxy initialization).
    IERC20 public cUSD;

    /// @notice Treasury address that receives house rake.
    address public treasury;

    /// @dev tournamentId => Tournament
    mapping(uint256 => Tournament) private _tournaments;

    /// @dev tournamentId => player => hasEntered
    mapping(uint256 => mapping(address => bool)) private _hasEntered;

    // ═══════════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a new tournament is registered.
    event TournamentCreated(
        uint256 indexed tournamentId,
        uint256 entryFee,
        uint256 startTime,
        uint256 endTime,
        uint256[] prizeSharesBps
    );

    /// @notice Emitted when a player successfully enters a tournament.
    event PlayerEntered(
        uint256 indexed tournamentId,
        address indexed player,
        uint256 totalEntrants
    );

    /// @notice Emitted when a tournament is finalized and prizes distributed.
    event TournamentFinalized(
        uint256 indexed tournamentId,
        address[] winners,
        uint256[] payouts,
        uint256 rake
    );

    /// @notice Emitted when a tournament is cancelled and all entrants refunded.
    event TournamentRefunded(
        uint256 indexed tournamentId,
        uint256 totalRefunded,
        uint256 entrantCount
    );

    /// @notice Emitted when treasury address is updated.
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ═══════════════════════════════════════════════════════════════════════════
    //  ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error TournamentAlreadyExists(uint256 tournamentId);
    error TournamentNotFound(uint256 tournamentId);
    error InvalidTimeRange(uint256 startTime, uint256 endTime);
    error InvalidPrizeShares(uint256 totalBps, uint256 maxBps);
    error EmptyPrizeShares();
    error TournamentNotOpen(uint256 tournamentId, TournamentStatus status);
    error EntryPeriodEnded(uint256 tournamentId, uint256 endTime);
    error EntryPeriodNotStarted(uint256 tournamentId, uint256 startTime);
    error AlreadyEntered(uint256 tournamentId, address player);
    error TournamentNotClosed(uint256 tournamentId, TournamentStatus status);
    error TooManyWinners(uint256 winners, uint256 prizeSlots);
    error TournamentNotFinalizable(uint256 tournamentId, TournamentStatus status);
    error ZeroAddress();
    error ZeroEntryFee();

    // ═══════════════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR — disables initializers on implementation
    // ═══════════════════════════════════════════════════════════════════════════

    constructor() {
        _disableInitializers();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  INITIALIZER
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Initialize the proxy.
    /// @param cUSD_       cUSD ERC-20 address.
    /// @param admin_      Address receiving DEFAULT_ADMIN_ROLE (multisig).
    /// @param operator_   Address receiving OPERATOR_ROLE (backend).
    /// @param finalizer_  Address receiving FINALIZER_ROLE (backend).
    /// @param treasury_   House rake destination.
    function initialize(
        address cUSD_,
        address admin_,
        address operator_,
        address finalizer_,
        address treasury_
    ) external initializer {
        if (cUSD_      == address(0)) revert ZeroAddress();
        if (admin_     == address(0)) revert ZeroAddress();
        if (operator_  == address(0)) revert ZeroAddress();
        if (finalizer_ == address(0)) revert ZeroAddress();
        if (treasury_  == address(0)) revert ZeroAddress();

        __AccessControl_init();
        __UUPSUpgradeable_init();

        cUSD     = IERC20(cUSD_);
        treasury = treasury_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE,      operator_);
        _grantRole(FINALIZER_ROLE,     finalizer_);
        _grantRole(UPGRADER_ROLE,      admin_);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  OPERATOR — TOURNAMENT LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create a new tournament.
    ///
    /// @dev    `prizeSharesBps` encodes the percentage of the total prize pool
    ///         awarded to each ranked finisher in basis points (10000 = 100%).
    ///         The array must sum to ≤ 8500 bps (85%), guaranteeing ≥ 15% rake.
    ///
    ///         Example: [5000, 2500, 1000] → 1st=50%, 2nd=25%, 3rd=10%, rake=15%.
    ///
    /// @param tournamentId   Unique ID (chosen by backend, e.g. sequential uint).
    /// @param entryFee       cUSD entry fee in wei (e.g. 5e18 = $5).
    /// @param startTime      Unix timestamp when entries open.
    /// @param endTime        Unix timestamp when entries close.
    /// @param prizeSharesBps Basis-point prize shares for places 1, 2, 3, …
    function createTournament(
        uint256   tournamentId,
        uint256   entryFee,
        uint256   startTime,
        uint256   endTime,
        uint256[] calldata prizeSharesBps
    ) external onlyRole(OPERATOR_ROLE) {
        if (_tournaments[tournamentId].endTime != 0)
            revert TournamentAlreadyExists(tournamentId);
        if (startTime >= endTime)
            revert InvalidTimeRange(startTime, endTime);
        if (entryFee == 0)
            revert ZeroEntryFee();
        if (prizeSharesBps.length == 0)
            revert EmptyPrizeShares();

        // Validate prize share sum
        uint256 totalBps;
        for (uint256 i; i < prizeSharesBps.length; ++i) {
            totalBps += prizeSharesBps[i];
        }
        if (totalBps > MAX_PRIZE_SHARE_BPS)
            revert InvalidPrizeShares(totalBps, MAX_PRIZE_SHARE_BPS);

        Tournament storage t = _tournaments[tournamentId];
        t.entryFee      = entryFee;
        t.startTime     = startTime;
        t.endTime       = endTime;
        t.prizeSharesBps = prizeSharesBps;
        t.status        = TournamentStatus.Pending;

        emit TournamentCreated(tournamentId, entryFee, startTime, endTime, prizeSharesBps);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PLAYER — ENTER
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Enter a tournament by paying the entry fee.
    ///
    /// @dev    The caller must have pre-approved this contract for at least
    ///         `entryFee` cUSD.  Entries are rejected after `endTime`.
    ///         Each address may enter at most once per tournament.
    ///
    /// @param tournamentId The tournament to enter.
    function enter(uint256 tournamentId) external nonReentrant {
        Tournament storage t = _getTournament(tournamentId);

        // Allow entry during Pending (before startTime window opens in UI) or
        // Open status — either way we enforce the time window below.
        if (t.status == TournamentStatus.Finalized ||
            t.status == TournamentStatus.Refunded) {
            revert TournamentNotOpen(tournamentId, t.status);
        }

        if (block.timestamp < t.startTime)
            revert EntryPeriodNotStarted(tournamentId, t.startTime);
        if (block.timestamp > t.endTime)
            revert EntryPeriodEnded(tournamentId, t.endTime);

        if (_hasEntered[tournamentId][msg.sender])
            revert AlreadyEntered(tournamentId, msg.sender);

        // Mark entered before external call (CEI pattern)
        _hasEntered[tournamentId][msg.sender] = true;
        t.entrants.push(msg.sender);
        t.totalPool += t.entryFee;

        // Update status to Open on first entry
        if (t.status == TournamentStatus.Pending) {
            t.status = TournamentStatus.Open;
        }

        // Pull cUSD from player
        cUSD.safeTransferFrom(msg.sender, address(this), t.entryFee);

        emit PlayerEntered(tournamentId, msg.sender, t.entrants.length);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  FINALIZER — DISTRIBUTE PRIZES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Finalize a tournament after its end time, distributing prizes.
    ///
    /// @dev    Payout math:
    ///           winner[i] receives: totalPool * prizeSharesBps[i] / 10_000
    ///           rake = totalPool - sum(all winner payouts)
    ///
    ///         `rankedWinners` length must be ≤ prizeSharesBps.length.
    ///         If fewer winners are submitted than prize slots (e.g. only 2
    ///         players in a 3-prize tournament), unawarded shares flow to rake.
    ///
    ///         Can only be called after endTime.  Status must be Open or Pending
    ///         (Pending = no entries, totalPool = 0; rake = 0, nothing sent).
    ///
    /// @param tournamentId  The tournament to finalize.
    /// @param rankedWinners Ordered list of winner addresses (1st place first).
    function finalize(
        uint256   tournamentId,
        address[] calldata rankedWinners
    ) external onlyRole(FINALIZER_ROLE) nonReentrant {
        Tournament storage t = _getTournament(tournamentId);

        if (t.status == TournamentStatus.Finalized ||
            t.status == TournamentStatus.Refunded) {
            revert TournamentNotFinalizable(tournamentId, t.status);
        }

        if (block.timestamp <= t.endTime)
            revert TournamentNotClosed(tournamentId, t.status);

        if (rankedWinners.length > t.prizeSharesBps.length)
            revert TooManyWinners(rankedWinners.length, t.prizeSharesBps.length);

        // Mark finalized before any transfers (CEI)
        t.status = TournamentStatus.Finalized;

        uint256 pool = t.totalPool;
        uint256 totalPaid;
        uint256[] memory payouts = new uint256[](rankedWinners.length);

        // Distribute to each ranked winner
        for (uint256 i; i < rankedWinners.length; ++i) {
            uint256 payout = (pool * t.prizeSharesBps[i]) / BPS_DENOMINATOR;
            payouts[i] = payout;
            totalPaid += payout;
            if (payout > 0 && rankedWinners[i] != address(0)) {
                cUSD.safeTransfer(rankedWinners[i], payout);
            }
        }

        // Residual = rake (≥ 15% of pool, plus any rounding dust)
        uint256 rake = pool - totalPaid;
        if (rake > 0) {
            cUSD.safeTransfer(treasury, rake);
        }

        emit TournamentFinalized(tournamentId, rankedWinners, payouts, rake);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  OPERATOR — EMERGENCY REFUND
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Cancel a tournament and refund all entrants.
    ///
    /// @dev    Can be called at any time before finalization.
    ///         After calling, tournament status is set to Refunded and no
    ///         further entries or finalization are possible.
    ///         Gas note: loops over all entrants — keep tournament size
    ///         reasonable (≤ ~500 players per tx; split into batches for large
    ///         events via refundBatch if needed).
    ///
    /// @param tournamentId The tournament to cancel and refund.
    function refund(uint256 tournamentId)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        Tournament storage t = _getTournament(tournamentId);

        if (t.status == TournamentStatus.Finalized)
            revert TournamentNotFinalizable(tournamentId, t.status);
        if (t.status == TournamentStatus.Refunded)
            revert TournamentNotFinalizable(tournamentId, t.status);

        uint256 count = t.entrants.length;
        uint256 fee   = t.entryFee;

        // Mark refunded before any transfers (CEI)
        t.status = TournamentStatus.Refunded;

        for (uint256 i; i < count; ++i) {
            cUSD.safeTransfer(t.entrants[i], fee);
        }

        emit TournamentRefunded(tournamentId, fee * count, count);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  ADMIN — CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Update the treasury address.
    /// @param newTreasury New destination for house rake.
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  VIEWS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Return the core tournament details.
    /// @param tournamentId The tournament to query.
    function getTournament(uint256 tournamentId)
        external
        view
        returns (
            uint256  entryFee,
            uint256  startTime,
            uint256  endTime,
            uint256  totalPool,
            uint256  entrantCount,
            TournamentStatus status,
            uint256[] memory prizeSharesBps
        )
    {
        Tournament storage t = _tournaments[tournamentId];
        entryFee      = t.entryFee;
        startTime     = t.startTime;
        endTime       = t.endTime;
        totalPool     = t.totalPool;
        entrantCount  = t.entrants.length;
        status        = t.status;
        prizeSharesBps = t.prizeSharesBps;
    }

    /// @notice Check whether a specific player has entered a tournament.
    /// @param tournamentId Tournament ID.
    /// @param player       Player address to query.
    /// @return entered     True if the player has entered.
    function hasEntered(uint256 tournamentId, address player)
        external
        view
        returns (bool entered)
    {
        entered = _hasEntered[tournamentId][player];
    }

    /// @notice Return the list of entrant addresses for a tournament.
    /// @param tournamentId Tournament ID.
    function getEntrants(uint256 tournamentId)
        external
        view
        returns (address[] memory)
    {
        return _tournaments[tournamentId].entrants;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Revert if tournament doesn't exist (endTime == 0 is the sentinel).
    function _getTournament(uint256 tournamentId)
        internal
        view
        returns (Tournament storage t)
    {
        t = _tournaments[tournamentId];
        if (t.endTime == 0) revert TournamentNotFound(tournamentId);
    }

    /// @dev UUPS guard — only UPGRADER_ROLE may authorize an upgrade.
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    /// @dev OZ v5 UUPSUpgradeable has no __init function — omitted intentionally.
    function __UUPSUpgradeable_init() internal onlyInitializing {}

    // ═══════════════════════════════════════════════════════════════════════════
    //  ERC-165
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc AccessControlUpgradeable
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
