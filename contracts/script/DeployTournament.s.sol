// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*──────────────────────────────────────────────────────────────────────────────
  DeployTournament.s.sol — Foundry deployment script for FruitRushTournament
  ─────────────────────────────────────────────────────────────────────────────
  Usage (Alfajores testnet):
    forge script script/DeployTournament.s.sol:DeployTournament \
      --rpc-url celo_testnet \
      --broadcast \
      --verify \
      --etherscan-api-key $CELOSCAN_API_KEY \
      -vvv

  Usage (Celo Mainnet):
    forge script script/DeployTournament.s.sol:DeployTournament \
      --rpc-url celo_mainnet \
      --broadcast \
      --verify \
      --etherscan-api-key $CELOSCAN_API_KEY \
      -vvv

  Required .env variables:
    PRIVATE_KEY          — Deployer private key (pays gas; ideally the admin)
    ADMIN_ADDRESS        — Multisig receiving DEFAULT_ADMIN_ROLE + UPGRADER_ROLE
    OPERATOR_ADDRESS     — Backend service receiving OPERATOR_ROLE
    FINALIZER_ADDRESS    — Backend service receiving FINALIZER_ROLE
    TOURNAMENT_TREASURY  — Rake destination
    CELOSCAN_API_KEY     — For Celoscan verification
    CELO_RPC_URL         — Celo mainnet RPC

  cUSD addresses:
    Mainnet:   0x765DE816845861e75A25fCA122bb6898B8B1282a
    Alfajores: 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
──────────────────────────────────────────────────────────────────────────────*/

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/FruitRushTournament.sol";

contract DeployTournament is Script {
    address constant CUSD_MAINNET   = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
    address constant CUSD_ALFAJORES = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;

    function run() external {
        // ── Load env ─────────────────────────────────────────────────────────
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");
        address adminAddr    = vm.envAddress("ADMIN_ADDRESS");
        address operatorAddr = vm.envAddress("OPERATOR_ADDRESS");
        address finalizerAddr = vm.envAddress("FINALIZER_ADDRESS");
        address treasuryAddr = vm.envAddress("TOURNAMENT_TREASURY");

        // Resolve cUSD by chain
        address cusdAddr;
        if (block.chainid == 42220) {
            cusdAddr = CUSD_MAINNET;
        } else if (block.chainid == 44787) {
            cusdAddr = CUSD_ALFAJORES;
        } else {
            revert("Unsupported chain");
        }

        console.log("=== FruitRush Tournament - Deployment ===");
        console.log("Chain ID:   ", block.chainid);
        console.log("cUSD:       ", cusdAddr);
        console.log("Admin:      ", adminAddr);
        console.log("Operator:   ", operatorAddr);
        console.log("Finalizer:  ", finalizerAddr);
        console.log("Treasury:   ", treasuryAddr);

        vm.startBroadcast(deployerKey);

        // ── Deploy implementation ─────────────────────────────────────────────
        FruitRushTournament implementation = new FruitRushTournament();
        console.log("Implementation:", address(implementation));

        // ── Deploy UUPS proxy ─────────────────────────────────────────────────
        bytes memory initData = abi.encodeCall(
            FruitRushTournament.initialize,
            (cusdAddr, adminAddr, operatorAddr, finalizerAddr, treasuryAddr)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        FruitRushTournament tournament = FruitRushTournament(address(proxy));

        vm.stopBroadcast();

        // ── Log summary ───────────────────────────────────────────────────────
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Implementation:", address(implementation));
        console.log("Proxy (use this):", address(proxy));
        console.log("Treasury:      ", tournament.treasury());
        console.log("cUSD:          ", address(tournament.cUSD()));
        console.log("");
        console.log("Role constants:");
        console.log("  OPERATOR_ROLE: ");
        console.logBytes32(tournament.OPERATOR_ROLE());
        console.log("  FINALIZER_ROLE:");
        console.logBytes32(tournament.FINALIZER_ROLE());
        console.log("  UPGRADER_ROLE: ");
        console.logBytes32(tournament.UPGRADER_ROLE());
        console.log("");
        console.log("Next steps:");
        console.log("  1. Store TOURNAMENT_PROXY in backend .env");
        console.log("  2. Backend calls createTournament() via OPERATOR_ROLE");
        console.log("  3. After each tournament closes, backend calls finalize()");
        console.log("  4. Transfer DEFAULT_ADMIN_ROLE to multisig if deployer != admin");
    }
}
