import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody,
  Button,
  Divider,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@heroui/react';
import { Progress } from '@heroui/progress';
import { useAccount } from 'wagmi';
import { useTradingContractActions } from '@/lib/contracts';
import { useContractCall } from '@/lib/contract-hook';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface RegistrationStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export const UserRegistration: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationProgress, setRegistrationProgress] = useState(0);

  const contractActions = useTradingContractActions();

  // 注册步骤
  const [steps, setSteps] = useState<RegistrationStep[]>([
    {
      id: 'connect',
      title: '连接钱包',
      description: '连接您的 Web3 钱包',
      completed: false,
      current: true,
    },
    {
      id: 'register',
      title: '注册账号',
      description: '在合约中注册用户账号',
      completed: false,
      current: false,
    },
    {
      id: 'complete',
      title: '完成设置',
      description: '账号设置完成，开始交易',
      completed: false,
      current: false,
    },
  ]);

  // 用户注册合约调用
  const registerCall = useContractCall(contractActions.register, {
    title: '用户注册',
    onSuccess: () => {
      setIsRegistered(true);
      updateStepStatus('register', true);
      updateStepStatus('complete', true);
      setRegistrationProgress(100);
    },
    onError: (error) => {
      console.error('注册失败:', error);
    }
  });

  // 更新步骤状态
  const updateStepStatus = (stepId: string, completed: boolean) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, completed, current: !completed }
        : step.id === getNextStepId(stepId) && completed 
          ? { ...step, current: true }
          : { ...step, current: false }
    ));
  };

  const getNextStepId = (currentStepId: string) => {
    const stepIds = ['connect', 'register', 'complete'];
    const currentIndex = stepIds.indexOf(currentStepId);
    return stepIds[currentIndex + 1];
  };

  // 检查钱包连接状态
  useEffect(() => {
    if (isConnected && address) {
      updateStepStatus('connect', true);
      setRegistrationProgress(33);
      
      // 模拟检查用户是否已注册
      // 这里应该调用合约方法检查用户注册状态
      const checkRegistration = async () => {
        // const registered = await contractActions.isUserRegistered(address);
        // setIsRegistered(registered);
        
        // 模拟检查结果
        const mockRegistered = Math.random() > 0.7; // 30% 概率已注册
        setIsRegistered(mockRegistered);
        
        if (mockRegistered) {
          updateStepStatus('register', true);
          updateStepStatus('complete', true);
          setRegistrationProgress(100);
        }
      };
      
      checkRegistration();
    } else {
      setSteps(prev => prev.map((step, index) => ({
        ...step,
        completed: false,
        current: index === 0
      })));
      setRegistrationProgress(0);
      setIsRegistered(false);
    }
  }, [isConnected, address]);

  const getStepIcon = (step: RegistrationStep) => {
    if (step.completed) {
      return '✅';
    } else if (step.current) {
      return '🔄';
    } else {
      return '⭕';
    }
  };

  const getRegistrationStatus = () => {
    if (!isConnected) {
      return { color: 'danger' as const, text: '请连接钱包' };
    } else if (isRegistered) {
      return { color: 'success' as const, text: '已注册' };
    } else {
      return { color: 'warning' as const, text: '待注册' };
    }
  };

  const status = getRegistrationStatus();

  return (
    <>
      <Card>
        <CardHeader className="flex gap-3">
          <div className="flex flex-col">
            <p className="text-md font-semibold">账户状态</p>
            <div className="flex items-center gap-2">
              <p className="text-small text-default-500">注册进度</p>
              <Chip 
                color={status.color} 
                variant="flat" 
                size="sm"
              >
                {status.text}
              </Chip>
            </div>
          </div>
        </CardHeader>
        <Divider/>
        <CardBody className="space-y-4">
          {/* 进度条 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-default-500">完成度</span>
              <span className="font-semibold">{registrationProgress}%</span>
            </div>
            <Progress 
              value={registrationProgress} 
              color={registrationProgress === 100 ? "success" : "primary"}
              size="sm"
            />
          </div>

          {/* 当前状态 */}
          {!isConnected ? (
            <div className="p-6 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-lg border border-primary-200">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1h-9a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h9zm-9-2h10V8H12v8z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-primary-800 mb-2">连接钱包开始</h4>
                  <p className="text-sm text-primary-600 mb-4">
                    连接您的 Web3 钱包以开始使用交易功能
                  </p>
                  <div className="flex justify-center">
                    <ConnectButton />
                  </div>
                </div>
              </div>
            </div>
          ) : !isRegistered ? (
            <div className="space-y-3">
              <div className="p-4 bg-warning-50 rounded-lg border border-warning-200">
                <div className="text-center">
                  <h4 className="font-semibold text-warning-800 mb-2">需要注册</h4>
                  <p className="text-sm text-warning-600 mb-3">
                    您需要在合约中注册账号才能开始交易
                  </p>
                  <Button
                    color="warning"
                    onPress={registerCall.execute}
                    isLoading={registerCall.isLoading}
                    size="sm"
                  >
                    {registerCall.isLoading ? '注册中...' : '立即注册'}
                  </Button>
                </div>
              </div>
              
              <Button
                variant="flat"
                color="primary"
                size="sm"
                onPress={onOpen}
                className="w-full"
              >
                查看注册流程
              </Button>
            </div>
          ) : (
            <div className="p-4 bg-success-50 rounded-lg border border-success-200">
              <div className="text-center">
                <h4 className="font-semibold text-success-800 mb-2">✅ 注册完成</h4>
                <p className="text-sm text-success-600">
                  您的账号已成功注册，可以开始交易了！
                </p>
              </div>
            </div>
          )}

          {/* 地址信息 */}
          {address && (
            <div className="text-xs text-default-400 text-center font-mono">
              {address.slice(0, 8)}...{address.slice(-6)}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 注册流程模态框 */}
      <Modal 
        isOpen={isOpen} 
        onClose={onClose}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">注册流程</h3>
            <p className="text-sm text-default-500">完成以下步骤开始交易</p>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      step.completed 
                        ? 'bg-success-100 text-success-700' 
                        : step.current 
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-default-100 text-default-500'
                    }`}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold ${
                      step.completed 
                        ? 'text-success-700' 
                        : step.current 
                          ? 'text-primary-700'
                          : 'text-default-500'
                    }`}>
                      {step.title}
                    </h4>
                    <p className="text-sm text-default-500">
                      {step.description}
                    </p>
                    {step.id === 'register' && step.current && !isRegistered && (
                      <div className="mt-2">
                        <Button
                          color="primary"
                          size="sm"
                          onPress={() => {
                            registerCall.execute();
                            onClose();
                          }}
                          isLoading={registerCall.isLoading}
                        >
                          执行注册
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" variant="light" onPress={onClose}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};