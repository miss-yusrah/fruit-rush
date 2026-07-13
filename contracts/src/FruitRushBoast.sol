// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*──────────────────────────────────────────────────────────────────────────────
  FruitRushBoast.sol
  ──────────────────
  On-chain score-attestation contract for Fruit Rush (Celo).

  Players pay a small cUSD fee to mint an immutable, timestamped attestation
  proving a high score or perfect-combo run.  The game backend signs off every
  legitimate score before the contract will accept it, preventing self-minting
  of fake results.

  Design decisions / assumptions
  ───────────────────────────────
  • NON-UPGRADEABLE — simpler audit surface.  If a critical bug is found, a new
    contract is deployed and the frontend is pointed at it.  Old attestations
    remain valid and readable on the old address.
  • ECDSA signature scheme: the backend signs
      keccak256(abi.encodePacked(player, score, gameMode, nonce))
    wrapped in an Ethereum signed-message prefix before signing with eth_sign /
    personal_sign.  The contract re-derives the same digest and recovers the
    signer — if it matches trustedSigner the attestation is accepted.
  • Payment token: cUSD (ERC-20).  Address is set at deploy time and is
    immutable thereafter.  On Celo mainnet this is
    0x765DE816845861e75A25fCA122bb6898B8B1282a.
  • OpenZeppelin version: 5.6.1 (non-upgradeable, via openzeppelin-contracts).
