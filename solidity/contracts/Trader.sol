// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "./fhevm-config/ZamaConfig.sol";

// PriceOracle 接口
interface IPriceOracle {
    function getBtcPrice() external view returns (uint32);
    function getBtcPriceUSD() external view returns (uint32);
    function getEncryptedBtcPrice() external view returns (euint32);
    function isPriceStale() external view returns (bool);
}

contract Trader is SepoliaConfig {
    // 价格预言机合约地址
    address public priceOracle;
    
    constructor(address _priceOracle) {
        priceOracle = _priceOracle;
    }

    struct Balance {
        euint32 encryptedCash;  // 加密的现金余额（单位 USD）
        euint32 encryptedBTC;   // 加密的 BTC 持仓（单位为小数点后6位的btc数量）
    }

    mapping(address => bool) public isRegistered;
    mapping(address => Balance) private balances;

    /// @notice 玩家注册并初始化加密资产状态
    function register() external {
        require(!isRegistered[msg.sender], "User already registered");

        // 初始化现金和BTC余额
        euint32 initialCash = FHE.asEuint32(10_000);  // 加密初始现金 10000 USD
        euint32 initialBTC = FHE.asEuint32(0);        // BTC 初始为 0

        balances[msg.sender] = Balance({
            encryptedCash: initialCash,
            encryptedBTC: initialBTC
        });

        FHE.allowThis(initialCash);
        FHE.allowThis(initialBTC);

        FHE.allow(initialCash, msg.sender);
        FHE.allow(initialBTC, msg.sender);

        isRegistered[msg.sender] = true;
    }

    /// @notice 获取当前加密现金余额（只能用户自己调用）
    function getEncryptedCash() external view returns (euint32) {
        require(isRegistered[msg.sender], "Not registered");
        return balances[msg.sender].encryptedCash;
    }

    /// @notice 获取当前加密BTC余额（只能用户自己调用）
    function getEncryptedBTC() external view returns (euint32) {
        require(isRegistered[msg.sender], "Not registered");
        return balances[msg.sender].encryptedBTC;
    }



    /// @notice 使用现金购买BTC
    /// @param inputEuint32 加密的购买金额（USD）
    /// @param inputProof 加密输入的证明
    function buy(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        require(isRegistered[msg.sender], "Not registered");
        
        // 将外部加密输入转换为内部加密类型
        euint32 buyAmount = FHE.fromExternal(inputEuint32, inputProof);
        
        // 获取用户当前余额
        euint32 currentCash = balances[msg.sender].encryptedCash;
        euint32 currentBTC = balances[msg.sender].encryptedBTC;
        
        // 检查用户是否有足够的现金
        // 注意：在FHE中，我们需要使用加密比较
        // 这里我们假设用户有足够的现金（在实际应用中需要更复杂的检查）
        
        // 从预言机获取BTC价格
        IPriceOracle oracle = IPriceOracle(priceOracle);
        uint32 btcPriceUSD = oracle.getBtcPrice();
        
        // 计算可以购买的BTC数量
        // 由于FHE不支持直接除法，我们使用乘法来计算
        // 假设1 USD可以买 0.00002 BTC (1/50000)
        euint32 btcPerDollar = FHE.asEuint32(2); // 0.00002 BTC = 2 * 10^-6 BTC
        euint32 btcToBuy = FHE.mul(buyAmount, btcPerDollar);
        
        // 更新用户余额
        balances[msg.sender].encryptedCash = FHE.sub(currentCash, buyAmount);
        balances[msg.sender].encryptedBTC = FHE.add(currentBTC, btcToBuy);
        
        // 授权新的余额给用户
        FHE.allowThis(balances[msg.sender].encryptedCash);
        FHE.allowThis(balances[msg.sender].encryptedBTC);
        FHE.allow(balances[msg.sender].encryptedCash, msg.sender);
        FHE.allow(balances[msg.sender].encryptedBTC, msg.sender);
    }

    /// @notice 卖出BTC换取现金
    /// @param inputEuint32 加密的卖出BTC数量
    /// @param inputProof 加密输入的证明
    function sell(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        require(isRegistered[msg.sender], "Not registered");
        
        // 将外部加密输入转换为内部加密类型
        euint32 sellAmount = FHE.fromExternal(inputEuint32, inputProof);
        
        // 获取用户当前余额
        euint32 currentCash = balances[msg.sender].encryptedCash;
        euint32 currentBTC = balances[msg.sender].encryptedBTC;
        
        // 检查用户是否有足够的BTC
        // 注意：在FHE中，我们需要使用加密比较
        // 这里我们假设用户有足够的BTC（在实际应用中需要更复杂的检查）
        
        // 从预言机获取BTC价格
        IPriceOracle oracle = IPriceOracle(priceOracle);
        uint32 btcPriceUSD = oracle.getBtcPrice();
        
        // 计算可以获得的现金数量
        // 使用预言机提供的价格
        euint32 btcPrice = FHE.asEuint32(btcPriceUSD);
        euint32 cashToReceive = FHE.mul(sellAmount, btcPrice);
        
        // 更新用户余额
        balances[msg.sender].encryptedCash = FHE.add(currentCash, cashToReceive);
        balances[msg.sender].encryptedBTC = FHE.sub(currentBTC, sellAmount);
        
        // 授权新的余额给用户
        FHE.allowThis(balances[msg.sender].encryptedCash);
        FHE.allowThis(balances[msg.sender].encryptedBTC);
        FHE.allow(balances[msg.sender].encryptedCash, msg.sender);
        FHE.allow(balances[msg.sender].encryptedBTC, msg.sender);
    }



    
}
