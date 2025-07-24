import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody,
  Button,
  Chip
} from '@heroui/react';
import { useAccount } from 'wagmi';
import { useTradingContractActions } from '@/lib/contracts';
import { useContractCall } from '@/lib/contract-hook';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface UserRegistrationProps {
  onRegistrationComplete?: () => void;
  registrationRefreshTrigger?: number;
}

export const UserRegistration: React.FC<UserRegistrationProps> = ({ 
  onRegistrationComplete, 
  registrationRefreshTrigger 
}) => {
  const { address, isConnected } = useAccount();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);

  const contractActions = useTradingContractActions();

  // 用户注册合约调用
  const registerCall = useContractCall(contractActions.register, {
    title: '用户注册',
    onSuccess: () => {
      setIsRegistered(true);
      // 调用父组件的回调函数通知注册完成
      onRegistrationComplete?.();
    },
    onError: (error) => {
      console.error('注册失败:', error);
    }
  });

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

  // 检查钱包连接状态
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

  // 格式化地址显示
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getRegistrationStatus = () => {
    if (!isConnected) {
      return { color: 'danger' as const, text: '请连接钱包' };
    } else if (isCheckingRegistration) {
      return { color: 'warning' as const, text: '检查中...' };
    } else if (isRegistered) {
      return { color: 'success' as const, text: '已注册' };
    } else {
      return { color: 'warning' as const, text: '待注册' };
    }
  };

  const status = getRegistrationStatus();

  return (
    <Card className="w-full">
      <CardBody className="p-4">
        <div className="flex items-center justify-between">
          {/* 左侧地址和状态 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-default-600">
              {address ? formatAddress(address) : '未连接钱包'}
            </span>
            <Chip 
              color={status.color} 
              variant="flat" 
              size="sm"
            >
              {status.text}
            </Chip>
          </div>

          {/* 右侧操作按钮 */}
          <div className="flex items-center gap-2">
            {!isConnected ? (
              <ConnectButton />
            ) : !isRegistered ? (
              <Button
                color="warning"
                size="sm"
                onPress={registerCall.execute}
                isLoading={registerCall.isLoading}
              >
                {registerCall.isLoading ? '注册中...' : '立即注册'}
              </Button>
            ) : (
              <span className="text-sm text-success-600">✅ 可以交易</span>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};