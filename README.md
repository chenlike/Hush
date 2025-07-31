# Hush

<a href="https://hush-iota.vercel.app/" target="__blank">https://hush-iota.vercel.app/</a>

**Privacy-Preserving Perpetual Contract Trading Platform**

> A decentralized BTC perpetual contract trading platform built with Fully Homomorphic Encryption (FHE) technology, ensuring complete privacy and security for all trading activities.


## 🌟 Overview

Hush is an innovative DeFi platform that leverages **Zama's FHEVM** (Fully Homomorphic Encryption Virtual Machine) to enable **completely private** perpetual contract trading. Unlike traditional trading platforms where transaction data is publicly visible on the blockchain, Hush encrypts all sensitive trading information while maintaining the transparency and security benefits of blockchain technology.



## 🚀 Getting Started

### Prerequisites
- Node.js 22+ 

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/hush.git
   cd hush
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   cd dapp
   npm install

   # Install smart contract dependencies
   cd ../solidity
   npm install
   ```

3. **Configure environment**
   ```bash
   # Copy environment template
   cp env.example .env
   # Fill in your configuration
   ```

4. **Deploy contracts (optional)**
   ```bash
   cd solidity
   npx hardhat deploy --network sepolia
   ```

5. **Start the development server**
   ```bash
   cd dapp
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## 📖 Usage

### Interface Operation Flow

1. **Connect Wallet**: Click "Connect Wallet" and select your Web3 wallet
2. **Switch Network**: The app will prompt you to switch to Sepolia testnet
3. **Register**: Complete the one-time user registration process
4. **Trade**: Start trading BTC perpetual contracts with privacy protection
5. **Monitor**: View your encrypted positions and participate in the leaderboard

### Detailed Interface Guide

#### 🔗 **Wallet Connection**
- Click the "Connect Wallet" button in the top navigation
- Select your preferred wallet (MetaMask recommended)
- Approve the connection request in your wallet
- The interface will automatically detect and switch to Sepolia testnet

#### 📝 **User Registration**
- After wallet connection, you'll see the registration panel
- Enter your desired trading amount (in USD)
- Click "Register" to create your encrypted account
- Wait for transaction confirmation on Sepolia

#### 💱 **Trading Operations**
- **Open Position**: 
  - Select "Long" or "Short" for BTC direction
  - Enter the USD amount you want to trade
  - Click "Open Position" and confirm the transaction
- **Close Position**:
  - View your active positions in the position panel
  - Click "Close" on any position you want to exit
  - Confirm the closing transaction

#### 📊 **Position Management**
- **Active Positions**: View all your open positions with real-time P&L
- **Balance Reveal**: Click "Reveal Balance" to decrypt your current USD balance
- **Position History**: Track your trading performance over time

#### 🏆 **Leaderboard**
- Navigate to the "Ranking" page to view the global leaderboard
- See your rank among all traders while maintaining privacy
- Monitor top performers and their encrypted balances


## 🔐 Privacy & Security

- **End-to-End Encryption**: All sensitive data is encrypted using FHE
- **No Data Leakage**: Trading positions and balances remain private
- **Auditable**: Smart contracts are open-source and verifiable
- **Decentralized**: No central authority has access to your trading data

## 🌍 Network Information

- **Testnet**: Sepolia Ethereum Testnet
- **Chain ID**: 11155111
- **Currency**: SEP (Sepolia ETH)
- **RPC**: https://rpc.sepolia.org
- **Explorer**: https://sepolia.etherscan.io

## 📋 Deployed Contracts

### Sepolia Testnet

| Contract | Address | Explorer |
|----------|---------|----------|
| **PositionTrader** | `0xa56c109905d464b11de03400fec02e3e77e3a9b4` | [View on Etherscan](https://sepolia.etherscan.io/address/0xa56c109905d464b11de03400fec02e3e77e3a9b4) |
| **PriceOracle** | `0x7cdc8EE2c834891E16C87c97c9933fB212d82144` | [View on Etherscan](https://sepolia.etherscan.io/address/0x7cdc8EE2c834891E16C87c97c9933fB212d82144) |

> **Note**: These contracts are deployed on Sepolia testnet for testing purposes only. Do not use real funds.

## ⚠️ Disclaimer

This is experimental software running on a testnet. Do not use real funds. This project is for educational and testing purposes only.

---

**Built with ❤️ and cutting-edge FHE technology**
