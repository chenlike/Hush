import React, { createContext, useContext, useState, useCallback } from 'react';
import { TransactionStatus } from './contracts';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  txHash?: string;
  status?: TransactionStatus;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<ToastMessage>) => void;
  showTransactionToast: (title: string, txHash?: string) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: ToastMessage = {
      ...toast,
      id,
      duration: toast.duration || 0, // Default: no auto-dismiss
    };

    setToasts(prev => [...prev, newToast]);

    // Only auto-remove toasts with explicitly set duration > 0 and not transaction-related
    if (newToast.duration && newToast.duration > 0 && !newToast.txHash && !newToast.status) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<ToastMessage>) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, ...updates } : toast
    ));
  }, []);

  const showTransactionToast = useCallback((title: string, txHash?: string) => {
    return addToast({
      title,
      message: 'Preparing transaction...',
      type: 'info',
      txHash,
      status: TransactionStatus.PREPARING,
      duration: 0, // No auto-removal, manual management required
    });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      updateToast,
      showTransactionToast,
    }}>
      {children}
    </ToastContext.Provider>
  );
}; 