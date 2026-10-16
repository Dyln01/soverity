// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SoverityBadges} from "../src/SoverityBadges.sol";
import {IERC721} from "openzeppelin-contracts/interfaces/IERC721.sol";
import {IERC5192} from "../src/interfaces/IERC5192.sol";

/**
 * @title SoverityBadgesTest
 * @notice Coverage for soulbound ERC-721 badges: minting, EIP-5192 locks,
 *         transfer blocking, tiers, metadata and access control.
 */
contract SoverityBadgesTest is Test {
    SoverityBadges internal badges;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal holder = makeAddr("holder");
    address internal other = makeAddr("other");

    string internal constant URI = "ipfs://QmBadgeMeta";

    function setUp() public {
        vm.prank(admin);
        badges = new SoverityBadges(issuer);
    }

    function _mint(SoverityBadges.Tier tier) internal returns (uint256) {
        vm.prank(issuer);
        return badges.mint(holder, tier, URI);
    }

    // ------------------------------------------------------------------
    // mint
    // ------------------------------------------------------------------

    function test_Mint_HappyPath() public {
        uint256 tokenId = _mint(SoverityBadges.Tier.Gold);
        assertEq(tokenId, 1);
        assertEq(badges.ownerOf(tokenId), holder);
        assertEq(uint8(badges.tierOf(tokenId)), uint8(SoverityBadges.Tier.Gold));
        assertEq(badges.tokenURI(tokenId), URI);
        assertEq(badges.nextTokenId(), 2);
    }

    function test_Mint_EmitsLocked() public {
        vm.expectEmit(true, true, true, true);
        emit IERC5192.Locked(1);
        vm.prank(issuer);
        badges.mint(holder, SoverityBadges.Tier.Bronze, URI);
    }

    function test_Mint_RevertWhen_NotIssuer() public {
        vm.prank(other);
        vm.expectRevert(SoverityBadges.NotIssuer.selector);
        badges.mint(holder, SoverityBadges.Tier.Bronze, URI);
    }

    function test_Mint_SequentialTiers() public {
        SoverityBadges.Tier[3] memory tiers =
            [SoverityBadges.Tier.Bronze, SoverityBadges.Tier.Silver, SoverityBadges.Tier.Gold];
        for (uint256 i = 0; i < 3; ++i) {
            uint256 id = _mint(tiers[i]);
            assertEq(uint8(badges.tierOf(id)), uint8(tiers[i]));
        }
    }

    // ------------------------------------------------------------------
    // soulbound enforcement (EIP-5192)
    // ------------------------------------------------------------------

    function test_Transfer_RevertWhen_Soulbound() public {
        uint256 tokenId = _mint(SoverityBadges.Tier.Bronze);
        vm.prank(holder);
        vm.expectRevert(bytes("SoverityBadges: soulbound"));
        badges.transferFrom(holder, other, tokenId);
    }

    function test_SafeTransfer_RevertWhen_Soulbound() public {
        uint256 tokenId = _mint(SoverityBadges.Tier.Bronze);
        vm.prank(holder);
        vm.expectRevert(bytes("SoverityBadges: soulbound"));
        badges.safeTransferFrom(holder, other, tokenId);
    }

    function test_Locked_View() public {
        uint256 tokenId = _mint(SoverityBadges.Tier.Silver);
        assertTrue(badges.locked(tokenId));
        // Non-existent tokens are not "locked".
        assertFalse(badges.locked(999));
    }

    function test_EIP5192_InterfaceSupported() public view {
        // Canonical ERC-165 interface id for EIP-5192 (minimal soulbound NFT).
        assertTrue(badges.supportsInterface(0x9d76f020));
        assertTrue(badges.supportsInterface(type(IERC721).interfaceId));
        assertFalse(badges.supportsInterface(0xffffffff));
    }

    // ------------------------------------------------------------------
    // issuer role
    // ------------------------------------------------------------------

    function test_SetIssuer_AdminCanRotate() public {
        vm.prank(admin);
        badges.setIssuer(other, true);
        assertTrue(badges.isIssuer(other));

        vm.prank(other);
        uint256 id = badges.mint(holder, SoverityBadges.Tier.Bronze, URI);
        assertEq(badges.ownerOf(id), holder);

        vm.prank(admin);
        badges.setIssuer(other, false);
        assertFalse(badges.isIssuer(other));
    }

    function test_SetIssuer_RevertWhen_NotAdmin() public {
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), other));
        badges.setIssuer(other, true);
    }

    // ------------------------------------------------------------------
    // metadata / burn
    // ------------------------------------------------------------------

    function test_TokenURI_RevertWhen_Nonexistent() public {
        vm.expectRevert(SoverityBadges.NonexistentToken.selector);
        badges.tokenURI(42);
    }

    function test_Burn_AdminOnly() public {
        uint256 tokenId = _mint(SoverityBadges.Tier.Gold);

        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), holder));
        badges.burn(tokenId);

        vm.prank(admin);
        badges.burn(tokenId);
        // After burn the token is gone: OZ raises ERC721NonexistentToken.
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("ERC721NonexistentToken(uint256)")), tokenId));
        badges.ownerOf(tokenId);
    }
}
