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
/// @notice 提供BTC价格信息，支持明文和加密价格
contract PriceOracle is Ownable, IPriceOracle {

    constructor(address aggregatorAddress) Ownable(msg.sender) {
        _aggregatorAddress = aggregatorAddress;
    }

    address private _aggregatorAddress;

    function setAggregatorAddress(address aggregatorAddress) public onlyOwner {
        _aggregatorAddress = aggregatorAddress;
    }
    
    function getLatestBtcPrice() public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_aggregatorAddress);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return uint256(price);
    }
    
    function getDecimals() public view returns (uint8) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_aggregatorAddress);
        return priceFeed.decimals();
    }
} 