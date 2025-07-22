// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import {IPriceOracle} from "./PriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PositionTrader is SepoliaConfig, Ownable {
    address public priceOracleAddress; // 价格预言机地址
    address public revealAddress; // 公布密文结果的存储合约
    
    // === 精度管理常量 ===
    uint64 public constant INITIAL_CASH_BASE = 10_000; // 初始虚拟资金基数
    uint64 public constant DECIMALS = 8; // 小数位数
    uint64 public constant PRECISION_FACTOR = 10 ** 8; // 统一精度因子 (10^8)

    constructor(address _priceOracle) Ownable(msg.sender) {
        priceOracleAddress = _priceOracle;
    }

    // 持仓状态枚举
    enum PositionStatus {
        INACTIVE,   // 未激活/已关闭
        ACTIVE      // 活跃
    }

    // 持仓结构体
    struct Position {
        address owner;
        euint64 marginAmount;     // 保证金数量（以USD计，带精度）
        euint64 btcSize;         // BTC持仓大小（带精度因子）
        uint64 entryPrice;       // 开仓价格（带精度）
        ebool isLong;           // 是否多头
        PositionStatus status;   // 持仓状态
        uint256 openTimestamp;   // 开仓时间戳
    }
    
    uint256 private positionCounter; // 持仓编号递增器
    mapping(uint256 => Position) private positions; // 持仓映射

    // 用户余额结构体，只存储USD余额（密文）
    struct Balance {
        euint64 usd;  // USD余额（带精度）
    }

    mapping(address => bool) public isRegistered; // 是否注册
    mapping(address => Balance) private balances; // 用户余额
    mapping(address => uint256[]) private userPositions; // 用户持仓列表

    // 事件定义
    event UserRegistered(address indexed user);
    event PositionOpened(address indexed user, uint256 indexed positionId, bool isLong, uint64 entryPrice);
    event PositionClosed(address indexed user, uint256 indexed positionId, uint64 exitPrice);

    // === 注册相关函数 ===
    function register() external {
        require(!isRegistered[msg.sender], "User already registered");

        // 初始化用户的USD余额（带精度）
        uint64 initialUsdAmount = INITIAL_CASH_BASE * PRECISION_FACTOR;
        euint64 initialUsd = FHE.asEuint64(initialUsdAmount);
        _authorizeHandle(initialUsd);

        balances[msg.sender] = Balance({usd: initialUsd});
        isRegistered[msg.sender] = true;

        emit UserRegistered(msg.sender);
    }

    // === 查询函数 ===
    function getBalance(address user) public view returns (euint64) {
        require(isRegistered[user], "User not registered");
        return balances[user].usd;
    }

    function getPosition(uint256 pid) public view returns (
        address owner,
        euint64 marginAmount,
        euint64 btcSize,
        uint64 entryPrice,
        ebool isLong,
        PositionStatus status
    ) {
        Position memory position = positions[pid];
        return (
            position.owner,
            position.marginAmount,
            position.btcSize,
            position.entryPrice,
            position.isLong,
            position.status
        );
    }

    // === 判断持仓是否已经平仓结束 ===
    function isOver(uint256 pid) public view returns (bool) {
        require(pid > 0 && pid <= positionCounter, "Invalid position ID");
        return positions[pid].status == PositionStatus.INACTIVE;
    }

    function getUserPositionIds(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    // === 批量检查用户持仓状态 ===
    function getUserActivePositions(address user) external view returns (uint256[] memory) {
        uint256[] memory allPositions = userPositions[user];
        uint256 activeCount = 0;
        
        // 首先计算活跃持仓数量
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (!isOver(allPositions[i])) {
                activeCount++;
            }
        }
        
        // 创建活跃持仓数组
        uint256[] memory activePositions = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (!isOver(allPositions[i])) {
                activePositions[index] = allPositions[i];
                index++;
            }
        }
        
        return activePositions;
    }

    // === 开仓函数 ===
    function openPosition(
        externalEbool _isLong,
        externalEuint64 _marginAmount,
        bytes calldata proof
    ) external returns (uint256) {
        require(isRegistered[msg.sender], "User not registered");

        // 解密用户提交的参数
        ebool isLong = FHE.fromExternal(_isLong, proof);
        euint64 marginAmount = FHE.fromExternal(_marginAmount, proof);

        // 检查保证金是否满足最小要求
        euint64 minMarginEncrypted = FHE.asEuint64(MIN_MARGIN);
        ebool hasEnoughMargin = FHE.ge(marginAmount, minMarginEncrypted);

        // 获取用户当前余额
        euint64 currentBalance = balances[msg.sender].usd;
        
        // 检查用户余额是否充足
        ebool hasSufficientBalance = FHE.ge(currentBalance, marginAmount);
        
        // 计算实际使用的保证金（如果余额不足或保证金不够最小值，则为0）
        ebool canOpenPosition = FHE.and(hasEnoughMargin, hasSufficientBalance);
        euint64 actualMargin = FHE.select(canOpenPosition, marginAmount, FHE.asEuint64(0));

        // 获取当前BTC价格
        uint64 currentPrice = getAdjustedBtcPrice();
        require(currentPrice > 0, "Invalid price");

        // 计算BTC持仓大小：(保证金 * 精度因子) / 价格
        // 这样保持了精度的一致性
        euint64 btcSize = FHE.div(
            FHE.mul(actualMargin, FHE.asEuint64(PRECISION_FACTOR)),
            currentPrice
        );

        // 扣减用户余额
        balances[msg.sender].usd = FHE.sub(currentBalance, actualMargin);

        // 授权处理所有加密数据
        _authorizeHandle(actualMargin);
        _authorizeHandle(btcSize);
        _authorizeHandle(isLong);
        _authorizeHandle(balances[msg.sender].usd);

        // 创建新持仓
        positionCounter++;
        positions[positionCounter] = Position({
            owner: msg.sender,
            marginAmount: actualMargin,
            btcSize: btcSize,
            entryPrice: currentPrice,
            isLong: isLong,
            status: PositionStatus.ACTIVE,
            openTimestamp: block.timestamp
        });

        // 添加到用户持仓列表
        userPositions[msg.sender].push(positionCounter);

        emit PositionOpened(msg.sender, positionCounter, true, currentPrice); // 这里无法访问isLong的明文值
        return positionCounter;
    }

    // === 平仓函数 ===
    function closePosition(uint256 pid) external {
        Position storage pos = positions[pid];
        require(pos.owner == msg.sender, "Not position owner");
        require(pos.status == PositionStatus.ACTIVE, "Position already closed");
        require(!isOver(pid), "Position is already over");

        // 获取当前价格
        uint64 exitPrice = getAdjustedBtcPrice();
        require(exitPrice > 0, "Invalid exit price");

        // 计算价格变化
        uint64 entryPrice = pos.entryPrice;
        bool isPriceUp = exitPrice > entryPrice;
        uint64 priceChange = isPriceUp ? exitPrice - entryPrice : entryPrice - exitPrice;

        // 计算盈亏金额
        // 盈亏 = BTC持仓大小 * 价格变化 / 精度因子
        euint64 pnlAmount = FHE.div(
            FHE.mul(pos.btcSize, FHE.asEuint64(priceChange)),
            FHE.asEuint64(PRECISION_FACTOR)
        );

        // 判断是否盈利：多头且价格上涨 或 空头且价格下跌
        ebool isProfit = FHE.eq(pos.isLong, FHE.asEbool(isPriceUp));

        // 计算最终结算金额
        euint64 baseMargin = pos.marginAmount;
        
        // 为了避免下溢出，我们需要检查亏损是否超过保证金
        ebool lossExceedsMargin = FHE.and(
            FHE.not(isProfit), // 是亏损
            FHE.gt(pnlAmount, baseMargin) // 亏损大于保证金
        );
        
        // 如果亏损超过保证金，最终结算为0；否则正常计算
        euint64 finalSettlement = FHE.select(
            lossExceedsMargin,
            FHE.asEuint64(0), // 亏损超过保证金，结算为0
            FHE.select(
                isProfit,
                FHE.add(baseMargin, pnlAmount), // 盈利：保证金 + 盈利
                FHE.sub(baseMargin, pnlAmount)  // 亏损：保证金 - 亏损
            )
        );

        // 更新用户余额
        balances[msg.sender].usd = FHE.add(balances[msg.sender].usd, finalSettlement);

        // 关闭持仓
        pos.status = PositionStatus.INACTIVE;
        pos.marginAmount = FHE.asEuint64(0);
        pos.btcSize = FHE.asEuint64(0);

        // 授权处理
        _authorizeHandle(balances[msg.sender].usd);
        _authorizeHandle(pos.marginAmount);
        _authorizeHandle(pos.btcSize);

        emit PositionClosed(msg.sender, pid, exitPrice);
    }

    // === 紧急平仓函数（管理员可调用，用于风险管理） ===
    function emergencyClosePosition(uint256 pid) external onlyOwner {
        Position storage pos = positions[pid];
        require(pos.status == PositionStatus.ACTIVE, "Position already closed");
        require(!isOver(pid), "Position is already over");

        // 紧急平仓只返还保证金，不计算盈亏
        balances[pos.owner].usd = FHE.add(balances[pos.owner].usd, pos.marginAmount);

        // 关闭持仓
        pos.status = PositionStatus.INACTIVE;
        pos.marginAmount = FHE.asEuint64(0);
        pos.btcSize = FHE.asEuint64(0);

        // 授权处理
        _authorizeHandle(balances[pos.owner].usd);
        _authorizeHandle(pos.marginAmount);
        _authorizeHandle(pos.btcSize);
    }

    // === 价格获取函数 ===
    function getAdjustedBtcPrice() public view returns (uint64) {
        uint256 price = IPriceOracle(priceOracleAddress).getLatestBtcPrice();
        
        // 确保价格预言机的精度与合约精度一致
        require(IPriceOracle(priceOracleAddress).getDecimals() == DECIMALS, "Price oracle decimal mismatch");
        require(price > 0, "Invalid price from oracle");
        require(price <= type(uint64).max, "Price overflow");

        return uint64(price);
    }

    // === 管理员函数 ===
    function updatePriceOracle(address newPriceOracle) external onlyOwner {
        require(newPriceOracle != address(0), "Invalid address");
        priceOracleAddress = newPriceOracle;
    }

    function updateRevealAddress(address newRevealAddress) external onlyOwner {
        require(newRevealAddress != address(0), "Invalid address");
        revealAddress = newRevealAddress;
    }

    // === 内部授权函数 ===
    function _authorizeHandle(euint64 handle) internal {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }

    function _authorizeHandle(ebool handle) internal {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }

    // === 查询合约状态函数 ===
    function getContractInfo() external view returns (
        uint64 initialCash,
        uint64 decimals,
        uint64 precisionFactor,
        uint64 minMargin,
        uint64 maxLeverage,
        uint256 totalPositions
    ) {
        return (
            INITIAL_CASH_BASE,
            DECIMALS,
            PRECISION_FACTOR,

            positionCounter
        );
    }
}