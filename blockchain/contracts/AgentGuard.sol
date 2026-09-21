// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentGuard is Ownable2Step, Pausable, ReentrancyGuard {
    uint256 public constant MAX_ALLOWED_RECIPIENTS = 100;

    struct Policy {
        uint256 perTransactionLimit;
        uint256 dailyLimit;
        uint64 expiresAt;
        bool walletPaused;
        bool allowlistEnforced;
    }

    mapping(address user => Policy policy) private _policies;
    mapping(address user => mapping(uint256 day => uint256 amount)) private _dailySpent;
    mapping(address user => mapping(address recipient => bool allowed)) public isRecipientAllowed;
    mapping(address user => address[] recipients) private _allowedRecipients;
    mapping(address user => mapping(address recipient => uint256 indexPlusOne))
        private _recipientIndexes;
    mapping(address user => mapping(bytes32 intentHash => bool used)) public usedIntentHash;
    mapping(address user => uint256 amount) public depositedBalance;

    error InvalidAmount();
    error InvalidPolicy();
    error PolicyExpired();
    error WalletPaused();
    error RecipientNotAllowed();
    error TransactionLimitExceeded();
    error DailyLimitExceeded();
    error IntentAlreadyUsed();
    error InvalidIntentHash();
    error TooManyRecipients();
    error TransferFailed();
    error InsufficientBalance();

    event PolicyUpdated(
        address indexed user,
        uint256 perTransactionLimit,
        uint256 dailyLimit,
        uint64 expiresAt,
        bool allowlistEnforced
    );
    event RecipientPermissionUpdated(
        address indexed user,
        address indexed recipient,
        bool allowed
    );
    event WalletPauseUpdated(address indexed user, bool paused);
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event PaymentExecuted(
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed intentHash,
        bool fundedFromBalance
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setPolicy(
        uint256 perTransactionLimit,
        uint256 dailyLimit,
        uint64 expiresAt,
        bool allowlistEnforced
    ) external {
        if (
            perTransactionLimit == 0 ||
            dailyLimit < perTransactionLimit ||
            expiresAt <= block.timestamp
        ) {
            revert InvalidPolicy();
        }

        Policy storage policy = _policies[msg.sender];
        policy.perTransactionLimit = perTransactionLimit;
        policy.dailyLimit = dailyLimit;
        policy.expiresAt = expiresAt;
        policy.allowlistEnforced = allowlistEnforced;
        emit PolicyUpdated(
            msg.sender,
            perTransactionLimit,
            dailyLimit,
            expiresAt,
            allowlistEnforced
        );
    }

    function setRecipient(address recipient, bool allowed) external {
        if (recipient == address(0) || recipient == address(this)) {
            revert RecipientNotAllowed();
        }
        bool current = isRecipientAllowed[msg.sender][recipient];
        if (current == allowed) return;

        isRecipientAllowed[msg.sender][recipient] = allowed;
        if (allowed) {
            if (_allowedRecipients[msg.sender].length >= MAX_ALLOWED_RECIPIENTS) {
                revert TooManyRecipients();
            }
            _allowedRecipients[msg.sender].push(recipient);
            _recipientIndexes[msg.sender][recipient] = _allowedRecipients[msg.sender].length;
        } else {
            uint256 index = _recipientIndexes[msg.sender][recipient] - 1;
            uint256 lastIndex = _allowedRecipients[msg.sender].length - 1;
            if (index != lastIndex) {
                address moved = _allowedRecipients[msg.sender][lastIndex];
                _allowedRecipients[msg.sender][index] = moved;
                _recipientIndexes[msg.sender][moved] = index + 1;
            }
            _allowedRecipients[msg.sender].pop();
            delete _recipientIndexes[msg.sender][recipient];
        }
        emit RecipientPermissionUpdated(msg.sender, recipient, allowed);
    }

    function setWalletPaused(bool paused) external {
        _policies[msg.sender].walletPaused = paused;
        emit WalletPauseUpdated(msg.sender, paused);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function deposit() public payable whenNotPaused {
        if (msg.value == 0) revert InvalidAmount();
        depositedBalance[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    receive() external payable {
        deposit();
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (depositedBalance[msg.sender] < amount) revert InsufficientBalance();
        depositedBalance[msg.sender] -= amount;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit Withdrawal(msg.sender, amount);
    }

    function executePayment(
        address payable recipient,
        bytes32 intentHash
    ) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        _validateAndRecord(msg.sender, recipient, msg.value, intentHash);
        (bool sent, ) = recipient.call{value: msg.value}("");
        if (!sent) revert TransferFailed();
        emit PaymentExecuted(msg.sender, recipient, msg.value, intentHash, false);
    }

    function executeFromBalance(
        address payable recipient,
        uint256 amount,
        bytes32 intentHash
    ) external whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (depositedBalance[msg.sender] < amount) revert InsufficientBalance();
        _validateAndRecord(msg.sender, recipient, amount, intentHash);
        depositedBalance[msg.sender] -= amount;
        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit PaymentExecuted(msg.sender, recipient, amount, intentHash, true);
    }

    function policyOf(
        address user
    )
        external
        view
        returns (
            uint256 perTransactionLimit,
            uint256 dailyLimit,
            uint64 expiresAt,
            bool walletPaused,
            bool allowlistEnforced,
            uint256 spent
        )
    {
        Policy memory policy = _policies[user];
        return (
            policy.perTransactionLimit,
            policy.dailyLimit,
            policy.expiresAt,
            policy.walletPaused,
            policy.allowlistEnforced,
            spentToday(user)
        );
    }

    function allowedRecipients(address user) external view returns (address[] memory) {
        return _allowedRecipients[user];
    }

    function spentToday(address user) public view returns (uint256) {
        return _dailySpent[user][block.timestamp / 1 days];
    }

    function _validateAndRecord(
        address payer,
        address recipient,
        uint256 amount,
        bytes32 intentHash
    ) private {
        Policy memory policy = _policies[payer];
        if (policy.perTransactionLimit == 0 || policy.dailyLimit == 0) revert InvalidPolicy();
        if (policy.walletPaused) revert WalletPaused();
        if (policy.expiresAt <= block.timestamp) revert PolicyExpired();
        if (recipient == address(0) || recipient == address(this)) revert RecipientNotAllowed();
        if (policy.allowlistEnforced && !isRecipientAllowed[payer][recipient]) {
            revert RecipientNotAllowed();
        }
        if (amount > policy.perTransactionLimit) revert TransactionLimitExceeded();

        uint256 day = block.timestamp / 1 days;
        uint256 newSpent = _dailySpent[payer][day] + amount;
        if (newSpent > policy.dailyLimit) revert DailyLimitExceeded();
        if (intentHash == bytes32(0)) revert InvalidIntentHash();
        if (usedIntentHash[payer][intentHash]) revert IntentAlreadyUsed();

        _dailySpent[payer][day] = newSpent;
        usedIntentHash[payer][intentHash] = true;
    }
}
