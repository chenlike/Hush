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

  // 检查用户注册状态
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
      console.error('检查注册状态失败:', error);
      setIsRegistered(false);
    } finally {
      setIsCheckingRegistration(false);
    }
  };

  // 获取BTC价格
  const fetchBtcPrice = async () => {
    setIsLoadingPrice(true);
    try {
      // 首先尝试从Trader合约获取价格
      let price = await contractActions.getCurrentBtcPrice();
      
      // 如果Trader合约返回null，则从PriceOracle获取
      if (price === null) {
        price = await contractActions.getOracleBtcPrice();
      }
      
      setBtcPrice(price);
      setLastPriceUpdate(new Date());
    } catch (error) {
      console.error('获取BTC价格失败:', error);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  // 监听钱包连接状态变化
  useEffect(() => {
    if (isConnected && address) {
      checkRegistrationStatus();
    } else {
      setIsRegistered(false);
    }
  }, [isConnected, address]);

  // 监听注册状态刷新触发器
  useEffect(() => {
    if (registrationRefreshTrigger && isConnected && address) {
      checkRegistrationStatus();
    }
  }, [registrationRefreshTrigger, isConnected, address]);

  // 初始化时获取价格，然后定期刷新
  useEffect(() => {
    if (isConnected) {
      fetchBtcPrice();
      
      // 每30秒刷新一次价格
      const interval = setInterval(fetchBtcPrice, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // 格式化价格显示
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // 格式化最后更新时间
  const formatLastUpdate = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return '刚刚更新';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}分钟前更新`;
    } else {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  // 开仓
  const openPositionCall = useContractCall(
    () => contractActions.openPosition(isLong, amount),
    {
      title: `${isLong ? '开多仓' : '开空仓'}`,
      onSuccess: (receipt) => {
        console.log('开仓成功', receipt);
        setAmount('1000'); // 重置表单
        // 开仓成功后触发持仓刷新
        onPositionUpdate?.();
      }
    }
  );

  // 平仓
  const closePositionCall = useContractCall(
    () => contractActions.closePosition(positionId, closeAmount),
    {
      title: '平仓',
      onSuccess: (receipt) => {
        console.log('平仓成功', receipt);
        setPositionId('');
        setCloseAmount('');
        // 平仓成功后也触发持仓刷新
        onPositionUpdate?.();
      }
    }
  );

  // 余额揭示
  const revealBalanceCall = useContractCall(contractActions.revealBalance, {
    title: '余额揭示',
    onSuccess: () => {
      console.log('余额揭示成功');
    }
  });

  // 判断是否可以进行交易操作（开仓和平仓）
  const canTrade = isConnected && isRegistered && !isCheckingRegistration;

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="flex flex-col flex-1">
          <p className="text-md font-semibold">交易面板</p>
          <p className="text-small text-default-500">执行合约交易操作</p>
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
                    <span className="text-sm text-default-400">加载中...</span>
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
        {/* 开仓区域 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-default-600">开仓交易</h4>
            <div className="flex items-center gap-2">
              <Chip 
                color={isLong ? "success" : "danger"} 
                variant="flat" 
                size="sm"
              >
                {isLong ? "做多" : "做空"}
              </Chip>
              {!canTrade && (
                <Chip color="warning" variant="flat" size="sm">
                  {!isConnected ? "请连接钱包" : isCheckingRegistration ? "检查中..." : "请先注册"}
                </Chip>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-default-600">交易方向</label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={isLong ? "solid" : "flat"}
                  color="success"
                  onPress={() => setIsLong(true)}
                  className="flex-1"
                  isDisabled={!canTrade}
                >
                  做多
                </Button>
                <Button
                  size="sm"
                  variant={!isLong ? "solid" : "flat"}
                  color="danger"
                  onPress={() => setIsLong(false)}
                  className="flex-1"
                  isDisabled={!canTrade}
                >
                  做空
                </Button>
              </div>
            </div>
            
            <Input
              type="number"
              label="交易金额 (USD)"
              placeholder="请输入金额"
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
                ? (!isConnected ? "请连接钱包" : isCheckingRegistration ? "检查注册状态..." : "请先完成注册")
                : (isLong ? `开多仓 ${amount} USD` : `开空仓 ${amount} USD`)
              }
            </Button>
          </div>
        </div>

        <Divider />

        {/* 平仓区域 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-default-600">平仓交易</h4>
            {!canTrade && (
              <Chip color="warning" variant="flat" size="sm">
                {!isConnected ? "请连接钱包" : isCheckingRegistration ? "检查中..." : "请先注册"}
              </Chip>
            )}
          </div>
          
          <div className="space-y-3">
            <Input
              type="text"
              label="持仓 ID"
              placeholder="请输入持仓ID"
              value={positionId}
              onValueChange={setPositionId}
              size="sm"
              isDisabled={!canTrade}
            />
            
            <Input
              type="number"
              label="平仓金额 (USD)"
              placeholder="请输入平仓金额"
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
                ? (!isConnected ? "请连接钱包" : isCheckingRegistration ? "检查注册状态..." : "请先完成注册")
                : `平仓 ${closeAmount} USD`
              }
            </Button>
          </div>
        </div>

        {/* 操作状态显示 */}
        {(openPositionCall.hash || closePositionCall.hash || revealBalanceCall.hash) && (
          <>
            <Divider />
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-default-600">交易状态</h4>
              <div className="space-y-1 text-xs text-default-500 font-mono bg-default-50 p-2 rounded">
                {openPositionCall.hash && (
                  <div>开仓: {openPositionCall.hash.slice(0, 10)}... ({openPositionCall.status})</div>
                )}
                {closePositionCall.hash && (
                  <div>平仓: {closePositionCall.hash.slice(0, 10)}... ({closePositionCall.status})</div>
                )}
                {revealBalanceCall.hash && (
                  <div>余额: {revealBalanceCall.hash.slice(0, 10)}... ({revealBalanceCall.status})</div>
                )}
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};