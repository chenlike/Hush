// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

// Chainlink 价格预言机接口
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

interface IPriceOracle {
    function getLatestBtcPrice() external view returns (uint256);
    function getDecimals() external view returns (uint8);
}

/// @title BTC价格预言机合约
/// @notice 提供BTC价格信息，支持明文和加密价格，以及测试用的手动设置
contract PriceOracle is Ownable, IPriceOracle {

    constructor(address aggregatorAddress) Ownable(msg.sender) {
        _aggregatorAddress = aggregatorAddress;
    }

    address private _aggregatorAddress;

    // 以下为测试用变量
    bool public manualMode = false;
    uint256 private _manualPrice = 0;

    /// @notice 设置 Chainlink 聚合器地址
    function setAggregatorAddress(address aggregatorAddress) public onlyOwner {
        _aggregatorAddress = aggregatorAddress;
    }

    /// @notice 设置手动价格，仅测试使用
    function setManualPrice(uint256 manualPrice) public onlyOwner {
        _manualPrice = manualPrice;
    }

    /// @notice 启用或关闭手动价格模式，仅测试使用
    function setManualMode(bool enabled) public onlyOwner {
        manualMode = enabled;
    }

    /// @notice 获取最新BTC价格（返回整数，无小数位）
    function getLatestBtcPrice() public view returns (uint256) {
        if (manualMode) {
            return _manualPrice;
        }
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_aggregatorAddress);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        uint8 decimals = priceFeed.decimals();
        require(price >= 0, "Invalid negative price");

        // 去除小数部分，转换为整数
        return uint256(price) / (10 ** decimals);
    }

    /// @notice 获取价格小数位
    function getDecimals() public view returns (uint8) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_aggregatorAddress);
        return priceFeed.decimals();
    }
}
