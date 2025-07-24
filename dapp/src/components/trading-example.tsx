import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  CardFooter, 
  Divider, 
  Input, 
  Button,
  Switch
} from "@heroui/react";
import { useTradingContractActions, useTransactionManager, TransactionStatus } from '@/lib/contracts';
import { useTransactionToast } from '@/lib/transaction-toast';
import { useAccount } from 'wagmi';

export const TradingExample: React.FC = () => {
  const { isConnected } = useAccount();
  const contracts = useTradingContractActions();
  const [isLong, setIsLong] = useState(true);
  const [usdAmount, setUsdAmount] = useState('');
  const [positionId, setPositionId] = useState('');
  const [closeAmount, setCloseAmount] = useState('');

  // 独立的交易管理器用于不同操作
  const openTxManager = useTransactionManager();
  const closeTxManager = useTransactionManager();
  const revealTxManager = useTransactionManager();

  // 为每个交易添加Toast显示
  useTransactionToast(openTxManager, '🚀 开仓交易');
  useTransactionToast(closeTxManager, '📉 平仓交易');
  useTransactionToast(revealTxManager, '💰 余额公开');

  // 监听开仓交易状态
  useEffect(() => {
    if (openTxManager.status === TransactionStatus.SUCCESS) {
      console.log('Open position successful!');
      // 清空输入表单
      setUsdAmount('');
    } else if (openTxManager.status === TransactionStatus.FAILED) {
      console.error('Open position failed:', openTxManager.error);
    }
  }, [openTxManager.status, openTxManager.error]);

  // 监听平仓交易状态
  useEffect(() => {
    if (closeTxManager.status === TransactionStatus.SUCCESS) {
      console.log('Close position successful!');
      // 清空输入表单
      setPositionId('');
      setCloseAmount('');
    } else if (closeTxManager.status === TransactionStatus.FAILED) {
      console.error('Close position failed:', closeTxManager.error);
    }
  }, [closeTxManager.status, closeTxManager.error]);

  // 监听余额公开状态
  useEffect(() => {
    if (revealTxManager.status === TransactionStatus.SUCCESS) {
      console.log('Balance reveal successful!');
    } else if (revealTxManager.status === TransactionStatus.FAILED) {
      console.error('Balance reveal failed:', revealTxManager.error);
    }
  }, [revealTxManager.status, revealTxManager.error]);

  if (!isConnected) {
    return (
      <Card className="max-w-md">
        <CardBody>
          <p className="text-center text-default-500">请先连接钱包</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 开仓交易 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold">开仓交易</h3>
            <p className="text-sm text-default-500">使用加密参数创建新仓位</p>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">交易方向:</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${!isLong ? 'text-default-500' : 'text-success-600'}`}>
                做多
              </span>
              <Switch 
                isSelected={isLong}
                onValueChange={setIsLong}
                color="success"
                size="sm"
              />
              <span className={`text-sm ${isLong ? 'text-default-500' : 'text-danger-600'}`}>
                做空
              </span>
            </div>
          </div>
          
          <Input
            label="USD 数量"
            placeholder="请输入数量"
            value={usdAmount}
            onValueChange={setUsdAmount}
            type="number"
            endContent={<span className="text-default-400">USD</span>}
          />


        </CardBody>
        <Divider />
        <CardFooter>
          <Button
            onPress={async () => {
              await openTxManager.executeTransaction(() => contracts.openPosition(isLong, usdAmount));
            }}
            isLoading={openTxManager.isLoading}
            isDisabled={!usdAmount || Number(usdAmount) <= 0 || openTxManager.isLoading}
            color="primary"
            className="w-full"
          >
            {openTxManager.isPreparing ? "创建仓位..." :
             openTxManager.isPending ? "等待确认..." :
             openTxManager.isConfirming ? "确认中..." :
             openTxManager.isSuccess ? "仓位创建成功" :
             "🚀 开仓交易"}
          </Button>
        </CardFooter>
      </Card>

      {/* 平仓交易 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold">平仓交易</h3>
            <p className="text-sm text-default-500">关闭现有仓位</p>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-4">
          <Input
            label="仓位 ID"
            placeholder="请输入仓位ID"
            value={positionId}
            onValueChange={setPositionId}
            type="number"
          />
          
          <Input
            label="平仓金额"
            placeholder="请输入平仓金额"
            value={closeAmount}
            onValueChange={setCloseAmount}
            type="number"
            endContent={<span className="text-default-400">USD</span>}
          />


        </CardBody>
        <Divider />
        <CardFooter>
          <Button
            onPress={async () => {
              await closeTxManager.executeTransaction(() => contracts.closePosition(positionId, closeAmount));
            }}
            isLoading={closeTxManager.isLoading}
            isDisabled={!positionId || !closeAmount || Number(closeAmount) <= 0 || closeTxManager.isLoading}
            color="warning"
            className="w-full"
          >
            {closeTxManager.isPreparing ? "平仓中..." :
             closeTxManager.isPending ? "等待确认..." :
             closeTxManager.isConfirming ? "确认中..." :
             closeTxManager.isSuccess ? "平仓成功" :
             "📉 平仓交易"}
          </Button>
        </CardFooter>
      </Card>

      {/* 余额公开 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold">余额公开</h3>
            <p className="text-sm text-default-500">公开您的当前余额</p>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <p className="text-sm text-default-600 mb-4">
            此操作将公开您的当前余额，供排名显示使用。
          </p>


        </CardBody>
        <Divider />
        <CardFooter>
          <Button
            onPress={async () => {
              await revealTxManager.executeTransaction(() => contracts.revealBalance());
            }}
            isLoading={revealTxManager.isLoading}
            isDisabled={revealTxManager.isLoading}
            color="secondary"
            className="w-full"
          >
            {revealTxManager.isPreparing ? "公开中..." :
             revealTxManager.isPending ? "等待确认..." :
             revealTxManager.isConfirming ? "确认中..." :
             revealTxManager.isSuccess ? "余额已公开" :
             "💰 公开余额"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}; 