// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
// import {SepoliaConfig} from "./config/ZamaConfig.sol";
import {IPriceOracle} from "./PriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FHE Perpetual Contract Trading Contract
 * @notice Supports 1x leverage fully encrypted perpetual contract trading
 * @dev Each contract has a fixed face value of 1 USD, BTC positions are precise to satoshi
 */
contract PositionTrader is SepoliaConfig, Ownable {
    // ============================
    // Constant Definitions
    // ============================

    uint64 public immutable INITIAL_CASH_BASE; // Initial virtual assets (USD)
    uint64 public constant CONTRACT_USD_VALUE = 1; // Value per contract (USD)
    uint64 public constant BTC_PRECISION = 1e8; // BTC precision (satoshi)
    uint256 public constant CALCULATION_PRECISION = 1e8; // Calculation precision

    // ============================
    // State Variables
    // ============================

    address public priceOracleAddress;

    uint256 private _positionCounter;

    // ============================
    // Data Structures
    // ============================

    struct Position {
        address owner; // Position owner
        euint64 contractCount; // Number of contracts
        euint64 btcSize; // BTC position size (satoshi)
        uint64 entryPrice; // Entry price (USD/BTC)
        ebool isLong; // Long/Short identifier
        uint256 openTimestamp; // Position opening timestamp
    }

    struct Balance {
        euint64 usd; // USD balance (encrypted)
    }

    struct BalanceReveal {
        uint64 amount; // Balance amount when decrypted
        uint256 timestamp; // Decryption timestamp
    }

    struct DecryptionRequest {
        address user; // User requesting decryption
        uint256 timestamp; // Request timestamp
    }

    // ============================
    // Mapping Storage
    // ============================

    mapping(uint256 => Position) private _positions;
    mapping(address => Balance) private _balances;
    mapping(address => bool) public isRegistered;
    mapping(address => uint256[]) private _userPositions;
    mapping(address => BalanceReveal) private _latestBalanceReveal;
    mapping(uint256 => DecryptionRequest) private _decryptionRequests;
    
    // Leaderboard related storage
    address[] private _revealedUsers; // All user addresses who have performed balance decryption

    // ============================
    // Event Definitions
    // ============================

    event UserRegistered(address indexed user);
    event PositionOpened(address indexed user, uint256 indexed positionId, uint64 entryPrice, uint256 timestamp);
    event PositionClosed(address indexed user, uint256 indexed positionId, uint64 exitPrice, uint256 timestamp);
    event BalanceRevealed(address indexed user, uint64 amount, uint256 timestamp);
    event DecryptionRequested(address indexed user, uint256 indexed requestId, uint256 timestamp);
    event PriceOracleUpdated(address indexed oldOracle, address indexed newOracle);

    // ============================
    // Modifiers
    // ============================

    modifier onlyRegistered() {
        require(isRegistered[msg.sender], "User not registered");
        _;
    }

    modifier validPositionOwner(uint256 positionId) {
        require(_positions[positionId].owner == msg.sender, "Not position owner");
        _;
    }

    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid zero address");
        _;
    }

    // ============================
    // Constructor
    // ============================

    /**
     * @notice Constructor
     * @param _priceOracle Price oracle address
     * @param _initialCashBase Initial virtual asset amount for user registration (USD)
     */
    constructor(address _priceOracle, uint64 _initialCashBase) Ownable(msg.sender) validAddress(_priceOracle) {
        require(_initialCashBase > 0, "Initial cash base must be greater than 0");
        priceOracleAddress = _priceOracle;
        INITIAL_CASH_BASE = _initialCashBase;
    }

    // ============================
    // User Management
    // ============================

    /**
     * @notice Register new user and allocate initial virtual assets
     * @dev Each address can only register once
     */
    function register() external {
        require(!isRegistered[msg.sender], "User already registered");

        euint64 initialBalance = FHE.asEuint64(INITIAL_CASH_BASE);
        _authorizeHandle(initialBalance);

        _balances[msg.sender] = Balance({usd: initialBalance});
        isRegistered[msg.sender] = true;

        emit UserRegistered(msg.sender);
    }

    // ============================
    // Query Functions
    // ============================

    /**
     * @notice Get user USD balance (encrypted)
     * @param user User address
     * @return balance User's USD balance
     */
    function getBalance(address user) external view returns (euint64 balance) {
        require(isRegistered[user], "User not registered");
        return _balances[user].usd;
    }

    /**
     * @notice Get specific position information
     * @param positionId Position ID
     * @return owner Position owner address
     * @return contractCount Number of contracts (encrypted)
     * @return btcSize BTC position size (encrypted)
     * @return entryPrice Entry price
     * @return isLong Whether long position (encrypted)
     */
    function getPosition(
        uint256 positionId
    ) external view returns (address owner, euint64 contractCount, euint64 btcSize, uint64 entryPrice, ebool isLong,uint256 openTimestamp) {
        Position memory pos = _positions[positionId];
        
        return (pos.owner, pos.contractCount, pos.btcSize, pos.entryPrice, pos.isLong,pos.openTimestamp);
    }

    /**
     * @notice Get all position IDs for a user
     * @param user User address
     * @return Array of position IDs
     */
    function getUserPositionIds(address user) external view returns (uint256[] memory) {
        return _userPositions[user];
    }

    /**
     * @notice Get current BTC price
     * @return price Adjusted BTC price
     */
    function getCurrentBtcPrice() external view returns (uint64 price) {
        return _getAdjustedBtcPrice();
    }

    /**
     * @notice Request decryption of own USD balance
     * @dev Send asynchronous decryption request to FHEVM backend
     * @return requestId ID of the decryption request
     */
    function revealMyBalance() external onlyRegistered returns (uint256 requestId) {
        uint256 timestamp = block.timestamp;

        // Prepare ciphertext array for decryption
        bytes32[] memory cipherTexts = new bytes32[](1);
        cipherTexts[0] = FHE.toBytes32(_balances[msg.sender].usd);

        // Send decryption request
        requestId = FHE.requestDecryption(cipherTexts, this.callbackRevealBalance.selector);

        // Record decryption request
        _decryptionRequests[requestId] = DecryptionRequest({user: msg.sender, timestamp: timestamp});

        emit DecryptionRequested(msg.sender, requestId, timestamp);

        return requestId;
    }

    /**
     * @notice Callback function after FHEVM backend decrypts balance
     * @param requestId Decryption request ID
     * @param decryptedAmount Decrypted balance amount
     * @param signatures Signature array for verifying callback authenticity
     */
    function callbackRevealBalance(uint256 requestId, uint64 decryptedAmount, bytes[] memory signatures) external {
        // Verify callback authenticity to prevent malicious calls
        FHE.checkSignatures(requestId, signatures);

        // Get decryption request information
        DecryptionRequest memory request = _decryptionRequests[requestId];
        require(request.user != address(0), "Invalid request ID");

        // If user performs balance decryption for the first time, add to leaderboard user list
        bool userExists = false;
        for (uint256 i = 0; i < _revealedUsers.length; i++) {
            if (_revealedUsers[i] == request.user) {
                userExists = true;
                break;
            }
        }
        
        if (!userExists) {
            _revealedUsers.push(request.user);
        }

        // Update user's latest balance decryption record
        _latestBalanceReveal[request.user] = BalanceReveal({amount: decryptedAmount, timestamp: request.timestamp});

        emit BalanceRevealed(request.user, decryptedAmount, request.timestamp);
    }

    /**
     * @notice Get user's latest balance decryption record
     * @param user User address
     * @return amount Last decrypted balance amount
     * @return timestamp Last decryption timestamp
     */
    function getLatestBalanceReveal(address user) external view returns (uint64 amount, uint256 timestamp) {
        require(isRegistered[user], "User not registered");
        BalanceReveal memory reveal = _latestBalanceReveal[user];
        return (reveal.amount, reveal.timestamp);
    }

    /**
     * @notice Check decryption request status
     * @param requestId Request ID
     * @return user Requesting user address
     * @return timestamp Request timestamp
     * @return isCompleted Whether completed
     */
    function getDecryptionRequestStatus(
        uint256 requestId
    ) external view returns (address user, uint256 timestamp, bool isCompleted) {
        DecryptionRequest memory request = _decryptionRequests[requestId];
        return (request.user, request.timestamp, request.user == address(0));
    }


    /**
     * @notice Get total number of users who have performed balance decryption
     * @return count Total number of users
     */
    function getRevealedUsersCount() external view returns (uint256 count) {
        return _revealedUsers.length;
    }
    /**
     * @notice Get all user addresses who have performed balance decryption
     * @return users Array of user addresses
     */
    function getRevealedUsers() external view returns (address[] memory users) {
        return _revealedUsers;
    }

    // ============================
    // Trading Functions
    // ============================

    /**
     * @notice Open position operation (1x leverage)
     * @param _isLong Whether long position (encrypted)
     * @param _usdAmount USD amount to invest (encrypted)
     * @param proof Zero-knowledge proof
     * @return positionId ID of the newly created position
     */
    function openPosition(
        externalEbool _isLong,
        externalEuint64 _usdAmount,
        bytes calldata proof
    ) external onlyRegistered returns (uint256 positionId) {
        // Decrypt input parameters
        ebool isLong = FHE.fromExternal(_isLong, proof);
        euint64 usdAmount = FHE.fromExternal(_usdAmount, proof);

        // Verify and deduct balance
        euint64 currentBalance = _balances[msg.sender].usd;
        ebool sufficientBalance = FHE.ge(currentBalance, usdAmount);

        euint64 actualAmount = FHE.select(sufficientBalance, usdAmount, FHE.asEuint64(0));
        _balances[msg.sender].usd = FHE.sub(currentBalance, actualAmount);


        _authorizeHandle(_balances[msg.sender].usd);




        // Get current price and calculate position parameters
        uint64 currentPrice = _getAdjustedBtcPrice();
        euint64 btcSize = _calculateBtcSize(actualAmount, currentPrice);
        euint64 contractCount = actualAmount; // 1 USD = 1 contract



        // Create new position
        positionId = _createPosition(isLong, contractCount, btcSize, currentPrice);

        emit PositionOpened(msg.sender, positionId, currentPrice, block.timestamp);
    }

    /**
     * @notice Close position operation (partial or full)
     * @param positionId Position ID
     * @param _usdValue Close amount (encrypted)
     * @param proof Zero-knowledge proof
     */
    function closePosition(
        uint256 positionId,
        externalEuint64 _usdValue,
        bytes calldata proof
    ) external validPositionOwner(positionId) {
        euint64 usdValue = FHE.fromExternal(_usdValue, proof);
        Position storage pos = _positions[positionId];

        // Verify close amount validity
        ebool validClose = FHE.le(usdValue, pos.contractCount);
        euint64 actualAmount = FHE.select(validClose, usdValue, FHE.asEuint64(0));

        // Calculate P&L and refund amount
        uint64 currentPrice = _getAdjustedBtcPrice();
        euint64 finalValue = _calculatePnL(pos, actualAmount, currentPrice);

        // Update position status after close
        _updatePositionAfterClose(pos, actualAmount, currentPrice);

        // Refund funds to user balance
        _balances[msg.sender].usd = FHE.add(_balances[msg.sender].usd, finalValue);
        _authorizeHandle(_balances[msg.sender].usd);

        emit PositionClosed(msg.sender, positionId, currentPrice, block.timestamp);
    }

    // ============================
    // Internal Helper Functions
    // ============================

    /**
     * @notice Calculate BTC position size
     */
    function _calculateBtcSize(euint64 usdAmount, uint64 price) private returns (euint64) {
        return FHE.div(FHE.mul(usdAmount, FHE.asEuint64(BTC_PRECISION)), price);
    }

    /**
     * @notice Create new position
     */
    function _createPosition(
        ebool isLong,
        euint64 contractCount,
        euint64 btcSize,
        uint64 entryPrice
    ) private returns (uint256 positionId) {
        positionId = ++_positionCounter;

        _positions[positionId] = Position({
            owner: msg.sender,
            contractCount: contractCount,
            btcSize: btcSize,
            entryPrice: entryPrice,
            isLong: isLong,
            openTimestamp: block.timestamp
        });

        _userPositions[msg.sender].push(positionId);

        // Authorize access permissions
        _authorizeHandle(contractCount);
        _authorizeHandle(btcSize);
        _authorizeHandle(isLong);
    }

    /**
     * @notice Calculate P&L
     */
    function _calculatePnL(Position memory pos, euint64 amount, uint64 currentPrice) private returns (euint64) {
        euint64 longPnL = _calculateLongPnL(amount, pos.entryPrice, currentPrice);
        euint64 shortPnL = _calculateShortPnL(amount, pos.entryPrice, currentPrice);

        return FHE.select(pos.isLong, longPnL, shortPnL);
    }

    /**
     * @notice Calculate long position P&L
     */
    function _calculateLongPnL(euint64 amount, uint64 entryPrice, uint64 currentPrice) private returns (euint64) {
        uint256 priceRatio = (uint256(currentPrice) * CALCULATION_PRECISION) / uint256(entryPrice);

        return FHE.div(FHE.mul(amount, FHE.asEuint64(uint64(priceRatio))), uint64(CALCULATION_PRECISION));
    }

    /**
     * @notice Calculate short position P&L
     */
    function _calculateShortPnL(euint64 amount, uint64 entryPrice, uint64 currentPrice) private returns (euint64) {
        if (currentPrice <= entryPrice) {
            // Short position profit
            uint256 priceDiff = uint256(entryPrice - currentPrice);
            uint256 profitRatio = (priceDiff * CALCULATION_PRECISION) / uint256(entryPrice);

            euint64 profit = FHE.div(
                FHE.mul(amount, FHE.asEuint64(uint64(profitRatio))),
                uint64(CALCULATION_PRECISION)
            );

            return FHE.add(amount, profit);
        } else {
            // Short position loss
            uint256 lossRatio = (uint256(entryPrice) * CALCULATION_PRECISION) / uint256(currentPrice);

            return FHE.div(FHE.mul(amount, FHE.asEuint64(uint64(lossRatio))), uint64(CALCULATION_PRECISION));
        }
    }

    /**
     * @notice Update position status after close
     */
    function _updatePositionAfterClose(Position storage pos, euint64 closeAmount, uint64 currentPrice) private {
        euint64 closeBtcSize = FHE.div(FHE.mul(closeAmount, FHE.asEuint64(BTC_PRECISION)), pos.entryPrice);

        pos.contractCount = FHE.sub(pos.contractCount, closeAmount);
        pos.btcSize = FHE.sub(pos.btcSize, closeBtcSize);

        _authorizeHandle(pos.contractCount);
        _authorizeHandle(pos.btcSize);
    }

    /**
     * @notice Get adjusted BTC price
     */
    function _getAdjustedBtcPrice() private view returns (uint64) {
        uint256 price = IPriceOracle(priceOracleAddress).getLatestBtcPrice();
        require(price >= 1, "Price too low");
        require(price <= type(uint64).max, "Price overflow");
        return uint64(price);
    }

    /**
     * @notice Authorize encrypted text access permissions
     */
    function _authorizeHandle(euint64 handle) private {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }

    /**
     * @notice Authorize boolean encrypted text access permissions
     */
    function _authorizeHandle(ebool handle) private {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }

    // ============================
    // Admin Functions
    // ============================

    /**
     * @notice Update price oracle address
     * @param newOracle New oracle address
     */
    function updatePriceOracle(address newOracle) external onlyOwner validAddress(newOracle) {
        address oldOracle = priceOracleAddress;
        priceOracleAddress = newOracle;
        emit PriceOracleUpdated(oldOracle, newOracle);
    }
}
