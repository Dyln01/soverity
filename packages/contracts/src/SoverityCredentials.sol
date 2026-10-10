// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";

/**
 * @title SoverityCredentials
 * @notice EAS-style schema registry and attestation issuance for the
 *         Soverity identity protocol.
 *
 *         Schemas are registered with a UID derived as
 *         `keccak256(abi.encode(schema, resolver, revocable))`. Attestations
 *         reference a schema UID, bind a subject address and carry a
 *         `bytes32` data payload (or a salted commitment for ZK-friendly
 *         flows). An attestation is *valid* when it has been issued, has not
 *         been revoked, and has not expired (expiry = 0 means never).
 */
contract SoverityCredentials is Ownable {
    // ------------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------------

    /// @notice A registered credential schema.
    /// @param schema The schema definition string (EAS-style, e.g. "bytes32 documentHash, uint8 score").
    /// @param resolver Optional resolver address (address(0) = none).
    /// @param revocable Whether attestations under this schema may be revoked.
    /// @param uid keccak256(abi.encode(schema, resolver, revocable)).
    struct SchemaRecord {
        string schema;
        address resolver;
        bool revocable;
        bytes32 uid;
    }

    /// @notice An issued attestation.
    /// @param schemaUid The UID of the schema the attestation conforms to.
    /// @param subject The attested subject address.
    /// @param attester The address that issued the attestation.
    /// @param data The attestation payload (plaintext or ZK commitment).
    /// @param issuedAt Unix timestamp of issuance.
    /// @param expiresAt Unix timestamp of expiry (0 = never expires).
    /// @param revoked Whether the attestation has been revoked.
    struct Attestation {
        bytes32 schemaUid;
        address subject;
        address attester;
        bytes32 data;
        uint64 issuedAt;
        uint64 expiresAt;
        bool revoked;
    }

    // ------------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------------

    error SchemaNotFound();
    error SchemaAlreadyRegistered();
    error AttestationNotFound();
    error AttestationAlreadyExists();
    error SchemaNotRevocable();
    error NotAttester();
    error AlreadyRevoked();
    error ZeroSubject();
    error InvalidExpiry();

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------

    /// @notice Emitted when a schema is registered.
    /// @param uid The schema UID.
    /// @param schema The schema definition string.
    /// @param resolver Optional resolver address.
    /// @param revocable Whether attestations under the schema are revocable.
    event SchemaRegistered(bytes32 indexed uid, string schema, address indexed resolver, bool revocable);

    /// @notice Emitted when an attestation is issued.
    /// @param uid The attestation UID.
    /// @param schemaUid The schema the attestation conforms to.
    /// @param subject The attested subject.
    /// @param attester The issuer.
    event AttestationIssued(
        bytes32 indexed uid,
        bytes32 indexed schemaUid,
        address indexed subject,
        address attester,
        bytes32 data,
        uint64 expiresAt
    );

    /// @notice Emitted when an attestation is revoked.
    /// @param uid The attestation UID.
    /// @param subject The attested subject.
    event AttestationRevoked(bytes32 indexed uid, address indexed subject);

    // ------------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------------

    /// @notice schema UID => schema record.
    mapping(bytes32 => SchemaRecord) private _schemas;
    /// @notice attestation UID => attestation.
    mapping(bytes32 => Attestation) private _attestations;
    /// @notice subject => attestation UIDs (append-only index).
    mapping(address => bytes32[]) private _subjectAttestations;

    /// @notice Salt used by the protocol for credential commitments.
    bytes32 public constant COMMITMENT_SALT = keccak256("soverity.credential.commitment.v1");

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    /// @notice Deploys the credential registry with the deployer as admin.
    constructor() Ownable(msg.sender) {}

    // ------------------------------------------------------------------------
    // Write API
    // ------------------------------------------------------------------------

    /**
     * @notice Registers a new credential schema. The UID is computed as
     *         keccak256(abi.encode(schema, resolver, revocable)).
     * @param schema The schema definition string, e.g.
     *        "bytes32 documentHash, uint8 level".
     * @param resolver Optional resolver contract (address(0) for none).
     * @param revocable Whether attestations under this schema can be revoked.
     * @return uid The computed schema UID.
     * @dev Anyone may register schemas; duplicate UIDs revert.
     */
    function registerSchema(string calldata schema, address resolver, bool revocable) external returns (bytes32 uid) {
        if (bytes(schema).length == 0) revert SchemaNotFound();
        uid = keccak256(abi.encode(schema, resolver, revocable));
        if (bytes(_schemas[uid].schema).length != 0) revert SchemaAlreadyRegistered();

        _schemas[uid] = SchemaRecord({schema: schema, resolver: resolver, revocable: revocable, uid: uid});
        emit SchemaRegistered(uid, schema, resolver, revocable);
    }

    /**
     * @notice Issues an attestation under a registered schema.
     * @param schemaUid The UID of the schema the attestation conforms to.
     * @param subject The attested subject address (non-zero).
     * @param data The attestation payload.
     * @param expiresAt Expiry timestamp; 0 = never expires. Must not be in
     *        the past at issuance time.
     * @return uid The UID of the new attestation
     *         (keccak256(abi.encode(schemaUid, subject, msg.sender, data, expiresAt))).
     * @dev Anyone may issue attestations as long as the schema exists.
     */
    function issue(bytes32 schemaUid, address subject, bytes32 data, uint64 expiresAt) public returns (bytes32 uid) {
        if (bytes(_schemas[schemaUid].schema).length == 0) revert SchemaNotFound();
        if (subject == address(0)) revert ZeroSubject();
        if (expiresAt != 0 && expiresAt < block.timestamp) revert InvalidExpiry();

        uid = keccak256(abi.encode(schemaUid, subject, msg.sender, data, expiresAt));
        if (_attestations[uid].attester != address(0)) revert AttestationAlreadyExists();

        _attestations[uid] = Attestation({
            schemaUid: schemaUid,
            subject: subject,
            attester: msg.sender,
            data: data,
            issuedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false
        });
        _subjectAttestations[subject].push(uid);

        emit AttestationIssued(uid, schemaUid, subject, msg.sender, data, expiresAt);
    }

    /**
     * @notice Issues an attestation whose data field is a salted commitment
     *         (keccak256(abi.encode(value, COMMITMENT_SALT))) instead of a
     *         plaintext value — for ZK-friendly verification flows.
     * @param schemaUid The UID of the schema the attestation conforms to.
     * @param subject The attested subject address (non-zero).
     * @param value The secret value being committed to.
     * @param expiresAt Expiry timestamp; 0 = never.
     * @return uid The UID of the new attestation.
     * @dev The commitment hides `value` until the subject reveals it along
     *      with the public COMMITMENT_SALT; a dApp can then verify the
     *      on-chain hash without ever seeing the plaintext on-chain.
     */
    function issueWithCommitment(bytes32 schemaUid, address subject, bytes32 value, uint64 expiresAt)
        external
        returns (bytes32 uid)
    {
        bytes32 commitment = keccak256(abi.encode(value, COMMITMENT_SALT));
        return issue(schemaUid, subject, commitment, expiresAt);
    }

    /**
     * @notice Revokes an attestation. Only the original attester may revoke,
     *         and only if the schema allows revocation.
     * @param uid The UID of the attestation to revoke.
     */
    function revoke(bytes32 uid) external {
        Attestation storage a = _attestations[uid];
        if (a.attester == address(0)) revert AttestationNotFound();
        if (a.attester != msg.sender) revert NotAttester();
        if (a.revoked) revert AlreadyRevoked();
        if (!_schemas[a.schemaUid].revocable) revert SchemaNotRevocable();

        a.revoked = true;
        emit AttestationRevoked(uid, a.subject);
    }

    // ------------------------------------------------------------------------
    // Read API
    // ------------------------------------------------------------------------

    /**
     * @notice Returns a registered schema by UID.
     * @param uid The schema UID.
     * @return The SchemaRecord; `schema` is "" for unknown UIDs.
     */
    function getSchema(bytes32 uid) external view returns (SchemaRecord memory) {
        return _schemas[uid];
    }

    /**
     * @notice Returns an attestation by UID.
     * @param uid The attestation UID.
     * @return The Attestation; `attester` is address(0) for unknown UIDs.
     */
    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return _attestations[uid];
    }

    /**
     * @notice Checks whether an attestation is valid: it must exist, not be
     *         revoked, and not be expired (expiresAt == 0 = never expires).
     * @param uid The attestation UID.
     * @return True when the attestation is currently valid.
     */
    function verify(bytes32 uid) external view returns (bool) {
        Attestation storage a = _attestations[uid];
        if (a.attester == address(0)) return false;
        if (a.revoked) return false;
        if (a.expiresAt != 0 && a.expiresAt < block.timestamp) return false;
        return true;
    }

    /**
     * @notice Verifies that an attestation is valid AND matches a revealed
     *         secret for commitment-based credentials.
     * @param uid The attestation UID.
     * @param value The revealed secret value.
     * @return True when the attestation is valid and its data equals
     *         keccak256(abi.encode(value, COMMITMENT_SALT)).
     */
    function verifyCommitment(bytes32 uid, bytes32 value) external view returns (bool) {
        if (!this.verify(uid)) return false;
        return _attestations[uid].data == keccak256(abi.encode(value, COMMITMENT_SALT));
    }

    /**
     * @notice Lists all attestation UIDs issued for a subject.
     * @param subject The subject address.
     * @return Array of attestation UIDs (append-only).
     */
    function attestationsOf(address subject) external view returns (bytes32[] memory) {
        return _subjectAttestations[subject];
    }

    /**
     * @notice Computes the UID a schema would receive, without registering.
     * @param schema The schema definition string.
     * @param resolver Optional resolver address.
     * @param revocable Whether the schema is revocable.
     * @return The would-be schema UID.
     */
    function computeSchemaUid(string calldata schema, address resolver, bool revocable)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(schema, resolver, revocable));
    }
}