──────────────────────────────────────────────────────────────────────────────*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title  FruitRushBoast
/// @author Fruit Rush team
/// @notice Immutable, timestamped on-chain score attestations for Fruit Rush.
///         Players pay a cUSD fee; the contract verifies a backend ECDSA
///         signature before recording the score.
/// @dev    Non-upgradeable by design.  Deployed on Celo.
contract FruitRushBoast is Ownable {
    using ECDSA       for bytes32;
    using MessageHashUtils for bytes32;
    using SafeERC20   for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    //  TYPES
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice An on-chain attestation record.
    struct Attestation {
        address player;            // Wallet that paid and whose score is attested
        uint256 score;             // Raw game score
        string  gameMode;          // e.g. "classic", "zen", "arcade"
        bytes32 serverSignatureHash; // keccak256 of the raw 65-byte ECDSA sig
        uint256 timestamp;         // block.timestamp at time of minting
        uint256 boastId;           // Sequential ID (1-based)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The cUSD ERC-20 token used for payment (immutable after deploy).
    IERC20 public immutable cUSD;

    /// @notice Fee in cUSD (18-decimal wei) required per attestation.
    ///         Settable by owner.  Default: 0.99 cUSD.
    uint256 public boastFee;

    /// @notice Backend address whose ECDSA signatures authorise attestations.
    ///         Settable by owner.
    address public trustedSigner;

    /// @notice Treasury address that receives withdrawn fees.
    ///         Settable by owner.
    address public treasury;

    /// @notice Total number of attestations minted (also the last boastId).
    uint256 public totalBoasts;

    /// @dev boastId => Attestation struct
    mapping(uint256 => Attestation) private _attestations;

    /// @dev player => nonce => used (replay protection)
    mapping(address => mapping(uint256 => bool)) private _usedNonces;

    // ═══════════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a new boast attestation is minted.
    event BoastMinted(
        uint256 indexed boastId,
        address indexed player,
        uint256 score,
        string  gameMode,
        uint256 timestamp
    );

    /// @notice Emitted when the owner updates the boast fee.
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    /// @notice Emitted when the trusted signer address is changed.
    event TrustedSignerUpdated(address indexed oldSigner, address indexed newSigner);

    /// @notice Emitted when the treasury address is changed.
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Emitted on fee withdrawal.
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════════
    //  ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error InvalidSignature();
    error NonceAlreadyUsed(address player, uint256 nonce);
    error InsufficientFee(uint256 required, uint256 provided);
    error ZeroAddress();
    error ZeroFee();
    error NothingToWithdraw();

    // ═══════════════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy the contract.
    /// @param cUSD_         cUSD ERC-20 address (Celo mainnet:
    ///                      0x765DE816845861e75A25fCA122bb6898B8B1282a).
    /// @param trustedSigner_ Backend hot-wallet that signs score attestations.
    /// @param treasury_      Initial treasury address for fee withdrawals.
    /// @param initialFee_    Initial fee in cUSD wei (e.g. 0.99e18 = $0.99).
    constructor(
        address cUSD_,
        address trustedSigner_,
        address treasury_,
        uint256 initialFee_
    ) Ownable(msg.sender) {
        if (cUSD_          == address(0)) revert ZeroAddress();
        if (trustedSigner_ == address(0)) revert ZeroAddress();
        if (treasury_      == address(0)) revert ZeroAddress();
        if (initialFee_    == 0)          revert ZeroFee();

        cUSD          = IERC20(cUSD_);
        trustedSigner = trustedSigner_;
        treasury      = treasury_;
        boastFee      = initialFee_;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  CORE — MINT ATTESTATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mint an on-chain boast attestation.
    ///
    /// @dev    Flow:
    ///         1. Caller must have approved this contract for at least `boastFee`
    ///            cUSD before calling.
    ///         2. The backend signs `keccak256(abi.encodePacked(player, score,
    ///            gameMode, nonce))` using eth_sign (which prepends the
    ///            Ethereum signed-message prefix before hashing).
    ///         3. The recovered signer must match `trustedSigner`.
    ///         4. `(player, nonce)` is marked used — replay protection.
    ///         5. cUSD is pulled from the caller and held in this contract.
    ///         6. Attestation is stored and `BoastMinted` emitted.
    ///
    /// @param player    The player wallet being attested (may differ from
    ///                  msg.sender if a relayer is used, but signature commits
    ///                  to this address so it cannot be spoofed).
    /// @param score     Raw score value from the game session.
    /// @param gameMode  Game-mode string (e.g. "classic").
    /// @param nonce     Per-player unique nonce issued by the backend.
    /// @param signature 65-byte ECDSA signature from the trusted backend signer.
    /// @return boastId  The newly assigned attestation ID.
    function mintBoast(
        address        player,
        uint256        score,
        string calldata gameMode,
        uint256        nonce,
        bytes calldata signature
    ) external returns (uint256 boastId) {
        // ── 1. Replay protection ──────────────────────────────────────────────
        if (_usedNonces[player][nonce]) revert NonceAlreadyUsed(player, nonce);

        // ── 2. Signature verification ─────────────────────────────────────────
        bytes32 msgHash = keccak256(abi.encodePacked(player, score, gameMode, nonce));
        bytes32 ethHash = msgHash.toEthSignedMessageHash();
        address recovered = ethHash.recover(signature);
        if (recovered != trustedSigner) revert InvalidSignature();

        // ── 3. Fee payment ────────────────────────────────────────────────────
        uint256 fee = boastFee;
        // Pull cUSD from caller; reverts if allowance/balance insufficient
        cUSD.safeTransferFrom(msg.sender, address(this), fee);

        // ── 4. Mark nonce used ────────────────────────────────────────────────
        _usedNonces[player][nonce] = true;

        // ── 5. Store attestation ──────────────────────────────────────────────
        boastId = ++totalBoasts;

        _attestations[boastId] = Attestation({
            player:              player,
            score:               score,
            gameMode:            gameMode,
            serverSignatureHash: keccak256(signature),
            timestamp:           block.timestamp,
            boastId:             boastId
        });

        emit BoastMinted(boastId, player, score, gameMode, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  VIEWS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Fetch the full attestation record for a given boastId.
    /// @param boastId_ The attestation ID to query (1-based).
    /// @return attest The Attestation struct.
    function getAttestation(uint256 boastId_)
        external
        view
        returns (Attestation memory attest)
    {
        attest = _attestations[boastId_];
    }

    /// @notice Check whether a (player, nonce) pair has already been used.
    /// @param player The player address.
    /// @param nonce  The nonce to check.
    /// @return used  True if the pair has been consumed.
    function isNonceUsed(address player, uint256 nonce)
        external
        view
        returns (bool used)
    {
        used = _usedNonces[player][nonce];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  OWNER — CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Update the boast fee.  Must be > 0.
    /// @param newFee New fee in cUSD wei.
    function setBoastFee(uint256 newFee) external onlyOwner {
        if (newFee == 0) revert ZeroFee();
        emit FeeUpdated(boastFee, newFee);
        boastFee = newFee;
    }

    /// @notice Update the trusted backend signer address.
    /// @param newSigner New signer address.  Must be non-zero.
    function setTrustedSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit TrustedSignerUpdated(trustedSigner, newSigner);
        trustedSigner = newSigner;
    }

    /// @notice Update the treasury withdrawal address.
    /// @param newTreasury New treasury address.  Must be non-zero.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  OWNER — FEE WITHDRAWAL
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Withdraw all accumulated cUSD fees to the treasury address.
    /// @dev    Only the owner may call this.  Reverts if there is nothing to
    ///         withdraw so you don't pay gas for a no-op.
    function withdrawFees() external onlyOwner {
        uint256 balance = cUSD.balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        address dest = treasury;
        cUSD.safeTransfer(dest, balance);
        emit FeesWithdrawn(dest, balance);
    }

    /// @notice Withdraw a specific amount of cUSD fees to the treasury.
    /// @param amount Amount in cUSD wei to withdraw.
    function withdrawFees(uint256 amount) external onlyOwner {
        if (amount == 0) revert NothingToWithdraw();
        address dest = treasury;
        cUSD.safeTransfer(dest, amount);
        emit FeesWithdrawn(dest, amount);
    }
}
