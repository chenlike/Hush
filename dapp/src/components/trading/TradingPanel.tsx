import React, { useState } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  Button, 
  Input, 
  Divider,
  Chip
} from '@heroui/react';
import { useTradingContractActions } from '@/lib/contracts';
import { useContractCall } from '@/lib/contract-hook';

export const TradingPanel: React.FC = () => {
  const [amount, setAmount] = useState('1000');
  const [isLong, setIsLong] = useState(true);
  const [positionId, setPositionId] = useState('');
  const [closeAmount, setCloseAmount] = useState('');

  const contractActions = useTradingContractActions();

  // 开仓
  const openPositionCall = useContractCall(
    () => contractActions.openPosition(isLong, amount),
    {
      title: `${isLong ? '开多仓' : '开空仓'}`,
      onSuccess: (receipt) => {
        console.log('开仓成功', receipt);
        setAmount('1000'); // 重置表单
      }
    }
  );

  // 平仓
  const closePositionCall = useContractCall(
    () => contractActions.closePosition(positionId, closeAmount),
    {
      title: '平仓',
      onSuccess: (receipt) => {
        console.log('平仓成功', receipt);
        setPositionId('');
        setCloseAmount('');
      }
    }
  );

  // 余额揭示
  const revealBalanceCall = useContractCall(contractActions.revealBalance, {
    title: '余额揭示',
    onSuccess: () => {
      console.log('余额揭示成功');
    }
  });

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="flex flex-col">
          <p className="text-md font-semibold">交易面板</p>
          <p className="text-small text-default-500">执行合约交易操作</p>
        </div>
      </CardHeader>
      <Divider/>
      <CardBody className="space-y-4">
        {/* 开仓区域 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-default-600">开仓交易</h4>
            <Chip 
              color={isLong ? "success" : "danger"} 
              variant="flat" 
              size="sm"
            >
              {isLong ? "做多" : "做空"}
            </Chip>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-default-600">交易方向</label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={isLong ? "solid" : "flat"}
                  color="success"
                  onPress={() => setIsLong(true)}
                  className="flex-1"
                >
                  做多
                </Button>
                <Button
                  size="sm"
                  variant={!isLong ? "solid" : "flat"}
                  color="danger"
                  onPress={() => setIsLong(false)}
                  className="flex-1"
                >
                  做空
                </Button>
              </div>
            </div>
            
            <Input
              type="number"
              label="交易金额 (USD)"
              placeholder="请输入金额"
              value={amount}
              onValueChange={setAmount}
              size="sm"
              endContent={
                <div className="pointer-events-none flex items-center">
                  <span className="text-default-400 text-small">USD</span>
                </div>
              }
            />
            
            <Button
              color={isLong ? "success" : "danger"}
              onPress={openPositionCall.execute}
              isLoading={openPositionCall.isLoading}
              isDisabled={!amount || openPositionCall.isLoading}
              size="sm"
              className="w-full"
            >
              {isLong ? `开多仓 ${amount} USD` : `开空仓 ${amount} USD`}
            </Button>
          </div>
        </div>

        <Divider />

        {/* 平仓区域 */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-default-600">平仓交易</h4>
          
          <div className="space-y-3">
            <Input
              type="text"
              label="持仓 ID"
              placeholder="请输入持仓ID"
              value={positionId}
              onValueChange={setPositionId}
              size="sm"
            />
            
            <Input
              type="number"
              label="平仓金额 (USD)"
              placeholder="请输入平仓金额"
              value={closeAmount}
              onValueChange={setCloseAmount}
              size="sm"
              endContent={
                <div className="pointer-events-none flex items-center">
                  <span className="text-default-400 text-small">USD</span>
                </div>
              }
            />
            
            <Button
              color="warning"
              onPress={closePositionCall.execute}
              isLoading={closePositionCall.isLoading}
              isDisabled={!positionId || !closeAmount || closePositionCall.isLoading}
              size="sm"
              className="w-full"
            >
              平仓 {closeAmount} USD
            </Button>
          </div>
        </div>

        {/* 操作状态显示 */}
        {(openPositionCall.hash || closePositionCall.hash || revealBalanceCall.hash) && (
          <>
            <Divider />
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-default-600">交易状态</h4>
              <div className="space-y-1 text-xs text-default-500 font-mono bg-default-50 p-2 rounded">
                {openPositionCall.hash && (
                  <div>开仓: {openPositionCall.hash.slice(0, 10)}... ({openPositionCall.status})</div>
                )}
                {closePositionCall.hash && (
                  <div>平仓: {closePositionCall.hash.slice(0, 10)}... ({closePositionCall.status})</div>
                )}
                {revealBalanceCall.hash && (
                  <div>余额: {revealBalanceCall.hash.slice(0, 10)}... ({revealBalanceCall.status})</div>
                )}
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};