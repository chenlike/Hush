import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Divider,
  Spinner
} from '@heroui/react';
import { useTradingContractActions, DecryptedPositionInfo } from '@/lib/contracts';
import { useContractCall } from '@/lib/contract-hook';

interface PositionData extends DecryptedPositionInfo {
  id: string;
  isDecrypted: boolean;
  entryTime: string;
}

export const PositionPanel: React.FC = () => {
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(false);

  const contractActions = useTradingContractActions();

  // 模拟获取持仓数据 - 在实际项目中这里应该是从合约读取数据
  const mockPositions: PositionData[] = [
    {
      id: '1',
      owner: contractActions.address || '',
      contractCount: '1',
      btcSize: '0.01000000',
      entryPrice: '45000',
      isLong: true,
      isDecrypted: false,
      entryTime: '2024-01-15 14:30:25'
    },
    {
      id: '2', 
      owner: contractActions.address || '',
      contractCount: '2',
      btcSize: '0.02000000',
      entryPrice: '44500',
      isLong: false,
      isDecrypted: false,
      entryTime: '2024-01-15 16:45:12'
    }
  ];

  // 解密持仓信息
  const decryptPosition = async (positionId: string) => {
    setIsDecrypting(true);
    setSelectedPosition(positionId);
    
    try {
      // 这里应该调用实际的合约方法获取加密数据
      // const encryptedData = await getPositionFromContract(positionId);
      // const decrypted = await contractActions.decryptPosition(encryptedData);
      
      // 模拟解密过程
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 模拟解密成功，更新持仓状态
      setPositions(prev => prev.map(pos => 
        pos.id === positionId 
          ? { ...pos, isDecrypted: true }
          : pos
      ));
      
      console.log(`解密持仓 ${positionId} 成功`);
    } catch (error) {
      console.error('解密失败:', error);
    } finally {
      setIsDecrypting(false);
      setSelectedPosition('');
    }
  };

  // 平仓操作
  const closePositionCall = useContractCall(
    () => contractActions.closePosition(selectedPosition, '1000'),
    {
      title: '执行平仓',
      onSuccess: (receipt) => {
        console.log('平仓成功', receipt);
        // 刷新持仓列表
        // refreshPositions();
      }
    }
  );

  useEffect(() => {
    // 模拟加载持仓数据
    setPositions(mockPositions);
  }, [contractActions.address]);

  const getPositionTypeColor = (isLong: boolean) => {
    return isLong ? 'success' : 'danger';
  };

  const getPositionTypeText = (isLong: boolean) => {
    return isLong ? '多仓' : '空仓';
  };

  // 格式化时间显示
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="flex flex-col">
          <p className="text-md font-semibold">持仓管理</p>
          <p className="text-small text-default-500">查看和管理当前持仓</p>
        </div>
      </CardHeader>
      <Divider/>
      <CardBody>
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-default-400">
            <p className="text-lg mb-2">暂无持仓</p>
            <p className="text-sm">开始交易后持仓将显示在这里</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table 
              aria-label="持仓列表"
              classNames={{
                wrapper: "min-h-[200px]",
              }}
            >
              <TableHeader>
                <TableColumn>持仓ID</TableColumn>
                <TableColumn>方向</TableColumn>
                <TableColumn>BTC数量</TableColumn>
                <TableColumn>入场价格</TableColumn>
                <TableColumn>入场时间</TableColumn>
                <TableColumn>合约数量</TableColumn>
                <TableColumn>操作</TableColumn>
              </TableHeader>
              <TableBody>
                {positions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>#{position.id}</TableCell>
                    <TableCell>
                      {position.isDecrypted ? (
                        <Chip 
                          color={getPositionTypeColor(position.isLong)} 
                          variant="flat"
                          size="sm"
                        >
                          {getPositionTypeText(position.isLong)}
                        </Chip>
                      ) : (
                        <Chip 
                          color="default" 
                          variant="flat"
                          size="sm"
                        >
                          ***
                        </Chip>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {position.isDecrypted ? (
                        `${position.btcSize} BTC`
                      ) : (
                        '***'
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      ${position.entryPrice}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTime(position.entryTime)}
                    </TableCell>
                    <TableCell>
                      {position.isDecrypted ? (
                        position.contractCount
                      ) : (
                        '***'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!position.isDecrypted ? (
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            onPress={() => decryptPosition(position.id)}
                            isLoading={isDecrypting && selectedPosition === position.id}
                            isDisabled={isDecrypting}
                          >
                            {isDecrypting && selectedPosition === position.id ? (
                              <>
                                解密中...
                              </>
                            ) : (
                              '解密'
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="flat"
                            color="warning"
                            onPress={() => {
                              setSelectedPosition(position.id);
                              closePositionCall.execute();
                            }}
                            isLoading={closePositionCall.isLoading && selectedPosition === position.id}
                          >
                            平仓
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 解密说明 */}
            <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  ℹ
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-primary-700 mb-1">隐私保护说明</h4>
                  <p className="text-xs text-primary-600">
                    持仓信息已通过 FHE 同态加密技术保护。在解密前，您只能看到入场价格和时间。
                    点击"解密"按钮可以查看完整的持仓信息，包括方向和数量。
                  </p>
                </div>
              </div>
            </div>

            {/* 错误显示 */}
            {positions.some(p => p.error) && (
              <>
                <Divider />
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-danger-600">解密错误</h4>
                  {positions
                    .filter(p => p.error)
                    .map(position => (
                      <div key={position.id} className="text-sm text-danger-500">
                        持仓 #{position.id}: {position.error}
                      </div>
                    ))
                  }
                </div>
              </>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};