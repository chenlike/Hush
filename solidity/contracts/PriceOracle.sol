// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

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

/// @title BTC价格预言机合约
/// @notice 提供BTC价格信息，支持明文和加密价格
contract PriceOracle is Initializable, UUPSUpgradeable, OwnableUpgradeable {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function aggregatorAddress() public view returns (address) {
        return 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c;
    }
    
    function getLatestBtcPrice() public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(aggregatorAddress());
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return uint256(price);
    }
    
    function getDecimals() public view returns (uint8) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(aggregatorAddress());
        return priceFeed.decimals();
    }
} 