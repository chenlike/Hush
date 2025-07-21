// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "./fhevm-config/ZamaConfig.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title BTC价格预言机合约
/// @notice 提供BTC价格信息，支持明文和加密价格
contract PriceOracle is SepoliaConfig, Initializable, UUPSUpgradeable, OwnableUpgradeable {
    
    // 价格更新者地址
    address public priceUpdater;
    
    // BTC价格（USD），以美元为单位，例如 50000 表示 $50,000
    uint32 public btcPriceUSD;
    
    // 加密的BTC价格
    euint32 public encryptedBtcPrice;
    
    // 价格更新时间
    uint256 public lastUpdateTime;
    
    // 价格更新事件
    event PriceUpdated(uint32 oldPrice, uint32 newPrice, uint256 timestamp);
    event EncryptedPriceUpdated(uint256 timestamp);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        priceUpdater = msg.sender;
        // 初始价格设置为 $50,000
        btcPriceUSD = 50000;
        encryptedBtcPrice = FHE.asEuint32(50000);
        lastUpdateTime = block.timestamp;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /// @notice 设置价格更新者
    /// @param newUpdater 新的价格更新者地址
    function setPriceUpdater(address newUpdater) external {
        require(msg.sender == priceUpdater, "Only price updater can set new updater");
        priceUpdater = newUpdater;
    }
    
    /// @notice 更新BTC价格（明文）
    /// @param newPriceUSD 新的BTC价格（美元）
    function updatePrice(uint32 newPriceUSD) external {
        require(msg.sender == priceUpdater, "Only price updater can update price");
        require(newPriceUSD > 0, "Price must be greater than 0");
        
        uint32 oldPrice = btcPriceUSD;
        btcPriceUSD = newPriceUSD;
        lastUpdateTime = block.timestamp;
        
        emit PriceUpdated(oldPrice, newPriceUSD, block.timestamp);
    }
    
    /// @notice 更新加密的BTC价格
    /// @param newEncryptedPrice 新的加密BTC价格
    function updateEncryptedPrice(euint32 newEncryptedPrice) external {
        require(msg.sender == priceUpdater, "Only price updater can update encrypted price");
        
        encryptedBtcPrice = newEncryptedPrice;
        lastUpdateTime = block.timestamp;
        
        // 授权新的加密价格
        FHE.allowThis(encryptedBtcPrice);
        
        emit EncryptedPriceUpdated(block.timestamp);
    }
    
    /// @notice 获取当前BTC价格（美元）
    /// @return 当前BTC价格（美元）
    function getBtcPrice() external view returns (uint32) {
        return btcPriceUSD;
    }
    
    /// @notice 获取当前BTC价格（美元）- 别名函数
    /// @return 当前BTC价格（美元）
    function getBtcPriceUSD() external view returns (uint32) {
        return btcPriceUSD;
    }
    
    /// @notice 获取加密的BTC价格
    /// @return 加密的BTC价格
    function getEncryptedBtcPrice() external view returns (euint32) {
        return encryptedBtcPrice;
    }
    
    /// @notice 获取价格更新时间
    /// @return 最后更新时间
    function getLastUpdateTime() external view returns (uint256) {
        return lastUpdateTime;
    }
    
    /// @notice 检查价格是否过期（超过1小时未更新）
    /// @return 是否过期
    function isPriceStale() external view returns (bool) {
        return block.timestamp > lastUpdateTime + 1 hours;
    }
} 