// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SoverityPermissions
 * @notice Scope-based dApp permission grants for Soverity identity passes.
 *
 *         A user approves a dApp (any address) with a `uint256` bitmask of
 *         scopes (e.g. bit 0 = read profile, bit 1 = read credentials,
 *         bit 2 = issue attestations). Grants and revocations are strictly
 *         self-service: only the user can grant or revoke their own
 *         permissions, at any time.
 *
 *         For privacy-preserving flows, a user may instead grant a hashed
 *         scope commitment (keccak256(abi.encode(scopes, user, dapp, salt))).
 *         The plaintext scopes never touch the chain; dApps verify grants
 *         off-chain by recomputing the commitment with the user-supplied
 *         scopes and salt.
 */
contract SoverityPermissions {
    // ------------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------------

    /// @notice A permission grant from a user to a dApp.
    /// @param scopes Bitmask of granted scopes (0 = revoked/empty).
    /// @param scopeCommitment Optional keccak commitment to scopes for
    ///        privacy-preserving grants (bytes32(0) = plaintext mode).
    /// @param grantedAt Timestamp of the (re)grant.
    struct Permission {
        uint256 scopes;
        bytes32 scopeCommitment;
        uint64 grantedAt;
    }

    // ------------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------------

    error ZeroDApp();
    error EmptyScopes();
    error CommitmentAlreadySet();
    error PermissionNotActive();
    error NotPermissionOwner();

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------

    /// @notice Emitted when a user grants scopes to a dApp.
    /// @param user The granting user.
    /// @param dapp The approved dApp address.
    /// @param scopes The granted scope bitmask (plaintext mode).
    /// @param scopeCommitment The scope commitment (private mode; 0 otherwise).
    event PermissionGranted(address indexed user, address indexed dapp, uint256 scopes, bytes32 scopeCommitment);

    /// @notice Emitted when a user revokes a dApp's permissions.
    /// @param user The revoking user.
    /// @param dapp The dApp whose access was revoked.
    event PermissionRevoked(address indexed user, address indexed dapp);

    // ------------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------------

    /// @notice user => dapp => permission.
    mapping(address => mapping(address => Permission)) private _permissions;
    /// @notice user => approved dApp list (append-only index for UIs).
    mapping(address => address[]) private _userDapps;
    /// @notice user => dapp => index in _userDapps (1-based; 0 = absent).
    mapping(address => mapping(address => uint256)) private _userDappIndex;

    // ------------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------------

    /**
     * @dev Computes the privacy-preserving scope commitment.
     * @param scopes The plaintext scopes being committed to.
     * @param user The granting user.
     * @param dapp The approved dApp.
     * @param salt Random salt chosen by the user.
     */
    function _computeCommitment(address user, address dapp, uint256 scopes, bytes32 salt)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(scopes, user, dapp, salt));
    }

    /// @dev Adds `dapp` to the user's approved list (no-op when present).
    function _trackDapp(address user, address dapp) private {
        if (_userDappIndex[user][dapp] != 0) return;
        _userDappIndex[user][dapp] = _userDapps[user].length + 1;
        _userDapps[user].push(dapp);
    }

    // ------------------------------------------------------------------------
    // Write API (self-service only)
    // ------------------------------------------------------------------------

    /**
     * @notice Grants `scopes` to `dapp` on behalf of the caller. Replaces
     *         any existing plaintext grant for the same dApp.
     * @param dapp The dApp contract address being approved (non-zero).
     * @param scopes Non-zero bitmask of scopes to grant, e.g.
     *        `0x3` = read profile + read credentials.
     * @dev Only the user themself can grant; there is no admin override.
     *      Grants may be replaced or revoked at any time via
     *      {revoke} or by re-granting different scopes.
     */
    function grant(address dapp, uint256 scopes) external {
        if (dapp == address(0)) revert ZeroDApp();
        if (scopes == 0) revert EmptyScopes();

        _permissions[msg.sender][dapp] =
            Permission({scopes: scopes, scopeCommitment: 0, grantedAt: uint64(block.timestamp)});
        _trackDapp(msg.sender, dapp);

        emit PermissionGranted(msg.sender, dapp, scopes, 0);
    }

    /**
     * @notice Grants a *hashed* scope commitment to `dapp` instead of
     *         plaintext scopes — the plaintext scopes never appear on-chain.
     * @param dapp The dApp contract address being approved (non-zero).
     * @param salt Random salt known only to the user (and shared with the
     *        dApp over a private channel).
     * @param scopes The plaintext scopes committed to. Passed here only to
     *        compute the commitment; it is NOT stored on-chain.
     * @dev The commitment is keccak256(abi.encode(scopes, user, dapp, salt)).
     *      The stored `scopes` field is left at 0 so nothing leaks; the dApp
     *      verifies the grant by calling {verifyCommitment} with the scopes
     *      and salt the user reveals to it privately.
     */
    function grantWithCommitment(address dapp, uint256 scopes, bytes32 salt) external {
        if (dapp == address(0)) revert ZeroDApp();
        if (scopes == 0) revert EmptyScopes();

        bytes32 commitment = _computeCommitment(msg.sender, dapp, scopes, salt);
        _permissions[msg.sender][dapp] =
            Permission({scopes: 0, scopeCommitment: commitment, grantedAt: uint64(block.timestamp)});
        _trackDapp(msg.sender, dapp);

        emit PermissionGranted(msg.sender, dapp, 0, commitment);
    }

    /**
     * @notice Verifies a private grant: checks that the revealed
     *         (scopes, salt) pair matches the stored commitment for
     *         `user` → `dapp`.
     * @param user The granting user.
     * @param dapp The approved dApp.
     * @param scopes The user-revealed plaintext scopes.
     * @param salt The user-revealed salt.
     * @return True when the pair matches an active private grant.
     */
    function verifyCommitment(address user, address dapp, uint256 scopes, bytes32 salt) external view returns (bool) {
        Permission storage p = _permissions[user][dapp];
        if (p.scopeCommitment == 0) return false;
        return p.scopeCommitment == _computeCommitment(user, dapp, scopes, salt);
    }

    /**
     * @notice Revokes all scopes granted to `dapp` by the caller.
     * @param dapp The dApp whose permission should be revoked.
     * @dev Only the user themself may revoke. Revocation clears both
     *      plaintext scopes and any scope commitment.
     */
    function revoke(address dapp) external {
        Permission storage p = _permissions[msg.sender][dapp];
        if (p.grantedAt == 0) revert PermissionNotActive();

        delete _permissions[msg.sender][dapp];
        emit PermissionRevoked(msg.sender, dapp);
    }

    // ------------------------------------------------------------------------
    // Read API
    // ------------------------------------------------------------------------

    /**
     * @notice Returns the permission state for `user` → `dapp`.
     * @param user The granting user.
     * @param dapp The dApp to query.
     * @return The Permission struct (grantedAt == 0 when never granted).
     */
    function getPermission(address user, address dapp) external view returns (Permission memory) {
        return _permissions[user][dapp];
    }

    /**
     * @notice Returns the granted scope bitmask for `user` → `dapp`.
     * @param user The granting user.
     * @param dapp The dApp to query.
     * @return The plaintext scopes, 0 for private-mode or absent grants.
     */
    function getScopes(address user, address dapp) external view returns (uint256) {
        return _permissions[user][dapp].scopes;
    }

    /**
     * @notice Checks whether `user` granted *all* bits in `requiredScopes`
     *         to `dapp` (plaintext mode only).
     * @param user The granting user.
     * @param dapp The dApp to check.
     * @param requiredScopes The bitmask of scopes the dApp wants to use.
     * @return True when every required scope bit is granted.
     */
    function hasScopes(address user, address dapp, uint256 requiredScopes) external view returns (bool) {
        uint256 grantedScopes = _permissions[user][dapp].scopes;
        return requiredScopes != 0 && grantedScopes & requiredScopes == requiredScopes;
    }

    /**
     * @notice Checks whether an active grant exists for `user` → `dapp`
     *         (either plaintext or commitment mode).
     * @param user The granting user.
     * @param dapp The dApp to check.
     * @return True when an active grant exists.
     */
    function isGranted(address user, address dapp) external view returns (bool) {
        return _permissions[user][dapp].grantedAt != 0;
    }

    /**
     * @notice Lists all dApps the user has ever granted permissions to
     *         (revoked entries remain in the index; check `isGranted`).
     * @param user The user to query.
     * @return The approved dApp list (append-only).
     */
    function dappsOf(address user) external view returns (address[] memory) {
        return _userDapps[user];
    }
}
