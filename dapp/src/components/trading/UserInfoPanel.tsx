import React, { useState } from 'react';
import { 
  Card, 
  CardBody,
  Button,
} from '@heroui/react';
import { useTradingContractActions } from '@/lib/contracts';
import { useAccount } from 'wagmi';
import { UserRegistration } from './UserRegistration';

export const UserInfoPanel: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [balance, setBalance] = useState<string>('');
  const [isDecryptingBalance, setIsDecryptingBalance] = useState(false);

  const contractActions = useTradingContractActions();

  // 解密用户余额
  const handleDecryptBalance = async () => {
    if (!address || !contractActions.walletClient) return;
    
    setIsDecryptingBalance(true);
    try {
      // 这里应该先从合约获取加密余额数据
      // const encryptedBalance = await getEncryptedBalanceFromContract();
      // const decryptedBalance = await contractActions.decryptBalance(encryptedBalance);
      
      // 模拟解密过程
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 模拟解密结果
      const mockDecryptedBalance = '15000.50';
      setBalance(mockDecryptedBalance);
      
      console.log('余额解密成功:', mockDecryptedBalance);
    } catch (error) {
      console.error('余额解密失败:', error);
    } finally {
      setIsDecryptingBalance(false);
    }
  };

  // 刷新余额
  const handleRefreshBalance = async () => {
    if (!address || !contractActions.walletClient) return;
    
    setIsDecryptingBalance(true);
    try {
      // 模拟刷新过程
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 模拟刷新结果
      const mockRefreshedBalance = '15200.75';
      setBalance(mockRefreshedBalance);
      
      console.log('余额刷新成功:', mockRefreshedBalance);
    } catch (error) {
      console.error('余额刷新失败:', error);
    } finally {
      setIsDecryptingBalance(false);
    }
  };

  // 格式化地址显示
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // 如果未连接钱包，显示注册组件
  if (!isConnected) {
    return <UserRegistration />;
  }

  return (
    <Card className="w-full">
      <CardBody className="p-4">
        <div className="flex items-center justify-between">
          {/* 地址显示 */}
          <span className="text-sm font-mono text-default-600">
            {address ? formatAddress(address) : '未连接钱包'}
          </span>

          {/* 右侧余额和解密功能 */}
          <div className="flex items-center gap-3">
            {!balance && (
              <>
                <span className="text-lg font-bold text-default-700">$****</span>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={handleDecryptBalance}
                  isLoading={isDecryptingBalance}
                >
                  {isDecryptingBalance ? '解密中...' : '解密余额'}
                </Button>
              </>
            )}
            
            {/* 解密后的余额显示和刷新按钮 */}
            {balance && (
              <>
                <div className="text-right">
                  <p className="text-sm font-semibold text-success-700">当前余额</p>
                  <p className="text-lg font-bold text-success-800 font-mono">
                    ${balance}
                  </p>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={handleRefreshBalance}
                  isLoading={isDecryptingBalance}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                  </svg>
                </Button>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};