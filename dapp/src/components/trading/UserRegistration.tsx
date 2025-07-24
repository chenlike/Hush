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

  // User registration contract call
  const registerCall = useContractCall(contractActions.register, {
    title: 'User Registration',
    onSuccess: () => {
      setIsRegistered(true);
      // Call parent component's callback function to notify registration completion
      onRegistrationComplete?.();
    },
    onError: (error) => {
      console.error('Registration failed:', error);
    }
  });

  // Check user registration status
  const checkRegistrationStatus = async () => {
    if (!address) return;
    
    setIsCheckingRegistration(true);
    try {
      const registered = await contractActions.checkUserRegistration(address);
      setIsRegistered(registered);
    } catch (error) {
      console.error('Failed to check registration status:', error);
    } finally {
      setIsCheckingRegistration(false);
    }
  };

  // Check wallet connection status
  useEffect(() => {
    if (isConnected && address) {
      checkRegistrationStatus();
    } else {
      setIsRegistered(false);
    }
  }, [isConnected, address]);

  // Listen to registrationRefreshTrigger, recheck registration status if triggered
  useEffect(() => {
    if (registrationRefreshTrigger && isConnected && address) {
      checkRegistrationStatus();
    }
  }, [registrationRefreshTrigger, isConnected, address]);

  // Format address display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getRegistrationStatus = () => {
    if (!isConnected) {
      return { color: 'danger' as const, text: 'Connect Wallet' };
    } else if (isCheckingRegistration) {
      return { color: 'warning' as const, text: 'Checking...' };
    } else if (isRegistered) {
      return { color: 'success' as const, text: 'Registered' };
    } else {
      return { color: 'warning' as const, text: 'Not Registered' };
    }
  };

  const status = getRegistrationStatus();

  return (
    <Card className="w-full">
      <CardBody className="p-4">
        <div className="flex items-center justify-between">
          {/* Left side address and status */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-default-600">
              {address ? formatAddress(address) : 'Wallet not connected'}
            </span>
            <Chip 
              color={status.color} 
              variant="flat" 
              size="sm"
            >
              {status.text}
            </Chip>
          </div>

          {/* Right side action buttons */}
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
                {registerCall.isLoading ? 'Registering...' : 'Register Now'}
              </Button>
            ) : (
              <span className="text-sm text-success-600">✅ Ready</span>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};