// 合约配置
export const CONTRACTS = {
    PRICE_ORACLE: {
        address: '0x7fE9e41e405e52D5534E0959D3573F1015E0d979' as `0x${string}`,
        abi:[
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "aggregatorAddress",
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
            "inputs": [],
            "name": "getDecimals",
            "outputs": [
              {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "getLatestBtcPrice",
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
            "name": "manualMode",
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
            "name": "renounceOwnership",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "aggregatorAddress",
                "type": "address"
              }
            ],
            "name": "setAggregatorAddress",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "bool",
                "name": "enabled",
                "type": "bool"
              }
            ],
            "name": "setManualMode",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "uint256",
                "name": "manualPrice",
                "type": "uint256"
              }
            ],
            "name": "setManualPrice",
            "outputs": [],
            "stateMutability": "nonpayable",
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
    },
    TRADER: {
        address: '0x84A068202b1F52Cc76869a8777d2569C1cc4F87b' as `0x${string}`,
        abi:[
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "_priceOracle",
                "type": "address"
              },
              {
                "internalType": "uint64",
                "name": "_initialCashBase",
                "type": "uint64"
              }
            ],
            "stateMutability": "nonpayable",
            "type": "constructor"
          },
          {
            "inputs": [],
            "name": "HandlesAlreadySavedForRequestID",
            "type": "error"
          },
          {
            "inputs": [],
            "name": "InvalidKMSSignatures",
            "type": "error"
          },
          {
            "inputs": [],
            "name": "NoHandleFoundForRequestID",
            "type": "error"
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
            "inputs": [],
            "name": "UnsupportedHandleType",
            "type": "error"
          },
          {
            "anonymous": false,
            "inputs": [
              {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
              },
              {
                "indexed": false,
                "internalType": "uint64",
                "name": "amount",
                "type": "uint64"
              },
              {
                "indexed": false,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              }
            ],
            "name": "BalanceRevealed",
            "type": "event"
          },
          {
            "anonymous": false,
            "inputs": [
              {
                "indexed": true,
                "internalType": "uint256",
                "name": "requestID",
                "type": "uint256"
              }
            ],
            "name": "DecryptionFulfilled",
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
              },
              {
                "indexed": true,
                "internalType": "uint256",
                "name": "requestId",
                "type": "uint256"
              },
              {
                "indexed": false,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              }
            ],
            "name": "DecryptionRequested",
            "type": "event"
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
              },
              {
                "indexed": true,
                "internalType": "uint256",
                "name": "positionId",
                "type": "uint256"
              },
              {
                "indexed": false,
                "internalType": "uint64",
                "name": "exitPrice",
                "type": "uint64"
              },
              {
                "indexed": false,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              }
            ],
            "name": "PositionClosed",
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
              },
              {
                "indexed": true,
                "internalType": "uint256",
                "name": "positionId",
                "type": "uint256"
              },
              {
                "indexed": false,
                "internalType": "uint64",
                "name": "entryPrice",
                "type": "uint64"
              },
              {
                "indexed": false,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              }
            ],
            "name": "PositionOpened",
            "type": "event"
          },
          {
            "anonymous": false,
            "inputs": [
              {
                "indexed": true,
                "internalType": "address",
                "name": "oldOracle",
                "type": "address"
              },
              {
                "indexed": true,
                "internalType": "address",
                "name": "newOracle",
                "type": "address"
              }
            ],
            "name": "PriceOracleUpdated",
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
            "name": "BTC_PRECISION",
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
            "name": "CALCULATION_PRECISION",
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
            "name": "CONTRACT_USD_VALUE",
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
                "name": "requestId",
                "type": "uint256"
              },
              {
                "internalType": "uint64",
                "name": "decryptedAmount",
                "type": "uint64"
              },
              {
                "internalType": "bytes[]",
                "name": "signatures",
                "type": "bytes[]"
              }
            ],
            "name": "callbackRevealBalance",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "uint256",
                "name": "positionId",
                "type": "uint256"
              },
              {
                "internalType": "externalEuint64",
                "name": "_usdValue",
                "type": "bytes32"
              },
              {
                "internalType": "bytes",
                "name": "proof",
                "type": "bytes"
              }
            ],
            "name": "closePosition",
            "outputs": [],
            "stateMutability": "nonpayable",
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
                "name": "balance",
                "type": "bytes32"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "getCurrentBtcPrice",
            "outputs": [
              {
                "internalType": "uint64",
                "name": "price",
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
                "name": "requestId",
                "type": "uint256"
              }
            ],
            "name": "getDecryptionRequestStatus",
            "outputs": [
              {
                "internalType": "address",
                "name": "user",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              },
              {
                "internalType": "bool",
                "name": "isCompleted",
                "type": "bool"
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
            "name": "getLatestBalanceReveal",
            "outputs": [
              {
                "internalType": "uint64",
                "name": "amount",
                "type": "uint64"
              },
              {
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [
              {
                "internalType": "uint256",
                "name": "positionId",
                "type": "uint256"
              }
            ],
            "name": "getPosition",
            "outputs": [
              {
                "internalType": "address",
                "name": "owner",
                "type": "address"
              },
              {
                "internalType": "euint64",
                "name": "contractCount",
                "type": "bytes32"
              },
              {
                "internalType": "euint64",
                "name": "btcSize",
                "type": "bytes32"
              },
              {
                "internalType": "uint64",
                "name": "entryPrice",
                "type": "uint64"
              },
              {
                "internalType": "ebool",
                "name": "isLong",
                "type": "bytes32"
              },
              {
                "internalType": "uint256",
                "name": "openTimestamp",
                "type": "uint256"
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
            "name": "getUserPositionIds",
            "outputs": [
              {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
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
                "name": "_usdAmount",
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
                "name": "positionId",
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
            "name": "revealMyBalance",
            "outputs": [
              {
                "internalType": "uint256",
                "name": "requestId",
                "type": "uint256"
              }
            ],
            "stateMutability": "nonpayable",
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
          },
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "newOracle",
                "type": "address"
              }
            ],
            "name": "updatePriceOracle",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ] as const
    }
} as const; 