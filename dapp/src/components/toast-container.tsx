import React from 'react';
import { Card, CardBody, Button, Progress, Spinner } from "@heroui/react";
import { useToast, ToastMessage } from '@/lib/toast';
import { TransactionStatus } from '@/lib/contracts';
import '@/styles/toast.css';

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const { removeToast } = useToast();

  const getToastColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-success-200 bg-success-50';
      case 'error':
        return 'border-danger-200 bg-danger-50';
      case 'warning':
        return 'border-warning-200 bg-warning-50';
      default:
        return 'border-primary-200 bg-primary-50';
    }
  };

  const getTextColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-success-700';
      case 'error':
        return 'text-danger-700';
      case 'warning':
        return 'text-warning-700';
      default:
        return 'text-primary-700';
    }
  };

  const getTitleColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-success-800';
      case 'error':
        return 'text-danger-800';
      case 'warning':
        return 'text-warning-800';
      default:
        return 'text-primary-800';
    }
  };

  const getIcon = () => {
    if (toast.status === TransactionStatus.SUCCESS) {
      return (
        <div className="w-6 h-6 bg-success-500 rounded-full flex items-center justify-center animate-bounce">
          <span className="text-white text-sm">✓</span>
        </div>
      );
    }
    
    if (toast.status === TransactionStatus.FAILED || toast.type === 'error') {
      return (
        <div className="w-6 h-6 bg-danger-500 rounded-full flex items-center justify-center animate-pulse">
          <span className="text-white text-sm">✗</span>
        </div>
      );
    }

    if (toast.status && [TransactionStatus.PREPARING, TransactionStatus.PENDING, TransactionStatus.CONFIRMING].includes(toast.status)) {
      return <Spinner size="sm" color="primary" />;
    }

    // Default icon
    switch (toast.type) {
      case 'success':
        return <span className="text-success-600 text-lg">✅</span>;
      case 'error':
        return <span className="text-danger-600 text-lg">❌</span>;
      case 'warning':
        return <span className="text-warning-600 text-lg">⚠️</span>;
      default:
        return <span className="text-primary-600 text-lg">ℹ️</span>;
    }
  };

  const getProgress = () => {
    switch (toast.status) {
      case TransactionStatus.PREPARING:
        return 25;
      case TransactionStatus.PENDING:
        return 50;
      case TransactionStatus.CONFIRMING:
        return 75;
      case TransactionStatus.SUCCESS:
        return 100;
      case TransactionStatus.FAILED:
        return 0;
      default:
        return 0;
    }
  };

  const showProgress = toast.status && toast.status !== TransactionStatus.IDLE;

  return (
    <Card 
      className={`border-2 ${getToastColor()} shadow-lg animate-in slide-in-from-top-2 duration-300 toast-item`}
      shadow="md"
    >
      <CardBody className="py-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-semibold ${getTitleColor()}`}>
              {toast.title}
            </h4>
            <p className={`text-sm mt-1 ${getTextColor()}`}>
              {toast.message}
            </p>

            {/* Transaction hash */}
            {toast.txHash && (
              <p className="text-xs text-default-500 mt-2 font-mono">
                tx: {toast.txHash}
              </p>
            )}

            {/* Progress bar */}
            {showProgress && (
              <Progress 
                value={getProgress()} 
                color={toast.type === 'error' ? 'danger' : 'primary'}
                size="sm"
                className="mt-3"
              />
            )}
          </div>

          {/* Close button */}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="text-default-400 hover:text-default-600"
            onPress={() => removeToast(toast.id)}
          >
            ✕
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container fixed-toast">
      <div className="space-y-2">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  );
}; 