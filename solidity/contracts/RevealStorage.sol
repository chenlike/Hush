// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32} from "@fhevm/solidity/lib/FHE.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract RevealStorage is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    struct PublicBalance {
        euint32 usd;
        euint32 btc;
        uint256 timestamp;
    }

    mapping(address => PublicBalance) public balances;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function storePublicBalance(address user, euint32 usd, euint32 btc) external {
        balances[user] = PublicBalance({
            usd: usd,
            btc: btc,
            timestamp: block.timestamp
        });
    }

    function getPublicBalance(address user) external view returns (euint32, euint32, uint256) {
        PublicBalance memory b = balances[user];
        return (b.usd, b.btc, b.timestamp);
    }

    // 公开查看其他用户的揭示余额（任何人都可以调用，不需要注册）
    function getPublicRevealedBalance(address user) external view returns (euint32, euint32, uint256) {
        PublicBalance memory b = balances[user];
        require(b.timestamp > 0, "User has not revealed balance");
        return (b.usd, b.btc, b.timestamp);
    }

    // 检查用户是否已揭示余额
    function hasUserRevealedBalance(address user) external view returns (bool) {
        PublicBalance memory b = balances[user];
        return b.timestamp > 0;
    }

    // 获取用户揭示余额的时间戳
    function getRevealTimestamp(address user) external view returns (uint256) {
        PublicBalance memory b = balances[user];
        require(b.timestamp > 0, "User has not revealed balance");
        return b.timestamp;
    }
}
