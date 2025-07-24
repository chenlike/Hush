import { useEffect, useRef } from 'react';
import { useToast } from './toast';
import { TransactionStatus, TransactionState } from './contracts';

export const useTransactionToast = (
  txState: TransactionState,
  title: string = 'Contract Transaction'
) => {
  const { updateToast, showTransactionToast, removeToast } = useToast();
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 如果交易开始，创建新的toast
    if (txState.status === TransactionStatus.PREPARING && !toastIdRef.current) {
      toastIdRef.current = showTransactionToast(title);
    }

    // 更新现有的toast状态
    if (toastIdRef.current) {
      let message = '';
      let type: 'info' | 'success' | 'error' = 'info';

      switch (txState.status) {
        case TransactionStatus.PREPARING:
          message = 'Preparing transaction ...';
          type = 'info';
          break;
        case TransactionStatus.PENDING:
          message = 'Waiting for wallet confirmation...';
          type = 'info';
          break;
        case TransactionStatus.CONFIRMING:
          message = 'Confirming on blockchain...';
          type = 'info';
          break;
        case TransactionStatus.SUCCESS:
          message = 'Transaction completed successfully!';
          type = 'success';
          break;
        case TransactionStatus.FAILED:
          message = txState.error || 'Transaction failed';
          type = 'error';
          break;
        case TransactionStatus.IDLE:
          // 重置时清理toast
          if (toastIdRef.current) {
            removeToast(toastIdRef.current);
            toastIdRef.current = null;
          }
          return;
      }

      updateToast(toastIdRef.current, {
        message,
        type,
        status: txState.status,
        txHash: txState.hash,
      });
    }
  }, [txState.status, txState.hash, txState.error, title, updateToast, showTransactionToast, removeToast]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        removeToast(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, [removeToast]);
}; 