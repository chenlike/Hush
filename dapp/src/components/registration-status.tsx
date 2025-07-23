import React, { useState, useEffect } from 'react';
import {Chip, Button, Card, CardHeader, CardBody, CardFooter, Divider, Spinner} from "@heroui/react";
import { useTradingContractActions, useTransactionManager, TransactionStatus } from '@/lib/contracts';
import { useTransactionToast } from '@/lib/transaction-toast';
import { useAccount, useWalletClient, useContractRead } from 'wagmi';
import { fheService } from '@/lib/fhe-service';
import { CONTRACTS } from '@/lib/base-contracts';

export const RegistrationStatus: React.FC = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const contracts = useTradingContractActions();
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  
  // 余额相关状态
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [isDecryptingBalance, setIsDecryptingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // 检查用户是否已注册
  const { data: isRegistered, refetch: refetchRegistration } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
  
  // 使用新的交易管理器
  const txManager = useTransactionManager();
  
  // 使用Toast显示交易过程
  useTransactionToast(txManager, '🏆 竞赛注册');

  // 获取用户余额（加密的）
  const { data: balanceData, refetch: refetchBalance } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getBalance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isRegistered,
    },
  });

  // 解密余额
  const handleDecryptBalance = async () => {
    if (!balanceData || !address || !walletClient) return;

    setIsDecryptingBalance(true);
    setBalanceError(null);
    
    try {
      const decrypted = await contracts.decryptBalance(balanceData);
      setDecryptedBalance(decrypted);
    } catch (error: any) {
      console.error('余额解密失败:', error);
      if (error.message.includes('user rejected')) {
        setBalanceError('用户取消了签名');
      } else {
        setBalanceError(`解密失败: ${error.message}`);
      }
    } finally {
      setIsDecryptingBalance(false);
    }
  };

  // 注册处理器
  const handleRegister = async () => {
    if (!address) return;
    
    setRegistrationError(null);
    
    await txManager.executeTransaction(
      () => contracts.register()
    );
  };

  // 监听交易状态变化
  useEffect(() => {
    if (txManager.status === TransactionStatus.SUCCESS) {
      // 交易成功，重新获取注册状态
      console.log('Registration successful!');
      setTimeout(() => {
        refetchRegistration();
        refetchBalance();
      }, 2000); // 等待2秒让交易完全确认
    } else if (txManager.status === TransactionStatus.FAILED) {
      // 交易失败，显示错误信息
      setRegistrationError(txManager.error || '注册失败，请重试');
      console.error('Registration failed:', txManager.error);
    }
  }, [txManager.status, txManager.error, refetchRegistration, refetchBalance]);

  // 当注册状态改变时获取余额
  useEffect(() => {
    if (isRegistered && address) {
      refetchBalance();
    }
  }, [isRegistered, address, refetchBalance]);

  // 重置状态
  const handleRetry = () => {
    setRegistrationError(null);
    txManager.reset();
  };



  // 如果没有连接钱包
  if (!address) {
    return (
      <Card className="max-w-[400px]">
        <CardHeader className="flex gap-3">
          <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
            <span className="text-warning-600 text-lg">⚠️</span>
          </div>
          <div className="flex flex-col">
            <p className="text-md font-semibold">钱包状态</p>
            <p className="text-small text-default-500">未连接</p>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="flex items-center gap-3">
            <Chip color="warning" variant="flat">未连接</Chip>
            <span className="text-sm text-default-600">请先连接您的钱包</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="max-w-[400px]">
      <CardHeader className="flex gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 ${
          isRegistered ? 'bg-success-100' : 'bg-warning-100'
        }`}>
          <span className={`text-lg transition-all duration-200 ${
            isRegistered ? 'text-success-600' : 'text-warning-600'
          }`}>
            {isRegistered ? '✅' : '🏆'}
          </span>
        </div>
        <div className="flex flex-col">
          <p className="text-md font-semibold">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        </div>
        <div className="ml-auto">
          <Chip 
            color={isRegistered ? "success" : "warning"} 
            variant="flat"
            size="sm"
            className="transition-colors duration-200"
          >
            {isRegistered ? "已注册" : "未注册"}
          </Chip>
        </div>
      </CardHeader>
      
      <Divider />
      
      <CardBody>
        {!isRegistered ? (
          <div className="space-y-3">
            <p className="text-sm text-default-600">
              🏆 欢迎来到交易竞赛！现在注册即可开始使用虚拟资金参与竞争。
            </p>
            <div className="bg-warning-50 p-3 rounded-lg">
              <p className="text-xs text-warning-700">
                💰 无需真实USD！所有交易都使用虚拟货币，安全竞争。
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-success-700 font-medium">
                竞赛准备就绪
              </span>
            </div>
            <p className="text-sm text-default-600">
              🎉 恭喜！您已注册成功，准备开始加密交易竞赛。
            </p>
            
            {/* 余额显示区域 */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs text-blue-600 font-medium">账户余额</span>
                  <div className="flex items-center gap-2 mt-1">
                    {decryptedBalance ? (
                      <span className="text-lg font-bold text-green-600">${decryptedBalance}</span>
                    ) : (
                      <span className="text-lg font-bold text-gray-500">$****</span>
                    )}
                                         <button
                       onClick={handleDecryptBalance}
                       disabled={isDecryptingBalance || !balanceData}
                       className="p-1 hover:bg-blue-100 rounded-full transition-colors duration-200 disabled:opacity-50"
                       title={decryptedBalance ? "余额已解密" : "点击解密余额"}
                     >
                       {isDecryptingBalance ? (
                         <Spinner size="sm" />
                       ) : decryptedBalance ? (
                         <span className="text-green-500">👁️</span>
                       ) : (
                         <span className="text-blue-500">🔒</span>
                       )}
                     </button>
                   </div>
                   {balanceError && (
                     <p className="text-xs text-red-500 mt-1">{balanceError}</p>
                   )}
                   {!balanceData && (
                     <div className="flex items-center gap-1 mt-1">
                       <Spinner size="sm" />
                       <span className="text-xs text-gray-500">加载余额中...</span>
                     </div>
                   )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">加密保护</p>
                  <span className="text-xs text-blue-600">🔐 FHE</span>
                </div>
              </div>
            </div>
            
            <div className="bg-success-50 p-3 rounded-lg">
              <p className="text-xs text-success-700">
                ✨ 您的所有交易数据都受到同态加密保护，确保隐私安全。
              </p>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {registrationError && !txManager.isLoading && (
          <div className="mt-3 bg-danger-50 p-3 rounded-lg">
            <p className="text-xs text-danger-700">{registrationError}</p>
          </div>
        )}
      </CardBody>



      {/* 操作按钮 */}
      {!isRegistered && (
        <>
          <Divider />
          <CardFooter>
            {registrationError && !txManager.isLoading ? (
              <div className="flex gap-2 w-full">
                <Button
                  color="default"
                  variant="bordered"
                  onPress={handleRetry}
                  size="md"
                  className="flex-1"
                >
                  重置
                </Button>
                <Button
                  color="primary"
                  onPress={handleRegister}
                  size="md"
                  className="flex-1"
                  variant="solid"
                >
                  重试注册
                </Button>
              </div>
            ) : (
              <Button
                color="primary"
                onPress={handleRegister}
                isLoading={txManager.isLoading}
                isDisabled={txManager.isLoading || txManager.status === TransactionStatus.SUCCESS}
                size="md"
                className="w-full"
                variant="solid"
              >
                {txManager.isPreparing ? "准备中..." :
                 txManager.isPending ? "等待确认..." :
                 txManager.isConfirming ? "确认中..." :
                 txManager.isSuccess ? "注册成功" :
                 "🚀 加入竞赛"}
              </Button>
            )}
          </CardFooter>
        </>
      )}
      
      {isRegistered && (
        <>
          <Divider />
          <CardFooter className="justify-center">
            <p className="text-xs text-success-600 font-medium">
              准备开始交易竞赛 🎯
            </p>
          </CardFooter>
        </>
      )}
    </Card>
  );
};

export default RegistrationStatus; 