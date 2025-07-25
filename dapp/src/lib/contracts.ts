import { hexlify } from 'ethers';
import {
  useAccount,
  useWalletClient,
  useWriteContract,
  usePublicClient,
  useWaitForTransactionReceipt,
  useReadContract
} from 'wagmi';
import { CONTRACTS } from './base-contracts';
import { fheService } from './fhe-service';
import type { WalletClient } from 'viem';
import { useState, useCallback, useEffect } from 'react';

const uint8ArrayToHex = (array: Uint8Array): `0x${string}` => {
  return `0x${Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
};

export interface DecryptedPositionInfo {
  owner: string;
  contractCount: string;
  btcSize: string;
  entryPrice: string;
  isLong: boolean;
  error?: string;
}

export interface BalanceRevealInfo {
  amount: string;
  timestamp: string;
}

// Transaction status enum
export enum TransactionStatus {
  IDLE = 'idle',
  PREPARING = 'preparing',
  PENDING = 'pending',
  CONFIRMING = 'confirming',
  SUCCESS = 'success',
  FAILED = 'failed',
}

// Transaction state interface
export interface TransactionState {
  status: TransactionStatus;
  hash?: `0x${string}`;
  error?: string;
  receipt?: any;
}

// Elegant transaction management hook
export const useTransactionManager = () => {
  const [txState, setTxState] = useState<TransactionState>({
    status: TransactionStatus.IDLE,
  });

  // Listen to transaction status
  const { data: receipt, isError, error } = useWaitForTransactionReceipt({
    hash: txState.hash,
  });

  // Update transaction status
  useEffect(() => {
    if (txState.hash && !txState.receipt) {
      setTxState(prev => ({ ...prev, status: TransactionStatus.CONFIRMING }));
    }
    
    if (receipt) {
      setTxState(prev => ({
        ...prev,
        status: receipt.status === 'success' ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
        receipt,
        error: receipt.status === 'reverted' ? 'Transaction reverted' : undefined,
      }));
    } else if (isError && error) {
      setTxState(prev => ({
        ...prev,
        status: TransactionStatus.FAILED,
        error: error.message || 'Transaction confirmation failed',
      }));
    }
  }, [receipt, isError, error, txState.hash]);

  // Method to immediately set preparing state
  const setPreparingState = useCallback(() => {
    setTxState({
      status: TransactionStatus.PREPARING,
    });
  }, []);

  // Generic method to execute transactions
  const executeTransaction = useCallback(async (
    transactionFn: () => Promise<`0x${string}`>
  ) => {
    try {
      // If not yet set to PREPARING state, set it
      setTxState(prev => 
        prev.status === TransactionStatus.IDLE 
          ? { status: TransactionStatus.PREPARING }
          : prev
      );
      
      const hash = await transactionFn();
      
      setTxState({
        status: TransactionStatus.PENDING,
        hash,
      });

    } catch (error: any) {
      const errorMessage = error.message || 'Transaction initiation failed';
      setTxState({
        status: TransactionStatus.FAILED,
        error: errorMessage,
      });
      setTimeout(() => setTxState({ status: TransactionStatus.IDLE }), 3000);
    }
  }, []);

  // Listen to transaction status changes and trigger callbacks
  useEffect(() => {
    if (txState.status === TransactionStatus.SUCCESS && txState.receipt) {
      setTimeout(() => setTxState({ status: TransactionStatus.IDLE }), 2000);
    } else if (txState.status === TransactionStatus.FAILED) {
      setTimeout(() => setTxState({ status: TransactionStatus.IDLE }), 3000);
    }
  }, [txState.status]);

  const reset = useCallback(() => {
    setTxState({ status: TransactionStatus.IDLE });
  }, []);

  return {
    ...txState,
    executeTransaction,
    setPreparingState,
    reset,
    isIdle: txState.status === TransactionStatus.IDLE,
    isPreparing: txState.status === TransactionStatus.PREPARING,
    isPending: txState.status === TransactionStatus.PENDING,
    isConfirming: txState.status === TransactionStatus.CONFIRMING,
    isSuccess: txState.status === TransactionStatus.SUCCESS,
    isFailed: txState.status === TransactionStatus.FAILED,
    isLoading: [TransactionStatus.PREPARING, TransactionStatus.PENDING, TransactionStatus.CONFIRMING].includes(txState.status),
  };
};

export const useTradingContractActions = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const { writeContractAsync } = useWriteContract();

  // Check if user is registered
  const checkUserRegistration = useCallback(async (userAddress?: string): Promise<boolean> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient) return false;

    try {
      const isRegistered = await publicClient.readContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'isRegistered',
        args: [targetAddress as `0x${string}`],
      });
      return Boolean(isRegistered);
    } catch (error) {
      console.error('Failed to check registration status:', error);
      return false;
    }
  }, [address, publicClient]);

  // Get user encrypted balance
  const getUserBalance = useCallback(async (userAddress?: string): Promise<string | null> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient) return null;

    try {
      const encryptedBalance = await publicClient.readContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'getBalance',
        args: [targetAddress as `0x${string}`],
      });
      return String(encryptedBalance);
    } catch (error) {
      console.error('Failed to get encrypted balance:', error);
      return null;
    }
  }, [address, publicClient]);

  // Get latest balance reveal
  const getLatestBalanceReveal = useCallback(async (userAddress?: string): Promise<BalanceRevealInfo | null> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient) return null;

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'getLatestBalanceReveal',
        args: [targetAddress as `0x${string}`],
      });

      if (result && Array.isArray(result) && result.length >= 2) {
        const [amount, timestamp] = result;
        if (Number(amount) > 0) {
          return {
            amount: String(amount),
            timestamp: new Date(Number(timestamp) * 1000).toLocaleString(),
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get balance reveal:', error);
      return null;
    }
  }, [address, publicClient]);

  // Get user position ID list
  const getUserPositionIds = useCallback(async (userAddress?: string): Promise<string[]> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient) return [];

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'getUserPositionIds',
        args: [targetAddress as `0x${string}`],
      });

      if (Array.isArray(result)) {
        return result.map(id => String(id));
      }
      return [];
    } catch (error) {
      console.error('Failed to get user position IDs:', error);
      return [];
    }
  }, [address, publicClient]);

  // Get position details
  const getPosition = useCallback(async (positionId: string): Promise<any> => {
    if (!publicClient) return null;

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'getPosition',
        args: [BigInt(positionId)],
      });

      return result;
    } catch (error) {
      console.error('Failed to get position details:', error);
      return null;
    }
  }, [publicClient]);

  // Query PositionOpened events to get actual position opening time
  const getPositionOpenTime = useCallback(async (positionId: string, userAddress?: string): Promise<string> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient) return new Date().toLocaleString();

    try {
      console.log(`Querying opening time for position ${positionId}, user address: ${targetAddress}`);
      
      // Get current block number, limit query range
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;
      
      console.log(`Query block range: ${fromBlock} to ${currentBlock}`);
      
      // Use contract event query
      const logs = await publicClient.getContractEvents({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        eventName: 'PositionOpened',
        args: {
          user: targetAddress as `0x${string}`
        },
        fromBlock,
        toBlock: 'latest'
      });

      console.log(`Got ${logs.length} PositionOpened events:`, logs);

      // Find matching position ID in all logs
      const matchingLog = logs.find(log => 
        log.args && String(log.args.positionId) === positionId
      );

      console.log(`Matching log for position ${positionId}:`, matchingLog);

      if (matchingLog && matchingLog.args && matchingLog.args.timestamp) {
        // block.timestamp is in seconds, need to convert to milliseconds
        const timestamp = Number(matchingLog.args.timestamp) * 1000;
        const date = new Date(timestamp);
        console.log(`Block timestamp for position ${positionId}: ${matchingLog.args.timestamp}s, converted to: ${date}`);
        
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }

      console.log(`Position ${positionId} opening event not found (may be in earlier blocks)`);
      // If no event found, return indication
      return 'Created earlier';
    } catch (error) {
      console.error('Query opening event failed:', error);
      
      // If block range error, try smaller range
      if (error instanceof Error && error.message.includes('ranges over')) {
        console.log('Try using smaller block range to query single position...');
        try {
          const currentBlock = await publicClient.getBlockNumber();
          const fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;
          
          const logs = await publicClient.getContractEvents({
            address: CONTRACTS.TRADER.address,
            abi: CONTRACTS.TRADER.abi,
            eventName: 'PositionOpened',
            args: {
              user: targetAddress as `0x${string}`
            },
            fromBlock,
            toBlock: 'latest'
          });

          const matchingLog = logs.find(log => 
            log.args && String(log.args.positionId) === positionId
          );

          if (matchingLog && matchingLog.args && matchingLog.args.timestamp) {
            const timestamp = Number(matchingLog.args.timestamp) * 1000;
            const date = new Date(timestamp);
            
            return date.toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
          }
        } catch (retryError) {
          console.error('Retry also failed:', retryError);
        }
      }
      
      return new Date().toLocaleString();
    }
  }, [address, publicClient]);

  // Batch get opening times for multiple positions
  const getMultiplePositionOpenTimes = useCallback(async (positionIds: string[], userAddress?: string): Promise<Record<string, string>> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient || positionIds.length === 0) return {};

    try {
      console.log(`Batch querying opening times for ${positionIds.length} positions, user address: ${targetAddress}`);
      console.log('Position ID list:', positionIds);
      
      const result: Record<string, string> = {};
      
      // Get current block number, then query backwards for recent 10000 blocks
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;
      
      console.log(`Query block range: ${fromBlock} to ${currentBlock}`);
      
      // Use contract event query, limit block range to avoid RPC limits
      const logs = await publicClient.getContractEvents({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        eventName: 'PositionOpened',
        args: {
          user: targetAddress as `0x${string}`
        },
        fromBlock,
        toBlock: 'latest'
      });

      console.log(`Got ${logs.length} PositionOpened events:`, logs);

      // Sort by time in descending order
      const sortedLogs = logs.sort((a, b) => {
        const timeA = a.args?.timestamp ? Number(a.args.timestamp) : 0;
        const timeB = b.args?.timestamp ? Number(b.args.timestamp) : 0;
        return timeB - timeA;
      });

      console.log('Sorted event logs:', sortedLogs);

      // Match timestamps by position ID
      positionIds.forEach(positionId => {
        const matchingLog = sortedLogs.find(log => 
          log.args && String(log.args.positionId) === positionId
        );
        
        console.log(`Matching log for position ${positionId}:`, matchingLog);
        
        if (matchingLog && matchingLog.args && matchingLog.args.timestamp) {
          // block.timestamp is in seconds, need to convert to milliseconds
          const timestamp = Number(matchingLog.args.timestamp) * 1000;
          const date = new Date(timestamp);
          console.log(`Block timestamp for position ${positionId}: ${matchingLog.args.timestamp}s, converted to: ${date}`);
          
          result[positionId] = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        } else {
          console.log(`Position ${positionId} no matching event log found (may be in earlier blocks)`);
          // If not found in recent blocks, try fallback approach
          result[positionId] = 'Created earlier';
        }
      });

      console.log('Final result:', result);
      return result;
    } catch (error) {
      console.error('Batch query opening events failed:', error);
      
      // If still fails, retry with smaller range
      if (error instanceof Error && error.message.includes('ranges over')) {
        console.log('Try using smaller block range to retry...');
        return await getMultiplePositionOpenTimesWithSmallRange(positionIds, userAddress);
      }
      
      // Return default time
      const result: Record<string, string> = {};
      positionIds.forEach(id => {
        result[id] = new Date().toLocaleString();
      });
      return result;
    }
  }, [address, publicClient]);

  // Fallback approach: use smaller block range
  const getMultiplePositionOpenTimesWithSmallRange = useCallback(async (positionIds: string[], userAddress?: string): Promise<Record<string, string>> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient || positionIds.length === 0) return {};

    try {
      console.log('Using fallback approach to query recent 1000 blocks');
      
      const result: Record<string, string> = {};
      
      // Only query recent 1000 blocks
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;
      
      console.log(`Fallback query block range: ${fromBlock} to ${currentBlock}`);
      
      const logs = await publicClient.getContractEvents({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        eventName: 'PositionOpened',
        args: {
          user: targetAddress as `0x${string}`
        },
        fromBlock,
        toBlock: 'latest'
      });

      console.log(`Fallback approach got ${logs.length} PositionOpened events`);

      // Match timestamps by position ID
      positionIds.forEach(positionId => {
        const matchingLog = logs.find(log => 
          log.args && String(log.args.positionId) === positionId
        );
        
        if (matchingLog && matchingLog.args && matchingLog.args.timestamp) {
          const timestamp = Number(matchingLog.args.timestamp) * 1000;
          const date = new Date(timestamp);
          
          result[positionId] = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        } else {
          result[positionId] = 'Created earlier';
        }
      });

      return result;
    } catch (error) {
      console.error('Fallback approach also failed:', error);
      
      // Final failure, return default time
      const result: Record<string, string> = {};
      positionIds.forEach(id => {
        result[id] = new Date().toLocaleString();
      });
      return result;
    }
  }, [address, publicClient]);

  // Basic contract call methods
  const register = useCallback(async (): Promise<`0x${string}`> => {
    if (!address) throw new Error('Wallet not connected');
    
    return await writeContractAsync({
      address: CONTRACTS.TRADER.address,
      abi: CONTRACTS.TRADER.abi,
      functionName: 'register',
      args: [],
    });
  }, [address, writeContractAsync]);

  const openPosition = useCallback(async (isLong: boolean, usdAmount: string): Promise<`0x${string}`> => {
    if (!address || !usdAmount || !fheService.isReady()) {
      throw new Error('Open position requirements not met, please wait for FHE to finish loading');
    }

    const encryptedInput = fheService.createEncryptedInput(CONTRACTS.TRADER.address, address);
    encryptedInput.addBool(isLong);
    encryptedInput.add64(BigInt(parseInt(usdAmount)));

    const encryptedResult = await encryptedInput.encrypt();
    const isLongHandle = uint8ArrayToHex(encryptedResult.handles[0]);
    const usdAmountHandle = uint8ArrayToHex(encryptedResult.handles[1]);

    return await writeContractAsync({
      address: CONTRACTS.TRADER.address,
      abi: CONTRACTS.TRADER.abi,
      functionName: 'openPosition',
      args: [
        isLongHandle,
        usdAmountHandle,
        hexlify(encryptedResult.inputProof) as any,
      ],
    });
  }, [address, writeContractAsync]);

  const closePosition = useCallback(async (positionId: string, closeUsdAmount: string): Promise<`0x${string}`> => {
    if (!address || !positionId || !closeUsdAmount || !fheService.isReady()) {
      throw new Error('Close position requirements not met');
    }

    const encryptedInput = fheService.createEncryptedInput(CONTRACTS.TRADER.address, address);
    encryptedInput.add64(BigInt(parseInt(closeUsdAmount)));

    const encryptedResult = await encryptedInput.encrypt();
    const usdHandle = uint8ArrayToHex(encryptedResult.handles[0]);

    return await writeContractAsync({
      address: CONTRACTS.TRADER.address,
      abi: CONTRACTS.TRADER.abi,
      functionName: 'closePosition',
      args: [
        BigInt(positionId),
        usdHandle,
        hexlify(encryptedResult.inputProof) as any,
      ],
    });
  }, [address, writeContractAsync]);

  const revealBalance = useCallback(async (): Promise<`0x${string}`> => {
    if (!address) throw new Error('Wallet not connected');
    
    return await writeContractAsync({
      address: CONTRACTS.TRADER.address,
      abi: CONTRACTS.TRADER.abi,
      functionName: 'revealMyBalance',
      args: [],
    });
  }, [address, writeContractAsync]);

  // Get current BTC price (from Trader contract)
  const getCurrentBtcPrice = useCallback(async (): Promise<number | null> => {
    if (!publicClient) return null;

    try {
      const price = await publicClient.readContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'getCurrentBtcPrice',
        args: [],
      });
      return Number(price);
    } catch (error) {
      console.error('Failed to get BTC price:', error);
      return null;
    }
  }, [publicClient]);

  // Get BTC price from PriceOracle
  const getOracleBtcPrice = useCallback(async (): Promise<number | null> => {
    if (!publicClient) return null;

    try {
      const price = await publicClient.readContract({
        address: CONTRACTS.PRICE_ORACLE.address,
        abi: CONTRACTS.PRICE_ORACLE.abi,
        functionName: 'getLatestBtcPrice',
        args: [],
      });
      return Number(price);
    } catch (error) {
      console.error('Failed to get Oracle BTC price:', error);
      return null;
    }
  }, [publicClient]);

    // Get all leaderboard data (first get user addresses, then get balance data for each)
  const getAllBalanceReveals = useCallback(async (): Promise<Array<{
    user: string;
    amount: number;
    timestamp: number;
    profit: number;
    profitPercentage: number;
  }> | null> => {
    if (!publicClient) return null;

    try {
      console.log('Getting all decrypted user addresses...');
      
      // 1. First get all decrypted user addresses
      const revealedUsers = await publicClient.readContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'getRevealedUsers',
        args: [],
      });

      if (!revealedUsers || !Array.isArray(revealedUsers) || revealedUsers.length === 0) {
        console.log('No decrypted users found:', revealedUsers);
        return [];
      }

      console.log(`Found ${revealedUsers.length} decrypted users:`, revealedUsers);

      // 2. Get balance decryption data for each user in parallel
      const balancePromises = revealedUsers.map(async (userAddress: string) => {
        try {
          const balanceReveal = await publicClient.readContract({
            address: CONTRACTS.TRADER.address,
            abi: CONTRACTS.TRADER.abi,
            functionName: 'getLatestBalanceReveal',
            args: [userAddress as `0x${string}`],
          });

          if (balanceReveal && Array.isArray(balanceReveal) && balanceReveal.length >= 2) {
            const [amount, timestamp] = balanceReveal;
            const amountNum = Number(amount);
            const timestampNum = Number(timestamp);
            
            if (amountNum > 0) {
              const initialAmount = 100000; // Initial balance
              const profit = amountNum - initialAmount;
              const profitPercentage = ((profit / initialAmount) * 100);

              return {
                user: userAddress,
                amount: amountNum,
                timestamp: timestampNum,
                profit,
                profitPercentage
              };
            }
          }
          return null;
        } catch (error) {
          console.error(`Failed to get balance data for user ${userAddress}:`, error);
          return null;
        }
      });

      // 3. Wait for all balance data to be retrieved
      const balanceResults = await Promise.all(balancePromises);
      
      // 4. Filter out invalid data
      const validResults = balanceResults.filter(result => result !== null);
      
      // 5. Sort by profit from high to low
      const sortedResults = validResults.sort((a, b) => b.profit - a.profit);
      
      console.log('Processed leaderboard data:', sortedResults);
      return sortedResults;

    } catch (error: any) {
      console.error('Failed to get leaderboard data:', error);
      return null;
    }
  }, [publicClient]);

  const decryptBalance = async (encryptedBalance: any): Promise<string> => {
    if (!encryptedBalance || !address || !walletClient) throw new Error('Decrypt balance requirements not met');

    try {
      const balanceHandle = String(encryptedBalance);
      const results = await fheService.decryptMultipleValuesWithWalletClient(
        [balanceHandle],
        CONTRACTS.TRADER.address,
        walletClient
      );

      const balance = results[balanceHandle];
      return balance?.toString() || '0';
    } catch (error: any) {
      console.error('Failed to decrypt balance:', error);
      if (error.message.includes('user rejected')) {
        throw new Error('User cancelled signature');
      }
      throw new Error(`Decryption failed: ${error.message}`);
    }
  };

  const decryptPosition = async (
    positionInfo: any
  ): Promise<DecryptedPositionInfo> => {
    if (!positionInfo || !address || !walletClient) throw new Error('Decrypt position requirements not met');

    const contractCountHandle = String(positionInfo[1]);
    const btcSizeHandle = String(positionInfo[2]);
    const isLongHandle = String(positionInfo[4]);

    const handles = [contractCountHandle, btcSizeHandle, isLongHandle];

    try {
      const results = await fheService.decryptMultipleValuesWithWalletClient(
        handles,
        CONTRACTS.TRADER.address,
        walletClient
      );

      const contractCount = results[contractCountHandle];
      const btcSize = results[btcSizeHandle];
      const isLong = results[isLongHandle];

      return {
        owner: positionInfo[0],
        contractCount: contractCount?.toString() || 'N/A',
        btcSize: (Number(btcSize) / 1e8).toFixed(8),
        entryPrice: positionInfo[3]?.toString() || 'N/A',
        isLong: Boolean(isLong),
      };
    } catch (error: any) {
      return {
        owner: positionInfo[0],
        contractCount: 'N/A',
        btcSize: 'N/A',
        entryPrice: 'N/A',
        isLong: false,
        error: error.message.includes('user rejected')
          ? 'User cancelled signature'
          : `Decryption failed: ${error.message}`,
      };
    }
  };

  const formatBalanceReveal = (latestBalanceReveal: any): BalanceRevealInfo | null => {
    if (latestBalanceReveal && latestBalanceReveal[0] > 0) {
      return {
        amount: latestBalanceReveal[0].toString(),
        timestamp: new Date(Number(latestBalanceReveal[1]) * 1000).toLocaleString(),
      };
    }
    return null;
  };

  // Get number of decrypted users
  const getRevealedUsersCount = useCallback(async (): Promise<number> => {
    if (!publicClient) return 0;

    try {
      const count = await publicClient.readContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'getRevealedUsersCount',
        args: [],
      });
      return Number(count);
    } catch (error) {
      console.error('Failed to get revealed users count:', error);
      return 0;
    }
  }, [publicClient]);

  return {
    address,
    walletClient,
    checkUserRegistration,
    getUserBalance,
    getLatestBalanceReveal,
    getUserPositionIds,
    getPosition,
    getPositionOpenTime,
    getMultiplePositionOpenTimes,
    register,
    openPosition,
    closePosition,
    revealBalance,
    getCurrentBtcPrice,
    getOracleBtcPrice,
    getAllBalanceReveals,
    getRevealedUsersCount,
    decryptBalance,
    decryptPosition,
    formatBalanceReveal,
  };
};
