// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "./fhevm-config/ZamaConfig.sol";
import {RevealStorage} from "./RevealStorage.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// 价格预言机接口
interface IPriceOracle {
    function getBtcPrice() external view returns (uint32);
    function isPriceStale() external view returns (bool);
}

contract Trader is SepoliaConfig, Initializable, UUPSUpgradeable, OwnableUpgradeable {
    address public priceOracle; // 价格预言机地址
    RevealStorage public storageContract; // 公布密文结果的存储合约
    uint32 private constant INITIAL_CASH = 10_000; // 初始虚拟资金

    event PositionClosed(address indexed owner, uint256 indexed positionId, uint32 currentPrice);
    event BalanceRevealed(address indexed owner, uint32 usdBalance, uint32 btcBalance, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _priceOracle, address _storageAddr) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        priceOracle = _priceOracle;
        storageContract = RevealStorage(_storageAddr);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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
        euint32 init = FHE.asEuint32(INITIAL_CASH);
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
        bytes calldata proofMargin,
        externalEbool inputDir,
        bytes calldata proofDir
    ) external returns (uint256) {
        require(isRegistered[msg.sender], "Not registered");

        // 解密输入密文
        euint32 margin = FHE.fromExternal(inputMargin, proofMargin);
        ebool isLong = FHE.fromExternal(inputDir, proofDir);

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
            entryPrice: IPriceOracle(priceOracle).getBtcPrice(),
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
        uint32 currentPrice = IPriceOracle(priceOracle).getBtcPrice();

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

    // 获取用户公开记录结构
    function getRevealRecord(address user) external view returns (
        uint32 usdBalance,
        uint32 btcBalance,
        uint256 timestamp,
        bool exists,
        ebool usdVerified,
        ebool btcVerified,
        bool usdVerifiedDecrypted,
        bool btcVerifiedDecrypted,
        bool isDecryptionPending
    ) {
        RevealRecord storage record = revealRecords[user];
        return (
            record.usdBalance,
            record.btcBalance,
            record.timestamp,
            record.exists,
            record.usdVerified,
            record.btcVerified,
            record.usdVerifiedDecrypted,
            record.btcVerifiedDecrypted,
            record.isDecryptionPending
        );
    }

    // 查询用户是否已经公开余额
    function hasRevealed(address user) external view returns (bool) {
        return revealRecords[user].exists;
    }

    // 公开查看其他用户的揭示余额（任何人都可以调用，不需要注册）
    function getPublicRevealedBalance(address user) external view returns (euint32, euint32, uint256) {
        require(revealRecords[user].exists, "User has not revealed balance");
        return storageContract.getPublicBalance(user);
    }

    // 获取所有已揭示余额的用户列表（简化版本，实际应用中可能需要更复杂的实现）
    function getRevealedUsers() external view returns (address[] memory) {
        // 注意：这个函数在实际应用中可能需要更复杂的实现
        // 因为 Solidity 没有内置的方法来遍历 mapping
        // 这里返回空数组作为示例
        return new address[](0);
    }
}
