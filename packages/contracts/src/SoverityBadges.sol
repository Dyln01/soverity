// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "openzeppelin-contracts/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {IERC5192} from "./interfaces/IERC5192.sol";

/**
 * @title SoverityBadges
 * @notice Soulbound (non-transferable) ERC-721 badges for the Soverity
 *         identity protocol, with issuer-role minting and Bronze/Silver/Gold
 *         tiers.
 *
 *         Transfers are permanently disabled by overriding `_update`,
 *         per EIP-5192 (minimal soulbound NFTs):
 *           - `locked(uint256)` returns true for every existing token,
 *           - `Locked(uint256)` is emitted on mint.
 */
contract SoverityBadges is ERC721, Ownable {
    // ------------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------------

    /// @notice Badge tier.
    enum Tier {
        Bronze,
        Silver,
        Gold
    }

    // ------------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------------

    error NotIssuer();
    error AlreadyMinted();
    error NonexistentToken();
    error InvalidTier();

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------

    /// @notice Emitted when a badge is minted (EIP-5192 lock signal).
    /// @param tokenId The locked token ID.
    event Locked(uint256 tokenId);

    /// @notice Emitted when a badge is minted with its tier and metadata.
    /// @param tokenId The minted token ID.
    /// @param to The soulbound recipient.
    /// @param tier The badge tier.
    /// @param metadataURI The off-chain metadata URI.
    event BadgeMinted(uint256 indexed tokenId, address indexed to, Tier tier, string metadataURI);

    /// @notice Emitted when an address is granted or revoked the issuer role.
    /// @param issuer The affected address.
    /// @param granted True when granted, false when revoked.
    event IssuerUpdated(address indexed issuer, bool granted);

    /// @notice EIP-5192 compatibility event (never emitted after mint since
    ///         tokens never unlock; declared for interface completeness).
    event Unlocked(uint256 tokenId);

    // ------------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------------

    /// @notice tokenId => tier.
    mapping(uint256 => Tier) public tierOf;
    /// @notice tokenId => metadata URI.
    mapping(uint256 => string) private _tokenURIs;
    /// @notice issuer addresses allowed to mint.
    mapping(address => bool) public isIssuer;
    /// @notice Next token ID to mint (starts at 1).
    uint256 private _nextTokenId = 1;

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    /// @notice Deploys the badge contract with the deployer as admin/issuer.
    /// @param initialIssuer The address granted the issuer role at deploy.
    constructor(address initialIssuer) ERC721("Soverity Badges", "SOVB") Ownable(msg.sender) {
        if (initialIssuer != address(0)) {
            isIssuer[initialIssuer] = true;
            emit IssuerUpdated(initialIssuer, true);
        }
    }

    // ------------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------------

    /// @dev Reverts unless the caller holds the issuer role or is the owner.
    modifier onlyIssuer() {
        if (!isIssuer[msg.sender] && msg.sender != owner()) revert NotIssuer();
        _;
    }

    // ------------------------------------------------------------------------
    // Write API
    // ------------------------------------------------------------------------

    /**
     * @notice Grants or revokes the issuer role. Issuers may mint badges.
     * @param issuer The affected address.
     * @param granted True to grant, false to revoke.
     * @dev Admin (owner) only.
     */
    function setIssuer(address issuer, bool granted) external onlyOwner {
        isIssuer[issuer] = granted;
        emit IssuerUpdated(issuer, granted);
    }

    /**
     * @notice Mints a soulbound badge to `to`. The badge can never be
     *         transferred away from the recipient.
     * @param to The soulbound recipient (badge holder).
     * @param tier The badge tier (Bronze, Silver or Gold).
     * @param metadataURI_ The off-chain metadata URI for the badge.
     * @return tokenId The minted token ID (sequential from 1).
     * @dev Issuer role or admin only. Emits EIP-5192 `Locked(tokenId)`.
     */
    function mint(address to, Tier tier, string calldata metadataURI_) external onlyIssuer returns (uint256 tokenId) {
        if (uint8(tier) > uint8(Tier.Gold)) revert InvalidTier();
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        tierOf[tokenId] = tier;
        _tokenURIs[tokenId] = metadataURI_;

        emit BadgeMinted(tokenId, to, tier, metadataURI_);
        emit Locked(tokenId);
    }

    /**
     * @notice Burns a badge. Restricted to the admin (e.g. when a pass is
     *         compromised); holders can never burn their own badges.
     * @param tokenId The badge to burn.
     * @dev Admin only.
     */
    function burn(uint256 tokenId) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken();
        _burn(tokenId);
        delete tierOf[tokenId];
        delete _tokenURIs[tokenId];
    }

    // ------------------------------------------------------------------------
    // EIP-5192 / soulbound enforcement
    // ------------------------------------------------------------------------

    /**
     * @notice EIP-5192: every existing token reports as locked (soulbound).
     * @param tokenId The token to query.
     * @return True when the token exists (soulbound tokens never unlock).
     */
    function locked(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /**
     * @notice ERC-165: reports support for the EIP-5192 interface
     *         (0x9d76f020) in addition to ERC-721.
     * @param interfaceId The interface id to check.
     * @return True when the interface is supported.
     */
    function supportsInterface(bytes4 interfaceId) public view override(ERC721) returns (bool) {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @dev OZ v5 ERC721 hook — blocks ALL transfers and explicitly permits
     *      minting (to == 0) and burning (from == 0).
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("SoverityBadges: soulbound");
        }
        return super._update(to, tokenId, auth);
    }

    // ------------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------------

    /**
     * @notice Returns the metadata URI for a badge.
     * @param tokenId The badge token ID.
     * @return The stored metadata URI.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken();
        return _tokenURIs[tokenId];
    }

    /**
     * @notice Returns the next token ID that will be minted.
     * @return The upcoming token ID.
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
