import React from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody,
  Button,
  Divider,
  Chip
} from '@heroui/react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export const WalletConnectGuide: React.FC = () => {
  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="flex flex-col">
          <p className="text-md font-semibold">Welcome to Hush</p>
          <p className="text-small text-default-500">Connect your wallet to start your private trading journey</p>
        </div>
      </CardHeader>
      <Divider/>
      <CardBody className="space-y-6">
        {/* Wallet connection area */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1h-9a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h9zm-9-2h10V8H12v8z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-sm text-default-500 mb-4">
              Connect your Web3 wallet to access trading features
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        </div>

        <Divider />

        {/* Features */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-default-600">Why Choose Hush?</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <div className="w-8 h-8 mx-auto mb-2 bg-primary-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
              </div>
              <h5 className="text-sm font-semibold text-primary-700 mb-1">Secure Trading</h5>
              <p className="text-xs text-primary-600">
                All trading data is protected by FHE (Fully Homomorphic Encryption) technology, ensuring privacy and security
              </p>
            </div>
            
            <div className="text-center p-4 bg-secondary-50 rounded-lg">
              <div className="w-8 h-8 mx-auto mb-2 bg-secondary-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-secondary-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                </svg>
              </div>
              <h5 className="text-sm font-semibold text-secondary-700 mb-1">Real-time Settlement</h5>
              <p className="text-xs text-secondary-600">
                Instant transaction confirmation and fund settlement based on blockchain
              </p>
            </div>
            
            <div className="text-center p-4 bg-success-50 rounded-lg">
              <div className="w-8 h-8 mx-auto mb-2 bg-success-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-success-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h5 className="text-sm font-semibold text-success-700 mb-1">Fair Competition</h5>
              <p className="text-xs text-success-600">
                Transparent leaderboard system showing the real strength of trading experts
              </p>
            </div>
          </div>
        </div>

        <Divider />

        {/* Usage steps */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-default-600">How to Use</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Connect Wallet</p>
                <p className="text-xs text-default-500">Use MetaMask or other Web3 wallets</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-secondary-100 text-secondary-700 rounded-full flex items-center justify-center text-xs font-semibold">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Register Account</p>
                <p className="text-xs text-default-500">Register your trading account in the smart contract</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-success-100 text-success-700 rounded-full flex items-center justify-center text-xs font-semibold">
                3
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Start Trading</p>
                <p className="text-xs text-default-500">Enjoy secure and private BTC contract trading</p>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}; 