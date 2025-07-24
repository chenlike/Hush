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
  
  // Position refresh control state
  const [positionRefreshTrigger, setPositionRefreshTrigger] = useState(0);
  
  // Registration status refresh control
  const [registrationRefreshTrigger, setRegistrationRefreshTrigger] = useState(0);
  
  // Function to trigger position refresh
  const triggerPositionRefresh = useCallback(() => {
    setPositionRefreshTrigger(prev => prev + 1);
  }, []);

  // Function to trigger registration status refresh (called when user completes registration)
  const triggerRegistrationRefresh = useCallback(() => {
    setRegistrationRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-6 py-6 md:py-8">
        {/* Page title */}
        <div className="inline-block max-w-4xl text-center justify-center">
          <h1 className={title()}>Trading Center</h1>
          <p className="text-default-500 mt-4">
            Manage your BTC contract trading, view positions and account information
          </p>
        </div>

        {/* Main content area */}
        <div className="w-full max-w-7xl px-4">
          {!isConnected ? (
            // Show guide page when wallet is not connected
            <div className="max-w-2xl mx-auto">
              <WalletConnectGuide />
            </div>
          ) : (
            // Show trading interface when wallet is connected
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column - Trading Panel */}
              <div className="lg:col-span-1">
                <TradingPanel 
                  onPositionUpdate={triggerPositionRefresh}
                  registrationRefreshTrigger={registrationRefreshTrigger}
                />
              </div>

              {/* Right column - User info and position management */}
              <div className="lg:col-span-2">
                <div className="space-y-6">
                  <UserInfoPanel 
                    onRegistrationComplete={triggerRegistrationRefresh}
                    registrationRefreshTrigger={registrationRefreshTrigger}
                  />
                  <PositionPanel 
                    refreshTrigger={positionRefreshTrigger}
                    registrationRefreshTrigger={registrationRefreshTrigger}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </DefaultLayout>
  );
}
