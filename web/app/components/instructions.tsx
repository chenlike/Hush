'use client';

import { useState } from 'react';

export function Instructions() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">使用说明</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? '收起' : '展开'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h3 className="font-medium text-foreground mb-2">1. 连接钱包</h3>
            <p>首先连接您的 Web3 钱包（如 MetaMask、WalletConnect 等）</p>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-2">2. 注册账户</h3>
            <p>注册您的账户以获得初始虚拟资金（10,000 USD）</p>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-2">3. 开仓交易</h3>
            <p>选择保证金金额和交易方向（做多/做空），然后开仓</p>
            <p className="text-xs mt-1">
              注意：开仓功能使用 FHE 加密，需要等待初始化完成
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-2">4. 平仓</h3>
            <p>选择要平仓的持仓 ID，系统会自动计算盈亏</p>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-2">隐私保护</h3>
            <p>所有交易数据都使用全同态加密技术进行保护，确保您的交易隐私</p>
            <p className="text-xs mt-1">
              使用 Zama FHE SDK 进行加密操作
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 