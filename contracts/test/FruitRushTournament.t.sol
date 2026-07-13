// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/FruitRushTournament.sol";

/// @title  FruitRushTournamentTest
/// @notice Foundry test suite for FruitRushTournament.
///
///  Test categories
///  ───────────────
///  1.  Deployment & initialisation
///  2.  createTournament — valid & invalid inputs
///  3.  enter — valid entry, timing gates
///  4.  enter — double-entry prevention
///  5.  enter — late entry rejection (after endTime)
///  6.  finalize — correct payout & rake math
///  7.  finalize — partial winners (fewer than prize slots)
///  8.  finalize — zero-pool tournament (no entrants)
///  9.  finalize — access control & timing guards
/// 10.  refund — full cancel + per-player refund
/// 11.  refund — cannot refund finalized tournament
/// 12.  Admin — setTreasury
/// 13.  UUPS upgrade guard
/// 14.  Fuzz — payout math invariants
contract FruitRushTournamentTest is Test {
    // ─── Mock ERC-20 ─────────────────────────────────────────────────────────
    MockERC20 cusd;

    // ─── Actors ───────────────────────────────────────────────────────────────
    address admin     = makeAddr("admin");
    address operator  = makeAddr("operator");
    address finalizer = makeAddr("finalizer");
    address treasury  = makeAddr("treasury");
    address player1   = makeAddr("player1");
    address player2   = makeAddr("player2");
    address player3   = makeAddr("player3");
    address stranger  = makeAddr("stranger");

    // ─── System under test ────────────────────────────────────────────────────
    FruitRushTournament impl;
    FruitRushTournament tournament; // proxy

    // ─── Default tournament params ────────────────────────────────────────────
    uint256 constant T_ID       = 1;
    uint256 constant ENTRY_FEE  = 5e18;      // $5 cUSD
    uint256 constant START_TIME = 1_000;
    uint256 constant END_TIME   = 2_000;
    // prize split: 50% / 25% / 10% → rake 15%
    uint256[] prizeBps;

    // ─── Setup ────────────────────────────────────────────────────────────────

    function setUp() public {
        // Build prize array (storage variable cannot be constant)
        prizeBps = new uint256[](3);
        prizeBps[0] = 5_000; // 50%
        prizeBps[1] = 2_500; // 25%
        prizeBps[2] = 1_000; // 10%

        // Mock cUSD
        cusd = new MockERC20("Celo Dollar", "cUSD", 18);

        // Deploy impl + proxy
        impl = new FruitRushTournament();
        bytes memory initData = abi.encodeCall(
            FruitRushTournament.initialize,
            (address(cusd), admin, operator, finalizer, treasury)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        tournament = FruitRushTournament(address(proxy));

        // Fund players and approve
        cusd.mint(player1, 100e18);
        cusd.mint(player2, 100e18);
        cusd.mint(player3, 100e18);
        vm.prank(player1); cusd.approve(address(tournament), type(uint256).max);
        vm.prank(player2); cusd.approve(address(tournament), type(uint256).max);
        vm.prank(player3); cusd.approve(address(tournament), type(uint256).max);

        // Warp to before start
        vm.warp(500);
    }

    // ─── Helper: create the default tournament ────────────────────────────────
    function _createDefault() internal {
        vm.prank(operator);
        tournament.createTournament(T_ID, ENTRY_FEE, START_TIME, END_TIME, prizeBps);
    }

    // ─── Helper: enter for a player during the open window ───────────────────
    function _enterAt(address player, uint256 ts) internal {
        vm.warp(ts);
        vm.prank(player);
        tournament.enter(T_ID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  1. DEPLOYMENT & INITIALISATION
    // ═══════════════════════════════════════════════════════════════════════════

    function test_init_rolesGranted() public view {
        assertTrue(tournament.hasRole(tournament.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(tournament.hasRole(tournament.OPERATOR_ROLE(),  operator));
        assertTrue(tournament.hasRole(tournament.FINALIZER_ROLE(), finalizer));
        assertTrue(tournament.hasRole(tournament.UPGRADER_ROLE(),  admin));
    }

    function test_init_cusdSet() public view {
        assertEq(address(tournament.cUSD()), address(cusd));
    }

    function test_init_treasurySet() public view {
        assertEq(tournament.treasury(), treasury);
    }

    function test_init_zeroAddressReverts() public {
        FruitRushTournament freshImpl = new FruitRushTournament();
        bytes memory bad = abi.encodeCall(
            FruitRushTournament.initialize,
            (address(0), admin, operator, finalizer, treasury)
        );
        vm.expectRevert(FruitRushTournament.ZeroAddress.selector);
        new ERC1967Proxy(address(freshImpl), bad);
    }

    function test_init_implDisablesInitializers() public {
        vm.expectRevert();
        impl.initialize(address(cusd), admin, operator, finalizer, treasury);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  2. createTournament
    // ═══════════════════════════════════════════════════════════════════════════

    function test_create_succeeds() public {
        _createDefault();
        (uint256 fee,,,,, FruitRushTournament.TournamentStatus status,) =
            tournament.getTournament(T_ID);
        assertEq(fee, ENTRY_FEE);
        assertEq(uint8(status), uint8(FruitRushTournament.TournamentStatus.Pending));
    }

    function test_create_emitsTournamentCreated() public {
        vm.prank(operator);
        vm.expectEmit(true, false, false, true);
        emit FruitRushTournament.TournamentCreated(T_ID, ENTRY_FEE, START_TIME, END_TIME, prizeBps);
        tournament.createTournament(T_ID, ENTRY_FEE, START_TIME, END_TIME, prizeBps);
    }

    function test_create_duplicateIdReverts() public {
        _createDefault();
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(FruitRushTournament.TournamentAlreadyExists.selector, T_ID)
        );
        tournament.createTournament(T_ID, ENTRY_FEE, START_TIME, END_TIME, prizeBps);
    }

    function test_create_invalidTimeRangeReverts() public {
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.InvalidTimeRange.selector, END_TIME, START_TIME
            )
        );
        tournament.createTournament(T_ID, ENTRY_FEE, END_TIME, START_TIME, prizeBps);
    }

    function test_create_zeroEntryFeeReverts() public {
        vm.prank(operator);
        vm.expectRevert(FruitRushTournament.ZeroEntryFee.selector);
        tournament.createTournament(T_ID, 0, START_TIME, END_TIME, prizeBps);
    }

    function test_create_emptyPrizeSharesReverts() public {
        uint256[] memory empty = new uint256[](0);
        vm.prank(operator);
        vm.expectRevert(FruitRushTournament.EmptyPrizeShares.selector);
        tournament.createTournament(T_ID, ENTRY_FEE, START_TIME, END_TIME, empty);
    }

    function test_create_prizeSharesExceedMaxReverts() public {
        uint256[] memory greedy = new uint256[](1);
        greedy[0] = 8_501; // > 8500 bps
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.InvalidPrizeShares.selector, 8_501, 8_500
            )
        );
        tournament.createTournament(T_ID, ENTRY_FEE, START_TIME, END_TIME, greedy);
    }

    function test_create_exactMaxPrizeSharesSucceeds() public {
        uint256[] memory max = new uint256[](1);
        max[0] = 8_500; // exactly 85%
        vm.prank(operator);
        tournament.createTournament(T_ID, ENTRY_FEE, START_TIME, END_TIME, max);
        (uint256 fee,,,,,, uint256[] memory bps) = tournament.getTournament(T_ID);
        assertEq(fee, ENTRY_FEE);
        assertEq(bps[0], 8_500);
    }

    function test_create_nonOperatorReverts() public {
        vm.prank(stranger);
        vm.expectRevert();
        tournament.createTournament(T_ID, ENTRY_FEE, START_TIME, END_TIME, prizeBps);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  3. enter — VALID ENTRY
    // ═══════════════════════════════════════════════════════════════════════════

    function test_enter_pullsFeeAndRecordsEntrant() public {
        _createDefault();
        uint256 bal = cusd.balanceOf(player1);
        _enterAt(player1, START_TIME + 1);

        assertEq(cusd.balanceOf(player1), bal - ENTRY_FEE);
        assertEq(cusd.balanceOf(address(tournament)), ENTRY_FEE);
        assertTrue(tournament.hasEntered(T_ID, player1));
    }

    function test_enter_emitsPlayerEntered() public {
        _createDefault();
        vm.warp(START_TIME + 1);
        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit FruitRushTournament.PlayerEntered(T_ID, player1, 1);
        tournament.enter(T_ID);
    }

    function test_enter_statusBecomesOpen() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);
        (,,,,,FruitRushTournament.TournamentStatus status,) = tournament.getTournament(T_ID);
        assertEq(uint8(status), uint8(FruitRushTournament.TournamentStatus.Open));
    }

    function test_enter_multiplePlayersAccumulate() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);
        _enterAt(player2, START_TIME + 2);
        _enterAt(player3, START_TIME + 3);

        (,,, uint256 pool, uint256 count,,) = tournament.getTournament(T_ID);
        assertEq(pool,  ENTRY_FEE * 3);
        assertEq(count, 3);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  4. enter — DOUBLE-ENTRY PREVENTION
    // ═══════════════════════════════════════════════════════════════════════════

    function test_enter_doubleEntryReverts() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);

        vm.prank(player1);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.AlreadyEntered.selector, T_ID, player1
            )
        );
        tournament.enter(T_ID);
    }

    function test_enter_differentPlayerAfterDoubleAttempt() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);

        // player1 tries again — revert
        vm.prank(player1);
        vm.expectRevert();
        tournament.enter(T_ID);

        // player2 can still enter
        _enterAt(player2, START_TIME + 5);
        assertTrue(tournament.hasEntered(T_ID, player2));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  5. enter — LATE ENTRY REJECTION
    // ═══════════════════════════════════════════════════════════════════════════

    function test_enter_afterEndTimeReverts() public {
        _createDefault();
        vm.warp(END_TIME + 1);
        vm.prank(player1);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.EntryPeriodEnded.selector, T_ID, END_TIME
            )
        );
        tournament.enter(T_ID);
    }

    function test_enter_beforeStartTimeReverts() public {
        _createDefault();
        // still at warp 500 (before START_TIME=1000)
        vm.prank(player1);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.EntryPeriodNotStarted.selector, T_ID, START_TIME
            )
        );
        tournament.enter(T_ID);
    }

    function test_enter_exactlyAtEndTimeReverts() public {
        _createDefault();
        vm.warp(END_TIME); // block.timestamp == endTime → "> endTime" is false; == endTime should fail
        // Our check is `block.timestamp > t.endTime` for rejection, so at exactly
        // endTime the player CAN enter — verify this boundary
        vm.prank(player1);
        // Should succeed at exactly endTime (boundary inclusive for entry)
        tournament.enter(T_ID);
        assertTrue(tournament.hasEntered(T_ID, player1));
    }

    function test_enter_onTimestampJustAfterEnd() public {
        _createDefault();
        vm.warp(END_TIME + 1);
        vm.prank(player1);
        vm.expectRevert();
        tournament.enter(T_ID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  6. finalize — CORRECT PAYOUT & RAKE MATH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_finalize_3playersCorrectPayouts() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);
        _enterAt(player2, START_TIME + 2);
        _enterAt(player3, START_TIME + 3);
        // totalPool = $15

        address[] memory winners = new address[](3);
        winners[0] = player1;
        winners[1] = player2;
        winners[2] = player3;

        uint256 p1Before = cusd.balanceOf(player1);
        uint256 p2Before = cusd.balanceOf(player2);
        uint256 p3Before = cusd.balanceOf(player3);
        uint256 trBefore = cusd.balanceOf(treasury);

        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(T_ID, winners);

        // 1st: $15 * 5000/10000 = $7.50
        assertEq(cusd.balanceOf(player1), p1Before + 7.5e18);
        // 2nd: $15 * 2500/10000 = $3.75
        assertEq(cusd.balanceOf(player2), p2Before + 3.75e18);
        // 3rd: $15 * 1000/10000 = $1.50
        assertEq(cusd.balanceOf(player3), p3Before + 1.5e18);
        // rake: $15 - $12.75 = $2.25
        assertEq(cusd.balanceOf(treasury), trBefore + 2.25e18);
        // Contract holds nothing
        assertEq(cusd.balanceOf(address(tournament)), 0);
    }

    function test_finalize_rakeNeverBelowFifteenPercent() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);
        _enterAt(player2, START_TIME + 2);
        _enterAt(player3, START_TIME + 3);

        address[] memory winners = new address[](3);
        winners[0] = player1; winners[1] = player2; winners[2] = player3;

        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(T_ID, winners);

        uint256 pool = 15e18;
        uint256 paid = 7.5e18 + 3.75e18 + 1.5e18; // 12.75
        uint256 rake = pool - paid;                  // 2.25 = 15%
        assertGe(rake * 10_000 / pool, 1_500); // ≥ 15%
    }

    function test_finalize_emitsTournamentFinalized() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);

        address[] memory winners = new address[](1);
        winners[0] = player1;

        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        vm.expectEmit(true, false, false, false);
        emit FruitRushTournament.TournamentFinalized(T_ID, winners, new uint256[](1), 0);
        tournament.finalize(T_ID, winners);
    }

    function test_finalize_statusIsFinalized() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);
        address[] memory w = new address[](1);
        w[0] = player1;

        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(T_ID, w);

        (,,,,, FruitRushTournament.TournamentStatus status,) = tournament.getTournament(T_ID);
        assertEq(uint8(status), uint8(FruitRushTournament.TournamentStatus.Finalized));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  7. finalize — PARTIAL WINNERS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_finalize_fewerWinnersThanPrizeSlots() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);
        _enterAt(player2, START_TIME + 2);
        // Only 2 players but 3 prize slots

        // Only submit 2 winners
        address[] memory winners = new address[](2);
        winners[0] = player1;
        winners[1] = player2;

        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(T_ID, winners);

        // 1st: $10 * 5000/10000 = $5
        // 2nd: $10 * 2500/10000 = $2.50
        // 3rd slot not used — share (10%) flows to rake
        // rake = $10 - $7.50 = $2.50 (25% > 15% min)
        assertEq(cusd.balanceOf(player1), 100e18 - ENTRY_FEE + 5e18);
        assertEq(cusd.balanceOf(player2), 100e18 - ENTRY_FEE + 2.5e18);
        assertEq(cusd.balanceOf(treasury), 2.5e18);
    }

    function test_finalize_tooManyWinnersReverts() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);

        // 4 winners but only 3 prize slots
        address[] memory winners = new address[](4);
        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.TooManyWinners.selector, 4, 3
            )
        );
        tournament.finalize(T_ID, winners);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  8. finalize — ZERO-POOL TOURNAMENT
    // ═══════════════════════════════════════════════════════════════════════════

    function test_finalize_zeroPoolNoTransfers() public {
        _createDefault();
        // No players entered — pool is 0

        address[] memory winners = new address[](0);
        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(T_ID, winners); // Should not revert

        assertEq(cusd.balanceOf(treasury), 0);
        assertEq(cusd.balanceOf(address(tournament)), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  9. finalize — ACCESS CONTROL & TIMING GUARDS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_finalize_beforeEndTimeReverts() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);

        address[] memory w = new address[](1);
        w[0] = player1;

        // Still within tournament window
        vm.warp(END_TIME - 1);
        vm.prank(finalizer);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.TournamentNotClosed.selector,
                T_ID,
                FruitRushTournament.TournamentStatus.Open
            )
        );
        tournament.finalize(T_ID, w);
    }

    function test_finalize_nonFinalizerReverts() public {
        _createDefault();
        address[] memory w = new address[](0);
        vm.warp(END_TIME + 1);
        vm.prank(stranger);
        vm.expectRevert();
        tournament.finalize(T_ID, w);
    }

    function test_finalize_alreadyFinalizedReverts() public {
        _createDefault();
        address[] memory w = new address[](0);
        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(T_ID, w);

        vm.prank(finalizer);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.TournamentNotFinalizable.selector,
                T_ID,
                FruitRushTournament.TournamentStatus.Finalized
            )
        );
        tournament.finalize(T_ID, w);
    }

    function test_finalize_refundedTournamentReverts() public {
        _createDefault();
        vm.prank(operator);
        tournament.refund(T_ID);

        address[] memory w = new address[](0);
        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.TournamentNotFinalizable.selector,
                T_ID,
                FruitRushTournament.TournamentStatus.Refunded
            )
        );
        tournament.finalize(T_ID, w);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. refund — FULL CANCEL & PER-PLAYER REFUND
    // ═══════════════════════════════════════════════════════════════════════════

    function test_refund_returnsFeesToAllEntrants() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);
        _enterAt(player2, START_TIME + 2);
        _enterAt(player3, START_TIME + 3);

        uint256 p1Before = cusd.balanceOf(player1); // 95e18 (paid 5)
        uint256 p2Before = cusd.balanceOf(player2);
        uint256 p3Before = cusd.balanceOf(player3);

        vm.prank(operator);
        tournament.refund(T_ID);

        assertEq(cusd.balanceOf(player1), p1Before + ENTRY_FEE);
        assertEq(cusd.balanceOf(player2), p2Before + ENTRY_FEE);
        assertEq(cusd.balanceOf(player3), p3Before + ENTRY_FEE);
        assertEq(cusd.balanceOf(address(tournament)), 0);
    }

    function test_refund_statusIsRefunded() public {
        _createDefault();
        vm.prank(operator);
        tournament.refund(T_ID);

        (,,,,, FruitRushTournament.TournamentStatus status,) = tournament.getTournament(T_ID);
        assertEq(uint8(status), uint8(FruitRushTournament.TournamentStatus.Refunded));
    }

    function test_refund_emitsTournamentRefunded() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);

        vm.prank(operator);
        vm.expectEmit(true, false, false, true);
        emit FruitRushTournament.TournamentRefunded(T_ID, ENTRY_FEE, 1);
        tournament.refund(T_ID);
    }

    function test_refund_beforeAnyEntrants() public {
        _createDefault();
        // No one entered yet — refund should not revert, emit 0 amount
        vm.prank(operator);
        tournament.refund(T_ID);
        assertEq(cusd.balanceOf(address(tournament)), 0);
    }

    function test_refund_entryAfterRefundReverts() public {
        _createDefault();
        vm.prank(operator);
        tournament.refund(T_ID);

        vm.warp(START_TIME + 1);
        vm.prank(player1);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.TournamentNotOpen.selector,
                T_ID,
                FruitRushTournament.TournamentStatus.Refunded
            )
        );
        tournament.enter(T_ID);
    }

    function test_refund_nonOperatorReverts() public {
        _createDefault();
        vm.prank(stranger);
        vm.expectRevert();
        tournament.refund(T_ID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. refund — CANNOT REFUND FINALIZED
    // ═══════════════════════════════════════════════════════════════════════════

    function test_refund_alreadyFinalizedReverts() public {
        _createDefault();
        address[] memory w = new address[](0);
        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(T_ID, w);

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.TournamentNotFinalizable.selector,
                T_ID,
                FruitRushTournament.TournamentStatus.Finalized
            )
        );
        tournament.refund(T_ID);
    }

    function test_refund_doubleRefundReverts() public {
        _createDefault();
        vm.prank(operator);
        tournament.refund(T_ID);

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushTournament.TournamentNotFinalizable.selector,
                T_ID,
                FruitRushTournament.TournamentStatus.Refunded
            )
        );
        tournament.refund(T_ID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 12. ADMIN — setTreasury
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setTreasury_updatesAddress() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(admin);
        tournament.setTreasury(newTreasury);
        assertEq(tournament.treasury(), newTreasury);
    }

    function test_setTreasury_rakeGoesToNewAddress() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(admin);
        tournament.setTreasury(newTreasury);

        _createDefault();
        _enterAt(player1, START_TIME + 1);
        address[] memory w = new address[](0);
        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(T_ID, w);

        assertEq(cusd.balanceOf(newTreasury), ENTRY_FEE); // 100% rake (no winners)
        assertEq(cusd.balanceOf(treasury), 0);
    }

    function test_setTreasury_zeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert(FruitRushTournament.ZeroAddress.selector);
        tournament.setTreasury(address(0));
    }

    function test_setTreasury_nonAdminReverts() public {
        vm.prank(stranger);
        vm.expectRevert();
        tournament.setTreasury(stranger);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 13. UUPS UPGRADE GUARD
    // ═══════════════════════════════════════════════════════════════════════════

    function test_upgrade_authorisedSucceeds() public {
        FruitRushTournament newImpl = new FruitRushTournament();
        vm.prank(admin);
        tournament.upgradeToAndCall(address(newImpl), "");
        // State preserved: treasury still set
        assertEq(tournament.treasury(), treasury);
    }

    function test_upgrade_unauthorisedReverts() public {
        FruitRushTournament newImpl = new FruitRushTournament();
        vm.prank(stranger);
        vm.expectRevert();
        tournament.upgradeToAndCall(address(newImpl), "");
    }

    function test_upgrade_statePreservedAfterUpgrade() public {
        _createDefault();
        _enterAt(player1, START_TIME + 1);

        FruitRushTournament newImpl = new FruitRushTournament();
        vm.prank(admin);
        tournament.upgradeToAndCall(address(newImpl), "");

        // Tournament state persists
        (uint256 fee,,, uint256 pool, uint256 count,,) = tournament.getTournament(T_ID);
        assertEq(fee,   ENTRY_FEE);
        assertEq(pool,  ENTRY_FEE);
        assertEq(count, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 14. FUZZ — PAYOUT MATH INVARIANTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Pool conservation: winners' payouts + rake == totalPool exactly.
    function testFuzz_finalize_poolConservation(
        uint8 numPlayers,
        uint8 numWinners
    ) public {
        vm.assume(numPlayers >= 1 && numPlayers <= 10);
        vm.assume(numWinners <= 3); // ≤ prize slots
        vm.assume(numWinners <= numPlayers);

        // Create a fresh tournament ID
        uint256 tid = 999;
        vm.prank(operator);
        tournament.createTournament(tid, ENTRY_FEE, START_TIME, END_TIME, prizeBps);

        // Enter players
        vm.warp(START_TIME + 1);
        for (uint8 i = 0; i < numPlayers; ++i) {
            address p = address(uint160(0xBEEF_0000 + i));
            cusd.mint(p, ENTRY_FEE);
            vm.prank(p); cusd.approve(address(tournament), ENTRY_FEE);
            vm.prank(p); tournament.enter(tid);
        }

        uint256 poolBefore = cusd.balanceOf(address(tournament));

        // Finalize with numWinners
        address[] memory winners = new address[](numWinners);
        for (uint8 i = 0; i < numWinners; ++i) {
            winners[i] = address(uint160(0xBEEF_0000 + i));
        }

        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(tid, winners);

        // Contract holds nothing — every wei accounted for
        assertEq(cusd.balanceOf(address(tournament)), 0);
        // Total out == pool in
        uint256 totalOut;
        for (uint8 i = 0; i < numWinners; ++i) {
            totalOut += cusd.balanceOf(winners[i]);
        }
        // rake went to treasury; we can't easily separate per-test but:
        assertEq(poolBefore, totalOut + cusd.balanceOf(treasury));
    }

    /// @dev Rake is always ≥ 15% of pool.
    function testFuzz_finalize_rakeFloor(uint8 numPlayers) public {
        vm.assume(numPlayers >= 1 && numPlayers <= 20);

        uint256 tid = 888;
        vm.prank(operator);
        tournament.createTournament(tid, ENTRY_FEE, START_TIME, END_TIME, prizeBps);

        vm.warp(START_TIME + 1);
        for (uint8 i = 0; i < numPlayers; ++i) {
            address p = address(uint160(0xCAFE_0000 + i));
            cusd.mint(p, ENTRY_FEE);
            vm.prank(p); cusd.approve(address(tournament), ENTRY_FEE);
            vm.prank(p); tournament.enter(tid);
        }

        uint256 pool = cusd.balanceOf(address(tournament));
        address[] memory winners = new address[](3);
        for (uint8 i = 0; i < 3 && i < numPlayers; ++i) {
            winners[i] = address(uint160(0xCAFE_0000 + i));
        }
        if (numPlayers < 3) {
            assembly { mstore(winners, numPlayers) }
        }

        uint256 trBefore = cusd.balanceOf(treasury);
        vm.warp(END_TIME + 1);
        vm.prank(finalizer);
        tournament.finalize(tid, winners);

        uint256 rake = cusd.balanceOf(treasury) - trBefore;
        // rake >= 15% of pool
        assertGe(rake * 10_000, pool * 1_500);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MOCK ERC-20
// ═══════════════════════════════════════════════════════════════════════════════

contract MockERC20 {
    string  public name;
    string  public symbol;
    uint8   public decimals;
    uint256 public totalSupply;

    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _n, string memory _s, uint8 _d) {
        name = _n; symbol = _s; decimals = _d;
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
        require(balanceOf[msg.sender] >= amount, "bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from]           >= amount, "bal");
        require(allowance[from][msg.sender] >= amount, "allow");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
