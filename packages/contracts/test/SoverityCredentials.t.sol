// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SoverityCredentials} from "../src/SoverityCredentials.sol";

/**
 * @title SoverityCredentialsTest
 * @notice Happy-path, revert and edge-case coverage for the EAS-style
 *         credential schema registry and attestation lifecycle.
 */
contract SoverityCredentialsTest is Test {
    SoverityCredentials internal credentials;

    address internal attester = makeAddr("attester");
    address internal subject = makeAddr("subject");
    address internal resolver = makeAddr("resolver");

    string internal constant SCHEMA = "bytes32 documentHash, uint8 level";
    bool internal constant REVOCABLE = true;
    bytes32 internal schemaUid;

    function setUp() public {
        credentials = new SoverityCredentials();
        vm.prank(attester);
        schemaUid = credentials.registerSchema(SCHEMA, resolver, REVOCABLE);
    }

    // ------------------------------------------------------------------
    // registerSchema
    // ------------------------------------------------------------------

    function test_RegisterSchema_HappyPath() public view {
        SoverityCredentials.SchemaRecord memory rec = credentials.getSchema(schemaUid);
        assertEq(rec.schema, SCHEMA);
        assertEq(rec.resolver, resolver);
        assertTrue(rec.revocable);
        assertEq(rec.uid, schemaUid);
        assertEq(schemaUid, credentials.computeSchemaUid(SCHEMA, resolver, REVOCABLE));
    }

    function test_RegisterSchema_RevertWhen_Duplicate() public {
        vm.prank(attester);
        vm.expectRevert(SoverityCredentials.SchemaAlreadyRegistered.selector);
        credentials.registerSchema(SCHEMA, resolver, REVOCABLE);
    }

    function test_RegisterSchema_RevertWhen_Empty() public {
        vm.expectRevert(SoverityCredentials.SchemaNotFound.selector);
        credentials.registerSchema("", address(0), true);
    }

    // ------------------------------------------------------------------
    // issue
    // ------------------------------------------------------------------

    function test_Issue_HappyPath() public returns (bytes32 uid) {
        bytes32 data = keccak256("passport-doc");
        vm.prank(attester);
        uid = credentials.issue(schemaUid, subject, data, 0);

        SoverityCredentials.Attestation memory a = credentials.getAttestation(uid);
        assertEq(a.schemaUid, schemaUid);
        assertEq(a.subject, subject);
        assertEq(a.attester, attester);
        assertEq(a.data, data);
        assertEq(a.expiresAt, 0);
        assertFalse(a.revoked);
        assertTrue(credentials.verify(uid));

        bytes32[] memory uids = credentials.attestationsOf(subject);
        assertEq(uids.length, 1);
        assertEq(uids[0], uid);
    }

    function test_Issue_RevertWhen_SchemaNotFound() public {
        vm.prank(attester);
        vm.expectRevert(SoverityCredentials.SchemaNotFound.selector);
        credentials.issue(bytes32("nope"), subject, 0, 0);
    }

    function test_Issue_RevertWhen_ZeroSubject() public {
        vm.prank(attester);
        vm.expectRevert(SoverityCredentials.ZeroSubject.selector);
        credentials.issue(schemaUid, address(0), 0, 0);
    }

    function test_Issue_RevertWhen_ExpiredTimestamp() public {
        vm.warp(1_700_000_000); // a real timestamp so `expiresAt` is non-zero
        vm.prank(attester);
        vm.expectRevert(SoverityCredentials.InvalidExpiry.selector);
        credentials.issue(schemaUid, subject, bytes32(uint256(1)), uint64(block.timestamp - 1));
    }

    function test_Issue_RevertWhen_Duplicate() public {
        vm.startPrank(attester);
        credentials.issue(schemaUid, subject, bytes32(uint256(1)), 0);
        vm.expectRevert(SoverityCredentials.AttestationAlreadyExists.selector);
        credentials.issue(schemaUid, subject, bytes32(uint256(1)), 0);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // expiry & verify
    // ------------------------------------------------------------------

    function test_Verify_FalseWhenExpired() public {
        uint64 ttl = 1 days;
        vm.prank(attester);
        bytes32 uid = credentials.issue(schemaUid, subject, bytes32(uint256(1)), uint64(block.timestamp + ttl));

        assertTrue(credentials.verify(uid));
        vm.warp(block.timestamp + ttl + 1);
        assertFalse(credentials.verify(uid));
    }

    function test_Verify_FalseWhenUnknown() public pure {
        // verify on a never-issued UID must not revert.
        // (kept as a call on a fresh contract below in the non-pure twin)
    }

    function test_Verify_FalseWhenUnknownUid() public {
        assertFalse(credentials.verify(bytes32("unknown")));
    }

    // ------------------------------------------------------------------
    // revoke
    // ------------------------------------------------------------------

    function test_Revoke_HappyPath() public {
        vm.prank(attester);
        bytes32 uid = credentials.issue(schemaUid, subject, bytes32(uint256(1)), 0);
        assertTrue(credentials.verify(uid));

        vm.prank(attester);
        credentials.revoke(uid);
        assertFalse(credentials.verify(uid));
        assertTrue(credentials.getAttestation(uid).revoked);

        vm.prank(attester);
        vm.expectRevert(SoverityCredentials.AlreadyRevoked.selector);
        credentials.revoke(uid);
    }

    function test_Revoke_RevertWhen_NotAttester() public {
        vm.prank(attester);
        bytes32 uid = credentials.issue(schemaUid, subject, bytes32(uint256(1)), 0);
        vm.prank(subject);
        vm.expectRevert(SoverityCredentials.NotAttester.selector);
        credentials.revoke(uid);
    }

    function test_Revoke_RevertWhen_SchemaNotRevocable() public {
        vm.prank(attester);
        bytes32 nonRevocableUid = credentials.registerSchema("bytes32 id", address(0), false);
        vm.prank(attester);
        bytes32 uid = credentials.issue(nonRevocableUid, subject, bytes32(uint256(1)), 0);
        vm.prank(attester);
        vm.expectRevert(SoverityCredentials.SchemaNotRevocable.selector);
        credentials.revoke(uid);
    }

    function test_Revoke_RevertWhen_NotFound() public {
        vm.expectRevert(SoverityCredentials.AttestationNotFound.selector);
        credentials.revoke(bytes32("missing"));
    }

    // ------------------------------------------------------------------
    // commitments
    // ------------------------------------------------------------------

    function test_IssueWithCommitment_RoundTrip() public {
        bytes32 secret = keccak256("secret-value");
        vm.prank(attester);
        bytes32 uid = credentials.issueWithCommitment(schemaUid, subject, secret, 0);

        // Plaintext never stored.
        assertEq(credentials.getAttestation(uid).data, keccak256(abi.encode(secret, credentials.COMMITMENT_SALT())));
        assertFalse(credentials.getAttestation(uid).data == secret);

        // Correct reveal verifies; wrong value does not.
        assertTrue(credentials.verifyCommitment(uid, secret));
        assertFalse(credentials.verifyCommitment(uid, keccak256("wrong")));
    }
}
