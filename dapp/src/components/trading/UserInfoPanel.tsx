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

  // Balance reveal contract call
  const revealBalanceCall = useContractCall(contractActions.revealBalance, {
    title: 'Balance Reveal',
    onSuccess: () => {
      console.log('Balance revealed successfully');
      // After successful reveal, wait for a while before getting the latest reveal info
      setTimeout(() => {
        loadLatestBalanceReveal();
      }, 2000);
    },
    onError: (error) => {
      console.error('Balance reveal failed:', error);
    }
  });

  // Get latest balance reveal information
  const loadLatestBalanceReveal = async () => {
    if (!address) return;
    
    setIsLoadingReveal(true);
    try {
      const revealInfo = await contractActions.getLatestBalanceReveal(address);
      setLastRevealInfo(revealInfo);
    } catch (error) {
      console.error('Failed to get balance reveal information:', error);
    } finally {
      setIsLoadingReveal(false);
    }
  };

  // Decrypt user balance
  const handleDecryptBalance = async () => {
    if (!address || !contractActions.walletClient) return;
    
    setIsDecryptingBalance(true);
    try {
      // Get encrypted balance
      const encryptedBalance = await contractActions.getUserBalance(address);
      if (!encryptedBalance) {
        throw new Error('Unable to get encrypted balance');
      }
      
      // Decrypt balance
      const decryptedBalance = await contractActions.decryptBalance(encryptedBalance);
      setBalance(decryptedBalance);
      
      console.log('Balance decrypted successfully:', decryptedBalance);
    } catch (error: any) {
      console.error('Balance decryption failed:', error);
      // Handle specific errors
      if (error.message.includes('User cancelled signature')) {
        // User cancelled signature, don't show error
        return;
      }
      // Other errors can be handled here
    } finally {
      setIsDecryptingBalance(false);
    }
  };

  // Refresh balance
  const handleRefreshBalance = async () => {
    await handleDecryptBalance();
  };

  // Check registration status and get balance info on page load
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

  // After registration status is confirmed, get balance information
  useEffect(() => {
    if (isRegistered && address) {
      loadLatestBalanceReveal();
    }
  }, [isRegistered, address]);

  return (
    <div className="space-y-6">
      {/* User registration status */}
      <UserRegistration 
        onRegistrationComplete={onRegistrationComplete} 
        registrationRefreshTrigger={registrationRefreshTrigger} 
      />
      
      {/* Balance information - only show when registered */}
      {isConnected && isRegistered && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Account Balance</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  color="secondary"
                  onPress={revealBalanceCall.execute}
                  isLoading={revealBalanceCall.isLoading}
                >
                  {revealBalanceCall.isLoading ? 'Revealing...' : 'Balance Reveal'}
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={handleDecryptBalance}
                  isLoading={isDecryptingBalance}
                >
                  {isDecryptingBalance ? 'Decrypting...' : 'Decrypt Balance'}
                </Button>
              </div>
            </div>
            
            <Divider />
            
            {/* Current balance display */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-500">Current Balance:</span>
                <div className="flex items-center gap-2">
                  {balance ? (
                    <Chip color="success" variant="flat" size="sm">
                      {balance} USD
                    </Chip>
                  ) : (
                    <span className="text-sm text-default-400">Not decrypted</span>
                  )}
                  {isDecryptingBalance && <Spinner size="sm" />}
                </div>
              </div>

              {/* Latest balance reveal information */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-500">Latest Reveal:</span>
                <div className="flex items-center gap-2">
                  {isLoadingReveal ? (
                    <Spinner size="sm" />
                  ) : lastRevealInfo ? (
                    <div className="text-right">
                      <div className="text-sm font-semibold">{lastRevealInfo.amount} USD</div>
                      <div className="text-xs text-default-400">{lastRevealInfo.timestamp}</div>
                    </div>
                  ) : (
                    <span className="text-sm text-default-400">No reveal records</span>
                  )}
                </div>
              </div>
            </div>

            {/* Operation instructions */}
            <div className="p-3 bg-default-50 rounded-lg">
              <p className="text-xs text-default-500">
                💡 Tip: Balance reveal will publicly record your balance on the blockchain, while decrypt balance only views locally. Balance reveal has some delay
              </p>
            </div>

          </CardBody>
        </Card>
      )}
    </div>
  );
};