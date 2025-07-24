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
import { useAccount } from 'wagmi';

interface PositionData extends DecryptedPositionInfo {
  id: string;
  isDecrypted: boolean;
  entryTime: string;
}

export const PositionPanel: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const contractActions = useTradingContractActions();

  // 检查用户注册状态
  const checkRegistrationStatus = async () => {
    if (!address) return;
    
    try {
      const registered = await contractActions.checkUserRegistration(address);
      setIsRegistered(registered);
    } catch (error) {
      console.error('检查注册状态失败:', error);
    }
  };

  // 加载用户持仓
  const loadUserPositions = async () => {
    if (!address || !isRegistered) return;
    
    setIsLoadingPositions(true);
    try {
      // 获取用户持仓ID列表
      const positionIds = await contractActions.getUserPositionIds(address);
      
      if (positionIds.length === 0) {
        setPositions([]);
        return;
      }

      console.log('获取到的持仓ID列表:', positionIds);

      // 批量获取开仓时间
      const openTimes = await contractActions.getMultiplePositionOpenTimes(positionIds, address);
      console.log('获取到的开仓时间:', openTimes);

      // 获取每个持仓的详情
      const positionPromises = positionIds.map(async (id) => {
        const positionInfo = await contractActions.getPosition(id);
        if (positionInfo) {
          const entryTime = openTimes[id] || new Date().toLocaleString();
          console.log(`持仓 ${id} 的开仓时间:`, entryTime);
          
          return {
            id,
            owner: positionInfo[0],
            contractCount: 'N/A', // 需要解密
            btcSize: 'N/A', // 需要解密
            entryPrice: String(positionInfo[3]), // 入场价格是明文的
            isLong: false, // 需要解密
            isDecrypted: false,
            entryTime, // 使用从事件日志获取的真实时间
          };
        }
        return null;
      });

      const loadedPositions = await Promise.all(positionPromises);
      const validPositions = loadedPositions.filter(p => p !== null) as PositionData[];
      
      console.log('最终加载的持仓数据:', validPositions);
      setPositions(validPositions);
    } catch (error) {
      console.error('加载持仓失败:', error);
    } finally {
      setIsLoadingPositions(false);
    }
  };

  // 解密持仓信息
  const decryptPosition = async (positionId: string) => {
    setIsDecrypting(true);
    setSelectedPosition(positionId);
    
    try {
      // 获取持仓的加密数据
      const positionInfo = await contractActions.getPosition(positionId);
      if (!positionInfo) {
        throw new Error('无法获取持仓信息');
      }

      // 解密持仓信息
      const decryptedInfo = await contractActions.decryptPosition(positionInfo);
      
      // 更新持仓状态
      setPositions(prev => prev.map(pos => 
        pos.id === positionId 
          ? { 
              ...pos, 
              ...decryptedInfo,
              isDecrypted: true,
              error: decryptedInfo.error 
            }
          : pos
      ));
      
      console.log(`解密持仓 ${positionId} 成功`);
    } catch (error: any) {
      console.error('解密失败:', error);
      
      // 更新错误状态
      setPositions(prev => prev.map(pos => 
        pos.id === positionId 
          ? { 
              ...pos, 
              error: error.message || '解密失败',
              isDecrypted: false
            }
          : pos
      ));
    } finally {
      setIsDecrypting(false);
      setSelectedPosition('');
    }
  };

  // 平仓操作
  const closePositionCall = useContractCall(
    () => contractActions.closePosition(selectedPosition, '1000'), // 这里的平仓金额可以让用户选择
    {
      title: '执行平仓',
      onSuccess: (receipt) => {
        console.log('平仓成功', receipt);
        // 刷新持仓列表
        setTimeout(() => {
          loadUserPositions();
        }, 2000);
      },
      onError: (error) => {
        console.error('平仓失败:', error);
      }
    }
  );

  // 检查注册状态和加载持仓
  useEffect(() => {
    if (isConnected && address) {
      checkRegistrationStatus();
    } else {
      setIsRegistered(false);
      setPositions([]);
    }
  }, [isConnected, address]);

  // 当注册状态确认后，加载持仓
  useEffect(() => {
    if (isRegistered && address) {
      loadUserPositions();
    } else {
      setPositions([]);
    }
  }, [isRegistered, address]);

  const getPositionTypeColor = (isLong: boolean) => {
    return isLong ? 'success' : 'danger';
  };

  const getPositionTypeText = (isLong: boolean) => {
    return isLong ? '多仓' : '空仓';
  };

  // 格式化时间显示
  const formatTime = (timeString: string) => {
    try {
      console.log('格式化时间输入:', timeString);
      
      const date = new Date(timeString);
      console.log('解析后的日期对象:', date);
      
      // 检查是否为有效日期
      if (isNaN(date.getTime())) {
        console.log('无效日期，返回原字符串');
        return timeString; // 如果不是有效日期，返回原字符串
      }
      
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      
      console.log(`时间差: ${diffInMs}ms, ${diffInMinutes}分钟`);
      
      // 如果时间差为负数（未来时间），显示具体时间
      if (diffInMinutes < 0) {
        console.log('未来时间，显示具体日期');
        return date.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // 如果是今天的数据，显示相对时间
      if (diffInMinutes < 1) {
        return '刚刚';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}分钟前`;
      } else if (diffInMinutes < 24 * 60) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours}小时前`;
      } else {
        // 超过一天的显示具体日期和时间
        return date.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('时间格式化错误:', error);
      return timeString;
    }
  };

  // 如果用户未注册，不显示持仓面板
  if (!isConnected || !isRegistered) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="flex flex-col">
          <p className="text-md font-semibold">持仓管理</p>
          <p className="text-small text-default-500">查看和管理当前持仓</p>
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="flat"
            color="primary"
            onPress={loadUserPositions}
            isLoading={isLoadingPositions}
          >
            {isLoadingPositions ? '加载中...' : '刷新'}
          </Button>
        </div>
      </CardHeader>
      <Divider/>
      <CardBody>
        {isLoadingPositions ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Spinner size="lg" />
            <p className="text-sm text-default-500 mt-4">正在加载持仓数据...</p>
          </div>
        ) : positions.length === 0 ? (
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
                            isDisabled={isDecrypting || !!position.error}
                          >
                            {isDecrypting && selectedPosition === position.id ? (
                              '解密中...'
                            ) : position.error ? (
                              '解密失败'
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