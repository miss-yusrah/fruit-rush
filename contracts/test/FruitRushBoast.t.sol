// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FruitRushBoast.sol";

/// @title  FruitRushBoastTest
/// @notice Foundry test suite for FruitRushBoast.
///
///  Test categories
///  ───────────────
///  1.  Deployment & initialisation
///  2.  mintBoast — valid flow (happy path)
///  3.  mintBoast — invalid signature rejected
///  4.  mintBoast — replay protection (nonce reuse)
///  5.  mintBoast — insufficient fee (underpayment)
///  6.  mintBoast — zero-address player edge case
///  7.  Attestation storage & retrieval
///  8.  Fee withdrawal (full & partial)
///  9.  Owner config updates (fee, signer, treasury)
/// 10.  Access control (non-owner reverts)
/// 11.  isNonceUsed view
contract FruitRushBoastTest is Test {
    using stdStorage for StdStorage;

    // ─── Mock ERC-20 (minimal cUSD stub) ─────────────────────────────────────

    MockERC20 cusd;

    // ─── Actors ───────────────────────────────────────────────────────────────

    // Signer key-pair derived deterministically so we can sign in tests
    uint256 constant SIGNER_PK = 0xA11CE_DEAD_BEEF_1337;
    address signer; // = vm.addr(SIGNER_PK)

    address owner    = makeAddr("owner");
    address player   = makeAddr("player");
    address treasury = makeAddr("treasury");
    address stranger = makeAddr("stranger");

    // ─── System under test ────────────────────────────────────────────────────

    FruitRushBoast boast;

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 constant INITIAL_FEE = 0.99e18; // $0.99 cUSD

    // ─── Setup ────────────────────────────────────────────────────────────────

    function setUp() public {
        signer = vm.addr(SIGNER_PK);

        // Deploy mock cUSD token
        cusd = new MockERC20("Celo Dollar", "cUSD", 18);

        // Deploy Boast contract (owner = this test contract for convenience;
        // owner role is transferred where needed)
        vm.prank(owner);
        boast = new FruitRushBoast(
            address(cusd),
            signer,
            treasury,
            INITIAL_FEE
        );

        // Fund player and approve boast contract
        cusd.mint(player, 100e18);
        vm.prank(player);
        cusd.approve(address(boast), type(uint256).max);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /// @dev Produce a valid backend signature for (player, score, gameMode, nonce).
    function _sign(
        address _player,
        uint256 _score,
        string memory _gameMode,
        uint256 _nonce
    ) internal pure returns (bytes memory sig) {
        bytes32 msgHash = keccak256(abi.encodePacked(_player, _score, _gameMode, _nonce));
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, ethHash);
        sig = abi.encodePacked(r, s, v);
    }

    /// @dev Mint a boast with default values, returns the boastId.
    function _mintDefault(uint256 nonce) internal returns (uint256) {
        bytes memory sig = _sign(player, 9_999, "classic", nonce);
        vm.prank(player);
        return boast.mintBoast(player, 9_999, "classic", nonce, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  1. DEPLOYMENT & INITIALISATION
    // ═══════════════════════════════════════════════════════════════════════════

    function test_init_owner() public view {
        assertEq(boast.owner(), owner);
    }

    function test_init_cusd() public view {
        assertEq(address(boast.cUSD()), address(cusd));
    }

    function test_init_trustedSigner() public view {
        assertEq(boast.trustedSigner(), signer);
    }

    function test_init_treasury() public view {
        assertEq(boast.treasury(), treasury);
    }

    function test_init_boastFee() public view {
        assertEq(boast.boastFee(), INITIAL_FEE);
    }

    function test_init_totalBoastsZero() public view {
        assertEq(boast.totalBoasts(), 0);
    }

    function test_init_zeroAddressCusdReverts() public {
        vm.prank(owner);
        vm.expectRevert(FruitRushBoast.ZeroAddress.selector);
        new FruitRushBoast(address(0), signer, treasury, INITIAL_FEE);
    }

    function test_init_zeroAddressSignerReverts() public {
        vm.prank(owner);
        vm.expectRevert(FruitRushBoast.ZeroAddress.selector);
        new FruitRushBoast(address(cusd), address(0), treasury, INITIAL_FEE);
    }

    function test_init_zeroAddressTreasuryReverts() public {
        vm.prank(owner);
        vm.expectRevert(FruitRushBoast.ZeroAddress.selector);
        new FruitRushBoast(address(cusd), signer, address(0), INITIAL_FEE);
    }

    function test_init_zeroFeeReverts() public {
        vm.prank(owner);
        vm.expectRevert(FruitRushBoast.ZeroFee.selector);
        new FruitRushBoast(address(cusd), signer, treasury, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  2. mintBoast — VALID FLOW
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint_returnsBoastId() public {
        uint256 id = _mintDefault(1);
        assertEq(id, 1);
    }

    function test_mint_incrementsTotalBoasts() public {
        _mintDefault(1);
        assertEq(boast.totalBoasts(), 1);
        _mintDefault(2);
        assertEq(boast.totalBoasts(), 2);
    }

    function test_mint_pullsFeeFromCaller() public {
        uint256 balBefore = cusd.balanceOf(player);
        _mintDefault(1);
        assertEq(cusd.balanceOf(player), balBefore - INITIAL_FEE);
        assertEq(cusd.balanceOf(address(boast)), INITIAL_FEE);
    }

    function test_mint_emitsBoastMinted() public {
        bytes memory sig = _sign(player, 9_999, "classic", 1);
        vm.prank(player);
        vm.expectEmit(true, true, false, true);
        emit FruitRushBoast.BoastMinted(1, player, 9_999, "classic", block.timestamp);
        boast.mintBoast(player, 9_999, "classic", 1, sig);
    }

    function test_mint_marksNonceUsed() public {
        assertFalse(boast.isNonceUsed(player, 1));
        _mintDefault(1);
        assertTrue(boast.isNonceUsed(player, 1));
    }

    function test_mint_differentPlayerSameNonceAllowed() public {
        address player2 = makeAddr("player2");
        cusd.mint(player2, 100e18);
        vm.prank(player2);
        cusd.approve(address(boast), type(uint256).max);

        _mintDefault(1); // player, nonce=1

        bytes memory sig2 = _sign(player2, 5_000, "zen", 1);
        vm.prank(player2);
        uint256 id2 = boast.mintBoast(player2, 5_000, "zen", 1, sig2);
        assertEq(id2, 2);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  3. mintBoast — INVALID SIGNATURE REJECTED
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint_wrongSignerReverts() public {
        // Sign with a random key that is NOT the trustedSigner
        uint256 badKey = 0xBADBADBEEF;
        bytes32 msgHash = keccak256(abi.encodePacked(player, uint256(9_999), "classic", uint256(1)));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badKey, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(player);
        vm.expectRevert(FruitRushBoast.InvalidSignature.selector);
        boast.mintBoast(player, 9_999, "classic", 1, badSig);
    }

    function test_mint_tamperedScoreReverts() public {
        // Sign for score=9999 but submit score=10000
        bytes memory sig = _sign(player, 9_999, "classic", 1);
        vm.prank(player);
        vm.expectRevert(FruitRushBoast.InvalidSignature.selector);
        boast.mintBoast(player, 10_000, "classic", 1, sig);
    }

    function test_mint_tamperedGameModeReverts() public {
        bytes memory sig = _sign(player, 9_999, "classic", 1);
        vm.prank(player);
        vm.expectRevert(FruitRushBoast.InvalidSignature.selector);
        boast.mintBoast(player, 9_999, "arcade", 1, sig);
    }

    function test_mint_tamperedPlayerReverts() public {
        // Sign for `player` but claim `stranger` is the player
        bytes memory sig = _sign(player, 9_999, "classic", 1);
        cusd.mint(stranger, 100e18);
        vm.prank(stranger);
        cusd.approve(address(boast), type(uint256).max);
        vm.expectRevert(FruitRushBoast.InvalidSignature.selector);
        boast.mintBoast(stranger, 9_999, "classic", 1, sig);
    }

    function test_mint_emptySignatureReverts() public {
        vm.prank(player);
        vm.expectRevert(); // ECDSA will revert on bad-length sig
        boast.mintBoast(player, 9_999, "classic", 1, "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  4. mintBoast — REPLAY PROTECTION
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint_sameNonceRevertsOnReplay() public {
        _mintDefault(42);

        bytes memory sig2 = _sign(player, 9_999, "classic", 42);
        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushBoast.NonceAlreadyUsed.selector,
                player,
                42
            )
        );
        boast.mintBoast(player, 9_999, "classic", 42, sig2);
    }

    function test_mint_differentNonceAllowsSecondMint() public {
        _mintDefault(1);
        uint256 id2 = _mintDefault(2);
        assertEq(id2, 2);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  5. mintBoast — FEE UNDERPAYMENT
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint_insufficientAllowanceReverts() public {
        address poorPlayer = makeAddr("poorPlayer");
        cusd.mint(poorPlayer, 100e18);
        vm.prank(poorPlayer);
        // Approve less than the fee
        cusd.approve(address(boast), INITIAL_FEE - 1);

        bytes memory sig = _sign(poorPlayer, 100, "classic", 1);
        vm.prank(poorPlayer);
        vm.expectRevert(); // SafeERC20 reverts on failed transferFrom
        boast.mintBoast(poorPlayer, 100, "classic", 1, sig);
    }

    function test_mint_insufficientBalanceReverts() public {
        address brokePlayer = makeAddr("brokePlayer");
        // Give less than fee — no balance
        cusd.mint(brokePlayer, INITIAL_FEE - 1);
        vm.prank(brokePlayer);
        cusd.approve(address(boast), type(uint256).max);

        bytes memory sig = _sign(brokePlayer, 500, "classic", 1);
        vm.prank(brokePlayer);
        vm.expectRevert(); // SafeERC20 reverts on failed transferFrom
        boast.mintBoast(brokePlayer, 500, "classic", 1, sig);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  7. ATTESTATION STORAGE & RETRIEVAL
    // ═══════════════════════════════════════════════════════════════════════════

    function test_attestation_storedCorrectly() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _sign(player, 12_345, "zen", 7);
        vm.prank(player);
        boast.mintBoast(player, 12_345, "zen", 7, sig);

        FruitRushBoast.Attestation memory a = boast.getAttestation(1);
        assertEq(a.player,    player);
        assertEq(a.score,     12_345);
        assertEq(a.gameMode,  "zen");
        assertEq(a.timestamp, ts);
        assertEq(a.boastId,   1);
        // serverSignatureHash is keccak256 of the raw sig — just check non-zero
        assertTrue(a.serverSignatureHash != bytes32(0));
    }

    function test_attestation_boastIdMonotonicallyIncreases() public {
        uint256 id1 = _mintDefault(1);
        uint256 id2 = _mintDefault(2);
        uint256 id3 = _mintDefault(3);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    function test_attestation_unknownIdReturnsEmpty() public view {
        FruitRushBoast.Attestation memory a = boast.getAttestation(999);
        assertEq(a.player, address(0));
        assertEq(a.score,  0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  8. FEE WITHDRAWAL
    // ═══════════════════════════════════════════════════════════════════════════

    function test_withdraw_fullBalanceToTreasury() public {
        _mintDefault(1);
        _mintDefault(2);
        uint256 contractBal = cusd.balanceOf(address(boast));
        assertEq(contractBal, INITIAL_FEE * 2);

        vm.prank(owner);
        boast.withdrawFees();

        assertEq(cusd.balanceOf(treasury),      INITIAL_FEE * 2);
        assertEq(cusd.balanceOf(address(boast)), 0);
    }

    function test_withdraw_emitsFeesWithdrawn() public {
        _mintDefault(1);
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit FruitRushBoast.FeesWithdrawn(treasury, INITIAL_FEE);
        boast.withdrawFees();
    }

    function test_withdraw_partialAmount() public {
        _mintDefault(1);
        _mintDefault(2);
        uint256 half = INITIAL_FEE;

        vm.prank(owner);
        boast.withdrawFees(half);

        assertEq(cusd.balanceOf(treasury),       half);
        assertEq(cusd.balanceOf(address(boast)), half);
    }

    function test_withdraw_nothingToWithdrawReverts() public {
        vm.prank(owner);
        vm.expectRevert(FruitRushBoast.NothingToWithdraw.selector);
        boast.withdrawFees();
    }

    function test_withdraw_zeroAmountReverts() public {
        _mintDefault(1);
        vm.prank(owner);
        vm.expectRevert(FruitRushBoast.NothingToWithdraw.selector);
        boast.withdrawFees(0);
    }

    function test_withdraw_nonOwnerReverts() public {
        _mintDefault(1);
        vm.prank(stranger);
        vm.expectRevert(); // Ownable
        boast.withdrawFees();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  9. OWNER CONFIG UPDATES
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setBoastFee_updatesAndEmits() public {
        uint256 newFee = 1.99e18;
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit FruitRushBoast.FeeUpdated(INITIAL_FEE, newFee);
        boast.setBoastFee(newFee);
        assertEq(boast.boastFee(), newFee);
    }

    function test_setBoastFee_newFeeAppliedOnNextMint() public {
        uint256 newFee = 1.49e18;
        vm.prank(owner);
        boast.setBoastFee(newFee);

        uint256 balBefore = cusd.balanceOf(player);
        _mintDefault(1);
        assertEq(cusd.balanceOf(player), balBefore - newFee);
    }

    function test_setBoastFee_zeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(FruitRushBoast.ZeroFee.selector);
        boast.setBoastFee(0);
    }

    function test_setTrustedSigner_updatesAndEmits() public {
        address newSigner = makeAddr("newSigner");
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit FruitRushBoast.TrustedSignerUpdated(signer, newSigner);
        boast.setTrustedSigner(newSigner);
        assertEq(boast.trustedSigner(), newSigner);
    }

    function test_setTrustedSigner_zeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(FruitRushBoast.ZeroAddress.selector);
        boast.setTrustedSigner(address(0));
    }

    function test_setTrustedSigner_oldSignatureRejectedAfterRotation() public {
        // Sign with original key
        bytes memory sig = _sign(player, 100, "classic", 99);

        // Rotate to a new signer
        address newSigner = makeAddr("newSigner");
        vm.prank(owner);
        boast.setTrustedSigner(newSigner);

        // Old sig no longer valid
        vm.prank(player);
        vm.expectRevert(FruitRushBoast.InvalidSignature.selector);
        boast.mintBoast(player, 100, "classic", 99, sig);
    }

    function test_setTreasury_updatesAndEmits() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit FruitRushBoast.TreasuryUpdated(treasury, newTreasury);
        boast.setTreasury(newTreasury);
        assertEq(boast.treasury(), newTreasury);
    }

    function test_setTreasury_withdrawGoesToNewAddress() public {
        _mintDefault(1);
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        boast.setTreasury(newTreasury);

        vm.prank(owner);
        boast.withdrawFees();

        assertEq(cusd.balanceOf(newTreasury), INITIAL_FEE);
        assertEq(cusd.balanceOf(treasury),    0);
    }

    function test_setTreasury_zeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(FruitRushBoast.ZeroAddress.selector);
        boast.setTreasury(address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. ACCESS CONTROL (non-owner reverts)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_access_setBoastFeeNonOwnerReverts() public {
        vm.prank(stranger);
        vm.expectRevert();
        boast.setBoastFee(1e18);
    }

    function test_access_setTrustedSignerNonOwnerReverts() public {
        vm.prank(stranger);
        vm.expectRevert();
        boast.setTrustedSigner(stranger);
    }

    function test_access_setTreasuryNonOwnerReverts() public {
        vm.prank(stranger);
        vm.expectRevert();
        boast.setTreasury(stranger);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. isNonceUsed VIEW
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isNonceUsed_falseBeforeMint() public view {
        assertFalse(boast.isNonceUsed(player, 1));
    }

    function test_isNonceUsed_trueAfterMint() public {
        _mintDefault(1);
        assertTrue(boast.isNonceUsed(player, 1));
    }

    function test_isNonceUsed_independentPerPlayer() public {
        _mintDefault(1); // player, nonce=1 used
        // nonce=1 for stranger is still unused
        assertFalse(boast.isNonceUsed(stranger, 1));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FUZZ — signature validity is keyed to exact parameters
    // ═══════════════════════════════════════════════════════════════════════════

    function testFuzz_mint_validSignatureAlwaysSucceeds(
        uint256 score,
        uint256 nonce
    ) public {
        vm.assume(nonce != 0); // nonce=0 is valid but let's keep uniqueness simple
        bytes memory sig = _sign(player, score, "classic", nonce);
        vm.prank(player);
        uint256 id = boast.mintBoast(player, score, "classic", nonce, sig);
        assertGt(id, 0);
    }

    function testFuzz_mint_wrongNonceAlwaysReverts(
        uint256 score,
        uint256 signedNonce,
        uint256 submittedNonce
    ) public {
        vm.assume(signedNonce != submittedNonce);
        bytes memory sig = _sign(player, score, "classic", signedNonce);
        vm.prank(player);
        vm.expectRevert(FruitRushBoast.InvalidSignature.selector);
        boast.mintBoast(player, score, "classic", submittedNonce, sig);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MOCK ERC-20 (minimal cUSD stub for tests)
// ═══════════════════════════════════════════════════════════════════════════════

contract MockERC20 {
    string  public name;
    string  public symbol;
    uint8   public decimals;
    uint256 public totalSupply;

    mapping(address => uint256)                      public balanceOf;
    mapping(address => mapping(address => uint256))  public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint8 _dec) {
        name = _name; symbol = _symbol; decimals = _dec;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply    += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from]           >= amount, "ERC20: insufficient balance");
        require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
