import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody,
  Button,
  Chip,
  Divider,
  Spinner
} from '@heroui/react';
import { useTradingContractActions } from '@/lib/contracts';
import { useContractCall } from '@/lib/contract-hook';
import { useAccount } from 'wagmi';
import { UserRegistration } from './UserRegistration';

interface UserInfoPanelProps {
  onRegistrationComplete?: () => void;
  registrationRefreshTrigger?: number;
}

export const UserInfoPanel: React.FC<UserInfoPanelProps> = ({ 
  onRegistrationComplete, 
  registrationRefreshTrigger 
}) => {
  const { address, isConnected } = useAccount();
  const [balance, setBalance] = useState<string>('');
  const [lastRevealInfo, setLastRevealInfo] = useState<any>(null);
  const [isDecryptingBalance, setIsDecryptingBalance] = useState(false);
  const [isLoadingReveal, setIsLoadingReveal] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);

  const contractActions = useTradingContractActions();

  // 检查用户注册状态
  const checkRegistrationStatus = async () => {
    if (!address) return;
    
    setIsCheckingRegistration(true);
    try {
      const registered = await contractActions.checkUserRegistration(address);
      setIsRegistered(registered);
    } catch (error) {
      console.error('检查注册状态失败:', error);
    } finally {
      setIsCheckingRegistration(false);
    }
  };

  // 余额揭示合约调用
  const revealBalanceCall = useContractCall(contractActions.revealBalance, {
    title: '余额揭示',
    onSuccess: () => {
      console.log('余额揭示成功');
      // 揭示成功后，等待一段时间再获取最新的揭示信息
      setTimeout(() => {
        loadLatestBalanceReveal();
      }, 2000);
    },
    onError: (error) => {
      console.error('余额揭示失败:', error);
    }
  });

  // 获取最新余额揭示信息
  const loadLatestBalanceReveal = async () => {
    if (!address) return;
    
    setIsLoadingReveal(true);
    try {
      const revealInfo = await contractActions.getLatestBalanceReveal(address);
      setLastRevealInfo(revealInfo);
    } catch (error) {
      console.error('获取余额揭示信息失败:', error);
    } finally {
      setIsLoadingReveal(false);
    }
  };

  // 解密用户余额
  const handleDecryptBalance = async () => {
    if (!address || !contractActions.walletClient) return;
    
    setIsDecryptingBalance(true);
    try {
      // 获取加密余额
      const encryptedBalance = await contractActions.getUserBalance(address);
      if (!encryptedBalance) {
        throw new Error('无法获取加密余额');
      }
      
      // 解密余额
      const decryptedBalance = await contractActions.decryptBalance(encryptedBalance);
      setBalance(decryptedBalance);
      
      console.log('余额解密成功:', decryptedBalance);
    } catch (error: any) {
      console.error('余额解密失败:', error);
      // 处理特定错误
      if (error.message.includes('用户取消了签名')) {
        // 用户取消签名，不显示错误
        return;
      }
      // 其他错误可以在这里处理
    } finally {
      setIsDecryptingBalance(false);
    }
  };

  // 刷新余额
  const handleRefreshBalance = async () => {
    await handleDecryptBalance();
  };

  // 页面加载时检查注册状态和获取余额信息
  useEffect(() => {
    if (isConnected && address) {
      checkRegistrationStatus();
    } else {
      setIsRegistered(false);
    }
  }, [isConnected, address]);

  // 监听registrationRefreshTrigger，如果触发则重新检查注册状态
  useEffect(() => {
    if (registrationRefreshTrigger && isConnected && address) {
      checkRegistrationStatus();
    }
  }, [registrationRefreshTrigger, isConnected, address]);

  // 当注册状态确认后，获取余额信息
  useEffect(() => {
    if (isRegistered && address) {
      loadLatestBalanceReveal();
    }
  }, [isRegistered, address]);

  return (
    <div className="space-y-6">
      {/* 用户注册状态 */}
      <UserRegistration 
        onRegistrationComplete={onRegistrationComplete} 
        registrationRefreshTrigger={registrationRefreshTrigger} 
      />
      
      {/* 余额信息 - 只在已注册时显示 */}
      {isConnected && isRegistered && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">账户余额</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  color="secondary"
                  onPress={revealBalanceCall.execute}
                  isLoading={revealBalanceCall.isLoading}
                >
                  {revealBalanceCall.isLoading ? '揭示中...' : '余额揭示'}
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={handleDecryptBalance}
                  isLoading={isDecryptingBalance}
                >
                  {isDecryptingBalance ? '解密中...' : '解密余额'}
                </Button>
              </div>
            </div>
            
            <Divider />
            
            {/* 当前余额显示 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-500">当前余额:</span>
                <div className="flex items-center gap-2">
                  {balance ? (
                    <Chip color="success" variant="flat" size="sm">
                      {balance} USD
                    </Chip>
                  ) : (
                    <span className="text-sm text-default-400">未解密</span>
                  )}
                  {isDecryptingBalance && <Spinner size="sm" />}
                </div>
              </div>

              {/* 最新余额揭示信息 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-500">最新揭示:</span>
                <div className="flex items-center gap-2">
                  {isLoadingReveal ? (
                    <Spinner size="sm" />
                  ) : lastRevealInfo ? (
                    <div className="text-right">
                      <div className="text-sm font-semibold">{lastRevealInfo.amount} USD</div>
                      <div className="text-xs text-default-400">{lastRevealInfo.timestamp}</div>
                    </div>
                  ) : (
                    <span className="text-sm text-default-400">暂无揭示记录</span>
                  )}
                </div>
              </div>
            </div>

            {/* 操作说明 */}
            <div className="p-3 bg-default-50 rounded-lg">
              <p className="text-xs text-default-500">
                💡 提示：余额揭示会将您的余额公开记录在区块链上，而解密余额只在本地查看。 揭示余额会有一定的延迟
              </p>
            </div>

          </CardBody>
        </Card>
      )}
    </div>
  );
};