import { useState, useEffect } from 'react';
import { Chip } from '@heroui/chip';
import { Button } from '@heroui/button';
import { Tooltip } from '@heroui/tooltip';
import { Spinner } from '@heroui/spinner';
import { fheService } from '@/lib/fhe-service';

export const FHEStatus = () => {
  const [status, setStatus] = useState<'initializing' | 'ready' | 'failed' | 'not-started'>('initializing');
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    // 页面加载时自动初始化FHE
    const initializeOnLoad = async () => {
      if (fheService.isReady()) {
        setStatus('ready');
        return;
      }
      
      if (fheService.hasInitializationFailed()) {
        setStatus('failed');
        return;
      }

      setIsInitializing(true);
      setStatus('initializing');
      
      try {
        await fheService.initialize();
        setStatus('ready');
      } catch (error) {
        console.error('FHE auto-initialization failed:', error);
        setStatus('failed');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeOnLoad();

    const checkStatus = () => {
      if (fheService.hasInitializationFailed()) {
        setStatus('failed');
      } else if (fheService.isReady()) {
        setStatus('ready');
      }
    };
    
    // 定期检查状态
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleInitialize = async () => {
    if (isInitializing || status === 'ready') return;
    
    setIsInitializing(true);
    setStatus('initializing');
    
    try {
      await fheService.initialize();
      setStatus('ready');
    } catch (error) {
      console.error('FHE initialization failed:', error);
      setStatus('failed');
    } finally {
      setIsInitializing(false);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'ready':
        return {
          color: 'success' as const,
          text: 'FHE Ready',
          description: 'FHE service is ready for encryption operations'
        };
      case 'initializing':
        return {
          color: 'warning' as const,
          text: 'FHE Initializing...',
          description: 'FHE service is initializing...'
        };
      case 'failed':
        return {
          color: 'danger' as const,
          text: 'FHE Failed',
          description: 'FHE service initialization failed, click to retry'
        };
      default:
        return {
          color: 'default' as const,
          text: 'FHE Not Started',
          description: 'Click to initialize FHE service'
        };
    }
  };

  const statusConfig = getStatusConfig();

  if (status === 'ready') {
    return (
      <Tooltip content={statusConfig.description}>
        <Chip 
          color={statusConfig.color} 
          variant="flat"
          size="sm"
        >
          {statusConfig.text}
        </Chip>
      </Tooltip>
    );
  }

  if (status === 'initializing') {
    return (
      <Tooltip content={statusConfig.description}>
        <Chip 
          color={statusConfig.color} 
          variant="flat"
          size="sm"
          startContent={<Spinner size="sm" color="current" />}
        >
          {statusConfig.text}
        </Chip>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={statusConfig.description}>
      <Button
        color={statusConfig.color}
        variant="flat"
        size="sm"
        isLoading={isInitializing}
        onPress={handleInitialize}
        className="min-w-[100px]"
      >
        {statusConfig.text}
      </Button>
    </Tooltip>
  );
}; 