// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC5192
 * @notice Minimal EIP-5192 interface for soulbound (non-transferable) NFTs.
 */
interface IERC5192 {
    /// @notice Emitted when a token is locked (soulbound).
    event Locked(uint256 tokenId);

    /// @notice Emitted when a token becomes transferable again (unused by
    ///         SoverityBadges since badges never unlock, but part of the EIP).
    event Unlocked(uint256 tokenId);

    /// @notice Returns whether a token is locked.
    function locked(uint256 tokenId) external view returns (bool);
}
