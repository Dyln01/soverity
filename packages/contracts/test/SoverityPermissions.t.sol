// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SoverityPermissions} from "../src/SoverityPermissions.sol";

/**
 * @title SoverityPermissionsTest
 * @notice Coverage for scope-based dApp grants: plaintext + commitment
 *         modes, revocation, and access control.
 */
contract SoverityPermissionsTest is Test {
    SoverityPermissions internal permissions;

    address internal user = makeAddr("user");
    address internal dapp = makeAddr("dapp");
    address internal otherDapp = makeAddr("otherDapp");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant READ_PROFILE = 1 << 0;
    uint256 internal constant READ_CREDENTIALS = 1 << 1;
    uint256 internal constant ISSUE_ATTESTATIONS = 1 << 2;

    function setUp() public {
        permissions = new SoverityPermissions();
    }

    // ------------------------------------------------------------------
    // grant (plaintext)
    // ------------------------------------------------------------------

    function test_Grant_HappyPath() public {
        vm.prank(user);
        permissions.grant(dapp, READ_PROFILE | READ_CREDENTIALS);

        SoverityPermissions.Permission memory p = permissions.getPermission(user, dapp);
        assertEq(p.scopes, READ_PROFILE | READ_CREDENTIALS);
        assertEq(p.scopeCommitment, 0);
        assertTrue(p.grantedAt != 0);
        assertTrue(permissions.isGranted(user, dapp));

        address[] memory dapps = permissions.dappsOf(user);
        assertEq(dapps.length, 1);
        assertEq(dapps[0], dapp);
    }

    function test_Grant_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit SoverityPermissions.PermissionGranted(user, dapp, READ_PROFILE, 0);
        vm.prank(user);
        permissions.grant(dapp, READ_PROFILE);
    }

    function test_Grant_ReplacesExistingScopes() public {
        vm.startPrank(user);
        permissions.grant(dapp, READ_PROFILE);
        permissions.grant(dapp, ISSUE_ATTESTATIONS);
        vm.stopPrank();
        assertEq(permissions.getScopes(user, dapp), ISSUE_ATTESTATIONS);
    }

    function test_Grant_RevertWhen_ZeroDapp() public {
        vm.prank(user);
        vm.expectRevert(SoverityPermissions.ZeroDApp.selector);
        permissions.grant(address(0), READ_PROFILE);
    }

    function test_Grant_RevertWhen_EmptyScopes() public {
        vm.prank(user);
        vm.expectRevert(SoverityPermissions.EmptyScopes.selector);
        permissions.grant(dapp, 0);
    }

    function test_Grant_MultipleDapps() public {
        vm.startPrank(user);
        permissions.grant(dapp, READ_PROFILE);
        permissions.grant(otherDapp, READ_CREDENTIALS);
        vm.stopPrank();

        assertEq(permissions.dappsOf(user).length, 2);
        assertTrue(permissions.hasScopes(user, dapp, READ_PROFILE));
        assertTrue(permissions.hasScopes(user, otherDapp, READ_CREDENTIALS));
        assertFalse(permissions.hasScopes(user, dapp, READ_CREDENTIALS));
    }

    // ------------------------------------------------------------------
    // hasScopes semantics
    // ------------------------------------------------------------------

    function test_HasScopes_SubsetCheck() public {
        vm.prank(user);
        permissions.grant(dapp, READ_PROFILE | READ_CREDENTIALS);

        assertTrue(permissions.hasScopes(user, dapp, READ_PROFILE)); // subset
        assertTrue(permissions.hasScopes(user, dapp, READ_PROFILE | READ_CREDENTIALS)); // exact
        assertFalse(permissions.hasScopes(user, dapp, ISSUE_ATTESTATIONS)); // missing bit
        assertFalse(permissions.hasScopes(user, dapp, 0)); // empty never true
        assertFalse(permissions.hasScopes(stranger, dapp, READ_PROFILE)); // no grant
    }

    // ------------------------------------------------------------------
    // commitment (private) grants
    // ------------------------------------------------------------------

    function test_GrantWithCommitment_HidesScopes() public {
        bytes32 salt = keccak256("salt");
        uint256 scopes = READ_PROFILE | ISSUE_ATTESTATIONS;

        vm.prank(user);
        permissions.grantWithCommitment(dapp, scopes, salt);

        // Nothing plaintext on-chain.
        assertEq(permissions.getScopes(user, dapp), 0);
        SoverityPermissions.Permission memory p = permissions.getPermission(user, dapp);
        assertTrue(p.scopeCommitment != 0);

        // Expected commitment stored.
        bytes32 expected = keccak256(abi.encode(scopes, user, dapp, salt));
        assertEq(p.scopeCommitment, expected);

        // Correct reveal verifies; wrong scopes/salt do not.
        assertTrue(permissions.verifyCommitment(user, dapp, scopes, salt));
        assertFalse(permissions.verifyCommitment(user, dapp, scopes ^ 1, salt));
        assertFalse(permissions.verifyCommitment(user, dapp, scopes, keccak256("evil")));
        // A plaintext grant never verifies as a commitment.
        assertFalse(permissions.verifyCommitment(stranger, dapp, scopes, salt));
    }

    function test_GrantWithCommitment_Fuzz(bytes32 salt, uint256 scopes) public {
        vm.assume(scopes != 0);
        vm.prank(user);
        permissions.grantWithCommitment(dapp, scopes, salt);

        assertTrue(permissions.verifyCommitment(user, dapp, scopes, salt));
        if (scopes != 1) {
            assertFalse(permissions.verifyCommitment(user, dapp, scopes - 1, salt));
        }
    }

    // ------------------------------------------------------------------
    // revoke
    // ------------------------------------------------------------------

    function test_Revoke_HappyPath() public {
        vm.startPrank(user);
        permissions.grant(dapp, READ_PROFILE);
        permissions.revoke(dapp);
        vm.stopPrank();

        assertFalse(permissions.isGranted(user, dapp));
        assertEq(permissions.getScopes(user, dapp), 0);
    }

    function test_Revoke_EmitsEvent() public {
        vm.prank(user);
        permissions.grant(dapp, READ_PROFILE);

        vm.expectEmit(true, true, true, true);
        emit SoverityPermissions.PermissionRevoked(user, dapp);
        vm.prank(user);
        permissions.revoke(dapp);
    }

    function test_Revoke_RevertWhen_NoActiveGrant() public {
        vm.prank(user);
        vm.expectRevert(SoverityPermissions.PermissionNotActive.selector);
        permissions.revoke(dapp);
    }

    function test_Revoke_ClearsCommitmentGrant() public {
        bytes32 salt = keccak256("salt");
        vm.startPrank(user);
        permissions.grantWithCommitment(dapp, READ_PROFILE, salt);
        permissions.revoke(dapp);
        vm.stopPrank();

        assertFalse(permissions.verifyCommitment(user, dapp, READ_PROFILE, salt));
        assertFalse(permissions.isGranted(user, dapp));
    }

    // ------------------------------------------------------------------
    // isolation between users
    // ------------------------------------------------------------------

    function test_GrantsArePerUser() public {
        vm.prank(user);
        permissions.grant(dapp, READ_PROFILE);

        // A stranger cannot see, use, or revoke the user's grant.
        assertFalse(permissions.isGranted(stranger, dapp));
        vm.prank(stranger);
        vm.expectRevert(SoverityPermissions.PermissionNotActive.selector);
        permissions.revoke(dapp);
    }
}
