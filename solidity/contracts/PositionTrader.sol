// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
// import {SepoliaConfig} from "./config/ZamaConfig.sol";
import {IPriceOracle} from "./PriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FHE 永续合约交易合约
 * @notice 支持 1 倍杠杆的全密态永续合约交易
 * @dev 每张合约面值固定为 1 美元，BTC 头寸精确到 satoshi
 */
contract PositionTrader is SepoliaConfig, Ownable {
    
    // ============================
    // 常量定义
    // ============================
    
    uint64 public immutable INITIAL_CASH_BASE; // 初始虚拟资产 (USD)
    uint64 public constant CONTRACT_USD_VALUE = 1;     // 每张合约价值 (USD)
    uint64 public constant BTC_PRECISION = 1e8;        // BTC 精度 (satoshi)
    uint256 public constant CALCULATION_PRECISION = 1e8; // 计算精度
    
    // ============================
    // 状态变量
    // ============================
    
    address public priceOracleAddress;
    
    uint256 private _positionCounter;
    
    // ============================
    // 数据结构
    // ============================
    
    struct Position {
        address owner;           // 持仓所有者
        euint64 contractCount;   // 合约张数
        euint64 btcSize;        // BTC 持仓大小 (satoshi)
        uint64 entryPrice;      // 开仓价格 (USD/BTC)
        ebool isLong;           // 多头/空头标识
        uint256 openTimestamp;  // 开仓时间戳
    }
    
    struct Balance {
        euint64 usd; // USD 余额（密文）
    }
    
    struct BalanceReveal {
        uint64 amount;          // 解密时的余额金额
        uint256 timestamp;      // 解密时间戳
    }
    
    struct DecryptionRequest {
        address user;           // 请求解密的用户
        uint256 timestamp;      // 请求时间戳
    }
    
    // ============================
    // 映射存储
    // ============================
    
    mapping(uint256 => Position) private _positions;
    mapping(address => Balance) private _balances;
    mapping(address => bool) public isRegistered;
    mapping(address => uint256[]) private _userPositions;
    mapping(address => BalanceReveal) private _latestBalanceReveal;
    mapping(uint256 => DecryptionRequest) private _decryptionRequests;
    
    // ============================
    // 事件定义
    // ============================
    
    event UserRegistered(address indexed user);
    event PositionOpened(
        address indexed user, 
        uint256 indexed positionId, 
        uint64 entryPrice,
        uint256 timestamp
    );
    event PositionClosed(
        address indexed user, 
        uint256 indexed positionId, 
        uint64 exitPrice,
        uint256 timestamp
    );
    event BalanceRevealed(address indexed user, uint64 amount, uint256 timestamp);
    event DecryptionRequested(address indexed user, uint256 indexed requestId, uint256 timestamp);
    event PriceOracleUpdated(address indexed oldOracle, address indexed newOracle);
    
    // ============================
    // 修饰符
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
    // 构造函数
    // ============================
    
    /**
     * @notice 构造函数
     * @param _priceOracle 价格预言机地址
     * @param _initialCashBase 用户注册时的初始虚拟资产数量 (USD)
     */
    constructor(address _priceOracle, uint64 _initialCashBase) 
        Ownable(msg.sender) 
        validAddress(_priceOracle) 
    {
        require(_initialCashBase > 0, "Initial cash base must be greater than 0");
        priceOracleAddress = _priceOracle;
        INITIAL_CASH_BASE = _initialCashBase;
    }
    
    // ============================
    // 用户管理
    // ============================
    
    /**
     * @notice 注册新用户并分配初始虚拟资产
     * @dev 每个地址只能注册一次
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
    // 查询功能
    // ============================
    
    /**
     * @notice 获取用户 USD 余额（密文）
     * @param user 用户地址
     * @return balance 用户的 USD 余额
     */
    function getBalance(address user) external view returns (euint64 balance) {
        require(isRegistered[user], "User not registered");
        return _balances[user].usd;
    }
    
    /**
     * @notice 获取特定持仓信息
     * @param positionId 持仓 ID
     * @return owner 持仓所有者地址
     * @return contractCount 合约张数（密文）
     * @return btcSize BTC 持仓大小（密文）
     * @return entryPrice 开仓价格
     * @return isLong 是否做多（密文）
     */
    function getPosition(uint256 positionId) 
        external 
        view 
        returns (
            address owner,
            euint64 contractCount,
            euint64 btcSize,
            uint64 entryPrice,
            ebool isLong
        ) 
    {
        Position memory pos = _positions[positionId];
        return (pos.owner, pos.contractCount, pos.btcSize, pos.entryPrice, pos.isLong);
    }
    
    /**
     * @notice 获取用户所有持仓 ID
     * @param user 用户地址
     * @return 持仓 ID 数组
     */
    function getUserPositionIds(address user) external view returns (uint256[] memory) {
        return _userPositions[user];
    }
    
    /**
     * @notice 获取当前 BTC 价格
     * @return price 调整后的 BTC 价格
     */
    function getCurrentBtcPrice() external view returns (uint64 price) {
        return _getAdjustedBtcPrice();
    }
    
        /**
     * @notice 请求解密自己的USD余额
     * @dev 向FHEVM后端发送异步解密请求
     * @return requestId 解密请求的ID
     */
    function revealMyBalance() external onlyRegistered returns (uint256 requestId) {
        uint256 timestamp = block.timestamp;
        

        
        // 准备要解密的密文数组
        bytes32[] memory cipherTexts = new bytes32[](1);
        cipherTexts[0] = FHE.toBytes32(_balances[msg.sender].usd);
        
        // 发送解密请求
        requestId = FHE.requestDecryption(
            cipherTexts,
            this.callbackRevealBalance.selector
        );
        
        // 记录解密请求
        _decryptionRequests[requestId] = DecryptionRequest({
            user: msg.sender,
            timestamp: timestamp
        });
        
        emit DecryptionRequested(msg.sender, requestId, timestamp);
        
        return requestId;
    }
    
    /**
     * @notice FHEVM后端解密余额后的回调函数
     * @param requestId 解密请求ID
     * @param decryptedAmount 解密后的余额数量
     * @param signatures 用于验证回调真实性的签名数组
     */
    function callbackRevealBalance(
        uint256 requestId, 
        uint64 decryptedAmount, 
        bytes[] memory signatures
    ) external {
        // 验证回调的真实性，防止恶意调用
        FHE.checkSignatures(requestId, signatures);
        
        // 获取解密请求信息
        DecryptionRequest memory request = _decryptionRequests[requestId];
        require(request.user != address(0), "Invalid request ID");
        
        // 更新用户的最新余额解密记录
        _latestBalanceReveal[request.user] = BalanceReveal({
            amount: decryptedAmount,
            timestamp: request.timestamp
        });
        
        emit BalanceRevealed(request.user, decryptedAmount, request.timestamp);
    }
    
    /**
     * @notice 获取用户最新的余额解密记录
     * @param user 用户地址
     * @return amount 上次解密的余额数量
     * @return timestamp 上次解密的时间戳
     */
    function getLatestBalanceReveal(address user) 
        external 
        view 
        returns (uint64 amount, uint256 timestamp) 
    {
        require(isRegistered[user], "User not registered");
        BalanceReveal memory reveal = _latestBalanceReveal[user];
        return (reveal.amount, reveal.timestamp);
    }
    
    /**
     * @notice 检查解密请求状态
     * @param requestId 请求ID
     * @return user 请求用户地址
     * @return timestamp 请求时间戳
     * @return isCompleted 是否已完成
     */
    function getDecryptionRequestStatus(uint256 requestId) 
        external 
        view 
        returns (address user, uint256 timestamp, bool isCompleted) 
    {
        DecryptionRequest memory request = _decryptionRequests[requestId];
        return (request.user, request.timestamp, request.user == address(0));
    }
    
    // ============================
    // 交易功能
    // ============================
    
    /**
     * @notice 开仓操作（1倍杠杆）
     * @param _isLong 是否做多（密文）
     * @param _usdAmount 投入的 USD 金额（密文）
     * @param proof 零知识证明
     * @return positionId 新建持仓的 ID
     */
    function openPosition(
        externalEbool _isLong,
        externalEuint64 _usdAmount,
        bytes calldata proof
    ) external onlyRegistered returns (uint256 positionId) {
        
        // 解密输入参数
        ebool isLong = FHE.fromExternal(_isLong, proof);
        euint64 usdAmount = FHE.fromExternal(_usdAmount, proof);
        
        // 获取当前价格并计算持仓参数
        uint64 currentPrice = _getAdjustedBtcPrice();
        euint64 btcSize = _calculateBtcSize(usdAmount, currentPrice);
        euint64 contractCount = usdAmount; // 1 USD = 1 张合约
        
        // 验证并扣除余额
        _validateAndDeductBalance(usdAmount);
        
        // 创建新持仓
        positionId = _createPosition(isLong, contractCount, btcSize, currentPrice);
        
        emit PositionOpened(msg.sender, positionId, currentPrice, block.timestamp);
    }
    
    /**
     * @notice 平仓操作（部分或全部）
     * @param positionId 持仓 ID
     * @param _usdValue 平仓金额（密文）
     * @param proof 零知识证明
     */
    function closePosition(
        uint256 positionId, 
        externalEuint64 _usdValue, 
        bytes calldata proof
    ) external validPositionOwner(positionId) {
        
        euint64 usdValue = FHE.fromExternal(_usdValue, proof);
        Position storage pos = _positions[positionId];
        
        // 验证平仓金额有效性
        ebool validClose = FHE.le(usdValue, pos.contractCount);
        euint64 actualAmount = FHE.select(validClose, usdValue, FHE.asEuint64(0));
        
        // 计算盈亏和退还金额
        uint64 currentPrice = _getAdjustedBtcPrice();
        euint64 finalValue = _calculatePnL(pos, actualAmount, currentPrice);
        
        // 更新持仓状态
        _updatePositionAfterClose(pos, actualAmount, currentPrice);
        
        // 返还资金到用户余额
        _balances[msg.sender].usd = FHE.add(_balances[msg.sender].usd, finalValue);
        _authorizeHandle(_balances[msg.sender].usd);
        
        emit PositionClosed(msg.sender, positionId, currentPrice, block.timestamp);
    }
    
    // ============================
    // 内部辅助函数
    // ============================
    
    /**
     * @notice 计算 BTC 持仓大小
     */
    function _calculateBtcSize(euint64 usdAmount, uint64 price) 
        private  
        returns (euint64) 
    {
        return FHE.div(
            FHE.mul(usdAmount, FHE.asEuint64(BTC_PRECISION)), 
            price
        );
    }
    
    /**
     * @notice 验证并扣除用户余额
     */
    function _validateAndDeductBalance(euint64 amount) private {
        euint64 currentBalance = _balances[msg.sender].usd;
        ebool sufficientBalance = FHE.ge(currentBalance, amount);
        
        euint64 actualAmount = FHE.select(sufficientBalance, amount, FHE.asEuint64(0));
        _balances[msg.sender].usd = FHE.sub(currentBalance, actualAmount);
        
        _authorizeHandle(_balances[msg.sender].usd);
    }
    
    /**
     * @notice 创建新持仓
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
        
        // 授权访问权限
        _authorizeHandle(contractCount);
        _authorizeHandle(btcSize);
        _authorizeHandle(isLong);
    }
    
    /**
     * @notice 计算盈亏
     */
    function _calculatePnL(
        Position memory pos, 
        euint64 amount, 
        uint64 currentPrice
    ) private returns (euint64) {
        
        euint64 longPnL = _calculateLongPnL(amount, pos.entryPrice, currentPrice);
        euint64 shortPnL = _calculateShortPnL(amount, pos.entryPrice, currentPrice);
        
        return FHE.select(pos.isLong, longPnL, shortPnL);
    }
    
    /**
     * @notice 计算做多盈亏
     */
    function _calculateLongPnL(
        euint64 amount, 
        uint64 entryPrice, 
        uint64 currentPrice
    ) private returns (euint64) {
        
        uint256 priceRatio = (uint256(currentPrice) * CALCULATION_PRECISION) / uint256(entryPrice);
        
        return FHE.div(
            FHE.mul(amount, FHE.asEuint64(uint64(priceRatio))), 
            uint64(CALCULATION_PRECISION)
        );
    }
    
    /**
     * @notice 计算做空盈亏
     */
    function _calculateShortPnL(
        euint64 amount, 
        uint64 entryPrice, 
        uint64 currentPrice
    ) private returns (euint64) {
        
        if (currentPrice <= entryPrice) {
            // 做空盈利
            uint256 priceDiff = uint256(entryPrice - currentPrice);
            uint256 profitRatio = (priceDiff * CALCULATION_PRECISION) / uint256(entryPrice);
            
            euint64 profit = FHE.div(
                FHE.mul(amount, FHE.asEuint64(uint64(profitRatio))), 
                uint64(CALCULATION_PRECISION)
            );
            
            return FHE.add(amount, profit);
        } else {
            // 做空亏损
            uint256 lossRatio = (uint256(entryPrice) * CALCULATION_PRECISION) / uint256(currentPrice);
            
            return FHE.div(
                FHE.mul(amount, FHE.asEuint64(uint64(lossRatio))), 
                uint64(CALCULATION_PRECISION)
            );
        }
    }
    
    /**
     * @notice 平仓后更新持仓状态
     */
    function _updatePositionAfterClose(
        Position storage pos, 
        euint64 closeAmount, 
        uint64 currentPrice
    ) private {
        
        euint64 closeBtcSize = FHE.div(
            FHE.mul(closeAmount, FHE.asEuint64(BTC_PRECISION)), 
            pos.entryPrice
        );
        
        pos.contractCount = FHE.sub(pos.contractCount, closeAmount);
        pos.btcSize = FHE.sub(pos.btcSize, closeBtcSize);
        
        _authorizeHandle(pos.contractCount);
        _authorizeHandle(pos.btcSize);
    }
    
    /**
     * @notice 获取调整后的 BTC 价格
     */
    function _getAdjustedBtcPrice() private view returns (uint64) {
        uint256 price = IPriceOracle(priceOracleAddress).getLatestBtcPrice();
        require(price >= 1, "Price too low");
        require(price <= type(uint64).max, "Price overflow");
        return uint64(price);
    }
    
    /**
     * @notice 授权密文访问权限
     */
    function _authorizeHandle(euint64 handle) private {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }
    
    /**
     * @notice 授权布尔密文访问权限
     */
    function _authorizeHandle(ebool handle) private {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }
    
    // ============================
    // 管理员功能
    // ============================
    
    /**
     * @notice 更新价格预言机地址
     * @param newOracle 新的预言机地址
     */
    function updatePriceOracle(address newOracle) 
        external 
        onlyOwner 
        validAddress(newOracle) 
    {
        address oldOracle = priceOracleAddress;
        priceOracleAddress = newOracle;
        emit PriceOracleUpdated(oldOracle, newOracle);
    }
    
}