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

1. **Connect Wallet**: Click "Connect Wallet" and select your Web3 wallet
2. **Switch Network**: The app will prompt you to switch to Sepolia testnet
3. **Register**: Complete the one-time user registration process
4. **Trade**: Start trading BTC perpetual contracts with privacy protection
5. **Monitor**: View your encrypted positions and participate in the leaderboard

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

## ⚠️ Disclaimer

This is experimental software running on a testnet. Do not use real funds. This project is for educational and testing purposes only.

---

**Built with ❤️ and cutting-edge FHE technology**
