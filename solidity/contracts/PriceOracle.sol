// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

// Chainlink Price Oracle Interface
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

/// @title BTC Price Oracle Contract
/// @notice Provides BTC price information, supports plain text and encrypted prices, and manual settings for testing
contract PriceOracle is Ownable, IPriceOracle {

    constructor(address aggregatorAddress) Ownable(msg.sender) {
        _aggregatorAddress = aggregatorAddress;
    }

    address private _aggregatorAddress;

    // The following are test variables
    bool public manualMode = false;
    uint256 private _manualPrice = 0;

    /// @notice Set Chainlink aggregator address
    function setAggregatorAddress(address aggregatorAddress) public onlyOwner {
        _aggregatorAddress = aggregatorAddress;
    }

    /// @notice Set manual price, for testing only
    function setManualPrice(uint256 manualPrice) public onlyOwner {
        _manualPrice = manualPrice;
    }

    /// @notice Enable or disable manual price mode, for testing only
    function setManualMode(bool enabled) public onlyOwner {
        manualMode = enabled;
    }

    /// @notice Get latest BTC price (returns integer, no decimal places)
    function getLatestBtcPrice() public view returns (uint256) {
        if (manualMode) {
            return _manualPrice;
        }
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_aggregatorAddress);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        uint8 decimals = priceFeed.decimals();
        require(price >= 0, "Invalid negative price");

        // Remove decimal part, convert to integer
        return uint256(price) / (10 ** decimals);
    }

    /// @notice Get price decimal places
    function getDecimals() public view returns (uint8) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_aggregatorAddress);
        return priceFeed.decimals();
    }
}
