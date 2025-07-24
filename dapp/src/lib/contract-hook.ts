import React, { useCallback } from 'react';
import { useTransactionManager, TransactionStatus } from './contracts';
import { useTransactionToast } from './transaction-toast';

export interface ContractCallOptions {
  title?: string;
  showToast?: boolean;
  onSuccess?: (receipt: any) => void;
  onError?: (error: string) => void;
  onPreparing?: () => void;
  onPending?: (hash: string) => void;
  onConfirming?: () => void;
}

export interface ContractCallResult {
  execute: () => Promise<void>;
  status: TransactionStatus;
  hash?: string;
  error?: string;
  receipt?: any;
  isLoading: boolean;
  reset: () => void;
}

/**
 * 通用的合约调用 hook，自动处理 toast 通知和状态管理
 * @param contractFunction 合约调用函数，需要返回 Promise<`0x${string}`>
 * @param options 配置选项，包括标题、回调等
 * @returns 包含执行函数和状态的对象
 */
export const useContractCall = (
  contractFunction: () => Promise<`0x${string}`>,
  options: ContractCallOptions = {}
): ContractCallResult => {
  const {
    title = '合约交易',
    showToast = true,
    onSuccess,
    onError,
    onPreparing,
    onPending,
    onConfirming,
  } = options;

  const txManager = useTransactionManager();
  
  // 只在启用 toast 时使用 toast hook
  if (showToast) {
    useTransactionToast(txManager, title);
  }

  const execute = useCallback(async () => {
    await txManager.executeTransaction(async () => {
      // 准备阶段回调
      onPreparing?.();
      
      try {
        const hash = await contractFunction();
        
        // 交易发起成功回调
        onPending?.(hash);
        
        return hash;
      } catch (error: any) {
        // 错误处理
        const errorMessage = error.message || '合约调用失败';
        onError?.(errorMessage);
        throw error;
      }
    });
  }, [contractFunction, txManager, onPreparing, onPending, onError]);

  // 监听状态变化，触发相应回调
  const handleStatusChange = useCallback(() => {
    if (txManager.status === TransactionStatus.CONFIRMING) {
      onConfirming?.();
    } else if (txManager.status === TransactionStatus.SUCCESS && txManager.receipt) {
      onSuccess?.(txManager.receipt);
    } else if (txManager.status === TransactionStatus.FAILED && txManager.error) {
      onError?.(txManager.error);
    }
  }, [txManager.status, txManager.receipt, txManager.error, onConfirming, onSuccess, onError]);

  // 在状态变化时触发回调
  React.useEffect(() => {
    handleStatusChange();
  }, [handleStatusChange]);

  return {
    execute,
    status: txManager.status,
    hash: txManager.hash,
    error: txManager.error,
    receipt: txManager.receipt,
    isLoading: txManager.isLoading,
    reset: txManager.reset,
  };
};

/**
 * 批量合约调用 hook，支持顺序执行多个合约调用
 * @param contractFunctions 合约调用函数数组
 * @param options 配置选项
 * @returns 包含批量执行函数和状态的对象
 */
export const useBatchContractCall = (
  contractFunctions: Array<() => Promise<`0x${string}`>>,
  options: ContractCallOptions & { 
    titles?: string[], 
    stopOnError?: boolean 
  } = {}
) => {
  const {
    title = '批量交易',
    titles = [],
    showToast = true,
    stopOnError = true,
    onSuccess,
    onError,
  } = options;

  const txManager = useTransactionManager();
  
  if (showToast) {
    useTransactionToast(txManager, title);
  }

  const execute = useCallback(async () => {
    const results: Array<{ hash?: string; error?: string; success: boolean }> = [];
    
    for (let i = 0; i < contractFunctions.length; i++) {
      const contractFunction = contractFunctions[i];
      const currentTitle = titles[i] || `${title} ${i + 1}/${contractFunctions.length}`;
      
      try {
        await txManager.executeTransaction(async () => {
          const hash = await contractFunction();
          results.push({ hash, success: true });
          return hash;
        });
        
        // 等待当前交易完成再进行下一个
        while (txManager.isLoading) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (txManager.status === TransactionStatus.FAILED) {
          results.push({ error: txManager.error, success: false });
          if (stopOnError) break;
        }
        
      } catch (error: any) {
        results.push({ error: error.message, success: false });
        if (stopOnError) break;
      }
    }
    
    // 批量执行完成回调
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    if (failCount === 0) {
      onSuccess?.(results);
    } else {
      onError?.(`批量执行完成: ${successCount} 成功, ${failCount} 失败`);
    }
    
    return results;
  }, [contractFunctions, titles, title, stopOnError, txManager, onSuccess, onError]);

  return {
    execute,
    status: txManager.status,
    hash: txManager.hash,
    error: txManager.error,
    receipt: txManager.receipt,
    isLoading: txManager.isLoading,
    reset: txManager.reset,
  };
};

/**
 * 便捷的合约调用 hooks，预设了常用的合约操作
 */
export const useContractCallHelpers = () => {
  /**
   * 静默合约调用（不显示 toast）
   */
  const callSilently = useCallback((
    contractFunction: () => Promise<`0x${string}`>,
    options: Omit<ContractCallOptions, 'showToast'> = {}
  ) => {
    return useContractCall(contractFunction, { ...options, showToast: false });
  }, []);

  /**
   * 带成功提示的合约调用
   */
  const callWithSuccess = useCallback((
    contractFunction: () => Promise<`0x${string}`>,
    title: string,
    successMessage?: string
  ) => {
    return useContractCall(contractFunction, {
      title,
      onSuccess: () => {
        if (successMessage) {
          // 这里可以显示额外的成功消息
          console.log(successMessage);
        }
      }
    });
  }, []);

  /**
   * 带确认的合约调用
   */
  const callWithConfirmation = useCallback((
    contractFunction: () => Promise<`0x${string}`>,
    title: string,
    confirmMessage: string
  ) => {
    return useContractCall(async () => {
      if (window.confirm(confirmMessage)) {
        return await contractFunction();
      }
      throw new Error('用户取消了操作');
    }, { title });
  }, []);

  return {
    callSilently,
    callWithSuccess,
    callWithConfirmation,
  };
};