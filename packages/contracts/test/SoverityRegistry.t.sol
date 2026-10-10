// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SoverityRegistry} from "../src/SoverityRegistry.sol";

/**
 * @title SoverityRegistryTest
 * @notice Happy-path, revert and edge-case coverage for SoverityRegistry,
 *         including a fuzz test for username normalization.
 */
contract SoverityRegistryTest is Test {
    SoverityRegistry internal registry;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal aliceAccount = makeAddr("aliceAccount");
    address internal bobAccount = makeAddr("bobAccount");

    string internal constant ALICE_DID = "did:pkh:eip155:8453:0xALICE";
    string internal constant BOB_DID = "did:pkh:eip155:8453:0xBOB";

    function setUp() public {
        registry = new SoverityRegistry();
        vm.prank(alice);
        registry.createPass(ALICE_DID, aliceAccount, "Alice");
        vm.prank(bob);
        registry.createPass(BOB_DID, bobAccount, "bob");
    }

    // ------------------------------------------------------------------
    // createPass
    // ------------------------------------------------------------------

    function test_CreatePass_HappyPath() public view {
        SoverityRegistry.Pass memory pass = registry.resolveByDid(ALICE_DID);
        assertEq(pass.account, aliceAccount);
        // Username must be normalized to lowercase.
        assertEq(pass.username, "alice");
        assertEq(registry.ownerOfDid(ALICE_DID), alice);
    }

    function test_CreatePass_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit SoverityRegistry.PassCreated(BOB_DID, bobAccount, "bob", bob);
        vm.prank(bob);
        registry.createPass("did:pkh:eip155:8453:0xBOB2", makeAddr("bobAccount2"), "bob2");
    }

    function test_CreatePass_RevertWhen_DidAlreadyRegistered() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.DidAlreadyRegistered.selector);
        registry.createPass(ALICE_DID, makeAddr("another"), "alice2");
    }

    function test_CreatePass_RevertWhen_UsernameTaken() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.UsernameTaken.selector);
        registry.createPass("did:pkh:new", makeAddr("another"), "ALICE");
    }

    function test_CreatePass_RevertWhen_UsernameTooShort() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.UsernameTooShort.selector);
        registry.createPass("did:pkh:new", makeAddr("another"), "ab");
    }

    function test_CreatePass_RevertWhen_UsernameTooLong() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.UsernameTooLong.selector);
        registry.createPass("did:pkh:new", makeAddr("another"), "abcdefghijklmnopqrstuvwxyz0123456");
    }

    function test_CreatePass_RevertWhen_UsernameInvalidCharacters() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.UsernameInvalidCharacters.selector);
        registry.createPass("did:pkh:new", makeAddr("another"), "ali ce");
    }

    function test_CreatePass_RevertWhen_AccountZero() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.InvalidAccount.selector);
        registry.createPass("did:pkh:new", address(0), "alice2");
    }

    function test_CreatePass_RevertWhen_AccountTaken() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.DidAlreadyRegistered.selector);
        registry.createPass("did:pkh:new", aliceAccount, "alice2");
    }

    function test_CreatePass_RevertWhen_DidEmpty() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.EmptyDid.selector);
        registry.createPass("", makeAddr("another"), "alice2");
    }

    function test_CreatePass_MultiplePassesPerOwner() public {
        address secondAccount = makeAddr("aliceAccount2");
        vm.startPrank(alice);
        registry.createPass("did:pkh:alice-second", secondAccount, "alice2");
        string[] memory dids = registry.didsOfOwner(alice);
        vm.stopPrank();
        assertEq(dids.length, 2);
        assertEq(dids[0], ALICE_DID);
        assertEq(dids[1], "did:pkh:alice-second");
    }

    // ------------------------------------------------------------------
    // updateProfile
    // ------------------------------------------------------------------

    function test_UpdateProfile_HappyPath() public {
        address newAccount = makeAddr("aliceNewAccount");
        vm.prank(alice);
        registry.updateProfile(ALICE_DID, newAccount);
        SoverityRegistry.Pass memory pass = registry.resolveByDid(ALICE_DID);
        assertEq(pass.account, newAccount);
        assertEq(registry.resolveByAccount(newAccount).did, ALICE_DID);
    }

    function test_UpdateProfile_RevertWhen_NotPassOwner() public {
        vm.prank(bob);
        vm.expectRevert(SoverityRegistry.NotPassOwner.selector);
        registry.updateProfile(ALICE_DID, makeAddr("hijack"));
    }

    function test_UpdateProfile_RevertWhen_PassNotFound() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.PassNotFound.selector);
        registry.updateProfile("did:pkh:missing", makeAddr("x"));
    }

    function test_UpdateProfile_RevertWhen_AccountTaken() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.DidAlreadyRegistered.selector);
        registry.updateProfile(ALICE_DID, bobAccount);
    }

    // ------------------------------------------------------------------
    // transferUsername
    // ------------------------------------------------------------------

    function test_TransferUsername_HappyPath() public {
        vm.startPrank(alice);
        registry.createPass("did:pkh:alice-second", makeAddr("aliceAccount2"), "alice-alt");
        registry.transferUsername(ALICE_DID, "alice-alt");
        vm.stopPrank();

        // New pass now holds "alice"; old pass lost it.
        assertEq(registry.resolveByUsername("alice").did, "did:pkh:alice-second");
        assertEq(bytes(registry.resolveByDid(ALICE_DID).username).length, 0);
        // The freed name can be reclaimed.
        vm.prank(alice);
        registry.createPass("did:pkh:alice-third", makeAddr("aliceAccount3"), "alice-alt");
    }

    function test_TransferUsername_RevertWhen_TargetOwnedByOther() public {
        vm.prank(alice);
        vm.expectRevert(SoverityRegistry.CannotTransferUsernameToAnotherOwner.selector);
        registry.transferUsername(ALICE_DID, "bob");
    }

    function test_TransferUsername_RevertWhen_NotPassOwner() public {
        vm.prank(bob);
        vm.expectRevert(SoverityRegistry.NotPassOwner.selector);
        registry.transferUsername(ALICE_DID, "bob");
    }

    // ------------------------------------------------------------------
    // setPassOwner (admin / recovery hook)
    // ------------------------------------------------------------------

    function test_SetPassOwner_ReassignsOwnership() public {
        registry.setPassOwner(ALICE_DID, bob);
        assertEq(registry.ownerOfDid(ALICE_DID), bob);
        assertEq(registry.didsOfOwner(alice).length, 0);
        assertEq(registry.didsOfOwner(bob).length, 2);
    }

    function test_SetPassOwner_RevertWhen_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        registry.setPassOwner(ALICE_DID, bob);
    }

    // ------------------------------------------------------------------
    // Resolution helpers
    // ------------------------------------------------------------------

    function test_ResolveByUsername_CaseInsensitive() public {
        SoverityRegistry.Pass memory pass = registry.resolveByUsername("ALICE");
        assertEq(pass.did, ALICE_DID);
    }

    function test_Resolve_RevertWhen_NotFound() public {
        vm.expectRevert(SoverityRegistry.PassNotFound.selector);
        registry.resolveByDid("did:pkh:missing");
    }

    function test_DidOfUsername_ReturnsEmptyForFree() public {
        assertEq(bytes(registry.didOfUsername("free-name")), 0);
    }

    // ------------------------------------------------------------------
    // Fuzz: username normalization
    // ------------------------------------------------------------------

    /// @dev Random mixed-case usernames must fold to the same identity slot:
    /// creating "Name" then querying "name" must resolve to the same pass,
    /// and a second create with the other casing must hit UsernameTaken.
    function testFuzz_UsernameNormalizationCaseFolding(string memory username) public {
        vm.assume(bytes(username).length >= 3 && bytes(username).length <= 32);
        // Restrict charset to letters only to keep the fold predictable.
        bytes memory raw = bytes(username);
        for (uint256 i = 0; i < raw.length; ++i) {
            bool letter = (raw[i] >= 0x41 && raw[i] <= 0x5A) || (raw[i] >= 0x61 && raw[i] <= 0x7A);
            vm.assume(letter);
        }

        address acct = makeAddr("fuzzAccount");
        vm.prank(alice);
        registry.createPass("did:pkh:fuzz", acct, username);

        // Flipped-case lookup resolves to the same DID.
        bytes memory flipped = new bytes(raw.length);
        for (uint256 i = 0; i < raw.length; ++i) {
            bytes1 b = raw[i];
            if (b >= 0x41 && b <= 0x5A) {
                flipped[i] = bytes1(uint8(b) + 32);
            } else if (b >= 0x61 && b <= 0x7A) {
                flipped[i] = bytes1(uint8(b) - 32);
            } else {
                flipped[i] = b;
            }
        }
        assertEq(registry.resolveByUsername(string(flipped)).did, "did:pkh:fuzz");

        // Same name in any casing is taken.
        vm.prank(bob);
        vm.expectRevert(SoverityRegistry.UsernameTaken.selector);
        registry.createPass("did:pkh:fuzz2", makeAddr("fuzzAccount2"), string(flipped));
    }
}
