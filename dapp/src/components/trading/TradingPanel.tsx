import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  Button, 
  Input, 
  Divider,
  Chip
} from '@heroui/react';
import { useAccount } from 'wagmi';
import { useTradingContractActions } from '@/lib/contracts';
import { useContractCall } from '@/lib/contract-hook';

interface TradingPanelProps {
  onPositionUpdate?: () => void;
  registrationRefreshTrigger?: number;
}

export const TradingPanel: React.FC<TradingPanelProps> = ({ onPositionUpdate, registrationRefreshTrigger }) => {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('1000');
  const [isLong, setIsLong] = useState(true);
  const [positionId, setPositionId] = useState('');
  const [closeAmount, setCloseAmount] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);

  const contractActions = useTradingContractActions();

  // Check user registration status
  const checkRegistrationStatus = async () => {
    if (!address) {
      setIsRegistered(false);
      return;
    }
    
    setIsCheckingRegistration(true);
    try {
      const registered = await contractActions.checkUserRegistration(address);
      setIsRegistered(registered);
    } catch (error) {
      console.error('Failed to check registration status:', error);
      setIsRegistered(false);
    } finally {
      setIsCheckingRegistration(false);
    }
  };

  // Get BTC price
  const fetchBtcPrice = async () => {
    setIsLoadingPrice(true);
    try {
      // First try to get price from Trader contract
      let price = await contractActions.getCurrentBtcPrice();
      
      // If Trader contract returns null, get from PriceOracle
      if (price === null) {
        price = await contractActions.getOracleBtcPrice();
      }
      
      setBtcPrice(price);
      setLastPriceUpdate(new Date());
    } catch (error) {
      console.error('Failed to get BTC price:', error);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  // Listen to wallet connection status changes
  useEffect(() => {
    if (isConnected && address) {
      checkRegistrationStatus();
    } else {
      setIsRegistered(false);
    }
  }, [isConnected, address]);

  // Listen to registration status refresh trigger
  useEffect(() => {
    if (registrationRefreshTrigger && isConnected && address) {
      checkRegistrationStatus();
    }
  }, [registrationRefreshTrigger, isConnected, address]);

  // Get price on initialization, then refresh periodically
  useEffect(() => {
    if (isConnected) {
      fetchBtcPrice();
      
      // Refresh price every 30 seconds
      const interval = setInterval(fetchBtcPrice, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // Format price display
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Format last update time
  const formatLastUpdate = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just updated';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `Updated ${minutes} minutes ago`;
    } else {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  // Open position
  const openPositionCall = useContractCall(
    () => contractActions.openPosition(isLong, amount),
    {
      title: `${isLong ? 'Open Long' : 'Open Short'}`,
      onSuccess: (receipt) => {
        console.log('Position opened successfully', receipt);
        setAmount('1000'); // Reset form
        // Trigger position refresh after successful opening
        onPositionUpdate?.();
      }
    }
  );

  // Close position
  const closePositionCall = useContractCall(
    () => contractActions.closePosition(positionId, closeAmount),
    {
      title: 'Close Position',
      onSuccess: (receipt) => {
        console.log('Position closed successfully', receipt);
        setPositionId('');
        setCloseAmount('');
        // Also trigger position refresh after closing
        onPositionUpdate?.();
      }
    }
  );

  // Balance reveal
  const revealBalanceCall = useContractCall(contractActions.revealBalance, {
    title: 'Balance Reveal',
    onSuccess: () => {
      console.log('Balance revealed successfully');
    }
  });

  // Determine if trading operations are allowed (open and close positions)
  const canTrade = isConnected && isRegistered && !isCheckingRegistration;

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="flex flex-col flex-1">
          <p className="text-md font-semibold">Trading Panel</p>
          <p className="text-small text-default-500">Execute contract trading operations</p>
        </div>
        
        {/* BTC价格显示区域 */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-default-600">BTC</span>
                {isLoadingPrice ? (
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                    <span className="text-sm text-default-400">Loading...</span>
                  </div>
                ) : (
                  <span className="text-lg font-bold text-primary-600">
                    {formatPrice(btcPrice)}
                  </span>
                )}
              </div>
              {lastPriceUpdate && (
                <div className="text-xs text-default-400 text-right">
                  {formatLastUpdate(lastPriceUpdate)}
                </div>
              )}
            </div>
            
            {/* 手动刷新按钮 */}
            <Button
              size="sm"
              variant="flat"
              color="primary"
              isIconOnly
              onPress={fetchBtcPrice}
              isLoading={isLoadingPrice}
              className="min-w-unit-8 w-8 h-8"
            >
              {!isLoadingPrice && '🔄'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <Divider/>
      <CardBody className="space-y-4">
        {/* Open position area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-default-600">Open Position</h4>
            <div className="flex items-center gap-2">
              <Chip 
                color={isLong ? "success" : "danger"} 
                variant="flat" 
                size="sm"
              >
                {isLong ? "Long" : "Short"}
              </Chip>
              {!canTrade && (
                <Chip color="warning" variant="flat" size="sm">
                  {!isConnected ? "Connect Wallet" : isCheckingRegistration ? "Checking..." : "Register First"}
                </Chip>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-default-600">Trading Direction</label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={isLong ? "solid" : "flat"}
                  color="success"
                  onPress={() => setIsLong(true)}
                  className="flex-1"
                  isDisabled={!canTrade}
                >
                  Long
                </Button>
                <Button
                  size="sm"
                  variant={!isLong ? "solid" : "flat"}
                  color="danger"
                  onPress={() => setIsLong(false)}
                  className="flex-1"
                  isDisabled={!canTrade}
                >
                  Short
                </Button>
              </div>
            </div>
            
            <Input
              type="number"
              label="Trading Amount (USD)"
              placeholder="Enter amount"
              value={amount}
              onValueChange={setAmount}
              size="sm"
              isDisabled={!canTrade}
              endContent={
                <div className="pointer-events-none flex items-center">
                  <span className="text-default-400 text-small">USD</span>
                </div>
              }
            />
            
            <Button
              color={isLong ? "success" : "danger"}
              onPress={openPositionCall.execute}
              isLoading={openPositionCall.isLoading}
              isDisabled={!canTrade || !amount || openPositionCall.isLoading}
              size="sm"
              className="w-full"
            >
              {!canTrade 
                ? (!isConnected ? "Connect Wallet" : isCheckingRegistration ? "Checking Registration..." : "Please Register First")
                : (isLong ? `Open Long ${amount} USD` : `Open Short ${amount} USD`)
              }
            </Button>
          </div>
        </div>

        <Divider />

        {/* Close position area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-default-600">Close Position</h4>
            {!canTrade && (
              <Chip color="warning" variant="flat" size="sm">
                {!isConnected ? "Connect Wallet" : isCheckingRegistration ? "Checking..." : "Register First"}
              </Chip>
            )}
          </div>
          
          <div className="space-y-3">
            <Input
              type="text"
              label="Position ID"
              placeholder="Enter position ID"
              value={positionId}
              onValueChange={setPositionId}
              size="sm"
              isDisabled={!canTrade}
            />
            
            <Input
              type="number"
              label="Close Amount (USD)"
              placeholder="Enter close amount"
              value={closeAmount}
              onValueChange={setCloseAmount}
              size="sm"
              isDisabled={!canTrade}
              endContent={
                <div className="pointer-events-none flex items-center">
                  <span className="text-default-400 text-small">USD</span>
                </div>
              }
            />
            
            <Button
              color="warning"
              onPress={closePositionCall.execute}
              isLoading={closePositionCall.isLoading}
              isDisabled={!canTrade || !positionId || !closeAmount || closePositionCall.isLoading}
              size="sm"
              className="w-full"
            >
              {!canTrade 
                ? (!isConnected ? "Connect Wallet" : isCheckingRegistration ? "Checking Registration..." : "Please Register First")
                : `Close ${closeAmount} USD`
              }
            </Button>
          </div>
        </div>

        {/* Operation status display */}
        {(openPositionCall.hash || closePositionCall.hash || revealBalanceCall.hash) && (
          <>
            <Divider />
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-default-600">Transaction Status</h4>
              <div className="space-y-1 text-xs text-default-500 font-mono bg-default-50 p-2 rounded">
                {openPositionCall.hash && (
                  <div>Open: {openPositionCall.hash.slice(0, 10)}... ({openPositionCall.status})</div>
                )}
                {closePositionCall.hash && (
                  <div>Close: {closePositionCall.hash.slice(0, 10)}... ({closePositionCall.status})</div>
                )}
                {revealBalanceCall.hash && (
                  <div>Balance: {revealBalanceCall.hash.slice(0, 10)}... ({revealBalanceCall.status})</div>
                )}
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};