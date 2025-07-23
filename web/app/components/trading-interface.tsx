'use client';

import { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, useWaitForTransactionReceipt, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { CONTRACTS } from '../../lib/contracts';
import { fheService } from '../../lib/fhe-service';
import { ErrorBanner } from './error-banner';
import { hexlify } from 'ethers';


export function TradingInterface() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  const [usdAmount, setUsdAmount] = useState(''); // 开仓用的USD金额
  const [isLong, setIsLong] = useState(true);
  const [positionId, setPositionId] = useState('');
  const [closeUsdAmount, setCloseUsdAmount] = useState(''); // 平仓用的USD金额
  const [fheReady, setFheReady] = useState(false);
  const [fheInitializing, setFheInitializing] = useState(false);
  const [fheFailed, setFheFailed] = useState(false);
  
  // 持仓查询相关状态
  const [queryPositionId, setQueryPositionId] = useState('');
  const [positionInfo, setPositionInfo] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  
  // 持仓解密相关状态
  const [decryptedPositionInfo, setDecryptedPositionInfo] = useState<any>(null);
  const [isDecryptingPosition, setIsDecryptingPosition] = useState(false);
  const [hasDecryptedPosition, setHasDecryptedPosition] = useState(false);

  // 余额相关状态
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [isDecryptingBalance, setIsDecryptingBalance] = useState(false);
  const [revealedBalanceInfo, setRevealedBalanceInfo] = useState<{amount: string, timestamp: string} | null>(null);

  // 辅助函数：将Uint8Array转换为hex字符串
  const uint8ArrayToHex = (array: Uint8Array): `0x${string}` => {
    return `0x${Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
  };

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

  // 获取当前 BTC 价格
  const { data: btcPrice } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getCurrentBtcPrice',
    args: [],
  });

  // 获取用户余额（加密的）
  const { data: encryptedBalance } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getBalance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!isRegistered,
    },
  });

  // 获取用户持仓ID列表
  const { data: userPositionIds } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getUserPositionIds',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!isRegistered,
    },
  });

  // 获取用户最新的余额揭示记录
  const { data: latestBalanceReveal } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getLatestBalanceReveal',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!isRegistered,
    },
  });

  // 注册合约调用
  const { writeContract: register, data: registerData } = useContractWrite();

  // 开仓合约调用
  const { writeContract: openPosition, data: openPositionData } = useContractWrite();

  // 平仓合约调用
  const { writeContract: closePosition, data: closePositionData } = useContractWrite();

  // 余额解密合约调用
  const { writeContract: revealBalance, data: revealBalanceData } = useContractWrite();

  // 持仓查询合约调用
  const { data: positionData, refetch: refetchPosition } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getPosition',
    args: queryPositionId ? [BigInt(queryPositionId)] : undefined,
    query: {
      enabled: !!queryPositionId,
    },
  });

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

  const { isLoading: isRevealing } = useWaitForTransactionReceipt({
    hash: revealBalanceData,
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
        args: [],
      });
    } catch (error) {
      console.error('注册失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPosition = async () => {
    if (!address || !usdAmount || !fheReady) {
      console.log('开仓前置检查失败:', {
        address: !!address,
        usdAmount: !!usdAmount,
        fheReady: fheReady
      });
      return;
    }
    
    if (!isConnected) {
      console.error('钱包未连接，无法进行交易');
      return;
    }
    
    console.log("开始开仓流程");
    console.log("address", address);
    console.log("usdAmount", usdAmount);
    console.log("fheReady", fheReady);
    console.log("isConnected", isConnected);
    
    setIsLoading(true);
    try {
      // 创建加密输入实例
      const encryptedInput = fheService.createEncryptedInput(CONTRACTS.TRADER.address, address);
      
      // 添加交易方向 (ebool)
      encryptedInput.addBool(isLong);
      
      // 添加USD金额 (euint64) - 合约中直接使用USD整数，不需要小数转换
      const usdValue = parseInt(usdAmount);
      console.log("usdValue", usdValue);
      encryptedInput.add64(BigInt(usdValue));
      
      // 加密所有输入
      const encryptedResult = await encryptedInput.encrypt();
      
      console.log('加密结果:', encryptedResult);
      console.log('加密结果类型:', typeof encryptedResult);
      console.log('inputProof类型:', typeof encryptedResult.inputProof);
      console.log('inputProof内容:', encryptedResult.inputProof);
      console.log('USD金额值:', usdValue);
      console.log('交易方向:', isLong);
      
      // 调用开仓合约 - 根据合约函数签名调整参数顺序
      // openPosition(externalEbool _isLong, externalEuint64 _usdAmount, bytes calldata proof)
      const isLongHandle = uint8ArrayToHex(encryptedResult.handles[0]);
      const usdAmountHandle = uint8ArrayToHex(encryptedResult.handles[1]);
      

      
      let s = openPosition({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'openPosition',
        args: [
          isLongHandle, // _isLong
          usdAmountHandle, // _usdAmount
          hexlify(encryptedResult.inputProof) as any // proof
        ]
      });
      console.log("开仓调用完成");
      
      // openPosition返回void，所以不需要检查返回值
      // 实际的交易状态可以通过useWaitForTransactionReceipt来监控
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

  // 处理持仓查询
  const handleQueryPosition = async () => {
    if (!queryPositionId) return;
    
    setIsQuerying(true);
    try {
      await refetchPosition();
    } catch (error) {
      console.error('查询持仓失败:', error);
    } finally {
      setIsQuerying(false);
    }
  };

  // 当持仓数据更新时，更新状态
  useEffect(() => {
    if (positionData) {
      setPositionInfo(positionData);
      // 重置解密状态
      setDecryptedPositionInfo(null);
      setHasDecryptedPosition(false);
    }
  }, [positionData]);

  // 当余额揭示数据更新时，更新状态
  useEffect(() => {
    if (latestBalanceReveal && latestBalanceReveal[0] > 0) {
      setRevealedBalanceInfo({
        amount: latestBalanceReveal[0].toString(),
        timestamp: new Date(Number(latestBalanceReveal[1]) * 1000).toLocaleString()
      });
    }
  }, [latestBalanceReveal]);

  // 解密持仓信息
  const handleDecryptPosition = async () => {
    if (!positionInfo || !address || !walletClient) return;

    setIsDecryptingPosition(true);
    setHasDecryptedPosition(true);

    try {
      // 持仓信息结构: [owner, contractCount, btcSize, entryPrice, isLong]
      // contractCount, btcSize 和 isLong 是加密的，需要解密
      const contractCountHandle = String(positionInfo[1]);
      const btcSizeHandle = String(positionInfo[2]);
      const isLongHandle = String(positionInfo[4]);

      const handles = [contractCountHandle, btcSizeHandle, isLongHandle];
      console.log("handles", handles);
      const results = await fheService.decryptMultipleValuesWithWalletClient(
        handles,
        CONTRACTS.TRADER.address,
        walletClient
      );

      console.log('持仓解密结果:', results);

      const contractCount = results[contractCountHandle];
      const btcSize = results[btcSizeHandle];
      const isLong = results[isLongHandle];
      console.log("contractCount", contractCount);
      console.log("btcSize", btcSize);
      console.log("isLong", isLong);  
      
      // 格式化显示
      const contractCountFormatted = contractCount?.toString() || 'N/A';
      const btcSizeFormatted = (Number(btcSize) / 1e8).toFixed(8);

      setDecryptedPositionInfo({
        owner: positionInfo[0],
        contractCount: contractCountFormatted,
        btcSize: btcSizeFormatted,
        entryPrice: positionInfo[3]?.toString() || 'N/A',
        isLong: isLong
      });
    } catch (error: any) {
      console.error('解密持仓失败:', error);
      if (error.message.includes('user rejected')) {
        setDecryptedPositionInfo({ error: '用户取消了签名' });
      } else {
        setDecryptedPositionInfo({ error: `解密失败: ${error.message}` });
      }
    } finally {
      setIsDecryptingPosition(false);
    }
  };

  const handleClosePosition = async () => {
    if (!positionId || !address || !fheReady || !closeUsdAmount) return;
    
    setIsLoading(true);
    try {
      // 创建加密输入实例
      const encryptedInput = fheService.createEncryptedInput(CONTRACTS.TRADER.address, address);
      
      // 添加平仓USD金额 (euint64)
      const usdValue = parseInt(closeUsdAmount);
      encryptedInput.add64(BigInt(usdValue));
      
      // 加密所有输入
      const encryptedResult = await encryptedInput.encrypt();
      
      // 调用平仓合约
      // closePosition(uint256 positionId, externalEuint64 _usdValue, bytes calldata proof)
      const usdValueHandle = uint8ArrayToHex(encryptedResult.handles[0]);

      let s = closePosition({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'closePosition',
        args: [
          BigInt(positionId),
          usdValueHandle,
          hexlify(encryptedResult.inputProof) as any
        ]
      });
      console.log("平仓结果:", s);
    } catch (error) {
      console.error('平仓失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 私人查看余额（FHE解密，不提交交易）
  const handleDecryptBalance = async () => {
    if (!encryptedBalance || !address || !walletClient) return;

    setIsDecryptingBalance(true);
    try {
      const balanceHandle = String(encryptedBalance);
      const results = await fheService.decryptMultipleValuesWithWalletClient(
        [balanceHandle],
        CONTRACTS.TRADER.address,
        walletClient
      );
      
      const balance = results[balanceHandle];
      setDecryptedBalance(balance?.toString() || 'N/A');
    } catch (error: any) {
      console.error('余额解密失败:', error);
      if (error.message.includes('user rejected')) {
        setDecryptedBalance('用户取消了签名');
      } else {
        setDecryptedBalance(`解密失败: ${error.message}`);
      }
    } finally {
      setIsDecryptingBalance(false);
    }
  };

  // 公开揭示余额（提交交易到链上）
  const handleRevealBalance = async () => {
    if (!address) return;
    
    try {
      revealBalance({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'revealMyBalance',
        args: [],
      });
    } catch (error) {
      console.error('余额揭示请求失败:', error);
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
          {encryptedBalance && (
            <div className="text-sm space-y-2">
              <p>余额: (加密数据)</p>
              
              {/* 私人查看余额 */}
              <div className="border rounded p-2 bg-blue-50">
                <p className="text-xs text-blue-600 mb-1">私人查看（仅自己可见）</p>
                <button
                  onClick={handleDecryptBalance}
                  disabled={isDecryptingBalance}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {isDecryptingBalance ? '解密中...' : '查看我的余额'}
                </button>
                {decryptedBalance && (
                  <p className="mt-1 text-green-600">当前余额: ${decryptedBalance}</p>
                )}
              </div>

              {/* 公开揭示余额 */}
              <div className="border rounded p-2 bg-yellow-50">
                <p className="text-xs text-yellow-600 mb-1">公开揭示（链上可见）</p>
                <button
                  onClick={handleRevealBalance}
                  disabled={isRevealing}
                  className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700 disabled:opacity-50"
                >
                  {isRevealing ? '提交中...' : '公开揭示余额'}
                </button>
                {revealedBalanceInfo && (
                  <div className="mt-1 text-orange-600">
                    <p>已揭示余额: ${revealedBalanceInfo.amount}</p>
                    <p className="text-xs">揭示时间: {revealedBalanceInfo.timestamp}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {userPositionIds && userPositionIds.length > 0 && (
            <div className="text-sm">
              <p>您的持仓ID: {userPositionIds.map(id => id.toString()).join(', ')}</p>
            </div>
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
                <label className="block text-sm font-medium mb-2">投入金额 (USD)</label>
                <input
                  type="number"
                  value={usdAmount}
                  onChange={(e) => setUsdAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="输入USD金额 (如: 100)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  请输入要投入交易的USD金额，1 USD = 1张合约
                </p>
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
                disabled={!usdAmount || isOpening || !fheReady || fheFailed || !isConnected}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {isOpening ? '开仓中...' : 
                 !isConnected ? '请先连接钱包' :
                 fheFailed ? 'FHE 初始化失败' : 
                 !fheReady ? '等待 FHE 初始化...' : 
                 '开仓'}
              </button>
            </div>
          </div>

          <div className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">持仓查询</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">持仓 ID</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={queryPositionId}
                    onChange={(e) => setQueryPositionId(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md bg-background"
                    placeholder="输入持仓 ID"
                  />
                  <button
                    onClick={handleQueryPosition}
                    disabled={!queryPositionId || isQuerying}
                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 disabled:opacity-50"
                  >
                    {isQuerying ? '查询中...' : '查询'}
                  </button>
                </div>
              </div>
              
              {positionInfo && (
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold">持仓信息</h3>
                  <div className="text-sm space-y-1">
                    <p>持仓所有者: {positionInfo[0]}</p>
                    <p>合约数量: {positionInfo[1]?.toString() || '加密数据'}</p>
                    <p>BTC持仓大小: {positionInfo[2]?.toString() || '加密数据'}</p>
                    <p>开仓价格: ${positionInfo[3]?.toString() || 'N/A'}</p>
                    <p>交易方向: {positionInfo[4] ? '多头' : '空头'}</p>
                  </div>
                  
                  {/* 解密功能 */}
                  {isDecryptingPosition ? (
                    <p className="text-sm text-blue-500">正在解密持仓信息...</p>
                  ) : decryptedPositionInfo ? (
                    <div className="mt-3 pt-3 border-t space-y-1">
                      <h4 className="font-medium text-green-600">解密后的持仓信息:</h4>
                      {decryptedPositionInfo.error ? (
                        <p className="text-sm text-red-500">{decryptedPositionInfo.error}</p>
                      ) : (
                        <div className="text-sm space-y-1">
                          <p>合约数量: {decryptedPositionInfo.contractCount}</p>
                          <p>BTC持仓大小: {decryptedPositionInfo.btcSize}</p>
                          <p>开仓价格: ${decryptedPositionInfo.entryPrice}</p>
                          <p>交易方向: {decryptedPositionInfo.isLong ? '多头' : '空头'}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t">
                      <button
                        onClick={handleDecryptPosition}
                        disabled={!positionInfo || !fheReady}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        解密持仓信息
                      </button>
                      <p className="text-xs text-muted-foreground mt-1">
                        注意：持仓信息使用全同态加密技术保护，解密过程需要用户签名
                      </p>
                    </div>
                  )}
                  
                  {positionInfo[0] === address && (
                    <div className="mt-3 pt-3 border-t">
                      <button
                        onClick={() => {
                          setPositionId(queryPositionId);
                          setCloseUsdAmount('');
                        }}
                        className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
                      >
                        使用此持仓进行平仓
                      </button>
                    </div>
                  )}
                </div>
              )}
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
              <div>
                <label className="block text-sm font-medium mb-2">平仓金额 (USD)</label>
                <input
                  type="number"
                  value={closeUsdAmount}
                  onChange={(e) => setCloseUsdAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  placeholder="输入平仓USD金额 (如: 50)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  请输入要平仓的USD金额，不能超过持仓的总合约数量
                </p>
              </div>
              <button
                onClick={handleClosePosition}
                disabled={!positionId || !closeUsdAmount || isClosing || !fheReady}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50"
              >
                {isClosing ? '平仓中...' : 
                 !fheReady ? '等待 FHE 初始化...' : 
                 !positionId ? '请输入持仓 ID' :
                 !closeUsdAmount ? '请输入平仓金额' :
                 '平仓'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 