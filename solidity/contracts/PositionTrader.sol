// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IPriceOracle} from "./PriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title 仅支持 1 倍杠杆的 FHE 永续合约交易合约
/// @notice 每张合约面值固定为 1 美元，BTC 头寸精确到 satoshi，所有金额处理为密文
contract PositionTrader is SepoliaConfig, Ownable {
    address public priceOracleAddress;
    address public revealAddress;

    // === 精度与杠杆设置 ===
    uint64 public constant INITIAL_CASH_BASE = 10_000; // 初始虚拟资产，单位 USD
    uint64 public constant CONTRACT_USD = 1; // 每张合约固定价值 1 USD
    uint64 public constant BTC_PRECISION = 1e8; // BTC 精度（satoshi）

    constructor(address _priceOracle) Ownable(msg.sender) {
        priceOracleAddress = _priceOracle;
    }

    struct Position {
        address owner;
        euint64 contractCount; // 合约张数
        euint64 btcSize; // 持仓 BTC 大小（satoshi）
        uint64 entryPrice; // 开仓时价格（USD/BTC）
        ebool isLong; // 多/空头
        uint256 openTimestamp; // 开仓时间
    }

    uint256 private positionCounter;
    mapping(uint256 => Position) private positions;

    struct Balance {
        euint64 usd; // 用户 USD 余额（密文）
    }

    mapping(address => bool) public isRegistered;
    mapping(address => Balance) private balances;
    mapping(address => uint256[]) private userPositions;

    // === 事件定义 ===
    event UserRegistered(address indexed user);
    event PositionOpened(address indexed user, uint256 indexed positionId, uint64 entryPrice);
    event PositionClosed(address indexed user, uint256 indexed positionId, uint64 exitPrice);

    /// @notice 注册新用户，初始化虚拟资产
    function register() external {
        require(!isRegistered[msg.sender], "User already registered");

        euint64 init = FHE.asEuint64(INITIAL_CASH_BASE);
        _authorizeHandle(init);

        balances[msg.sender] = Balance({usd: init});
        isRegistered[msg.sender] = true;
        emit UserRegistered(msg.sender);
    }

    /// @notice 获取用户余额（密文）
    function getBalance(address user) public view returns (euint64) {
        require(isRegistered[user], "Not registered");
        return balances[user].usd;
    }

    /// @notice 获取单个持仓信息
    function getPosition(uint256 pid) public view returns (address, euint64, euint64, uint64, ebool) {
        Position memory p = positions[pid];
        return (p.owner, p.contractCount, p.btcSize, p.entryPrice, p.isLong);
    }

    /// @notice 获取用户所有持仓编号
    function getUserPositionIds(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    /// @notice 开仓（固定 1 倍杠杆）
    function openPosition(
        externalEbool _isLong,
        externalEuint64 _usdAmount,
        bytes calldata proof
    ) external returns (uint256) {
        require(isRegistered[msg.sender], "Not registered");

        ebool isLong = FHE.fromExternal(_isLong, proof);
        euint64 usdAmount = FHE.fromExternal(_usdAmount, proof); // 用户想要投入的USD数量

        // 获取当前价格
        uint64 price = getAdjustedBtcPrice();

        // 计算对应的BTC数量 = USD数量 × BTC精度 / 价格
        euint64 btcSize = FHE.div(FHE.mul(usdAmount, FHE.asEuint64(BTC_PRECISION)), price);

        // 计算合约张数 = USD数量（因为每张合约固定价值1USD）
        euint64 contractCount = usdAmount;

        // 检查余额是否充足
        euint64 balance = balances[msg.sender].usd;
        ebool sufficient = FHE.ge(balance, usdAmount);
        euint64 actualUsd = FHE.select(sufficient, usdAmount, FHE.asEuint64(0));
        euint64 actualBtcSize = FHE.select(sufficient, btcSize, FHE.asEuint64(0));
        euint64 actualContractCount = FHE.select(sufficient, contractCount, FHE.asEuint64(0));

        // 扣除余额
        balances[msg.sender].usd = FHE.sub(balance, actualUsd);

        _authorizeHandle(actualUsd);
        _authorizeHandle(actualContractCount);
        _authorizeHandle(actualBtcSize);
        _authorizeHandle(isLong);
        _authorizeHandle(balances[msg.sender].usd);

        positionCounter++;
        positions[positionCounter] = Position({
            owner: msg.sender,
            contractCount: actualContractCount,
            btcSize: actualBtcSize,
            entryPrice: price,
            isLong: isLong,
            openTimestamp: block.timestamp
        });

        userPositions[msg.sender].push(positionCounter);
        emit PositionOpened(msg.sender, positionCounter, price);
        return positionCounter;
    }

    /// @notice 平仓（部分或全部）
    function closePosition(uint256 pid, externalEuint64 _usdValue, bytes calldata proof) external {
        Position storage pos = positions[pid];
        require(pos.owner == msg.sender, "Not owner");

        // 解密输入的 USD 平仓金额（密文）
        euint64 usdValue = FHE.fromExternal(_usdValue, proof);

        // 验证平仓金额不超过持仓合约张数
        ebool validClose = FHE.le(usdValue, pos.contractCount);
        euint64 actualAmount = FHE.select(validClose, usdValue, FHE.asEuint64(0));

        // 获取当前价格和开仓价
        uint64 currentPrice = getAdjustedBtcPrice();
        uint64 entry = pos.entryPrice;

        // === 计算做多回报 ===
        euint64 longValue = FHE.div(FHE.mul(actualAmount, FHE.asEuint64(currentPrice)), entry);

        // === 计算做空回报，加入明文判断逻辑 ===
        uint64 shortNumerator = currentPrice <= 2 * entry ? (2 * entry - currentPrice) : 0;
        euint64 shortValue = shortNumerator > 0
            ? FHE.div(FHE.mul(actualAmount, FHE.asEuint64(shortNumerator)), entry)
            : FHE.asEuint64(0);

        // === 根据多/空头方向决定最终收益 ===
        euint64 closeValue = FHE.select(pos.isLong, longValue, shortValue);

        // === 计算平仓 BTC 数量（按原始开仓价换算） ===
        euint64 closeBtcSize = FHE.div(FHE.mul(actualAmount, FHE.asEuint64(BTC_PRECISION)), entry);

        // === 更新持仓信息 ===
        pos.contractCount = FHE.sub(pos.contractCount, actualAmount);
        pos.btcSize = FHE.sub(pos.btcSize, closeBtcSize);

        // === 返还平仓后的 USD 收益 ===
        balances[msg.sender].usd = FHE.add(balances[msg.sender].usd, closeValue);

        // === 授权密文访问权给用户 ===
        _authorizeHandle(actualAmount);
        _authorizeHandle(closeValue);
        _authorizeHandle(closeBtcSize);
        _authorizeHandle(pos.contractCount);
        _authorizeHandle(pos.btcSize);
        _authorizeHandle(balances[msg.sender].usd);

        // === 事件日志 ===
        emit PositionClosed(msg.sender, pid, currentPrice);
    }

    /// @notice 获取整数 BTC 价格（最少为 1）
    function getAdjustedBtcPrice() public view returns (uint64) {
        uint256 price = IPriceOracle(priceOracleAddress).getLatestBtcPrice();
        require(price >= 1, "Price too low");
        require(price <= type(uint64).max, "Overflow");
        return uint64(price);
    }

    function updatePriceOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Zero address");
        priceOracleAddress = newOracle;
    }

    function updateRevealAddress(address newReveal) external onlyOwner {
        require(newReveal != address(0), "Zero address");
        revealAddress = newReveal;
    }

    function _authorizeHandle(euint64 h) internal {
        FHE.allowThis(h);
        FHE.allow(h, msg.sender);
    }

    function _authorizeHandle(ebool h) internal {
        FHE.allowThis(h);
        FHE.allow(h, msg.sender);
    }
}
