import React from 'react';
import {Chip, Button, Spinner, Card, CardHeader, CardBody, CardFooter, Divider, Image} from "@heroui/react";
import { useTradingContracts, TradingContractService } from '@/lib/contracts';
import { useAccount } from 'wagmi';

export const RegistrationStatus: React.FC = () => {
  const { address } = useAccount();
  const { useIsRegistered, useContractOperations } = useTradingContracts();
  
  // 获取注册状态
  const { data: isRegistered, isLoading: isCheckingRegistration, error: registrationError } = useIsRegistered();
  
  // 获取注册操作
  const { register, isRegistering } = useContractOperations();

  // 处理注册
  const handleRegister = async () => {
    if (!address) return;
    
    try {
      await TradingContractService.register(register);
    } catch (error) {
      console.error('Registration failed:', error);
    }
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
            <p className="text-md font-semibold">Wallet Status</p>
            <p className="text-small text-default-500">Not Connected</p>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="flex items-center gap-3">
            <Chip color="warning" variant="flat">Disconnected</Chip>
            <span className="text-sm text-default-600">Please connect your wallet first</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  // 正在检查注册状态
  if (isCheckingRegistration) {
    return (
      <Card className="max-w-[400px]">
        <CardHeader className="flex gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Spinner size="sm" color="primary" />
          </div>
          <div className="flex flex-col">
            <p className="text-md font-semibold">Account Status</p>
            <p className="text-small text-default-500">Checking...</p>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="flex items-center gap-3">
            <span className="text-sm text-default-600">Checking registration status, please wait...</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  // 检查注册状态出错
  if (registrationError) {
    return (
      <Card className="max-w-[400px]">
        <CardHeader className="flex gap-3">
          <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
            <span className="text-danger-600 text-lg">❌</span>
          </div>
          <div className="flex flex-col">
            <p className="text-md font-semibold">Connection Error</p>
            <p className="text-small text-default-500">Cannot fetch status</p>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="flex items-center gap-3">
            <Chip color="danger" variant="flat">Error</Chip>
            <span className="text-sm text-default-600">Unable to get registration status</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="max-w-[400px]">
      <CardHeader className="flex gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isRegistered ? 'bg-success-100' : 'bg-warning-100'
        }`}>
          <span className={`text-lg ${
            isRegistered ? 'text-success-600' : 'text-warning-600'
          }`}>
            {isRegistered ? '✅' : '🏆'}
          </span>
        </div>
        <div className="flex flex-col">
          <p className="text-md font-semibold">   {address.slice(0, 6)}...{address.slice(-4)}</p>
        </div>
        <div className="ml-auto">
          <Chip 
            color={isRegistered ? "success" : "warning"} 
            variant="flat"
            size="sm"
          >
            {isRegistered ? "Registered" : "Not Registered"}
          </Chip>
        </div>
      </CardHeader>
      
      <Divider />
      
      <CardBody>
        {!isRegistered ? (
          <div className="space-y-3">
            <p className="text-sm text-default-600">
              🏆 Welcome to the Trading Competition! Register now to start competing with virtual funds.
            </p>
            <div className="bg-warning-50 p-3 rounded-lg">
              <p className="text-xs text-warning-700">
                💰 No real USD required! All trades use virtual currency for safe competition.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-success-700 font-medium">
                Competition Ready
              </span>
            </div>
            <p className="text-sm text-default-600">
              🎉 Congratulations! You're registered and ready to compete with encrypted trading.
            </p>
            <div className="bg-success-50 p-3 rounded-lg">
              <p className="text-xs text-success-700">
                ✨ All your trading data is protected by homomorphic encryption for privacy.
              </p>
            </div>
          </div>
        )}
      </CardBody>

      {!isRegistered && (
        <>
          <Divider />
          <CardFooter>
            <Button
              color="primary"
              onPress={handleRegister}
              isLoading={isRegistering}
              size="md"
              className="w-full"
              variant="solid"
            >
              {isRegistering ? "Registering..." : "🚀 Join Competition"}
            </Button>
          </CardFooter>
        </>
      )}
      
      {isRegistered && (
        <>
          <Divider />
          <CardFooter className="justify-center">
            <p className="text-xs text-success-600 font-medium">
              Ready to Trade & Compete 🎯
            </p>
          </CardFooter>
        </>
      )}
    </Card>
  );
};

export default RegistrationStatus; 