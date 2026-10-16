// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";

/**
 * @title SoverityRegistry
 * @notice On-chain registry mapping decentralized identifiers (DIDs) to smart
 *         account addresses and unique human-readable usernames for the
 *         Soverity no-KYC identity protocol.
 *
 *         Each "pass" is a record binding:
 *           - a DID string (e.g. "did:pkh:eip155:8453:0xAbC…") to
 *           - a smart account address (ERC-4337 account),
 *           - a unique username (ENS-like, normalized lowercase, 3-32 chars).
 *
 *         A single owner may hold multiple passes. Usernames are globally
 *         unique and can be transferred between passes owned by the same
 *         owner only. All writes are restricted to the pass owner.
 */
contract SoverityRegistry is Ownable {
    // ------------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------------

    /// @notice A registered identity pass.
    struct Pass {
        string did; ///< Decentralized identifier, e.g. "did:pkh:0x…".
        address account; ///< Smart account address bound to the DID.
        string username; ///< Unique, normalized lowercase username (3-32 chars).
        uint64 createdAt; ///< Unix timestamp when the pass was created.
        uint64 updatedAt; ///< Unix timestamp of the last profile update.
    }

    // ------------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------------

    error DidAlreadyRegistered();
    error UsernameTaken();
    error UsernameTooShort();
    error UsernameTooLong();
    error UsernameInvalidCharacters();
    error InvalidAccount();
    error PassNotFound();
    error NotPassOwner();
    error CannotTransferUsernameToAnotherOwner();
    error EmptyDid();
    error CannotTransferToSamePass();

    /// @dev Reverts unless the caller owns the pass identified by `did`.
    /// @param did The DID whose ownership is being checked.
    modifier onlyPassOwner(string calldata did) {
        address owner = _passOwners[did];
        if (owner == address(0)) revert PassNotFound();
        if (owner != msg.sender) revert NotPassOwner();
        _;
    }

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------

    /// @notice Emitted when a new pass is created.
    /// @param did The decentralized identifier of the pass.
    /// @param account The smart account address bound to the pass.
    /// @param username The claimed username.
    /// @param owner The owner of the pass.
    event PassCreated(string indexed did, address indexed account, string username, address indexed owner);

    /// @notice Emitted when a pass profile is updated.
    /// @param did The DID of the updated pass.
    /// @param account The account address of the updated pass.
    event PassUpdated(string indexed did, address indexed account);

    /// @notice Emitted when a username is transferred between two passes of
    ///         the same owner.
    /// @param fromDid DID losing the username.
    /// @param toDid DID receiving the username.
    /// @param username The transferred username.
    event UsernameTransferred(string indexed fromDid, string indexed toDid, string username);

    /// @notice Emitted when pass ownership is transferred by the registry
    ///         admin (e.g. as part of social recovery).
    /// @param did The affected DID.
    /// @param previousOwner The previous pass owner.
    /// @param newOwner The new pass owner.
    event PassOwnerSet(string indexed did, address indexed previousOwner, address indexed newOwner);

    // ------------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------------

    uint256 public constant MIN_USERNAME_LENGTH = 3;
    uint256 public constant MAX_USERNAME_LENGTH = 32;

    /// @notice did => Pass
    mapping(string => Pass) private _passes;
    /// @notice did => owner
    mapping(string => address) private _passOwners;
    /// @notice normalized username => did ("" when unclaimed)
    mapping(string => string) private _usernameToDid;
    /// @notice owner => array of DIDs owned
    mapping(address => string[]) private _ownerDids;
    /// @notice owner => did => index in _ownerDids (1-based; 0 = absent)
    mapping(address => mapping(string => uint256)) private _ownerDidIndex;
    /// @notice account address => did ("" when unregistered)
    mapping(address => string) private _accountToDid;

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    /// @notice Deploys the registry with the deployer as initial Ownable admin.
    constructor() Ownable(msg.sender) {}

    // ------------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------------

    /**
     * @dev Normalizes a username to lowercase and validates charset/length.
     *      Allowed characters after lowering: a-z, 0-9, hyphen, underscore.
     *      Uppercase ASCII letters are folded to lowercase so that "Alice"
     *      and "alice" refer to the same name.
     */
    function _normalizeAndValidate(string memory username) internal pure returns (string memory) {
        bytes memory raw = bytes(username);
        uint256 len = raw.length;
        if (len < MIN_USERNAME_LENGTH) revert UsernameTooShort();
        if (len > MAX_USERNAME_LENGTH) revert UsernameTooLong();

        bytes memory normalized = new bytes(len);
        for (uint256 i = 0; i < len; ++i) {
            bytes1 b = raw[i];
            // Fold ASCII uppercase to lowercase.
            if (b >= 0x41 && b <= 0x5A) {
                normalized[i] = bytes1(uint8(b) + 32);
            } else {
                normalized[i] = b;
            }
        }
        // Validate charset on the normalized bytes.
        for (uint256 i = 0; i < len; ++i) {
            bytes1 c = normalized[i];
            bool lower = (c >= 0x61 && c <= 0x7A); // a-z
            bool digit = (c >= 0x30 && c <= 0x39); // 0-9
            bool hyphen = c == 0x2D; // -
            bool underscore = c == 0x5F; // _
            if (!(lower || digit || hyphen || underscore)) revert UsernameInvalidCharacters();
        }
        return string(normalized);
    }

    /// @dev Adds `did` to the owner's DID list, maintaining the index map.
    function _addOwnerDid(address owner, string memory did) private {
        _ownerDidIndex[owner][did] = _ownerDids[owner].length + 1;
        _ownerDids[owner].push(did);
    }

    /// @dev Removes `did` from the owner's DID list using swap-and-pop.
    function _removeOwnerDid(address owner, string memory did) private {
        uint256 idx = _ownerDidIndex[owner][did];
        if (idx == 0) return;
        uint256 i = idx - 1;
        string[] storage dids = _ownerDids[owner];
        uint256 last = dids.length - 1;
        if (i != last) {
            dids[i] = dids[last];
            _ownerDidIndex[owner][dids[last]] = i + 1;
        }
        dids.pop();
        delete _ownerDidIndex[owner][did];
    }

    // ------------------------------------------------------------------------
    // Write API
    // ------------------------------------------------------------------------

    /**
     * @notice Creates a new identity pass binding `did` to `account` and
     *         claiming `username`.
     * @param did The decentralized identifier (e.g. "did:pkh:eip155:8453:0x…").
     *            Must not already be registered.
     * @param account The smart account address. Must be non-zero and not
     *                already bound to another DID.
     * @param username The desired username; normalized to lowercase.
     *                 Must be 3-32 chars of [a-z0-9-_] after folding.
     * @dev Callable by anyone on behalf of their own smart account: the
     *      caller becomes the pass owner and `account` is the represented
     *      smart account (for ERC-4337 flows the caller is typically the
     *      account itself, making owner == account).
     */
    function createPass(string calldata did, address account, string calldata username) external {
        if (bytes(did).length == 0) revert EmptyDid();
        if (account == address(0)) revert InvalidAccount();
        if (_passOwners[did] != address(0)) revert DidAlreadyRegistered();
        if (bytes(_accountToDid[account]).length != 0) revert DidAlreadyRegistered();

        string memory normalized = _normalizeAndValidate(username);
        if (bytes(_usernameToDid[normalized]).length != 0) revert UsernameTaken();

        _passes[did] = Pass({
            did: did,
            account: account,
            username: normalized,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });
        _passOwners[did] = msg.sender;
        _usernameToDid[normalized] = did;
        _accountToDid[account] = did;
        _addOwnerDid(msg.sender, did);

        emit PassCreated(did, account, normalized, msg.sender);
    }

    /**
     * @notice Updates the smart account address bound to an existing pass.
     *         The DID and username are immutable; the account can rotate.
     * @param did The DID of the pass to update.
     * @param newAccount The new smart account address. Must be non-zero and
     *                   not bound to another DID.
     * @dev Only the pass owner may call this.
     */
    function updateProfile(string calldata did, address newAccount) external onlyPassOwner(did) {
        address current = _passes[did].account;
        if (newAccount == address(0) || newAccount == current) revert InvalidAccount();
        if (bytes(_accountToDid[newAccount]).length != 0) revert DidAlreadyRegistered();

        delete _accountToDid[current];
        _passes[did].account = newAccount;
        _passes[did].updatedAt = uint64(block.timestamp);
        _accountToDid[newAccount] = did;

        emit PassUpdated(did, newAccount);
    }

    /**
     * @notice Transfers the username of `fromDid` to the pass identified by
     *         `toUsername`'s current holder. Both passes must belong to the
     *         same owner. The old holder keeps its pass but loses its name.
     * @param fromDid DID currently holding the username to transfer.
     * @param toUsername The username of the receiving pass.
     * @dev Only the owner of both passes may call this.
     */
    function transferUsername(string calldata fromDid, string calldata toUsername) external onlyPassOwner(fromDid) {
        string memory targetDid = _usernameToDid[_normalizeAndValidate(toUsername)];
        if (bytes(targetDid).length == 0) revert PassNotFound();
        if (_passOwners[targetDid] != msg.sender) revert CannotTransferUsernameToAnotherOwner();

        string memory movingName = _passes[fromDid].username;
        if (keccak256(bytes(movingName)) == keccak256(bytes(_passes[targetDid].username))) {
            revert CannotTransferToSamePass();
        }

        // Free the receiving pass' old name, then swap.
        delete _usernameToDid[_passes[targetDid].username];
        _usernameToDid[movingName] = targetDid;
        _passes[targetDid].username = movingName;
        _passes[targetDid].updatedAt = uint64(block.timestamp);

        // Source pass loses the name without receiving one.
        delete _passes[fromDid].username;
        _passes[fromDid].updatedAt = uint64(block.timestamp);

        emit UsernameTransferred(fromDid, targetDid, movingName);
    }

    /**
     * @notice Admin hook allowing the recovery module (contract owner) to
     *         reassign a pass to a new owner, e.g. after social recovery.
     * @param did The DID whose ownership changes.
     * @param newOwner The new pass owner.
     * @dev Only callable by the registry admin (the protocol / recovery
     *      module). Ownership of the DID record moves; the pass contents
     *      (DID, account, username) are preserved.
     */
    function setPassOwner(string calldata did, address newOwner) external onlyOwner {
        address current = _passOwners[did];
        if (current == address(0)) revert PassNotFound();
        if (newOwner == address(0)) revert InvalidAccount();

        _removeOwnerDid(current, did);
        _addOwnerDid(newOwner, did);
        _passOwners[did] = newOwner;

        emit PassOwnerSet(did, current, newOwner);
    }

    // ------------------------------------------------------------------------
    // Read API
    // ------------------------------------------------------------------------

    /**
     * @notice Resolves a pass by its DID.
     * @param did The decentralized identifier.
     * @return The full Pass struct.
     */
    function resolveByDid(string calldata did) external view returns (Pass memory) {
        if (_passOwners[did] == address(0)) revert PassNotFound();
        return _passes[did];
    }

    /**
     * @notice Resolves a pass by its username (case-insensitive).
     * @param username The username to look up; folded to lowercase.
     * @return The full Pass struct.
     */
    function resolveByUsername(string calldata username) external view returns (Pass memory) {
        string memory normalized = _normalizeAndValidate(username);
        string memory did = _usernameToDid[normalized];
        if (bytes(did).length == 0) revert PassNotFound();
        return _passes[did];
    }

    /**
     * @notice Resolves a pass by its bound smart account address.
     * @param account The smart account address.
     * @return The full Pass struct.
     */
    function resolveByAccount(address account) external view returns (Pass memory) {
        string memory did = _accountToDid[account];
        if (bytes(did).length == 0) revert PassNotFound();
        return _passes[did];
    }

    /**
     * @notice Returns the owner of a pass.
     * @param did The DID to query.
     * @return The pass owner, or address(0) if not registered.
     */
    function ownerOfDid(string calldata did) external view returns (address) {
        return _passOwners[did];
    }

    /**
     * @notice Returns all DIDs owned by `owner`.
     * @param owner The owner address.
     * @return Array of DIDs. Empty array for unknown owners.
     */
    function didsOfOwner(address owner) external view returns (string[] memory) {
        return _ownerDids[owner];
    }

    /**
     * @notice Returns the DID currently holding `username` ("" if free).
     * @param username The username to look up (normalized internally).
     * @return The DID holding the username, or "" when unclaimed.
     */
    function didOfUsername(string calldata username) external view returns (string memory) {
        return _usernameToDid[_normalizeAndValidate(username)];
    }
}
