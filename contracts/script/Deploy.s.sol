// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*──────────────────────────────────────────────────────────────────────────────
  Deploy.s.sol — Foundry deployment script for FruitRushCosmetics
  ─────────────────────────────────────────────────────────────────────────────
  Usage (Celo Mainnet):
    forge script script/Deploy.s.sol:Deploy \
      --rpc-url celo_mainnet \
      --broadcast \
      --verify \
      --etherscan-api-key $CELOSCAN_API_KEY \
      -vvv

  Usage (Alfajores Testnet):
    forge script script/Deploy.s.sol:Deploy \
      --rpc-url celo_testnet \
      --broadcast \
      --verify \
      --etherscan-api-key $CELOSCAN_API_KEY \
      -vvv

  Required .env variables:
    PRIVATE_KEY          — Deployer private key (has ETH/CELO for gas)
    ADMIN_ADDRESS        — Multisig / owner that receives DEFAULT_ADMIN_ROLE
    MINTER_ADDRESS       — Game backend hot-wallet that receives MINTER_ROLE
    ROYALTY_RECEIVER     — Address that receives ERC-2981 royalties
    BASE_URI             — Base metadata URI prefix (e.g. https://meta.fruitrush.io/)
    CELOSCAN_API_KEY     — API key for Celoscan contract verification
──────────────────────────────────────────────────────────────────────────────*/

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/FruitRushCosmetics.sol";

contract Deploy is Script {
    // ─── Token ID constants matching the production item catalogue ────────────
    //     Format: (category << 248) | (rarity << 240) | serial
    //     Categories: 1=KnifeSkin 2=FruitSkin 3=Trail 4=Background
    //     Rarities:   1=Common 2=Rare 3=Epic 4=Legendary

    // Knife Skins
    uint256 constant KNIFE_COMMON_1    = (1 << 248) | (1 << 240) | 1;
    uint256 constant KNIFE_COMMON_2    = (1 << 248) | (1 << 240) | 2;
    uint256 constant KNIFE_RARE_1      = (1 << 248) | (2 << 240) | 1;
    uint256 constant KNIFE_EPIC_1      = (1 << 248) | (3 << 240) | 1;
    uint256 constant KNIFE_LEGENDARY_1 = (1 << 248) | (4 << 240) | 1;

    // Fruit Skins
    uint256 constant FRUIT_COMMON_1    = (2 << 248) | (1 << 240) | 1;
    uint256 constant FRUIT_RARE_1      = (2 << 248) | (2 << 240) | 1;
    uint256 constant FRUIT_EPIC_1      = (2 << 248) | (3 << 240) | 1;
    uint256 constant FRUIT_LEGENDARY_1 = (2 << 248) | (4 << 240) | 1;

    // Trail Effects
    uint256 constant TRAIL_COMMON_1    = (3 << 248) | (1 << 240) | 1;
    uint256 constant TRAIL_RARE_1      = (3 << 248) | (2 << 240) | 1;
    uint256 constant TRAIL_EPIC_1      = (3 << 248) | (3 << 240) | 1;
    uint256 constant TRAIL_LEGENDARY_1 = (3 << 248) | (4 << 240) | 1;

    // Backgrounds
    uint256 constant BG_COMMON_1       = (4 << 248) | (1 << 240) | 1;
    uint256 constant BG_RARE_1         = (4 << 248) | (2 << 240) | 1;
    uint256 constant BG_EPIC_1         = (4 << 248) | (3 << 240) | 1;
    uint256 constant BG_LEGENDARY_1    = (4 << 248) | (4 << 240) | 1;

    function run() external {
        // ── Load env ─────────────────────────────────────────────────────────
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        address adminAddr   = vm.envAddress("ADMIN_ADDRESS");
        address minterAddr  = vm.envAddress("MINTER_ADDRESS");
        address royaltyAddr = vm.envAddress("ROYALTY_RECEIVER");
        string  memory baseURI = vm.envString("BASE_URI");

        console.log("=== FruitRush Cosmetics - Deployment ===");
        console.log("Network chain ID:", block.chainid);
        console.log("Admin:           ", adminAddr);
        console.log("Minter:          ", minterAddr);
        console.log("Royalty receiver:", royaltyAddr);
        console.log("Base URI:        ", baseURI);

        vm.startBroadcast(deployerKey);

        // ── 1. Deploy implementation ──────────────────────────────────────────
        FruitRushCosmetics implementation = new FruitRushCosmetics();
        console.log("Implementation deployed at:", address(implementation));

        // ── 2. Deploy UUPS proxy ──────────────────────────────────────────────
        bytes memory initData = abi.encodeCall(
            FruitRushCosmetics.initialize,
            (adminAddr, minterAddr, royaltyAddr, baseURI)
        );

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        FruitRushCosmetics cosmetics = FruitRushCosmetics(address(proxy));
        console.log("Proxy deployed at:         ", address(proxy));

        // ── 3. Register initial item types ────────────────────────────────────
        //      Supply caps follow launch-catalogue design:
        //        Common:    5 000  (relatively abundant)
        //        Rare:      1 000
        //        Epic:        250
        //        Legendary:    50  (ultra-scarce)
        //      Unlimited (0) is used for base items without artificial scarcity.
        //
        //      URIs follow convention:
        //        {baseURI}knife/common/1/metadata.json
        //      Adjust to match your IPFS / CDN structure before mainnet.

        string memory b = baseURI; // shorthand

        // Knife Skins
        cosmetics.addItemType(KNIFE_COMMON_1,    5000, _join(b, "knife/common/1/metadata.json"));
        cosmetics.addItemType(KNIFE_COMMON_2,    5000, _join(b, "knife/common/2/metadata.json"));
        cosmetics.addItemType(KNIFE_RARE_1,      1000, _join(b, "knife/rare/1/metadata.json"));
        cosmetics.addItemType(KNIFE_EPIC_1,       250, _join(b, "knife/epic/1/metadata.json"));
        cosmetics.addItemType(KNIFE_LEGENDARY_1,   50, _join(b, "knife/legendary/1/metadata.json"));

        // Fruit Skins
        cosmetics.addItemType(FRUIT_COMMON_1,    5000, _join(b, "fruit/common/1/metadata.json"));
        cosmetics.addItemType(FRUIT_RARE_1,      1000, _join(b, "fruit/rare/1/metadata.json"));
        cosmetics.addItemType(FRUIT_EPIC_1,       250, _join(b, "fruit/epic/1/metadata.json"));
        cosmetics.addItemType(FRUIT_LEGENDARY_1,   50, _join(b, "fruit/legendary/1/metadata.json"));

        // Trail Effects
        cosmetics.addItemType(TRAIL_COMMON_1,    5000, _join(b, "trail/common/1/metadata.json"));
        cosmetics.addItemType(TRAIL_RARE_1,      1000, _join(b, "trail/rare/1/metadata.json"));
        cosmetics.addItemType(TRAIL_EPIC_1,       250, _join(b, "trail/epic/1/metadata.json"));
        cosmetics.addItemType(TRAIL_LEGENDARY_1,   50, _join(b, "trail/legendary/1/metadata.json"));

        // Backgrounds
        cosmetics.addItemType(BG_COMMON_1,       5000, _join(b, "bg/common/1/metadata.json"));
        cosmetics.addItemType(BG_RARE_1,         1000, _join(b, "bg/rare/1/metadata.json"));
        cosmetics.addItemType(BG_EPIC_1,          250, _join(b, "bg/epic/1/metadata.json"));
        cosmetics.addItemType(BG_LEGENDARY_1,      50, _join(b, "bg/legendary/1/metadata.json"));

        vm.stopBroadcast();

        // ── 4. Log summary ────────────────────────────────────────────────────
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Implementation : ", address(implementation));
        console.log("Proxy (use this):", address(proxy));
        console.log("17 item types registered.");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Verify implementation on Celoscan (automatic if --verify flag used)");
        console.log("  2. Grant MINTER_ROLE to the shop contract after deployment");
        console.log("  3. Transfer DEFAULT_ADMIN_ROLE to multisig if deployer != adminAddr");
        console.log("  4. Store PROXY_ADDRESS in your backend .env");
    }

    // ─── Internal helper: string concatenation ────────────────────────────────
    function _join(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }
}
