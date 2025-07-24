import { useEffect, useRef } from 'react';
import { useToast } from './toast';
import { TransactionStatus, TransactionState } from './contracts';

export const useTransactionToast = (
  txState: TransactionState,
  title: string = '合约交易'
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
          message = '准备交易参数...';
          type = 'info';
          break;
        case TransactionStatus.PENDING:
          message = '等待钱包确认...';
          type = 'info';
          break;
        case TransactionStatus.CONFIRMING:
          message = '区块链确认中...';
          type = 'info';
          break;
        case TransactionStatus.SUCCESS:
          message = '交易成功完成！';
          type = 'success';
          // 3秒后自动移除成功的toast
          setTimeout(() => {
            if (toastIdRef.current) {
              removeToast(toastIdRef.current);
              toastIdRef.current = null;
            }
          }, 3000);
          break;
        case TransactionStatus.FAILED:
          message = txState.error || '交易执行失败';
          type = 'error';
          // 5秒后自动移除失败的toast
          setTimeout(() => {
            if (toastIdRef.current) {
              removeToast(toastIdRef.current);
              toastIdRef.current = null;
            }
          }, 5000);
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