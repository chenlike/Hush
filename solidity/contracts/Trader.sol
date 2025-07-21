// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "./fhevm-config/ZamaConfig.sol";
import {RevealStorage} from "./RevealStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// 价格预言机接口
interface IPriceOracle {
    function getLatestBtcPrice() external view returns (uint32);
    function getDecimals() external view returns (uint8);
}

contract Trader is SepoliaConfig, Ownable {
    address public priceOracle; // 价格预言机地址
    RevealStorage public storageContract; // 公布密文结果的存储合约
    uint256 private constant INITIAL_CASH_BASE = 10_000; // 初始虚拟资金基数
    uint8 public constant TRADER_DECIMALS = 8; // 合约自己的小数位数

    event PositionClosed(address indexed owner, uint256 indexed positionId, uint32 currentPrice);
    event BalanceRevealed(address indexed owner, uint32 usdBalance, uint32 btcBalance, uint256 timestamp);

    constructor(address _priceOracle, address _storageAddr) Ownable(msg.sender) {
        priceOracle = _priceOracle;
        storageContract = RevealStorage(_storageAddr);
    }

    // 用户余额结构体，存储密文
    struct Balance {
        euint32 cash;
    }

    // 持仓结构体
    struct Position {
        address owner;
        euint32 margin;
        uint32 entryPrice;
        ebool isLong;
        bool isOpen;
    }

    // 余额公开记录结构体
    struct RevealRecord {
        uint32 usdBalance;
        uint32 btcBalance;
        uint256 timestamp;
        bool exists;
        ebool usdVerified;
        ebool btcVerified;
        bool usdVerifiedDecrypted;
        bool btcVerifiedDecrypted;
        bool isDecryptionPending;
        uint256 latestRequestId;
    }

    mapping(address => bool) public isRegistered; // 是否注册
    mapping(address => Balance) private balances; // 密文余额
    uint256 private positionCounter; // 持仓编号递增器
    mapping(uint256 => Position) private positions; // 持仓映射
    mapping(address => uint256[]) private userPositions; // 用户持仓 ID 集合
    mapping(address => RevealRecord) private revealRecords; // 用户公开记录

    modifier validPosition(uint256 positionId) {
        require(positions[positionId].owner == msg.sender, "Not position owner");
        require(positions[positionId].isOpen, "Position not open");
        _;
    }

    // 注册账户并初始化密文资金
    function register() external {
        require(!isRegistered[msg.sender], "Already registered");
        uint256 adjustedInitialCash = getAdjustedInitialCash();
        euint32 init = FHE.asEuint32(adjustedInitialCash);
        balances[msg.sender] = Balance({ cash: init });
        FHE.allowThis(init);
        FHE.allow(init, msg.sender);
        isRegistered[msg.sender] = true;
    }

    // 查看当前用户的密文资金
    function getEncryptedCash() external view returns (euint32) {
        require(isRegistered[msg.sender], "Not registered");
        return balances[msg.sender].cash;
    }

    // 获取当前用户持仓编号列表
    function getPositionIds() external view returns (uint256[] memory) {
        return userPositions[msg.sender];
    }

    // 获取单个持仓信息（含密文）
    function getPosition(uint256 pid) external view returns (
        euint32 margin,
        uint32 entryPrice,
        ebool isLong,
        bool isOpen
    ) {
        Position storage p = positions[pid];
        require(p.owner == msg.sender, "Not position owner");
        return (p.margin, p.entryPrice, p.isLong, p.isOpen);
    }

    // 开多/空单（需提供 FHE 外部密文及证明）
    function openPosition(
        externalEuint32 inputMargin,
        externalEbool inputDir,
        bytes calldata proof
    ) external returns (uint256) {
        require(isRegistered[msg.sender], "Not registered");

        // 解密输入密文，使用同一个 proof
        euint32 margin = FHE.fromExternal(inputMargin, proof);
        ebool isLong = FHE.fromExternal(inputDir, proof);

        // 判断是否有足够余额开仓，若不足则使用 0
        euint32 cur = balances[msg.sender].cash;
        euint32 useM = FHE.select(FHE.gt(cur, margin), margin, FHE.asEuint32(0));
        balances[msg.sender].cash = FHE.sub(cur, useM);
        FHE.allowThis(balances[msg.sender].cash);
        FHE.allow(balances[msg.sender].cash, msg.sender);

        // 记录持仓信息
        positionCounter++;
        uint256 pid = positionCounter;
        positions[pid] = Position({
            owner: msg.sender,
            margin: useM,
            entryPrice: getAdjustedBtcPrice(),
            isLong: isLong,
            isOpen: true
        });

        // 授权密文给合约用于后续运算
        FHE.allowThis(useM);
        FHE.allow(useM, address(this));
        FHE.allowThis(isLong);
        FHE.allow(isLong, address(this));

        userPositions[msg.sender].push(pid);
        return pid;
    }

    // 平仓操作，自动判定盈亏
    function closePosition(uint256 positionId) external validPosition(positionId) {
        Position storage p = positions[positionId];
        uint32 currentPrice = getAdjustedBtcPrice();

        euint32 entryPriceEnc = FHE.asEuint32(p.entryPrice);
        euint32 currentPriceEnc = FHE.asEuint32(currentPrice);

        ebool priceUp = FHE.gt(currentPriceEnc, entryPriceEnc);
        ebool isProfit = FHE.select(p.isLong, priceUp, FHE.not(priceUp));

        euint32 currentCash = balances[msg.sender].cash;
        euint32 finalBalance = FHE.select(isProfit,
            FHE.add(currentCash, p.margin),
            currentCash
        );

        balances[msg.sender].cash = finalBalance;
        FHE.allowThis(balances[msg.sender].cash);
        FHE.allow(balances[msg.sender].cash, msg.sender);

        p.isOpen = false;
        emit PositionClosed(msg.sender, positionId, currentPrice);
    }

    // 用户提交明文余额进行公开验证
    function revealBalance(uint32 usdBalance, uint32 btcBalance) external {
        require(isRegistered[msg.sender], "Not registered");
        require(!revealRecords[msg.sender].exists, "Already revealed");

        euint32 currentCash = balances[msg.sender].cash;

        euint32 claimedUsd = FHE.asEuint32(usdBalance);
        euint32 claimedBtc = FHE.asEuint32(btcBalance);

        // 设置为可公开解密的密文
        FHE.makePubliclyDecryptable(claimedUsd);
        FHE.makePubliclyDecryptable(claimedBtc);

        // 授予任意人访问权限（address(0)表示公开）
        FHE.allow(claimedUsd, address(0));
        FHE.allow(claimedBtc, address(0));

        // 存储到外部 RevealStorage 合约
        storageContract.storePublicBalance(msg.sender, claimedUsd, claimedBtc);

        // 内部验证 claimed 值是否正确
        ebool usdEqual = FHE.eq(currentCash, claimedUsd);
        ebool btcEqual = FHE.eq(FHE.asEuint32(0), claimedBtc);

        // 授权密文用于进一步使用
        FHE.allowThis(usdEqual);
        FHE.allowThis(btcEqual);

        // 存储验证记录
        revealRecords[msg.sender] = RevealRecord({
            usdBalance: usdBalance,
            btcBalance: btcBalance,
            timestamp: block.timestamp,
            exists: true,
            usdVerified: usdEqual,
            btcVerified: btcEqual,
            usdVerifiedDecrypted: false,
            btcVerifiedDecrypted: false,
            isDecryptionPending: false,
            latestRequestId: 0
        });

        emit BalanceRevealed(msg.sender, usdBalance, btcBalance, block.timestamp);
    }



    // 查询用户是否已经公开余额
    function hasRevealed(address user) external view returns (bool) {
        return revealRecords[user].exists;
    }



    // 获取价格预言机的小数位数
    function getPriceDecimals() external view returns (uint8) {
        return IPriceOracle(priceOracle).getDecimals();
    }

    // 获取调整后的BTC价格（转换为合约自己的小数位数）
    function getAdjustedBtcPrice() internal view returns (uint32) {
        uint256 rawPrice = IPriceOracle(priceOracle).getLatestBtcPrice();
        uint8 oracleDecimals = IPriceOracle(priceOracle).getDecimals();
        
        // 将预言机价格转换为合约的小数位数
        uint256 adjustedPrice;
        if (oracleDecimals > TRADER_DECIMALS) {
            // 如果预言机小数位数更多，需要除以差值
            adjustedPrice = rawPrice / (10 ** (oracleDecimals - TRADER_DECIMALS));
        } else if (oracleDecimals < TRADER_DECIMALS) {
            // 如果预言机小数位数更少，需要乘以差值
            adjustedPrice = rawPrice * (10 ** (TRADER_DECIMALS - oracleDecimals));
        } else {
            // 小数位数相同，直接使用
            adjustedPrice = rawPrice;
        }
        
        return uint32(adjustedPrice);
    }

    // 获取调整后的初始资金（使用合约自己的小数位数）
    function getAdjustedInitialCash() internal view returns (uint256) {
        return INITIAL_CASH_BASE * (10 ** TRADER_DECIMALS);
    }

    // 获取当前预言机的小数位数
    function getCurrentDecimals() external view returns (uint8) {
        return IPriceOracle(priceOracle).getDecimals();
    }

    // 获取合约自己的小数位数
    function getTraderDecimals() external view returns (uint8) {
        return TRADER_DECIMALS;
    }
}
