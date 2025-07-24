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

// 交易状态枚举
export enum TransactionStatus {
  IDLE = 'idle',
  PREPARING = 'preparing',
  PENDING = 'pending',
  CONFIRMING = 'confirming',
  SUCCESS = 'success',
  FAILED = 'failed',
}

// 交易状态接口
export interface TransactionState {
  status: TransactionStatus;
  hash?: `0x${string}`;
  error?: string;
  receipt?: any;
}

// 优雅的交易管理 hook
export const useTransactionManager = () => {
  const [txState, setTxState] = useState<TransactionState>({
    status: TransactionStatus.IDLE,
  });

  // 监听交易状态
  const { data: receipt, isError, error } = useWaitForTransactionReceipt({
    hash: txState.hash,
  });

  // 更新交易状态
  useEffect(() => {
    if (txState.hash && !txState.receipt) {
      setTxState(prev => ({ ...prev, status: TransactionStatus.CONFIRMING }));
    }
    
    if (receipt) {
      setTxState(prev => ({
        ...prev,
        status: receipt.status === 'success' ? TransactionStatus.SUCCESS : TransactionStatus.FAILED,
        receipt,
        error: receipt.status === 'reverted' ? '交易被回滚' : undefined,
      }));
    } else if (isError && error) {
      setTxState(prev => ({
        ...prev,
        status: TransactionStatus.FAILED,
        error: error.message || '交易确认失败',
      }));
    }
  }, [receipt, isError, error, txState.hash]);

  // 立即设置准备状态的方法
  const setPreparingState = useCallback(() => {
    setTxState({
      status: TransactionStatus.PREPARING,
    });
  }, []);

  // 执行交易的通用方法
  const executeTransaction = useCallback(async (
    transactionFn: () => Promise<`0x${string}`>
  ) => {
    try {
      // 如果还没有设置为 PREPARING 状态，则设置
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
      const errorMessage = error.message || '交易发起失败';
      setTxState({
        status: TransactionStatus.FAILED,
        error: errorMessage,
      });
      setTimeout(() => setTxState({ status: TransactionStatus.IDLE }), 3000);
    }
  }, []);

  // 监听交易状态变化并触发回调
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

  // 检查用户是否已注册
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
      console.error('检查注册状态失败:', error);
      return false;
    }
  }, [address, publicClient]);

  // 获取用户加密余额
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
      console.error('获取加密余额失败:', error);
      return null;
    }
  }, [address, publicClient]);

  // 获取最新余额揭示
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
      console.error('获取余额揭示失败:', error);
      return null;
    }
  }, [address, publicClient]);

  // 获取用户持仓ID列表
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
      console.error('获取用户持仓ID失败:', error);
      return [];
    }
  }, [address, publicClient]);

  // 获取持仓详情
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
      console.error('获取持仓详情失败:', error);
      return null;
    }
  }, [publicClient]);

  // 查询PositionOpened事件来获取真实的开仓时间
  const getPositionOpenTime = useCallback(async (positionId: string, userAddress?: string): Promise<string> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient) return new Date().toLocaleString();

    try {
      console.log(`查询持仓 ${positionId} 的开仓时间，用户地址: ${targetAddress}`);
      
      // 获取当前区块号，限制查询范围
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;
      
      console.log(`查询区块范围: ${fromBlock} 到 ${currentBlock}`);
      
      // 使用合约事件查询
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

      console.log(`获取到 ${logs.length} 个PositionOpened事件:`, logs);

      // 在所有日志中查找匹配的持仓ID
      const matchingLog = logs.find(log => 
        log.args && String(log.args.positionId) === positionId
      );

      console.log(`匹配持仓 ${positionId} 的日志:`, matchingLog);

      if (matchingLog && matchingLog.args && matchingLog.args.timestamp) {
        // block.timestamp 是秒，需要转换为毫秒
        const timestamp = Number(matchingLog.args.timestamp) * 1000;
        const date = new Date(timestamp);
        console.log(`持仓 ${positionId} 的区块时间戳: ${matchingLog.args.timestamp}秒, 转换为: ${date}`);
        
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }

      console.log(`未找到持仓 ${positionId} 的开仓事件（可能在更早的区块中）`);
      // 如果没有找到事件，返回提示
      return '较早创建';
    } catch (error) {
      console.error('查询开仓事件失败:', error);
      
      // 如果是区块范围错误，尝试更小的范围
      if (error instanceof Error && error.message.includes('ranges over')) {
        console.log('尝试使用更小的区块范围查询单个持仓...');
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
          console.error('重试也失败:', retryError);
        }
      }
      
      return new Date().toLocaleString();
    }
  }, [address, publicClient]);

  // 批量获取多个持仓的开仓时间
  const getMultiplePositionOpenTimes = useCallback(async (positionIds: string[], userAddress?: string): Promise<Record<string, string>> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient || positionIds.length === 0) return {};

    try {
      console.log(`批量查询 ${positionIds.length} 个持仓的开仓时间，用户地址: ${targetAddress}`);
      console.log('持仓ID列表:', positionIds);
      
      const result: Record<string, string> = {};
      
      // 获取当前区块号，然后向前查询最近的10000个区块
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;
      
      console.log(`查询区块范围: ${fromBlock} 到 ${currentBlock}`);
      
      // 使用合约事件查询，限制区块范围避免RPC限制
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

      console.log(`获取到 ${logs.length} 个PositionOpened事件:`, logs);

      // 按时间倒序排序
      const sortedLogs = logs.sort((a, b) => {
        const timeA = a.args?.timestamp ? Number(a.args.timestamp) : 0;
        const timeB = b.args?.timestamp ? Number(b.args.timestamp) : 0;
        return timeB - timeA;
      });

      console.log('排序后的事件日志:', sortedLogs);

      // 根据持仓ID匹配时间戳
      positionIds.forEach(positionId => {
        const matchingLog = sortedLogs.find(log => 
          log.args && String(log.args.positionId) === positionId
        );
        
        console.log(`持仓 ${positionId} 匹配的日志:`, matchingLog);
        
        if (matchingLog && matchingLog.args && matchingLog.args.timestamp) {
          // block.timestamp 是秒，需要转换为毫秒
          const timestamp = Number(matchingLog.args.timestamp) * 1000;
          const date = new Date(timestamp);
          console.log(`持仓 ${positionId} 的区块时间戳: ${matchingLog.args.timestamp}秒, 转换为: ${date}`);
          
          result[positionId] = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        } else {
          console.log(`持仓 ${positionId} 未找到匹配的事件日志（可能在更早的区块中）`);
          // 如果在最近的区块中没有找到，尝试备用方案
          result[positionId] = '较早创建';
        }
      });

      console.log('最终结果:', result);
      return result;
    } catch (error) {
      console.error('批量查询开仓事件失败:', error);
      
      // 如果还是失败，使用更小的范围重试
      if (error instanceof Error && error.message.includes('ranges over')) {
        console.log('尝试使用更小的区块范围重试...');
        return await getMultiplePositionOpenTimesWithSmallRange(positionIds, userAddress);
      }
      
      // 返回默认时间
      const result: Record<string, string> = {};
      positionIds.forEach(id => {
        result[id] = new Date().toLocaleString();
      });
      return result;
    }
  }, [address, publicClient]);

  // 备用方案：使用更小的区块范围
  const getMultiplePositionOpenTimesWithSmallRange = useCallback(async (positionIds: string[], userAddress?: string): Promise<Record<string, string>> => {
    const targetAddress = userAddress || address;
    if (!targetAddress || !publicClient || positionIds.length === 0) return {};

    try {
      console.log('使用备用方案查询最近1000个区块');
      
      const result: Record<string, string> = {};
      
      // 只查询最近的1000个区块
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;
      
      console.log(`备用查询区块范围: ${fromBlock} 到 ${currentBlock}`);
      
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

      console.log(`备用方案获取到 ${logs.length} 个PositionOpened事件`);

      // 根据持仓ID匹配时间戳
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
          result[positionId] = '较早创建';
        }
      });

      return result;
    } catch (error) {
      console.error('备用方案也失败:', error);
      
      // 最终失败，返回默认时间
      const result: Record<string, string> = {};
      positionIds.forEach(id => {
        result[id] = new Date().toLocaleString();
      });
      return result;
    }
  }, [address, publicClient]);

  // 基础合约调用方法
  const register = useCallback(async (): Promise<`0x${string}`> => {
    if (!address) throw new Error('钱包未连接');
    
    return await writeContractAsync({
      address: CONTRACTS.TRADER.address,
      abi: CONTRACTS.TRADER.abi,
      functionName: 'register',
      args: [],
    });
  }, [address, writeContractAsync]);

  const openPosition = useCallback(async (isLong: boolean, usdAmount: string): Promise<`0x${string}`> => {
    if (!address || !usdAmount || !fheService.isReady()) {
      throw new Error('开仓前置条件不满足,请等待FHE加载完毕');
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
      throw new Error('平仓前置条件不满足');
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
    if (!address) throw new Error('钱包未连接');
    
    return await writeContractAsync({
      address: CONTRACTS.TRADER.address,
      abi: CONTRACTS.TRADER.abi,
      functionName: 'revealMyBalance',
      args: [],
    });
  }, [address, writeContractAsync]);

  const decryptBalance = async (encryptedBalance: any): Promise<string> => {
    if (!encryptedBalance || !address || !walletClient) throw new Error('解密余额前置条件不满足');

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
      console.error('解密余额失败:', error);
      if (error.message.includes('user rejected')) {
        throw new Error('用户取消了签名');
      }
      throw new Error(`解密失败: ${error.message}`);
    }
  };

  const decryptPosition = async (
    positionInfo: any
  ): Promise<DecryptedPositionInfo> => {
    if (!positionInfo || !address || !walletClient) throw new Error('解密持仓前置条件不满足');

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
          ? '用户取消了签名'
          : `解密失败: ${error.message}`,
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
    decryptBalance,
    decryptPosition,
    formatBalanceReveal,
  };
};
