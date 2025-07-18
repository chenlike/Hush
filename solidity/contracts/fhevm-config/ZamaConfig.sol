// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {SepoliaZamaOracleAddress} from "../../fhevmTemp/@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol";
import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {FHEVMConfigStruct} from "@fhevm/solidity/lib/Impl.sol";

/**
 * @title   ZamaConfig.
 * @notice  This library returns the FHEVM config for different networks
 *          with the contract addresses for (1) ACL, (2) FHEVMExecutor, (3) KMSVerifier, (4) InputVerifier
 *          which are deployed & maintained by Zama. It also returns the address of the decryption oracle.
 */
library ZamaConfig {
    function getSepoliaConfig() internal pure returns (FHEVMConfigStruct memory) {
        return
            FHEVMConfigStruct({
                ACLAddress: 0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D,
                FHEVMExecutorAddress: 0xCD3ab3bd6bcc0c0bf3E27912a92043e817B1cf69,
                KMSVerifierAddress: 0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC,
                InputVerifierAddress: 0x901F8942346f7AB3a01F6D7613119Bca447Bb030
            });
    }

    function getSepoliaOracleAddress() internal pure returns (address) {
        return SepoliaZamaOracleAddress;
    }

    function getEthereumConfig() internal pure returns (FHEVMConfigStruct memory) {
        /// @note The addresses below are placeholders and should be replaced with actual addresses
        /// once deployed on the Ethereum mainnet.
        return
            FHEVMConfigStruct({
                ACLAddress: address(0),
                FHEVMExecutorAddress: address(0),
                KMSVerifierAddress: address(0),
                InputVerifierAddress: address(0)
            });
    }

    function getEthereumOracleAddress() internal pure returns (address) {
        /// @note Placeholder, should be replaced with actual address once deployed.
        return address(0);
    }
}

/**
 * @title   SepoliaConfig.
 * @dev     This contract can be inherited by a contract wishing to use the FHEVM contracts provided by Zama
 *          on the Sepolia network (chainId = 11155111).
 *          Other providers may offer similar contracts deployed at different addresses.
 *          If you wish to use them, you should rely on the instructions from these providers.
 */
contract SepoliaConfig {
    constructor() {
        FHE.setCoprocessor(ZamaConfig.getSepoliaConfig());
        FHE.setDecryptionOracle(ZamaConfig.getSepoliaOracleAddress());
    }
}

/**
 * @title   EthereumConfig.
 * @dev     This contract can be inherited by a contract wishing to use the FHEVM contracts provided by Zama
 *          on the Ethereum (mainnet) network (chainId = 1).
 *          Other providers may offer similar contracts deployed at different addresses.
 *          If you wish to use them, you should rely on the instructions from these providers.
 */
contract EthereumConfig {
    constructor() {
        FHE.setCoprocessor(ZamaConfig.getEthereumConfig());
        FHE.setDecryptionOracle(ZamaConfig.getEthereumOracleAddress());
    }
}
