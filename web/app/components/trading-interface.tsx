'use client';

import { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { CONTRACTS } from '../../lib/contracts';
import { fheService } from '../../lib/fhe-service';
import { ErrorBanner } from './error-banner';

export function TradingInterface() {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [margin, setMargin] = useState('');
  const [isLong, setIsLong] = useState(true);
  const [positionId, setPositionId] = useState('');
  const [fheReady, setFheReady] = useState(false);
  const [fheInitializing, setFheInitializing] = useState(false);
  const [fheFailed, setFheFailed] = useState(false);

  // 检查用户是否已注册
  const { data: isRegistered } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // 获取用户持仓
  const { data: positionIds } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getPositionIds',
    args: [],
    query: {
      enabled: !!address && !!isRegistered,
    },
  });

  // 获取当前 BTC 价格
  const { data: btcPrice } = useContractRead({
    address: CONTRACTS.PRICE_ORACLE.address,
    abi: CONTRACTS.PRICE_ORACLE.abi,
    functionName: 'getBtcPrice',
    args: [],
  });

  // 注册合约调用
  const { writeContract: register, data: registerData } = useContractWrite();

  // 开仓合约调用
  const { writeContract: openPosition, data: openPositionData } = useContractWrite();

  // 平仓合约调用
  const { writeContract: closePosition, data: closePositionData } = useContractWrite();

  // 等待交易完成
  const { isLoading: isRegistering } = useWaitForTransactionReceipt({
    hash: registerData,
  });

  const { isLoading: isOpening } = useWaitForTransactionReceipt({
    hash: openPositionData,
  });

  const { isLoading: isClosing } = useWaitForTransactionReceipt({
    hash: closePositionData,
  });

  // 初始化 FHE SDK
  useEffect(() => {
    const initFHE = async () => {
      if (!fheReady && !fheInitializing && !fheFailed) {
        setFheInitializing(true);
        try {
          await fheService.initialize();
          setFheReady(true);
        } catch (error) {
          console.error('FHE initialization failed:', error);
          setFheFailed(true);
        } finally {
          setFheInitializing(false);
        }
      }
    };

    // 只有在连接钱包且不在初始化失败状态时才初始化 FHE
    if (isConnected && !fheReady && !fheFailed) {
      initFHE();
    }
  }, [isConnected, fheReady, fheInitializing, fheFailed]);

  const handleRegister = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      register({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'register',
      });
    } catch (error) {
      console.error('注册失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPosition = async () => {
    if (!address || !margin || !fheReady) return;
    console.log("address", address);
    console.log("margin", margin);
    console.log("fheReady", fheReady);
    setIsLoading(true);
    try {
      // 创建加密输入实例
      const encryptedInput = fheService.createEncryptedInput(CONTRACTS.TRADER.address, address);
      
      // 添加保证金
      const marginValue = parseInt(margin);
      encryptedInput.add32(marginValue);
      
      // 添加交易方向
      encryptedInput.addBool(isLong);
      
      // 加密所有输入
      const encryptedResult = await encryptedInput.encrypt();
      
      console.log('加密结果:', encryptedResult);
      console.log('保证金值:', marginValue);
      console.log('交易方向:', isLong);
      
      // 调用开仓合约 - 暂时使用占位符证明
      openPosition({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'openPosition',
        args: [
          `0x${Buffer.from(encryptedResult.handles[0]).toString('hex')}` as `0x${string}`,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`, // 占位符证明
          `0x${Buffer.from(encryptedResult.handles[1]).toString('hex')}` as `0x${string}`,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}` // 占位符证明
        ]
      });
    } catch (error) {
      console.error('开仓失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryFHE = () => {
    setFheFailed(false);
    setFheReady(false);
    setFheInitializing(false);
  };

  const handleClosePosition = async () => {
    if (!positionId) return;
    
    try {
      closePosition({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'closePosition',
        args: [BigInt(positionId)]
      });
    } catch (error) {
      console.error('平仓失败:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-semibold">请先连接钱包</h2>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {fheFailed && (
        <ErrorBanner
          message="FHE 初始化失败，无法进行加密交易。请检查网络连接或刷新页面重试。"
          onRetry={handleRetryFHE}
        />
      )}
      <div className="bg-card rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">账户状态</h2>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            钱包地址: {address}
          </p>
          <p className="text-sm">
            注册状态: {isRegistered ? '已注册' : '未注册'}
          </p>
          <p className="text-sm">
            FHE 状态: {
              fheInitializing ? '初始化中...' : 
              fheReady ? '已就绪' : 
              fheFailed ? '初始化失败' : 
              '未初始化'
            }
          </p>
          {btcPrice && (
            <p className="text-sm">
              当前 BTC 价格: ${btcPrice.toString()}
            </p>
          )}
        </div>
        
        {!isRegistered && (
          <button
            onClick={handleRegister}
            disabled={isLoading || isRegistering}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading || isRegistering ? '注册中...' : '注册账户'}
          </button>
        )}
      </div>

      {isRegistered && (
        <>
          <div className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">开仓</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">保证金 (USD)</label>
                <input
                  type="number"
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="输入保证金金额"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">交易方向</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={isLong}
                      onChange={() => setIsLong(true)}
                      className="mr-2"
                    />
                    做多
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!isLong}
                      onChange={() => setIsLong(false)}
                      className="mr-2"
                    />
                    做空
                  </label>
                </div>
              </div>
              <button
                onClick={handleOpenPosition}
                disabled={!margin || isOpening || !fheReady || fheFailed}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isOpening ? '开仓中...' : 
                 fheFailed ? 'FHE 初始化失败' : 
                 !fheReady ? '等待 FHE 初始化...' : 
                 '开仓'}
              </button>
            </div>
          </div>

          <div className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">平仓</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">持仓 ID</label>
                <input
                  type="number"
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="输入持仓 ID"
                />
              </div>
              {positionIds && positionIds.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">您的持仓:</p>
                  <div className="space-y-1">
                    {positionIds.map((id) => (
                      <button
                        key={id.toString()}
                        onClick={() => setPositionId(id.toString())}
                        className="block w-full text-left px-2 py-1 text-sm hover:bg-muted rounded"
                      >
                        持仓 #{id.toString()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={handleClosePosition}
                disabled={!positionId || isClosing}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50"
              >
                {isClosing ? '平仓中...' : '平仓'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 