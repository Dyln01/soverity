// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {SoverityRegistry} from "../src/SoverityRegistry.sol";
import {SoverityCredentials} from "../src/SoverityCredentials.sol";
import {SoverityBadges} from "../src/SoverityBadges.sol";
import {SoverityRecovery} from "../src/SoverityRecovery.sol";
import {SoverityPermissions} from "../src/SoverityPermissions.sol";

/**
 * @title Deploy
 * @notice Deploys the full Soverity identity stack:
 *           1. SoverityRegistry   — DID/username registry
 *           2. SoverityCredentials — schema + attestation registry
 *           3. SoverityBadges     — soulbound tier badges (issuer = deployer)
 *           4. SoverityRecovery   — 3-of-5 guardian social recovery, 48h timelock
 *           5. SoverityPermissions — scope-based dApp grants
 *
 *         Deployed addresses land in `broadcast/` (forge writes the run JSON
 *         automatically) and are logged to the console.
 *
 * Usage:
 *   forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast
 *   forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify
 */
contract Deploy is Script {
    // Social-recovery defaults: the deployer is seeded as the sole initial
    // guardian with threshold 1 so the deployment is immediately usable.
    // Rotate the guardian set (addGuardian/removeGuardian) to reach the
    // intended M-of-N (e.g. 3-of-5 with a 48h timelock) before production.
    uint256 constant RECOVERY_TIMELOCK = 48 hours;

    function run() external returns (SoverityRegistry registry) {
        vm.startBroadcast();

        // 1. DID → account + username registry. The deployer is the initial
        //    admin; ownership should be moved to a governance/timelock later.
        registry = new SoverityRegistry();

        // 2. Credential schemas + attestations (EAS-style).
        new SoverityCredentials();

        // 3. Soulbound badges; the deployer holds the issuer role at first.
        new SoverityBadges(msg.sender);

        // 4. Guardian-based social recovery, wired to the registry so
        //    executed recoveries reassign pass ownership on-chain.
        //    The deployer is seeded as the sole initial guardian (threshold
        //    1); rotate via addGuardian/removeGuardian once real guardians
        //    are chosen.
        address[] memory guardians = new address[](1);
        guardians[0] = msg.sender;
        new SoverityRecovery(registry, guardians, 1, RECOVERY_TIMELOCK);

        // 5. Scope-based dApp permissions.
        new SoverityPermissions();

        vm.stopBroadcast();

        console2.log("SoverityRegistry:   ", address(registry));
    }
}
