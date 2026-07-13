// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*──────────────────────────────────────────────────────────────────────────────
  DeployBoast.s.sol — Foundry deployment script for FruitRushBoast
  ─────────────────────────────────────────────────────────────────────────────
  Usage (Celo Mainnet):
    forge script script/DeployBoast.s.sol:DeployBoast \
      --rpc-url celo_mainnet \
      --broadcast \
      --verify \
      --etherscan-api-key $CELOSCAN_API_KEY \
      -vvv

  Usage (Alfajores Testnet):
    forge script script/DeployBoast.s.sol:DeployBoast \
      --rpc-url celo_testnet \
      --broadcast \
      --verify \
      --etherscan-api-key $CELOSCAN_API_KEY \
      -vvv

  Required .env variables:
    PRIVATE_KEY          — Deployer / owner private key
    BOAST_SIGNER         — Backend hot-wallet address (signs score attestations)
    BOAST_TREASURY       — Treasury wallet for fee withdrawals
    BOAST_FEE_WEI        — Initial fee in cUSD wei (e.g. 990000000000000000 = $0.99)
    CELOSCAN_API_KEY     — For contract verification on Celoscan
    CELO_RPC_URL         — Celo mainnet RPC endpoint
  ──────────────────────────────────────────────────────────────────────────────
  Celo cUSD addresses:
    Mainnet:   0x765DE816845861e75A25fCA122bb6898B8B1282a
    Alfajores: 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
──────────────────────────────────────────────────────────────────────────────*/

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/FruitRushBoast.sol";

contract DeployBoast is Script {
    // cUSD token addresses per network
    address constant CUSD_MAINNET   = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
    address constant CUSD_ALFAJORES = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;

    function run() external {
        // ── Load env ─────────────────────────────────────────────────────────
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address boastSigner = vm.envAddress("BOAST_SIGNER");
        address boastTreasury = vm.envAddress("BOAST_TREASURY");
        uint256 boastFeeWei = vm.envUint("BOAST_FEE_WEI");

        // Resolve cUSD address by chain ID
        address cusdAddr;
        if (block.chainid == 42220) {
            cusdAddr = CUSD_MAINNET;   // Celo Mainnet
        } else if (block.chainid == 44787) {
            cusdAddr = CUSD_ALFAJORES; // Alfajores Testnet
        } else {
            revert("Unsupported chain: set CUSD address manually");
        }

        console.log("=== FruitRush Boast - Deployment ===");
        console.log("Network chain ID:  ", block.chainid);
        console.log("cUSD address:      ", cusdAddr);
        console.log("Trusted signer:    ", boastSigner);
        console.log("Treasury:          ", boastTreasury);
        console.log("Boast fee (wei):   ", boastFeeWei);

        vm.startBroadcast(deployerKey);

        // ── Deploy FruitRushBoast ─────────────────────────────────────────────
        FruitRushBoast boast = new FruitRushBoast(
            cusdAddr,
            boastSigner,
            boastTreasury,
            boastFeeWei
        );

        vm.stopBroadcast();

        // ── Log summary ───────────────────────────────────────────────────────
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("FruitRushBoast:   ", address(boast));
        console.log("Owner:            ", boast.owner());
        console.log("Trusted signer:   ", boast.trustedSigner());
        console.log("Treasury:         ", boast.treasury());
        console.log("Boast fee (wei):  ", boast.boastFee());
        console.log("");
        console.log("Next steps:");
        console.log("  1. Store BOAST_CONTRACT_ADDRESS in backend .env");
        console.log("  2. Verify contract on Celoscan (automatic with --verify flag)");
        console.log("  3. Test a mint on Alfajores before mainnet");
        console.log("  4. Transfer ownership to multisig after verifying the deploy");
    }
}
