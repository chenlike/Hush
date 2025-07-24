import React, { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import DefaultLayout from "@/layouts/default";
import { TradingPanel } from '@/components/trading/TradingPanel';
import { PositionPanel } from '@/components/trading/PositionPanel';
import { UserInfoPanel } from '@/components/trading/UserInfoPanel';
import { WalletConnectGuide } from '@/components/trading/WalletConnectGuide';
import { title } from "@/components/primitives";

export default function TradePage() {
  const { isConnected } = useAccount();
  
  // 持仓刷新控制状态
  const [positionRefreshTrigger, setPositionRefreshTrigger] = useState(0);
  
  // 触发持仓刷新的函数
  const triggerPositionRefresh = useCallback(() => {
    setPositionRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-6 py-6 md:py-8">
        {/* 页面标题 */}
        <div className="inline-block max-w-4xl text-center justify-center">
          <h1 className={title()}>交易中心</h1>
          <p className="text-default-500 mt-4">
            管理您的 BTC 合约交易，查看持仓和账户信息
          </p>
        </div>

        {/* 主要内容区域 */}
        <div className="w-full max-w-7xl px-4">
          {!isConnected ? (
            // 未连接钱包时显示引导页面
            <div className="max-w-2xl mx-auto">
              <WalletConnectGuide />
            </div>
          ) : (
            // 已连接钱包时显示交易界面
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧列 - 交易面板 */}
              <div className="lg:col-span-1">
                <TradingPanel onPositionUpdate={triggerPositionRefresh} />
              </div>

              {/* 右侧列 - 用户信息和持仓管理 */}
              <div className="lg:col-span-2">
                <div className="space-y-6">
                  <UserInfoPanel />
                  <PositionPanel refreshTrigger={positionRefreshTrigger} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </DefaultLayout>
  );
}
