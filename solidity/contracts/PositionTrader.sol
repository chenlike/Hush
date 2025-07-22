// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
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

    // 持仓结构体
    struct Position {
        address owner;
        euint64 marginAmount; // 保证金数量（以USD计，带精度）
        euint64 btcSize; // BTC持仓大小（带精度因子）
        uint64 entryPrice; // 开仓价格（带精度）
        ebool isLong; // 是否多头
        uint256 openTimestamp; // 开仓时间戳
    }

    uint256 private positionCounter; // 持仓编号递增器
    mapping(uint256 => Position) private positions; // 持仓映射

    // 用户余额结构体，只存储USD余额（密文）
    struct Balance {
        euint64 usd; // USD余额（带精度）
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

    function getPosition(
        uint256 pid
    ) public view returns (address owner, euint64 marginAmount, euint64 btcSize, uint64 entryPrice, ebool isLong) {
        Position memory position = positions[pid];
        return (position.owner, position.marginAmount, position.btcSize, position.entryPrice, position.isLong);
    }

    function getUserPositionIds(address user) external view returns (uint256[] memory) {
        return userPositions[user];
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

        // 获取用户当前余额
        euint64 currentBalance = balances[msg.sender].usd;

        // 检查用户余额是否充足
        ebool hasSufficientBalance = FHE.ge(currentBalance, marginAmount);
        euint64 actualMargin = FHE.select(hasSufficientBalance, marginAmount, FHE.asEuint64(0));

        // 获取当前BTC价格
        uint64 currentPrice = getAdjustedBtcPrice();
        require(currentPrice > 0, "Invalid price");

        // 计算BTC持仓大小：(保证金 * 精度因子) / 价格
        // 这样保持了精度的一致性
        euint64 btcSize = FHE.div(FHE.mul(actualMargin, FHE.asEuint64(PRECISION_FACTOR)), currentPrice);

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
            openTimestamp: block.timestamp
        });

        // 添加到用户持仓列表
        userPositions[msg.sender].push(positionCounter);

        emit PositionOpened(msg.sender, positionCounter, true, currentPrice); // 这里无法访问isLong的明文值
        return positionCounter;
    }

    /**
     * @param pid               持仓编号
     * @param _btcAmount        本次想平仓的 BTC 数量（明文，带 1e8 精度）
     * @param proof             zk-proof
     */
    function closePosition(uint256 pid, externalEuint64 _btcAmount, bytes calldata proof) external {
        Position storage pos = positions[pid];
        require(pos.owner == msg.sender, "Not position owner");

        // 1. 解密用户输入的平仓数量
        euint64 closeBtcAmountEnc = FHE.fromExternal(_btcAmount, proof);

        // 2. 读取当前剩余仓位
        euint64 remainBtcEnc = pos.btcSize;
        euint64 remainMarginEnc = pos.marginAmount;

        // 3. 不能超仓
        euint64 actualCloseBtcEnc = FHE.min(remainBtcEnc, closeBtcAmountEnc);

        // 4. 计算本次平仓所占比例：ratio = actualClose / remainBtc
        //    由于 FHE 没有 euint64 除法返回小数，我们采用“交叉相乘”思想：
        //    closeMargin = remainMargin * actualCloseBtc / remainBtc
        euint64 closeMarginEnc = FHE.div(FHE.mul(remainMarginEnc, actualCloseBtcEnc), remainBtcEnc);

        // 5. 更新仓位数据：剩余数量 = 原值 - 本次平仓数量
        pos.btcSize = FHE.sub(remainBtcEnc, actualCloseBtcEnc);
        pos.marginAmount = FHE.sub(remainMarginEnc, closeMarginEnc);

        // 6. 计算盈亏
        uint64 exitPrice = getAdjustedBtcPrice();
        require(exitPrice > 0, "Invalid exit price");

        uint64 entryPrice = pos.entryPrice;
        uint64 priceChange = exitPrice > entryPrice ? exitPrice - entryPrice : entryPrice - exitPrice;

        euint64 pnlAmountEnc = FHE.div(FHE.mul(actualCloseBtcEnc, FHE.asEuint64(priceChange)), PRECISION_FACTOR);

        ebool isProfit = FHE.eq(pos.isLong, FHE.asEbool(exitPrice > entryPrice));

        // 7. 最终结算金额
        euint64 settleEnc = FHE.select(
            isProfit,
            FHE.add(closeMarginEnc, pnlAmountEnc),
            // 亏损不能使结算金额变负
            FHE.select(FHE.gt(pnlAmountEnc, closeMarginEnc), FHE.asEuint64(0), FHE.sub(closeMarginEnc, pnlAmountEnc))
        );

        // 8. 更新用户余额
        balances[msg.sender].usd = FHE.add(balances[msg.sender].usd, settleEnc);

        // 10. 授权
        _authorizeHandle(pos.btcSize);
        _authorizeHandle(pos.marginAmount);
        _authorizeHandle(balances[msg.sender].usd);

        // 11. 事件（如果需要把明文数量返回给前端，可额外 emit）
        emit PositionClosed(msg.sender, pid, exitPrice);
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
}
