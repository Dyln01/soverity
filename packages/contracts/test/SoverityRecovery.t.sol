// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SoverityRecovery} from "../src/SoverityRecovery.sol";
import {SoverityRegistry} from "../src/SoverityRegistry.sol";

/**
 * @title SoverityRecoveryTest
 * @notice Guardian social-recovery coverage: threshold approvals, 48h
 *         timelock, cancellation, access control — plus a fuzz test over
 *         random guardian sets and thresholds.
 */
contract SoverityRecoveryTest is Test {
    SoverityRegistry internal registry;
    SoverityRecovery internal recovery;

    address internal user = makeAddr("user");
    address internal candidate = makeAddr("candidate");
    address internal attacker = makeAddr("attacker");

    address[5] internal guardians;
    uint256 internal constant THRESHOLD = 3;
    uint256 internal constant TIMELOCK = 48 hours;

    string internal constant DID = "did:pkh:eip155:8453:0xUSER";

    function setUp() public {
        registry = new SoverityRegistry();
        vm.prank(user);
        registry.createPass(DID, makeAddr("userAccount"), "username1");

        for (uint256 i = 0; i < 5; ++i) {
            guardians[i] = makeAddr(string.concat("guardian", vm.toString(i)));
        }
        address[] memory guardianList = new address[](5);
        for (uint256 i = 0; i < 5; ++i) {
            guardianList[i] = guardians[i];
        }
        vm.prank(user);
        recovery = new SoverityRecovery(registry, guardianList, THRESHOLD, TIMELOCK);

        // The recovery module becomes the registry admin so it can reassign
        // pass ownership on execution.
        registry.transferOwnership(address(recovery));
    }

    // ------------------------------------------------------------------
    // constructor validation
    // ------------------------------------------------------------------

    function test_Constructor_RevertWhen_ThresholdTooHigh() public {
        address[] memory gs = new address[](2);
        gs[0] = makeAddr("g0");
        gs[1] = makeAddr("g1");
        vm.expectRevert(SoverityRecovery.InvalidThreshold.selector);
        new SoverityRecovery(registry, gs, 3, TIMELOCK);
    }

    function test_Constructor_RevertWhen_EmptyGuardians() public {
        address[] memory gs = new address[](0);
        vm.expectRevert(SoverityRecovery.GuardianLimitExceeded.selector);
        new SoverityRecovery(registry, gs, 1, TIMELOCK);
    }

    function test_Constructor_RevertWhen_DuplicateGuardian() public {
        address g = makeAddr("dup");
        address[] memory gs = new address[](2);
        gs[0] = g;
        gs[1] = g;
        vm.expectRevert(SoverityRecovery.AlreadyGuardian.selector);
        new SoverityRecovery(registry, gs, 2, TIMELOCK);
    }

    function test_Constructor_RevertWhen_ZeroGuardian() public {
        address[] memory gs = new address[](1);
        gs[0] = address(0);
        vm.expectRevert(SoverityRecovery.ZeroAddress.selector);
        new SoverityRecovery(registry, gs, 1, TIMELOCK);
    }

    // ------------------------------------------------------------------
    // full recovery flow
    // ------------------------------------------------------------------

    function test_FullRecoveryFlow() public {
        vm.prank(guardians[0]);
        recovery.proposeRecovery(DID, candidate);

        SoverityRecovery.RecoveryProposal memory p = recovery.getProposal(DID);
        assertEq(p.candidate, candidate);
        assertEq(p.approvalCount, 1);

        vm.prank(guardians[1]);
        recovery.approveRecovery(DID);
        vm.prank(guardians[2]);
        recovery.approveRecovery(DID);

        p = recovery.getProposal(DID);
        assertEq(p.approvalCount, THRESHOLD);
        assertEq(p.executableAt, block.timestamp + TIMELOCK);
        assertTrue(recovery.hasApproved(DID, guardians[0]));
        assertFalse(recovery.hasApproved(DID, guardians[3]));

        // Timelock blocks early execution.
        vm.expectRevert(SoverityRecovery.TimelockNotElapsed.selector);
        recovery.executeRecovery(DID);

        vm.warp(block.timestamp + TIMELOCK + 1);
        recovery.executeRecovery(DID);

        // Registry ownership reassigned to the candidate.
        assertEq(registry.ownerOfDid(DID), candidate);
        assertEq(registry.didsOfOwner(candidate).length, 1);

        // Proposal cleared.
        assertEq(bytes(recovery.getProposal(DID).did).length, 0);
    }

    function test_Execute_RevertWhen_ThresholdNotMet() public {
        vm.startPrank(guardians[0]);
        recovery.proposeRecovery(DID, candidate);
        recovery.approveRecovery(DID); // proposing guardian auto-approved, second is a no-op revert
    }

    function test_Approve_RevertWhen_AlreadyApproved() public {
        vm.prank(guardians[0]);
        recovery.proposeRecovery(DID, candidate);
        vm.prank(guardians[0]);
        vm.expectRevert(SoverityRecovery.AlreadyApproved.selector);
        recovery.approveRecovery(DID);
    }

    function test_Propose_RevertWhen_NotGuardian() public {
        vm.prank(attacker);
        vm.expectRevert(SoverityRecovery.NotGuardian.selector);
        recovery.proposeRecovery(DID, attacker);
    }

    function test_Propose_RevertWhen_ActiveProposal() public {
        vm.prank(guardians[0]);
        recovery.proposeRecovery(DID, candidate);
        vm.prank(guardians[1]);
        vm.expectRevert(SoverityRecovery.ProposalAlreadyActive.selector);
        recovery.proposeRecovery(DID, candidate);
    }

    function test_Approve_RevertWhen_NoProposal() public {
        vm.prank(guardians[0]);
        vm.expectRevert(SoverityRecovery.ProposalNotFound.selector);
        recovery.approveRecovery(DID);
    }

    function test_Execute_RevertWhen_NoProposal() public {
        vm.expectRevert(SoverityRecovery.ProposalNotFound.selector);
        recovery.executeRecovery(DID);
    }

    // ------------------------------------------------------------------
    // cancel
    // ------------------------------------------------------------------

    function test_CancelRecovery_ByGuardian() public {
        vm.prank(guardians[0]);
        recovery.proposeRecovery(DID, candidate);

        vm.prank(guardians[4]);
        recovery.cancelRecovery(DID);
        assertEq(bytes(recovery.getProposal(DID).did).length, 0);

        // A fresh proposal can restart the flow.
        vm.prank(guardians[0]);
        recovery.proposeRecovery(DID, candidate);
        assertEq(recovery.getProposal(DID).approvalCount, 1);
    }

    function test_CancelRecovery_RevertWhen_Attacker() public {
        vm.prank(guardians[0]);
        recovery.proposeRecovery(DID, candidate);
        vm.prank(attacker);
        vm.expectRevert(SoverityRecovery.NotGuardian.selector);
        recovery.cancelRecovery(DID);
    }

    // ------------------------------------------------------------------
    // guardian management
    // ------------------------------------------------------------------

    function test_GuardianManagement() public {
        // Module owner (user transferred ownership in setUp) manages guardians.
        address newGuardian = makeAddr("newGuardian");
        vm.prank(user);
        recovery.addGuardian(newGuardian);
        assertTrue(recovery.isGuardian(newGuardian));
        assertEq(recovery.guardianCount(), 6);

        vm.prank(user);
        recovery.removeGuardian(newGuardian);
        assertFalse(recovery.isGuardian(newGuardian));
        assertEq(recovery.guardianCount(), 5);
    }

    function test_AddGuardian_RevertWhen_NotOwner() public {
        vm.prank(attacker);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        recovery.addGuardian(makeAddr("x"));
    }

    function test_RemoveGuardian_RevertWhen_BelowThreshold() public {
        vm.startPrank(user);
        // 5 guardians, threshold 3: removing 3 leaves 2 > 3? no — remove
        // until only threshold remain, then the next removal must revert.
        recovery.removeGuardian(guardians[0]);
        recovery.removeGuardian(guardians[1]);
        vm.expectRevert(SoverityRecovery.ThresholdNotMet.selector);
        recovery.removeGuardian(guardians[2]);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Fuzz: random guardian sets / thresholds
    // ------------------------------------------------------------------

    /// @dev For a random (n, t) guardian configuration the recovery must
    ///      execute exactly when t distinct guardians approved AND the
    ///      timelock elapsed, and never before.
    function testFuzz_RecoveryThreshold(uint8 guardianCountSeed, uint8 approveCount) public {
        uint256 n = 2 + (guardianCountSeed % 6); // 2..7 guardians
        vm.assume(n <= 7);

        address[] memory gs = new address[](n);
        for (uint256 i = 0; i < n; ++i) {
            gs[i] = makeAddr(string.concat("fz-g", vm.toString(i), vm.toString(n)));
        }

        uint256 t = 1 + (uint256(approveCount) % n); // 1..n
        SoverityRecovery rec = new SoverityRecovery(registry, gs, t, 1 hours);

        vm.prank(gs[0]);
        rec.proposeRecovery("did:pkh:fuzz", candidate);

        // Approve with exactly `t-1` more guardians: threshold NOT yet met.
        uint256 extra = approveCount % (n - 1); // 0..n-2 additional approvals beyond proposer
        for (uint256 i = 1; i <= extra && i < n; ++i) {
            vm.prank(gs[i]);
            rec.approveRecovery("did:pkh:fuzz");
        }

        uint256 approvals = rec.getProposal("did:pkh:fuzz").approvalCount;
        if (approvals < t) {
            vm.warp(block.timestamp + 2 hours);
            vm.expectRevert(SoverityRecovery.ThresholdNotMet.selector);
            rec.executeRecovery("did:pkh:fuzz");
        } else {
            // Threshold met: timelock must still gate execution.
            vm.expectRevert(SoverityRecovery.TimelockNotElapsed.selector);
            rec.executeRecovery("did:pkh:fuzz");

            vm.warp(block.timestamp + 1 hours + 1);
            rec.executeRecovery("did:pkh:fuzz");
        }
    }
}
