// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import {IPriceOracle} from "./PriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PositionTrader is SepoliaConfig, Ownable {
    address public priceOracleAddress; // 价格预言机地址
    address public revealAddress; // 公布密文结果的存储合约
    uint64 public constant INITIAL_CASH_BASE = 10_000; // 初始虚拟资金基数
    uint64 public constant DECIMALS = 8; // 小数位数

    constructor(address _priceOracle) Ownable(msg.sender) {
        priceOracleAddress = _priceOracle;
    }

    // 持仓结构体
    struct Position {
        address owner;
        euint64 margin;
        euint64 btcAmount; // 持仓的BTC数量（密文）
        uint64 entryPrice; // 开仓价格
        ebool isLong; // 是否多头
    }
    uint256 private positionCounter; // 持仓编号递增器
    mapping(uint256 => Position) private positions; // 持仓

    // 用户余额结构体，存储密文
    struct Balance {
        euint64 usd;
        euint64 btc;
    }

    mapping(address => bool) public isRegistered; // 是否注册
    mapping(address => Balance) private balances; // 密文余额

    event UserRegistered(address indexed user);

    // 注册账户并初始化密文资金
    function register() external {
        // 检查用户是否已经注册
        require(!isRegistered[msg.sender], "User already registered");

        // 初始化用户的密文余额
        // 使用 FHE.encrypt 将明文转换为密文
        // 考虑小数精度：INITIAL_CASH_BASE * 10^DECIMALS
        uint64 initialUsdAmount = uint64(INITIAL_CASH_BASE * (10 ** DECIMALS));
        euint64 initialUsd = FHE.asEuint64(initialUsdAmount);
        euint64 initialBtc = FHE.asEuint64(0);
        _authorizeHandle(initialUsd);
        _authorizeHandle(initialBtc);

        // 设置用户余额
        balances[msg.sender] = Balance({usd: initialUsd, btc: initialBtc});

        // 标记用户为已注册
        isRegistered[msg.sender] = true;

        // 触发注册事件（如果需要的话）
        emit UserRegistered(msg.sender);
    }

    function getBalance(address user) public view returns (euint64, euint64) {
        Balance memory balance = balances[user];
        return (balance.usd, balance.btc);
    }

    function openPosition(
        externalEbool _isLong,
        externalEuint64 _margin,
        bytes calldata proof
    ) external returns (uint256) {
        require(isRegistered[msg.sender], "User not registered");

        // TODO 验证签名

        // 解密用户提交的持仓方向和保证金
        ebool isLong = FHE.fromExternal(_isLong, proof);
        euint64 margin = FHE.fromExternal(_margin, proof);

        // 获取当前余额，计算实际可用保证金（不足则为 0）
        euint64 currentBalance = balances[msg.sender].usd;
        euint64 usedMargin = FHE.select(FHE.ge(currentBalance, margin), margin, FHE.asEuint64(0));

        // 获取当前BTC价格
        uint64 currentPrice = getAdjustedBtcPrice();

        // 将USD保证金转换为BTC数量 (margin / price)
        euint64 btcAmount = FHE.div(usedMargin, currentPrice);

        // 扣减保证金并更新余额
        balances[msg.sender].usd = FHE.sub(currentBalance, usedMargin);
        balances[msg.sender].btc = FHE.add(balances[msg.sender].btc, btcAmount);


        _authorizeHandle(usedMargin);
        _authorizeHandle(balances[msg.sender].usd);
        _authorizeHandle(balances[msg.sender].btc);
        _authorizeHandle(btcAmount);
        _authorizeHandle(isLong);

        // 存储仓位信息
        positionCounter++;
        positions[positionCounter] = Position({
            owner: msg.sender,
            margin: usedMargin,
            btcAmount: btcAmount,
            entryPrice: currentPrice,
            isLong: isLong
        });

        return positionCounter;
    }

    function getPosition(uint256 pid) public view returns (address, euint64, euint64, uint64, ebool) {
        Position memory position = positions[pid];
        return (position.owner, position.margin, position.btcAmount, position.entryPrice, position.isLong);
    }

    function closePosition(uint256 pid) external {
        Position storage pos = positions[pid];
        require(pos.owner == msg.sender, "Not position owner");

        // 1. 计算盈亏
        uint64 exitPrice = getAdjustedBtcPrice();
        bool isPriceUp = exitPrice > pos.entryPrice;
        uint64 absDiff = isPriceUp ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice;
        
        // 2. 计算最终结算金额
        // 基础保证金 = 全部仓位保证金
        euint64 baseMargin = pos.margin;
        
        // 盈亏金额 = 全部BTC数量 * 价格差
        euint64 pnlAmount = FHE.mul(pos.btcAmount, FHE.asEuint64(absDiff));
        
        // 方向判断：多头且上涨 或 空头且下跌 = 盈利
        ebool isProfit = FHE.eq(pos.isLong, FHE.asEbool(isPriceUp));
        
        // 最终结算金额：基础保证金 + 盈亏（盈利为正，亏损为负）
        euint64 finalSettlement = FHE.select(
            isProfit, 
            FHE.add(baseMargin, pnlAmount),  // 盈利：保证金 + 盈利
            FHE.sub(baseMargin, pnlAmount)   // 亏损：保证金 - 亏损
        );

        // 3. 更新用户余额
        balances[msg.sender].usd = FHE.add(balances[msg.sender].usd, finalSettlement);
        balances[msg.sender].btc = FHE.sub(balances[msg.sender].btc, pos.btcAmount);

        // 4. 清空仓位
        pos.btcAmount = FHE.asEuint64(0);
        pos.margin = FHE.asEuint64(0);

        // 5. 授权处理
        _authorizeHandle(balances[msg.sender].usd);
        _authorizeHandle(balances[msg.sender].btc);
        _authorizeHandle(pos.btcAmount);
        _authorizeHandle(pos.margin);
    }

    function getAdjustedBtcPrice() public view returns (uint64) {
        uint256 price = IPriceOracle(priceOracleAddress).getLatestBtcPrice();
        // 里面的价格已经是priceoracle decimal过的了

        // 比较一下两边decimal是否一致
        require(IPriceOracle(priceOracleAddress).getDecimals() == DECIMALS, "Price oracle decimal mismatch");

        return uint64(price);
    }

    function _authorizeHandle(euint64 handle) internal {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }

    function _authorizeHandle(ebool handle) internal {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }
}
