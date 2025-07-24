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
          <p className="text-md font-semibold">欢迎来到 Hush</p>
          <p className="text-small text-default-500">连接钱包开始您的隐私交易之旅</p>
        </div>
      </CardHeader>
      <Divider/>
      <CardBody className="space-y-6">
        {/* 连接钱包区域 */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1h-9a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h9zm-9-2h10V8H12v8z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">连接您的钱包</h3>
            <p className="text-sm text-default-500 mb-4">
              连接 Web3 钱包以访问交易功能
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        </div>

        <Divider />

        {/* 功能特色 */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-default-600">为什么选择 Hush？</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <div className="w-8 h-8 mx-auto mb-2 bg-primary-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
              </div>
              <h5 className="text-sm font-semibold text-primary-700 mb-1">安全交易</h5>
              <p className="text-xs text-primary-600">
                所有交易数据通过 FHE 同态加密技术保护，确保隐私安全
              </p>
            </div>
            
            <div className="text-center p-4 bg-secondary-50 rounded-lg">
              <div className="w-8 h-8 mx-auto mb-2 bg-secondary-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-secondary-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                </svg>
              </div>
              <h5 className="text-sm font-semibold text-secondary-700 mb-1">实时结算</h5>
              <p className="text-xs text-secondary-600">
                基于区块链的即时交易确认和资金结算
              </p>
            </div>
            
            <div className="text-center p-4 bg-success-50 rounded-lg">
              <div className="w-8 h-8 mx-auto mb-2 bg-success-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-success-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h5 className="text-sm font-semibold text-success-700 mb-1">公平竞技</h5>
              <p className="text-xs text-success-600">
                透明的排行榜系统，展示交易高手的真实实力
              </p>
            </div>
          </div>
        </div>

        <Divider />

        {/* 使用步骤 */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-default-600">使用步骤</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">连接钱包</p>
                <p className="text-xs text-default-500">使用 MetaMask 或其他 Web3 钱包</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-secondary-100 text-secondary-700 rounded-full flex items-center justify-center text-xs font-semibold">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">注册账号</p>
                <p className="text-xs text-default-500">在智能合约中注册您的交易账号</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-success-100 text-success-700 rounded-full flex items-center justify-center text-xs font-semibold">
                3
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">开始交易</p>
                <p className="text-xs text-default-500">享受安全、私密的 BTC 合约交易</p>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}; 