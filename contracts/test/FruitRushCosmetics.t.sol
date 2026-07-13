// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/FruitRushCosmetics.sol";

/// @title FruitRushCosmeticsTest
/// @notice Comprehensive Foundry test suite for FruitRushCosmetics.
///
///  Test categories
///  ───────────────
///  1. Deployment & initialisation
///  2. Role management
///  3. addItemType (admin)
///  4. mint — authorised minter
///  5. mint — unauthorised caller (reverts)
///  6. mint — supply cap enforcement
///  7. mintBatch
///  8. URI resolution
///  9. Royalty calculation (ERC-2981)
/// 10. UUPS upgrade guard
/// 11. Token-ID encode / decode helpers
contract FruitRushCosmeticsTest is Test {
    // ─── Constants ────────────────────────────────────────────────────────────

    string  constant BASE_URI    = "https://meta.fruitrush.io/";
    string  constant TOKEN_URI_1 = "ipfs://QmKnife1Common/metadata.json";
    string  constant TOKEN_URI_2 = "ipfs://QmFruit1Rare/metadata.json";
    string  constant TOKEN_URI_3 = "ipfs://QmTrail1Epic/metadata.json";

    // Precomputed token IDs (category | rarity | serial)
    // category=1 (KnifeSkin), rarity=1 (Common), serial=1
    uint256 constant TOKEN_KNIFE_COMMON_1 =
        (1 << 248) | (1 << 240) | 1;
    // category=2 (FruitSkin), rarity=2 (Rare), serial=1
    uint256 constant TOKEN_FRUIT_RARE_1   =
        (2 << 248) | (2 << 240) | 1;
    // category=3 (Trail), rarity=3 (Epic), serial=1
    uint256 constant TOKEN_TRAIL_EPIC_1   =
        (3 << 248) | (3 << 240) | 1;
    // category=4 (Background), rarity=4 (Legendary), serial=1
    uint256 constant TOKEN_BG_LEGENDARY_1 =
        (4 << 248) | (4 << 240) | 1;

    // ─── Actors ───────────────────────────────────────────────────────────────

    address admin    = makeAddr("admin");
    address minter   = makeAddr("minter");
    address player   = makeAddr("player");
    address royRcvr  = makeAddr("royaltyReceiver");
    address stranger = makeAddr("stranger");
    address shopAddr = makeAddr("shopContract");

    // ─── Contracts ────────────────────────────────────────────────────────────

    FruitRushCosmetics impl;
    FruitRushCosmetics cosmetics; // proxy cast to impl

    // ─── Setup ────────────────────────────────────────────────────────────────

    function setUp() public {
        // Deploy implementation
        impl = new FruitRushCosmetics();

        // Encode initializer call
        bytes memory initData = abi.encodeCall(
            FruitRushCosmetics.initialize,
            (admin, minter, royRcvr, BASE_URI)
        );

        // Deploy ERC1967 proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        cosmetics = FruitRushCosmetics(address(proxy));

        // Register some item types as admin
        vm.startPrank(admin);
        cosmetics.addItemType(TOKEN_KNIFE_COMMON_1, 1000, TOKEN_URI_1);
        cosmetics.addItemType(TOKEN_FRUIT_RARE_1,   500,  TOKEN_URI_2);
        cosmetics.addItemType(TOKEN_TRAIL_EPIC_1,   0,    TOKEN_URI_3); // unlimited
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  1. DEPLOYMENT & INITIALISATION
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialisation_rolesAreSet() public view {
        assertTrue(cosmetics.hasRole(cosmetics.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(cosmetics.hasRole(cosmetics.MINTER_ROLE(),        minter));
        assertTrue(cosmetics.hasRole(cosmetics.UPGRADER_ROLE(),      admin));
    }

    function test_initialisation_implConstructorDisablesInitializers() public {
        // Calling initialize on the bare implementation should revert
        vm.expectRevert();
        impl.initialize(admin, minter, royRcvr, BASE_URI);
    }

    function test_initialisation_zeroAddressReverts() public {
        FruitRushCosmetics freshImpl = new FruitRushCosmetics();
        bytes memory bad = abi.encodeCall(
            FruitRushCosmetics.initialize,
            (address(0), minter, royRcvr, BASE_URI)
        );
        vm.expectRevert(FruitRushCosmetics.ZeroAddress.selector);
        new ERC1967Proxy(address(freshImpl), bad);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  2. ROLE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    function test_role_grantMinterToShop() public {
        bytes32 minterRole = cosmetics.MINTER_ROLE();
        vm.prank(admin);
        cosmetics.grantRole(minterRole, shopAddr);
        assertTrue(cosmetics.hasRole(minterRole, shopAddr));
    }

    function test_role_nonAdminCannotGrantRole() public {
        bytes32 minterRole = cosmetics.MINTER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(); // AccessControl revert
        cosmetics.grantRole(minterRole, stranger);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  3. addItemType
    // ═══════════════════════════════════════════════════════════════════════════

    function test_addItemType_registersCorrectly() public view {
        (uint256 maxSupply, bool exists) = cosmetics.itemTypes(TOKEN_KNIFE_COMMON_1);
        assertTrue(exists);
        assertEq(maxSupply, 1000);
    }

    function test_addItemType_nonAdminReverts() public {
        uint256 newId = (1 << 248) | (1 << 240) | 99;
        vm.prank(stranger);
        vm.expectRevert(); // AccessControl
        cosmetics.addItemType(newId, 100, "ipfs://x");
    }

    function test_addItemType_duplicateReverts() public {
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushCosmetics.ItemTypeAlreadyExists.selector,
                TOKEN_KNIFE_COMMON_1
            )
        );
        cosmetics.addItemType(TOKEN_KNIFE_COMMON_1, 100, "ipfs://y");
    }

    function test_addItemType_invalidCategoryReverts() public {
        // category = 0 — invalid
        uint256 badId = (0 << 248) | (1 << 240) | 1;
        vm.prank(admin);
        vm.expectRevert(FruitRushCosmetics.InvalidTokenId.selector);
        cosmetics.addItemType(badId, 10, "ipfs://bad");
    }

    function test_addItemType_invalidRarityReverts() public {
        // rarity = 5 — invalid
        uint256 badId = (1 << 248) | (5 << 240) | 1;
        vm.prank(admin);
        vm.expectRevert(FruitRushCosmetics.InvalidTokenId.selector);
        cosmetics.addItemType(badId, 10, "ipfs://bad");
    }

    function test_addItemType_zeroSerialReverts() public {
        // serial = 0 — invalid
        uint256 badId = (1 << 248) | (1 << 240) | 0;
        vm.prank(admin);
        vm.expectRevert(FruitRushCosmetics.InvalidTokenId.selector);
        cosmetics.addItemType(badId, 10, "ipfs://bad");
    }

    function test_addItemType_emitsEvent() public {
        uint256 newId = (2 << 248) | (3 << 240) | 7;
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit FruitRushCosmetics.ItemTypeAdded(newId, 50, "ipfs://new");
        cosmetics.addItemType(newId, 50, "ipfs://new");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  4. MINT — AUTHORISED MINTER
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint_authorisedMinter_succeeds() public {
        vm.prank(minter);
        cosmetics.mint(player, TOKEN_KNIFE_COMMON_1, 1);
        assertEq(cosmetics.balanceOf(player, TOKEN_KNIFE_COMMON_1), 1);
    }

    function test_mint_emitsCosmeticMinted() public {
        vm.prank(minter);
        vm.expectEmit(true, true, false, true);
        emit FruitRushCosmetics.CosmeticMinted(player, TOKEN_KNIFE_COMMON_1, 1);
        cosmetics.mint(player, TOKEN_KNIFE_COMMON_1, 1);
    }

    function test_mint_shopContractAfterRoleGrant() public {
        bytes32 minterRole = cosmetics.MINTER_ROLE();
        vm.prank(admin);
        cosmetics.grantRole(minterRole, shopAddr);

        vm.prank(shopAddr);
        cosmetics.mint(player, TOKEN_FRUIT_RARE_1, 2);
        assertEq(cosmetics.balanceOf(player, TOKEN_FRUIT_RARE_1), 2);
    }

    function test_mint_multipleToSamePlayer() public {
        vm.startPrank(minter);
        cosmetics.mint(player, TOKEN_KNIFE_COMMON_1, 3);
        cosmetics.mint(player, TOKEN_KNIFE_COMMON_1, 2);
        vm.stopPrank();
        assertEq(cosmetics.balanceOf(player, TOKEN_KNIFE_COMMON_1), 5);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  5. MINT — UNAUTHORISED CALLER
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint_unauthorisedRevertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(); // AccessControl missing role
        cosmetics.mint(player, TOKEN_KNIFE_COMMON_1, 1);
    }

    function test_mint_unauthorisedRevertsForAdmin() public {
        // admin has DEFAULT_ADMIN_ROLE but NOT MINTER_ROLE by default
        vm.prank(admin);
        vm.expectRevert();
        cosmetics.mint(player, TOKEN_KNIFE_COMMON_1, 1);
    }

    function test_mint_zeroAddressReverts() public {
        vm.prank(minter);
        vm.expectRevert(FruitRushCosmetics.ZeroAddress.selector);
        cosmetics.mint(address(0), TOKEN_KNIFE_COMMON_1, 1);
    }

    function test_mint_zeroAmountReverts() public {
        vm.prank(minter);
        vm.expectRevert(FruitRushCosmetics.ZeroAmount.selector);
        cosmetics.mint(player, TOKEN_KNIFE_COMMON_1, 0);
    }

    function test_mint_unknownTokenIdReverts() public {
        uint256 unregistered = (1 << 248) | (2 << 240) | 999;
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushCosmetics.UnknownItemType.selector,
                unregistered
            )
        );
        cosmetics.mint(player, unregistered, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  6. SUPPLY CAP ENFORCEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    function test_supplyCap_exactCapSucceeds() public {
        // TOKEN_FRUIT_RARE_1 has maxSupply = 500
        vm.prank(minter);
        cosmetics.mint(player, TOKEN_FRUIT_RARE_1, 500);
        assertEq(cosmetics.totalSupply(TOKEN_FRUIT_RARE_1), 500);
    }

    function test_supplyCap_overCapReverts() public {
        vm.prank(minter);
        cosmetics.mint(player, TOKEN_FRUIT_RARE_1, 499);

        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushCosmetics.SupplyCapExceeded.selector,
                TOKEN_FRUIT_RARE_1,
                2,   // requested
                1    // remaining
            )
        );
        cosmetics.mint(player, TOKEN_FRUIT_RARE_1, 2);
    }

    function test_supplyCap_exactLastTokenSucceeds() public {
        vm.prank(minter);
        cosmetics.mint(player, TOKEN_FRUIT_RARE_1, 499);
        vm.prank(minter);
        cosmetics.mint(player, TOKEN_FRUIT_RARE_1, 1);
        assertEq(cosmetics.totalSupply(TOKEN_FRUIT_RARE_1), 500);
    }

    function test_supplyCap_unlimitedAllowsLargeAmount() public {
        // TOKEN_TRAIL_EPIC_1 has maxSupply = 0 (unlimited)
        vm.prank(minter);
        cosmetics.mint(player, TOKEN_TRAIL_EPIC_1, 100_000);
        assertEq(cosmetics.totalSupply(TOKEN_TRAIL_EPIC_1), 100_000);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  7. MINT BATCH
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mintBatch_succeeds() public {
        uint256[] memory ids = new uint256[](2);
        uint256[] memory amts = new uint256[](2);
        ids[0]  = TOKEN_KNIFE_COMMON_1;
        ids[1]  = TOKEN_FRUIT_RARE_1;
        amts[0] = 1;
        amts[1] = 2;

        vm.prank(minter);
        cosmetics.mintBatch(player, ids, amts);

        assertEq(cosmetics.balanceOf(player, TOKEN_KNIFE_COMMON_1), 1);
        assertEq(cosmetics.balanceOf(player, TOKEN_FRUIT_RARE_1),   2);
    }

    function test_mintBatch_emitsCosmeticMintedForEach() public {
        uint256[] memory ids = new uint256[](2);
        uint256[] memory amts = new uint256[](2);
        ids[0]  = TOKEN_KNIFE_COMMON_1;
        ids[1]  = TOKEN_TRAIL_EPIC_1;
        amts[0] = 1;
        amts[1] = 1;

        vm.prank(minter);
        vm.recordLogs();
        cosmetics.mintBatch(player, ids, amts);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        // Two CosmeticMinted events emitted
        bytes32 eventSig = keccak256("CosmeticMinted(address,uint256,uint256)");
        uint256 count;
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].topics[0] == eventSig) ++count;
        }
        assertEq(count, 2);
    }

    function test_mintBatch_unauthorisedReverts() public {
        uint256[] memory ids  = new uint256[](1);
        uint256[] memory amts = new uint256[](1);
        ids[0]  = TOKEN_KNIFE_COMMON_1;
        amts[0] = 1;

        vm.prank(stranger);
        vm.expectRevert();
        cosmetics.mintBatch(player, ids, amts);
    }

    function test_mintBatch_capEnforcedPerToken() public {
        // TOKEN_FRUIT_RARE_1 cap = 500
        uint256[] memory ids  = new uint256[](2);
        uint256[] memory amts = new uint256[](2);
        ids[0]  = TOKEN_KNIFE_COMMON_1;
        ids[1]  = TOKEN_FRUIT_RARE_1;
        amts[0] = 1;
        amts[1] = 501; // exceeds cap

        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushCosmetics.SupplyCapExceeded.selector,
                TOKEN_FRUIT_RARE_1,
                501,
                500
            )
        );
        cosmetics.mintBatch(player, ids, amts);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  8. URI RESOLUTION
    // ═══════════════════════════════════════════════════════════════════════════

    function test_uri_perTokenOverrideReturned() public view {
        assertEq(cosmetics.uri(TOKEN_KNIFE_COMMON_1), TOKEN_URI_1);
        assertEq(cosmetics.uri(TOKEN_FRUIT_RARE_1),   TOKEN_URI_2);
        assertEq(cosmetics.uri(TOKEN_TRAIL_EPIC_1),   TOKEN_URI_3);
    }

    function test_uri_newItemTypeHasCorrectUri() public {
        uint256 newId = (4 << 248) | (2 << 240) | 42;
        string memory expected = "ipfs://QmBackground42/metadata.json";

        vm.prank(admin);
        cosmetics.addItemType(newId, 10, expected);

        assertEq(cosmetics.uri(newId), expected);
    }

    function test_uri_setTokenURI_succeedsForAdmin() public {
        string memory newUri = "ipfs://QmUpdatedKnife1/metadata.json";
        vm.prank(admin);
        cosmetics.setTokenURI(TOKEN_KNIFE_COMMON_1, newUri);
        assertEq(cosmetics.uri(TOKEN_KNIFE_COMMON_1), newUri);
    }

    function test_uri_setTokenURI_revertsForNonAdmin() public {
        string memory newUri = "ipfs://QmUpdatedKnife1/metadata.json";
        vm.prank(stranger);
        vm.expectRevert();
        cosmetics.setTokenURI(TOKEN_KNIFE_COMMON_1, newUri);
    }

    function test_uri_setTokenURI_revertsForUnknownToken() public {
        uint256 unregistered = (1 << 248) | (2 << 240) | 999;
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                FruitRushCosmetics.UnknownItemType.selector,
                unregistered
            )
        );
        cosmetics.setTokenURI(unregistered, "ipfs://new");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  9. ROYALTY CALCULATION (ERC-2981)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_royalty_fivePercent() public view {
        uint256 salePrice = 1 ether;
        (address receiver, uint256 royaltyAmount) =
            cosmetics.royaltyInfo(TOKEN_KNIFE_COMMON_1, salePrice);

        assertEq(receiver,      royRcvr);
        // 5% of 1 ether = 0.05 ether = 50000000000000000
        assertEq(royaltyAmount, salePrice * 500 / 10_000);
    }

    function test_royalty_fivePercentVariousPrices(uint256 salePrice) public view {
        vm.assume(salePrice <= type(uint128).max); // avoid overflow
        (, uint256 royaltyAmount) =
            cosmetics.royaltyInfo(TOKEN_KNIFE_COMMON_1, salePrice);
        assertEq(royaltyAmount, salePrice * 500 / 10_000);
    }

    function test_royalty_receiverCorrect() public view {
        (address receiver,) = cosmetics.royaltyInfo(TOKEN_KNIFE_COMMON_1, 1 ether);
        assertEq(receiver, royRcvr);
    }

    function test_royalty_setNewReceiver() public {
        address newRcvr = makeAddr("newRoyaltyReceiver");
        vm.prank(admin);
        cosmetics.setRoyaltyReceiver(newRcvr);

        (address receiver,) = cosmetics.royaltyInfo(TOKEN_KNIFE_COMMON_1, 1 ether);
        assertEq(receiver, newRcvr);
    }

    function test_royalty_setNewReceiverZeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert(FruitRushCosmetics.ZeroAddress.selector);
        cosmetics.setRoyaltyReceiver(address(0));
    }

    function test_royalty_setNewReceiverNonAdminReverts() public {
        vm.prank(stranger);
        vm.expectRevert();
        cosmetics.setRoyaltyReceiver(stranger);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. UUPS UPGRADE GUARD
    // ═══════════════════════════════════════════════════════════════════════════

    function test_upgrade_authorisedUpgraderCanUpgrade() public {
        FruitRushCosmetics newImpl = new FruitRushCosmetics();

        vm.prank(admin);
        cosmetics.upgradeToAndCall(address(newImpl), "");

        // State must be preserved through the upgrade
        assertTrue(cosmetics.hasRole(cosmetics.MINTER_ROLE(), minter));
        (uint256 maxSupply, bool exists) = cosmetics.itemTypes(TOKEN_KNIFE_COMMON_1);
        assertTrue(exists);
        assertEq(maxSupply, 1000);
    }

    function test_upgrade_unauthorisedRevertsForStranger() public {
        FruitRushCosmetics newImpl = new FruitRushCosmetics();

        vm.prank(stranger);
        vm.expectRevert();
        cosmetics.upgradeToAndCall(address(newImpl), "");
    }

    function test_upgrade_statePreservedAfterUpgrade() public {
        // Mint before upgrade
        vm.prank(minter);
        cosmetics.mint(player, TOKEN_KNIFE_COMMON_1, 3);

        // Upgrade
        FruitRushCosmetics newImpl = new FruitRushCosmetics();
        vm.prank(admin);
        cosmetics.upgradeToAndCall(address(newImpl), "");

        // Balance persists
        assertEq(cosmetics.balanceOf(player, TOKEN_KNIFE_COMMON_1), 3);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. TOKEN-ID ENCODE / DECODE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function test_tokenId_encodeDecodeRoundTrip() public view {
        uint256 encoded = cosmetics.encodeTokenId(2, 3, 7);
        (uint256 cat, uint256 rar, uint256 ser) = cosmetics.decodeTokenId(encoded);
        assertEq(cat, 2);
        assertEq(rar, 3);
        assertEq(ser, 7);
    }

    function test_tokenId_knownValue() public view {
        // category=1, rarity=1, serial=1 => TOKEN_KNIFE_COMMON_1
        uint256 encoded = cosmetics.encodeTokenId(1, 1, 1);
        assertEq(encoded, TOKEN_KNIFE_COMMON_1);
    }

    function test_tokenId_fuzzRoundTrip(
        uint8 cat,
        uint8 rar,
        uint240 ser
    ) public view {
        uint256 c = (uint256(cat) % 4) + 1; // 1–4
        uint256 r = (uint256(rar) % 4) + 1; // 1–4
        uint256 s = (uint256(ser) == 0) ? 1 : uint256(ser);

        uint256 encoded = cosmetics.encodeTokenId(c, r, s);
        (uint256 dc, uint256 dr, uint256 ds) = cosmetics.decodeTokenId(encoded);
        assertEq(dc, c);
        assertEq(dr, r);
        assertEq(ds, s);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 12. ERC-165 INTERFACE SUPPORT
    // ═══════════════════════════════════════════════════════════════════════════

    function test_supportsInterface_ERC1155() public view {
        // ERC-1155 interface ID
        assertTrue(cosmetics.supportsInterface(0xd9b67a26));
    }

    function test_supportsInterface_ERC2981() public view {
        // ERC-2981 interface ID
        assertTrue(cosmetics.supportsInterface(0x2a55205a));
    }

    function test_supportsInterface_AccessControl() public view {
        // IAccessControl interface ID
        assertTrue(cosmetics.supportsInterface(0x7965db0b));
    }
}
