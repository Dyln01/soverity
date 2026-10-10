// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";
import {SoverityRegistry} from "./SoverityRegistry.sol";

/**
 * @title SoverityRecovery
 * @notice Guardian-based social recovery for Soverity passes.
 *
 *         A user (the pass owner) registers trusted guardians. When the
 *         owner loses their keys, guardians propose a recovery to a new
 *         owner candidate and approve it. Once the approval threshold is
 *         met AND the timelock delay has elapsed (default 48h), anyone can
 *         execute the recovery, transferring pass ownership to the candidate.
 *
 *         The module optionally holds a reference to the {SoverityRegistry}.
 *         When this contract is the registry admin, `executeRecovery` also
 *         reassigns pass ownership on the registry automatically.
 */
contract SoverityRecovery is Ownable {
    // ------------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------------

    /// @notice An in-flight recovery proposal.
    /// @param did The pass (DID) being recovered.
    /// @param candidate The proposed new owner.
    /// @param approvals Bitmask of guardian approvals (bit i = guardian i).
    /// @param approvalCount Number of approvals collected.
    /// @param proposedAt Timestamp of the first approval; timelock anchor.
    /// @param executableAt Timestamp after which execution is allowed
    ///        (proposedAt + delay); 0 while below threshold.
    struct RecoveryProposal {
        string did;
        address candidate;
        uint256 approvals;
        uint256 approvalCount;
        uint64 proposedAt;
        uint64 executableAt;
    }

    // ------------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------------

    error NotGuardian();
    error AlreadyGuardian();
    error GuardianLimitExceeded();
    error ZeroAddress();
    error ProposalNotFound();
    error ProposalAlreadyActive();
    error ThresholdNotMet();
    error TimelockNotElapsed();
    error AlreadyApproved();
    error InvalidThreshold();

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------

    /// @notice Emitted when a guardian is added.
    /// @param guardian The added guardian.
    event GuardianAdded(address indexed guardian);
    /// @notice Emitted when a guardian is removed.
    /// @param guardian The removed guardian.
    event GuardianRemoved(address indexed guardian);
    /// @notice Emitted when a recovery proposal is created.
    /// @param did The pass being recovered.
    /// @param candidate The proposed new owner.
    /// @param proposedAt The timelock anchor timestamp.
    event RecoveryProposed(string indexed did, address indexed candidate, uint64 proposedAt);
    /// @notice Emitted when a guardian approves a proposal.
    /// @param did The pass being recovered.
    /// @param guardian The approving guardian.
    /// @param approvalCount Approvals collected so far.
    event RecoveryApproved(string indexed did, address indexed guardian, uint256 approvalCount);
    /// @notice Emitted when a recovery is executed.
    /// @param did The recovered pass.
    /// @param newOwner The installed new owner.
    event RecoveryExecuted(string indexed did, address indexed newOwner);
    /// @notice Emitted when a recovery is cancelled.
    /// @param did The pass whose recovery was cancelled.
    event RecoveryCancelled(string indexed did);

    // ------------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------------

    uint256 public constant MAX_GUARDIANS = 255;
    /// @notice Minimum number of guardian approvals required.
    uint256 public immutable threshold;
    /// @notice Timelock delay in seconds (default 48h).
    uint256 public immutable timelockDelay;

    /// @notice Ordered guardian set.
    address[] private _guardians;
    /// @notice guardian => index in _guardians (1-based; 0 = not guardian).
    mapping(address => uint256) private _guardianIndex;

    /// @notice did => active recovery proposal.
    mapping(string => RecoveryProposal) private _proposals;

    /// @notice Optional registry the module can reassign pass ownership on.
    SoverityRegistry public immutable registry;

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    /// @notice Deploys the recovery module.
    /// @param registry_ The SoverityRegistry this module can reassign pass
    ///        ownership on (set to the zero address to run standalone).
    /// @param guardians_ Initial guardian set (1..255 addresses, unique).
    /// @param threshold_ Required guardian approvals (1 <= threshold_ <= guardians.length).
    /// @param timelockDelay_ Seconds between threshold being met and
    ///        execution (e.g. 48 hours = 172800).
    constructor(SoverityRegistry registry_, address[] memory guardians_, uint256 threshold_, uint256 timelockDelay_)
        Ownable(msg.sender)
    {
        if (guardians_.length == 0 || guardians_.length > MAX_GUARDIANS) revert GuardianLimitExceeded();
        if (threshold_ == 0 || threshold_ > guardians_.length) revert InvalidThreshold();
        if (timelockDelay_ == 0) revert InvalidThreshold();

        for (uint256 i = 0; i < guardians_.length; ++i) {
            address g = guardians_[i];
            if (g == address(0)) revert ZeroAddress();
            if (_guardianIndex[g] != 0) revert AlreadyGuardian();
            _guardianIndex[g] = i + 1;
            _guardians.push(g);
        }

        threshold = threshold_;
        timelockDelay = timelockDelay_;
        registry = registry_;
    }

    // ------------------------------------------------------------------------
    // Guardian management (owner only)
    // ------------------------------------------------------------------------

    /**
     * @notice Adds a guardian to the trusted set.
     * @param guardian The guardian address (non-zero, not already present).
     * @dev Owner only. The threshold never changes automatically, so keep
     *      the guardian count above `threshold` for recovery to stay usable.
     */
    function addGuardian(address guardian) external onlyOwner {
        if (guardian == address(0)) revert ZeroAddress();
        if (_guardianIndex[guardian] != 0) revert AlreadyGuardian();
        if (_guardians.length >= MAX_GUARDIANS) revert GuardianLimitExceeded();

        _guardianIndex[guardian] = _guardians.length + 1;
        _guardians.push(guardian);
        emit GuardianAdded(guardian);
    }

    /**
     * @notice Removes a guardian from the trusted set.
     * @param guardian The guardian address to remove.
     * @dev Owner only. Reverts if the remaining guardian count would fall
     *      below the threshold.
     */
    function removeGuardian(address guardian) external onlyOwner {
        uint256 idx = _guardianIndex[guardian];
        if (idx == 0) revert NotGuardian();
        if (_guardians.length <= threshold) revert ThresholdNotMet();

        uint256 i = idx - 1;
        uint256 last = _guardians.length - 1;
        if (i != last) {
            _guardians[i] = _guardians[last];
            _guardianIndex[_guardians[last]] = i + 1;
        }
        _guardians.pop();
        delete _guardianIndex[guardian];
        emit GuardianRemoved(guardian);
    }

    // ------------------------------------------------------------------------
    // Recovery flow
    // ------------------------------------------------------------------------

    /**
     * @notice Proposes a recovery of `did` to `candidate`.
     * @param did The pass (DID) to recover.
     * @param candidate The proposed new owner address.
     * @dev Only guardians may propose. Starts (or restarts) the timelock
     *      window; the proposal becomes executable once `threshold`
     *      guardians have approved AND `timelockDelay` seconds passed since
     *      the proposal was created.
     */
    function proposeRecovery(string calldata did, address candidate) external {
        if (_guardianIndex[msg.sender] == 0) revert NotGuardian();
        if (candidate == address(0)) revert ZeroAddress();
        if (bytes(_proposals[did].did).length != 0) revert ProposalAlreadyActive();

        _proposals[did] = RecoveryProposal({
            did: did,
            candidate: candidate,
            approvals: 0,
            approvalCount: 0,
            proposedAt: uint64(block.timestamp),
            executableAt: 0
        });
        emit RecoveryProposed(did, candidate, uint64(block.timestamp));

        // The proposing guardian's approval is implied and recorded here.
        _approve(did);
    }

    /**
     * @notice Records a guardian's approval of the active recovery proposal
     *         for `did`.
     * @param did The pass being recovered.
     * @dev Guardians only; each guardian approves at most once. When the
     *      approval count reaches `threshold`, `executableAt` is anchored.
     */
    function approveRecovery(string calldata did) external {
        if (_guardianIndex[msg.sender] == 0) revert NotGuardian();
        _approve(did);
    }

    /// @dev Shared approval bookkeeping with bitmask deduplication.
    function _approve(string memory did) private {
        RecoveryProposal storage p = _proposals[did];
        if (bytes(p.did).length == 0) revert ProposalNotFound();

        uint256 guardianBit = _guardianIndex[msg.sender] - 1;
        if (p.approvals & (1 << guardianBit) != 0) revert AlreadyApproved();

        p.approvals |= 1 << guardianBit;
        p.approvalCount += 1;
        emit RecoveryApproved(did, msg.sender, p.approvalCount);

        if (p.approvalCount == threshold && p.executableAt == 0) {
            p.executableAt = uint64(block.timestamp + timelockDelay);
        }
    }

    /**
     * @notice Executes a matured recovery proposal and installs `candidate`
     *         as the new pass owner.
     * @param did The pass being recovered.
     * @dev Callable by anyone (including the candidate) once the threshold
     *      is met and the timelock has elapsed. The proposal is deleted
     *      afterwards. When a {SoverityRegistry} reference was provided at
     *      deployment, ownership of the pass is reassigned there directly
     *      via `setPassOwner`.
     */
    function executeRecovery(string calldata did) external {
        RecoveryProposal storage p = _proposals[did];
        if (bytes(p.did).length == 0) revert ProposalNotFound();
        if (p.approvalCount < threshold) revert ThresholdNotMet();
        if (block.timestamp < p.executableAt) revert TimelockNotElapsed();

        address newOwner = p.candidate;
        delete _proposals[did];

        // Reassign pass ownership on the registry when wired up. The call
        // reverts (and bubbles up) if the pass does not exist there.
        if (address(registry) != address(0)) {
            registry.setPassOwner(did, newOwner);
        }

        emit RecoveryExecuted(did, newOwner);
    }

    /**
     * @notice Cancels the active recovery proposal for `did`.
     * @param did The pass whose recovery should be cancelled.
     * @dev Callable by the owner or by any guardian. The proposal is
     *      deleted and a fresh proposal would need fresh approvals.
     */
    function cancelRecovery(string calldata did) external {
        RecoveryProposal storage p = _proposals[did];
        if (bytes(p.did).length == 0) revert ProposalNotFound();
        if (msg.sender != owner() && _guardianIndex[msg.sender] == 0) revert NotGuardian();

        delete _proposals[did];
        emit RecoveryCancelled(did);
    }

    // ------------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------------

    /**
     * @notice Returns the guardian set.
     * @return The ordered guardian addresses.
     */
    function getGuardians() external view returns (address[] memory) {
        return _guardians;
    }

    /**
     * @notice Returns the number of registered guardians.
     * @return The guardian count.
     */
    function guardianCount() external view returns (uint256) {
        return _guardians.length;
    }

    /**
     * @notice Returns whether an address is a registered guardian.
     * @param account The address to check.
     * @return True when the address is a guardian.
     */
    function isGuardian(address account) external view returns (bool) {
        return _guardianIndex[account] != 0;
    }

    /**
     * @notice Returns the active recovery proposal for a pass.
     * @param did The pass (DID) to query.
     * @return The RecoveryProposal (did == "" when none is active).
     */
    function getProposal(string calldata did) external view returns (RecoveryProposal memory) {
        return _proposals[did];
    }

    /**
     * @notice Returns whether a guardian has approved the active proposal.
     * @param did The pass being recovered.
     * @param guardian The guardian to check.
     * @return True when the guardian's approval bit is set.
     */
    function hasApproved(string calldata did, address guardian) external view returns (bool) {
        uint256 idx = _guardianIndex[guardian];
        if (idx == 0) return false;
        return _proposals[did].approvals & (1 << (idx - 1)) != 0;
    }
}
