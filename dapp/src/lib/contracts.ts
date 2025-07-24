import { hexlify } from 'ethers';
import {
  useAccount,
  useWalletClient,
  useWriteContract,
  usePublicClient,
  useWaitForTransactionReceipt
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

  // 执行交易的通用方法
  const executeTransaction = useCallback(async (
    transactionFn: () => Promise<`0x${string}`>
  ) => {
    try {
      setTxState({ status: TransactionStatus.PREPARING });
      
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
      throw new Error('开仓前置条件不满足');
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

    const balanceHandle = String(encryptedBalance);
    const results = await fheService.decryptMultipleValuesWithWalletClient(
      [balanceHandle],
      CONTRACTS.TRADER.address,
      walletClient
    );

    const balance = results[balanceHandle];
    return balance?.toString() || 'N/A';
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
    register,
    openPosition,
    closePosition,
    revealBalance,
    decryptBalance,
    decryptPosition,
    formatBalanceReveal,
  };
};
