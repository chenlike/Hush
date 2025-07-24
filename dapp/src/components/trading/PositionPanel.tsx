import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Divider,
  Spinner
} from '@heroui/react';
import { useTradingContractActions, DecryptedPositionInfo } from '@/lib/contracts';
import { useContractCall } from '@/lib/contract-hook';
import { useAccount } from 'wagmi';

interface PositionData extends DecryptedPositionInfo {
  id: string;
  isDecrypted: boolean;
  entryTime: string;
}

interface PositionPanelProps {
  refreshTrigger?: number;
  registrationRefreshTrigger?: number;
}

export const PositionPanel: React.FC<PositionPanelProps> = ({ refreshTrigger, registrationRefreshTrigger }) => {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [positionToClose, setPositionToClose] = useState<{id: string, contractCount: string} | null>(null);

  const contractActions = useTradingContractActions();

  // Check user registration status
  const checkRegistrationStatus = async () => {
    if (!address) return;
    
    try {
      const registered = await contractActions.checkUserRegistration(address);
      setIsRegistered(registered);
    } catch (error) {
      console.error('Failed to check registration status:', error);
    }
  };

  // Load user positions
  const loadUserPositions = async () => {
    if (!address || !isRegistered) return;
    
    setIsLoadingPositions(true);
    try {
      // Get user position ID list
      const positionIds = await contractActions.getUserPositionIds(address);
      
      if (positionIds.length === 0) {
        setPositions([]);
        return;
      }


      // Get details for each position
      const positionPromises = positionIds.map(async (id) => {
        const positionInfo = await contractActions.getPosition(id);
        console.log('???!',positionInfo)
        if (positionInfo) {
          // Directly use the timestamp returned by the contract, convert to local time string
          const openTimestamp = positionInfo[5]; // openTimestamp is the 6th return value
          const entryTime = new Date(Number(openTimestamp) * 1000).toLocaleString('en-US');
          
          return {
            id,
            owner: positionInfo[0],
            contractCount: 'N/A', // Needs decryption
            btcSize: 'N/A', // Needs decryption
            entryPrice: String(positionInfo[3]), // Entry price is in plain text
            isLong: false, // Needs decryption
            isDecrypted: false,
            entryTime, // Use timestamp returned by contract
          };
        }
        return null;
      });

      const loadedPositions = await Promise.all(positionPromises);
      const validPositions = loadedPositions.filter(p => p !== null) as PositionData[];
      // Sort by time in descending order
      validPositions.sort((a, b) => {
        const dateA = new Date(a.entryTime);
        const dateB = new Date(b.entryTime);
        return dateB.getTime() - dateA.getTime();
      });
      setPositions(validPositions);
    } catch (error) {
      console.error('Failed to load positions:', error);
    } finally {
      setIsLoadingPositions(false);
    }
  };

  // Decrypt position information
  const decryptPosition = async (positionId: string) => {
    setIsDecrypting(true);
    setSelectedPosition(positionId);
    
    try {
      // Get encrypted data for the position
      const positionInfo = await contractActions.getPosition(positionId);
      if (!positionInfo) {
        throw new Error('Unable to get position information');
      }

      // Decrypt position information
      const decryptedInfo = await contractActions.decryptPosition(positionInfo);
      
      // Update position state
      setPositions(prev => prev.map(pos => 
        pos.id === positionId 
          ? { 
              ...pos, 
              ...decryptedInfo,
              isDecrypted: true,
              error: decryptedInfo.error 
            }
          : pos
      ));
      
    } catch (error: any) {
      console.error('Decryption failed:', error);
      
      // Update error state
      setPositions(prev => prev.map(pos => 
        pos.id === positionId 
          ? { 
              ...pos, 
              error: error.message || 'Decryption failed',
              isDecrypted: false
            }
          : pos
      ));
    } finally {
      setIsDecrypting(false);
      setSelectedPosition('');
    }
  };

  // Close position operation
  const closePositionCall = useContractCall(
    () => positionToClose ? contractActions.closePosition(positionToClose.id, positionToClose.contractCount) : Promise.reject('No position selected'),
    {
      title: 'Execute Close Position',
      onSuccess: (receipt) => {
        // Refresh position list
        setTimeout(() => {
          loadUserPositions();
        }, 2000);
        setPositionToClose(null);
      },
      onError: (error) => {
        console.error('Failed to close position:', error);
        setPositionToClose(null);
      }
    }
  );

  // Check registration status and load positions
  useEffect(() => {
    if (isConnected && address) {
      checkRegistrationStatus();
    } else {
      setIsRegistered(false);
      setPositions([]);
    }
  }, [isConnected, address]);

  // After registration status is confirmed, load positions
  useEffect(() => {
    if (isRegistered && address) {
      loadUserPositions();
    } else {
      setPositions([]);
    }
  }, [isRegistered, address]);

  // Listen to refreshTrigger, refresh positions if triggered
  useEffect(() => {
    if (refreshTrigger) {
      loadUserPositions();
    }
  }, [refreshTrigger]);

  // Listen to registrationRefreshTrigger, recheck registration status if triggered
  useEffect(() => {
    if (registrationRefreshTrigger) {
      checkRegistrationStatus();
    }
  }, [registrationRefreshTrigger]);

  const getPositionTypeColor = (isLong: boolean) => {
    return isLong ? 'success' : 'danger';
  };

  const getPositionTypeText = (isLong: boolean) => {
    return isLong ? 'Long' : 'Short';
  };

  // Format time display
  const formatTime = (timeString: string) => {
    try {
      
      const date = new Date(timeString);
      
      // Check if it's a valid date
      if (isNaN(date.getTime())) {
        return timeString; // If not a valid date, return original string
      }
      
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      
      
      // If time difference is negative (future time), show specific time
      if (diffInMinutes < 0) {
        return date.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // If it's today's data, show relative time
      if (diffInMinutes < 1) {
        return 'Just now';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes} minutes ago`;
      } else if (diffInMinutes < 24 * 60) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} hours ago`;
      } else {
        // Show specific date and time for more than a day
        return date.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('Time formatting error:', error);
      return timeString;
    }
  };

  // If user hasn't connected wallet, show wallet connection guide
  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader className="flex gap-3">
          <div className="flex flex-col">
            <p className="text-md font-semibold">Position Management</p>
            <p className="text-small text-default-500">View and manage current positions</p>
          </div>
        </CardHeader>
        <Divider/>
        <CardBody className="py-8">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-16 h-16 bg-warning-100 text-warning-600 rounded-full flex items-center justify-center text-2xl">
              🔗
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-default-700">Please connect your wallet first</h3>
              <p className="text-default-500 max-w-sm">
                You need to connect your wallet to view and manage positions. Please click the connect wallet button in the top right corner.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // If user is not registered, show registration guide
  if (!isRegistered) {
    return (
      <Card className="w-full">
        <CardHeader className="flex gap-3">
          <div className="flex flex-col">
            <p className="text-md font-semibold">Position Management</p>
            <p className="text-small text-default-500">View and manage current positions</p>
          </div>
        </CardHeader>
        <Divider/>
        <CardBody className="py-8">
          <div className="flex flex-col items-center justify-center space-y-6 text-center">
            <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-2xl">
              📋
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-default-700">Registration required first</h3>
              <p className="text-default-500 max-w-md">
                You need to register first to start trading and view positions. After registration, you will receive initial virtual assets for trading.
              </p>
            </div>
            
            {/* Feature description */}
            <div className="w-full max-w-md space-y-4 pt-4">
              <h4 className="text-sm font-semibold text-default-600 text-left">After registration, you can:</h4>
              <div className="space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-success-100 text-success-600 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-default-600">Open and close BTC trading positions</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-success-100 text-success-600 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-default-600">View and manage all position information</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-success-100 text-success-600 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-default-600">Use FHE technology to protect trading privacy</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-success-100 text-success-600 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-default-600">Get initial virtual assets to start trading competition!</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Registration tip */}
            <div className="w-full max-w-md bg-primary-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  💡
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-primary-700 mb-1">How to register?</h4>
                  <p className="text-xs text-primary-600">
                    Please go to the user information panel above and click the "Register Now" button to complete registration on the blockchain.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="flex flex-col">
          <p className="text-md font-semibold">Position Management</p>
          <p className="text-small text-default-500">View and manage current positions</p>
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="flat"
            color="primary"
            onPress={loadUserPositions}
            isLoading={isLoadingPositions}
          >
            {isLoadingPositions ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <Divider/>
      <CardBody>
        {isLoadingPositions ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Spinner size="lg" />
            <p className="text-sm text-default-500 mt-4">Loading position data...</p>
          </div>
        ) : positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-default-400">
            <p className="text-lg mb-2">No positions</p>
            <p className="text-sm">Positions will be displayed here after you start trading</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table 
              aria-label="Position list"
              classNames={{
                wrapper: "min-h-[200px]",
              }}
            >
              <TableHeader>
                <TableColumn>Position ID</TableColumn>
                <TableColumn>Direction</TableColumn>
                <TableColumn>BTC Amount</TableColumn>
                <TableColumn>Entry Price</TableColumn>
                <TableColumn>Entry Time</TableColumn>
                <TableColumn>Contract Amount</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody>
                {positions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>#{position.id}</TableCell>
                    <TableCell>
                      {position.isDecrypted ? (
                        <Chip 
                          color={getPositionTypeColor(position.isLong)} 
                          variant="flat"
                          size="sm"
                        >
                          {getPositionTypeText(position.isLong)}
                        </Chip>
                      ) : (
                        <Chip 
                          color="default" 
                          variant="flat"
                          size="sm"
                        >
                          ***
                        </Chip>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {position.isDecrypted ? (
                        `${position.btcSize} BTC`
                      ) : (
                        '***'
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      ${position.entryPrice}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTime(position.entryTime)}
                    </TableCell>
                    <TableCell>
                      {position.isDecrypted ? (
                        position.contractCount
                      ) : (
                        '***'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!position.isDecrypted ? (
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            onPress={() => decryptPosition(position.id)}
                            isLoading={isDecrypting && selectedPosition === position.id}
                            isDisabled={isDecrypting || !!position.error}
                          >
                            {isDecrypting && selectedPosition === position.id ? (
                              'Decrypting...'
                            ) : position.error ? (
                              'Decrypt Failed'
                            ) : (
                              'Decrypt'
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="flat"
                            color="warning"
                            onPress={() => {
                              setSelectedPosition(position.id);
                              // Use decrypted contract amount, or default value if not available
                              const contractCountToUse = position.contractCount || '1000';
                              setPositionToClose({ 
                                id: position.id, 
                                contractCount: contractCountToUse 
                              });
                              closePositionCall.execute();
                            }}
                            isLoading={closePositionCall.isLoading && positionToClose?.id === position.id}
                          >
                            Close
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Decryption information */}
            <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  ℹ
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-primary-700 mb-1">Privacy Protection Information</h4>
                  <p className="text-xs text-primary-600">
                    Position information is protected by FHE (Fully Homomorphic Encryption) technology. Before decryption, you can only see the entry price and time.
                    Click the "Decrypt" button to view complete position information, including direction and amount.
                  </p>
                </div>
              </div>
            </div>

            {/* Error display */}
            {positions.some(p => p.error) && (
              <>
                <Divider />
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-danger-600">Decryption Errors</h4>
                  {positions
                    .filter(p => p.error)
                    .map(position => (
                      <div key={position.id} className="text-sm text-danger-500">
                        Position #{position.id}: {position.error}
                      </div>
                    ))
                  }
                </div>
              </>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};