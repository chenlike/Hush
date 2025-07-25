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
 * Universal contract call hook that automatically handles toast notifications and state management
 * @param contractFunction Contract call function that should return Promise<`0x${string}`>
 * @param options Configuration options, including title, callbacks etc
 * @returns Object containing execution function and state
 */
export const useContractCall = (
  contractFunction: () => Promise<`0x${string}`>,
  options: ContractCallOptions = {}
): ContractCallResult => {
  const {
    title = 'Contract Transaction',
    showToast = true,
    onSuccess,
    onError,
    onPreparing,
    onPending,
    onConfirming,
  } = options;

  const txManager = useTransactionManager();
  
  // Only use toast hook when toast is enabled
  if (showToast) {
    useTransactionToast(txManager, title);
  }

  const execute = useCallback(async () => {
    // Immediately enter preparing state to provide instant user feedback
    txManager.setPreparingState();
    
    // Preparing phase callback
    onPreparing?.();

    // Wait 100ms to let UI render loading animation, avoid being blocked by time-consuming FHE computation
    await new Promise(resolve => setTimeout(resolve, 100));

    await txManager.executeTransaction(async () => {      
      try {
        const hash = await contractFunction();
        
        // Transaction initiation success callback
        onPending?.(hash);
        
        return hash;
      } catch (error: any) {
        // Error handling
        const errorMessage = error.message || 'Contract call failed';
        onError?.(errorMessage);
        throw error;
      }
    });
  }, [contractFunction, txManager, onPreparing, onPending, onError]);

  // Listen to status changes and trigger corresponding callbacks
  const handleStatusChange = useCallback(() => {
    if (txManager.status === TransactionStatus.CONFIRMING) {
      onConfirming?.();
    } else if (txManager.status === TransactionStatus.SUCCESS && txManager.receipt) {
      onSuccess?.(txManager.receipt);
    } else if (txManager.status === TransactionStatus.FAILED && txManager.error) {
      onError?.(txManager.error);
    }
  }, [txManager.status, txManager.receipt, txManager.error, onConfirming, onSuccess, onError]);

  // Trigger callbacks when status changes
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
 * Batch contract call hook that supports sequential execution of multiple contract calls
 * @param contractFunctions Array of contract call functions
 * @param options Configuration options
 * @returns Object containing batch execution function and state
 */
export const useBatchContractCall = (
  contractFunctions: Array<() => Promise<`0x${string}`>>,
  options: ContractCallOptions & { 
    titles?: string[], 
    stopOnError?: boolean 
  } = {}
) => {
  const {
    title = 'Batch Transaction',
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
        
        // Wait for current transaction to complete before proceeding to the next
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
    
    // Batch execution completion callback
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    if (failCount === 0) {
      onSuccess?.(results);
    } else {
      onError?.(`Batch execution completed: ${successCount} successful, ${failCount} failed`);
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
 * Convenient contract call hooks with preset common contract operations
 */
export const useContractCallHelpers = () => {
  /**
   * Silent contract call (no toast display)
   */
  const callSilently = useCallback((
    contractFunction: () => Promise<`0x${string}`>,
    options: Omit<ContractCallOptions, 'showToast'> = {}
  ) => {
    return useContractCall(contractFunction, { ...options, showToast: false });
  }, []);

  /**
   * Contract call with success notification
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
          // Additional success message can be displayed here
          console.log(successMessage);
        }
      }
    });
  }, []);

  /**
   * Contract call with confirmation
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
      throw new Error('User cancelled the operation');
    }, { title });
  }, []);

  return {
    callSilently,
    callWithSuccess,
    callWithConfirmation,
  };
};