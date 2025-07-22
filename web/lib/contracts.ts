// 合约配置
export const CONTRACTS = {
    PRICE_ORACLE: {
        address: '0x9dc76B1C9fd6ACf977CF35521A4C4Faa05e81657' as `0x${string}`,
        abi: [
            {
              "inputs": [],
              "stateMutability": "nonpayable",
              "type": "constructor"
            },
            {
              "anonymous": false,
              "inputs": [
                {
                  "indexed": false,
                  "internalType": "uint256",
                  "name": "timestamp",
                  "type": "uint256"
                }
              ],
              "name": "EncryptedPriceUpdated",
              "type": "event"
            },
            {
              "anonymous": false,
              "inputs": [
                {
                  "indexed": false,
                  "internalType": "uint32",
                  "name": "oldPrice",
                  "type": "uint32"
                },
                {
                  "indexed": false,
                  "internalType": "uint32",
                  "name": "newPrice",
                  "type": "uint32"
                },
                {
                  "indexed": false,
                  "internalType": "uint256",
                  "name": "timestamp",
                  "type": "uint256"
                }
              ],
              "name": "PriceUpdated",
              "type": "event"
            },
            {
              "inputs": [],
              "name": "btcPriceUSD",
              "outputs": [
                {
                  "internalType": "uint32",
                  "name": "",
                  "type": "uint32"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            },
            {
              "inputs": [],
              "name": "encryptedBtcPrice",
              "outputs": [
                {
                  "internalType": "euint32",
                  "name": "",
                  "type": "bytes32"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            },
            {
              "inputs": [],
              "name": "getBtcPrice",
              "outputs": [
                {
                  "internalType": "uint32",
                  "name": "",
                  "type": "uint32"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            },
            {
              "inputs": [],
              "name": "getBtcPriceUSD",
              "outputs": [
                {
                  "internalType": "uint32",
                  "name": "",
                  "type": "uint32"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            },
            {
              "inputs": [],
              "name": "getEncryptedBtcPrice",
              "outputs": [
                {
                  "internalType": "euint32",
                  "name": "",
                  "type": "bytes32"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            },
            {
              "inputs": [],
              "name": "getLastUpdateTime",
              "outputs": [
                {
                  "internalType": "uint256",
                  "name": "",
                  "type": "uint256"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            },
            {
              "inputs": [],
              "name": "isPriceStale",
              "outputs": [
                {
                  "internalType": "bool",
                  "name": "",
                  "type": "bool"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            },
            {
              "inputs": [],
              "name": "lastUpdateTime",
              "outputs": [
                {
                  "internalType": "uint256",
                  "name": "",
                  "type": "uint256"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            },
            {
              "inputs": [],
              "name": "priceUpdater",
              "outputs": [
                {
                  "internalType": "address",
                  "name": "",
                  "type": "address"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            },
            {
              "inputs": [
                {
                  "internalType": "address",
                  "name": "newUpdater",
                  "type": "address"
                }
              ],
              "name": "setPriceUpdater",
              "outputs": [],
              "stateMutability": "nonpayable",
              "type": "function"
            },
            {
              "inputs": [
                {
                  "internalType": "euint32",
                  "name": "newEncryptedPrice",
                  "type": "bytes32"
                }
              ],
              "name": "updateEncryptedPrice",
              "outputs": [],
              "stateMutability": "nonpayable",
              "type": "function"
            },
            {
              "inputs": [
                {
                  "internalType": "uint32",
                  "name": "newPriceUSD",
                  "type": "uint32"
                }
              ],
              "name": "updatePrice",
              "outputs": [],
              "stateMutability": "nonpayable",
              "type": "function"
            }
          ] as const
    },
    TRADER: {
        address: '0x678BD31E25F8EcdB1F3b2Bc0129EFa5739cEc570' as `0x${string}`,
        abi: [
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "_priceOracle",
                "type": "address"
              }
            ],
            "stateMutability": "nonpayable",
            "type": "constructor"
          },
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "owner",
                "type": "address"
              }
            ],
            "name": "OwnableInvalidOwner",
            "type": "error"
          },
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "account",
                "type": "address"
              }
            ],
            "name": "OwnableUnauthorizedAccount",
            "type": "error"
          },
          {
            "anonymous": false,
            "inputs": [
              {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
              },
              {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
              }
            ],
            "name": "OwnershipTransferred",
            "type": "event"
          },
          {
            "anonymous": false,
            "inputs": [
              {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
              }
            ],
            "name": "UserRegistered",
            "type": "event"
          },
          {
            "inputs": [],
            "name": "DECIMALS",
            "outputs": [
              {
                "internalType": "uint64",
                "name": "",
                "type": "uint64"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "INITIAL_CASH_BASE",
            "outputs": [
              {
                "internalType": "uint64",
                "name": "",
                "type": "uint64"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "uint256",
                "name": "pid",
                "type": "uint256"
              }
            ],
            "name": "closePosition",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "getAdjustedBtcPrice",
            "outputs": [
              {
                "internalType": "uint64",
                "name": "",
                "type": "uint64"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "user",
                "type": "address"
              }
            ],
            "name": "getBalance",
            "outputs": [
              {
                "internalType": "euint64",
                "name": "",
                "type": "bytes32"
              },
              {
                "internalType": "euint64",
                "name": "",
                "type": "bytes32"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "uint256",
                "name": "pid",
                "type": "uint256"
              }
            ],
            "name": "getPosition",
            "outputs": [
              {
                "internalType": "address",
                "name": "",
                "type": "address"
              },
              {
                "internalType": "euint64",
                "name": "",
                "type": "bytes32"
              },
              {
                "internalType": "euint64",
                "name": "",
                "type": "bytes32"
              },
              {
                "internalType": "uint64",
                "name": "",
                "type": "uint64"
              },
              {
                "internalType": "ebool",
                "name": "",
                "type": "bytes32"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "",
                "type": "address"
              }
            ],
            "name": "isRegistered",
            "outputs": [
              {
                "internalType": "bool",
                "name": "",
                "type": "bool"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "externalEbool",
                "name": "_isLong",
                "type": "bytes32"
              },
              {
                "internalType": "externalEuint64",
                "name": "_margin",
                "type": "bytes32"
              },
              {
                "internalType": "bytes",
                "name": "proof",
                "type": "bytes"
              }
            ],
            "name": "openPosition",
            "outputs": [
              {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
              }
            ],
            "stateMutability": "nonpayable",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "owner",
            "outputs": [
              {
                "internalType": "address",
                "name": "",
                "type": "address"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "priceOracleAddress",
            "outputs": [
              {
                "internalType": "address",
                "name": "",
                "type": "address"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "register",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "renounceOwnership",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "revealAddress",
            "outputs": [
              {
                "internalType": "address",
                "name": "",
                "type": "address"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
              }
            ],
            "name": "transferOwnership",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ] as const
    }
} as const; 