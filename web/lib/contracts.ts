// 合约配置
export const CONTRACTS = {
    PRICE_ORACLE: {
        address: '0x8013bf7a8654f81d18ac99cd2776a4aa02eb6ff7' as `0x${string}`,
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
        address: '0xb8b228e6524561ba3e5653be97f1a44700f325b0' as `0x${string}`,
        abi: [
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "_priceOracle",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "_storageAddr",
                        "type": "address"
                    }
                ],
                "stateMutability": "nonpayable",
                "type": "constructor"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": true,
                        "internalType": "address",
                        "name": "owner",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint32",
                        "name": "usdBalance",
                        "type": "uint32"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint32",
                        "name": "btcBalance",
                        "type": "uint32"
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
                        "internalType": "address",
                        "name": "owner",
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
                        "internalType": "uint32",
                        "name": "currentPrice",
                        "type": "uint32"
                    }
                ],
                "name": "PositionClosed",
                "type": "event"
            },
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "positionId",
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
                "name": "getEncryptedCash",
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
                        "internalType": "euint32",
                        "name": "margin",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "uint32",
                        "name": "entryPrice",
                        "type": "uint32"
                    },
                    {
                        "internalType": "ebool",
                        "name": "isLong",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "bool",
                        "name": "isOpen",
                        "type": "bool"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getPositionIds",
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
                        "name": "user",
                        "type": "address"
                    }
                ],
                "name": "getPublicRevealedBalance",
                "outputs": [
                    {
                        "internalType": "euint32",
                        "name": "",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "euint32",
                        "name": "",
                        "type": "bytes32"
                    },
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
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                    }
                ],
                "name": "getRevealRecord",
                "outputs": [
                    {
                        "internalType": "uint32",
                        "name": "usdBalance",
                        "type": "uint32"
                    },
                    {
                        "internalType": "uint32",
                        "name": "btcBalance",
                        "type": "uint32"
                    },
                    {
                        "internalType": "uint256",
                        "name": "timestamp",
                        "type": "uint256"
                    },
                    {
                        "internalType": "bool",
                        "name": "exists",
                        "type": "bool"
                    },
                    {
                        "internalType": "ebool",
                        "name": "usdVerified",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "ebool",
                        "name": "btcVerified",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "bool",
                        "name": "usdVerifiedDecrypted",
                        "type": "bool"
                    },
                    {
                        "internalType": "bool",
                        "name": "btcVerifiedDecrypted",
                        "type": "bool"
                    },
                    {
                        "internalType": "bool",
                        "name": "isDecryptionPending",
                        "type": "bool"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getRevealedUsers",
                "outputs": [
                    {
                        "internalType": "address[]",
                        "name": "",
                        "type": "address[]"
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
                "name": "hasRevealed",
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
                        "internalType": "externalEuint32",
                        "name": "inputMargin",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "bytes",
                        "name": "proofMargin",
                        "type": "bytes"
                    },
                    {
                        "internalType": "externalEbool",
                        "name": "inputDir",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "bytes",
                        "name": "proofDir",
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
                "name": "priceOracle",
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
                "inputs": [
                    {
                        "internalType": "uint32",
                        "name": "usdBalance",
                        "type": "uint32"
                    },
                    {
                        "internalType": "uint32",
                        "name": "btcBalance",
                        "type": "uint32"
                    }
                ],
                "name": "revealBalance",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "storageContract",
                "outputs": [
                    {
                        "internalType": "contract RevealStorage",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ] as const
    },
    REVEAL_STORAGE: {
        address: '0xe2a799237021eb1b0473b294d4bf7440135ffecd' as `0x${string}`,
        abi: [
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "name": "balances",
                "outputs": [
                    {
                        "internalType": "euint32",
                        "name": "usd",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "euint32",
                        "name": "btc",
                        "type": "bytes32"
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
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                    }
                ],
                "name": "getPublicBalance",
                "outputs": [
                    {
                        "internalType": "euint32",
                        "name": "",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "euint32",
                        "name": "",
                        "type": "bytes32"
                    },
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
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                    }
                ],
                "name": "getPublicRevealedBalance",
                "outputs": [
                    {
                        "internalType": "euint32",
                        "name": "",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "euint32",
                        "name": "",
                        "type": "bytes32"
                    },
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
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                    }
                ],
                "name": "getRevealTimestamp",
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
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                    }
                ],
                "name": "hasUserRevealedBalance",
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
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                    },
                    {
                        "internalType": "euint32",
                        "name": "usd",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "euint32",
                        "name": "btc",
                        "type": "bytes32"
                    }
                ],
                "name": "storePublicBalance",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ] as const
    }
} as const; 