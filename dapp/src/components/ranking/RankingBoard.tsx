import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Avatar,
  Chip,
  Button,
  Divider,
  Spinner
} from '@heroui/react';
import { Progress } from '@heroui/progress';
import { useTradingContractActions } from '@/lib/contracts';
import { useAccount } from 'wagmi';

interface RankingUser {
  rank: number;
  address: string;
  balance: number;
  profit: number;
  profitPercentage: number;
  lastRevealTime: string;
  isCurrentUser?: boolean;
}

export const RankingBoard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState<RankingUser | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  const contractActions = useTradingContractActions();

  // 格式化时间显示
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return '刚刚';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`;
    } else if (diffInMinutes < 24 * 60) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}小时前`;
    } else {
      const days = Math.floor(diffInMinutes / (24 * 60));
      return `${days}天前`;
    }
  };

  // 加载排行榜数据
  const loadRankingData = async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const balanceReveals = await contractActions.getAllBalanceReveals();
      
      if (balanceReveals && balanceReveals.length > 0) {
        // 转换数据格式并添加排名
        const rankingUsers: RankingUser[] = balanceReveals.map((reveal, index) => ({
          rank: index + 1,
          address: reveal.user,
          balance: reveal.amount,
          profit: reveal.profit,
          profitPercentage: reveal.profitPercentage,
          lastRevealTime: formatTime(reveal.timestamp),
          isCurrentUser: reveal.user.toLowerCase() === address?.toLowerCase()
        }));

        setRankings(rankingUsers);
        
        // 设置当前用户排名
        const userRank = rankingUsers.find(user => user.isCurrentUser);
        setCurrentUserRank(userRank || null);
        
        setLastUpdateTime(new Date());
      } else {
        setRankings([]);
        setCurrentUserRank(null);
      }
    } catch (error) {
      console.error('加载排行榜数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadRankingData();
    }
  }, [isConnected, address]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'warning'; // 金色
      case 2:
        return 'default'; // 银色
      case 3:
        return 'secondary'; // 铜色
      default:
        return 'primary';
    }
  };

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(balance);
  };

  const formatProfit = (profit: number) => {
    const sign = profit >= 0 ? '+' : '';
    return `${sign}${formatBalance(profit)}`;
  };

  const formatProfitPercentage = (percentage: number) => {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* 当前用户排名卡片 */}
      {currentUserRank && (
        <Card className="border-2 border-primary-200 bg-primary-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Chip 
                color={getRankColor(currentUserRank.rank)} 
                variant="solid"
                size="lg"
              >
                {getRankIcon(currentUserRank.rank)}
              </Chip>
              <div>
                <h3 className="text-lg font-semibold text-primary-800">您的排名</h3>
                <p className="text-sm text-primary-600">当前位置第 {currentUserRank.rank} 名</p>
              </div>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xl font-bold text-primary-700">{formatBalance(currentUserRank.balance)}</p>
                <p className="text-xs text-primary-500">当前余额</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold ${currentUserRank.profit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {formatProfit(currentUserRank.profit)}
                </p>
                <p className="text-xs text-primary-500">总盈亏</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold ${currentUserRank.profitPercentage >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {formatProfitPercentage(currentUserRank.profitPercentage)}
                </p>
                <p className="text-xs text-primary-500">收益率</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-primary-700">{currentUserRank.lastRevealTime}</p>
                <p className="text-xs text-primary-500">最后更新</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 排行榜主体 */}
      <Card>
        <CardHeader className="flex gap-3">
          <div className="flex flex-col flex-1">
            <p className="text-md font-semibold">🏆 交易排行榜</p>
            <p className="text-small text-default-500">基于公开余额的实时排名</p>
          </div>
          {lastUpdateTime && (
            <div className="text-right">
              <p className="text-xs text-default-400">
                最后更新: {lastUpdateTime.toLocaleTimeString('zh-CN')}
              </p>
              <p className="text-xs text-default-400">
                共 {rankings.length} 位用户
              </p>
            </div>
          )}
        </CardHeader>
        <Divider/>
        <CardBody>
          {/* 空状态或加载状态 */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner size="lg" />
              <p className="text-sm text-default-500 mt-4">正在加载排行榜数据...</p>
            </div>
          ) : rankings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-default-400">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">暂无排行数据</h3>
              <p className="text-sm text-center max-w-md">
                还没有用户公开余额。成为第一个公开余额的用户吧！
              </p>
              <p className="text-xs text-center mt-2 text-default-400">
                在用户信息面板中点击"余额揭示"来公开您的余额
              </p>
            </div>
          ) : (
            /* 排行榜表格 */
            <Table 
              aria-label="排行榜"
              classNames={{
                wrapper: "min-h-[400px]",
              }}
            >
              <TableHeader>
                <TableColumn>排名</TableColumn>
                <TableColumn>用户地址</TableColumn>
                <TableColumn>当前余额</TableColumn>
                <TableColumn>总盈亏</TableColumn>
                <TableColumn>收益率</TableColumn>
                <TableColumn>最后更新</TableColumn>
              </TableHeader>
              <TableBody>
                {rankings.map((user) => (
                  <TableRow 
                    key={user.address}
                    className={user.isCurrentUser ? "bg-primary-50 border border-primary-200" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Chip 
                          color={getRankColor(user.rank)} 
                          variant={user.rank <= 3 ? "solid" : "flat"}
                          size="sm"
                        >
                          {getRankIcon(user.rank)}
                        </Chip>
                        {user.isCurrentUser && (
                          <Chip color="primary" variant="solid" size="sm">
                            您
                          </Chip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar 
                          name={formatAddress(user.address)}
                          size="sm"
                          className="flex-shrink-0"
                          showFallback
                          fallback={
                            <div className="w-full h-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                {user.address.slice(2, 4).toUpperCase()}
                              </span>
                            </div>
                          }
                        />
                        <span className="font-mono text-sm">
                          {formatAddress(user.address)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold">
                        {formatBalance(user.balance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono font-semibold ${
                        user.profit >= 0 ? 'text-success-600' : 'text-danger-600'
                      }`}>
                        {formatProfit(user.profit)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${
                          user.profitPercentage >= 0 ? 'text-success-600' : 'text-danger-600'
                        }`}>
                          {formatProfitPercentage(user.profitPercentage)}
                        </span>
                        {user.profitPercentage !== 0 && (
                          <Progress 
                            value={Math.min(Math.abs(user.profitPercentage), 100)} 
                            color={user.profitPercentage >= 0 ? "success" : "danger"}
                            size="sm"
                            className="w-16"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-default-500">
                        {user.lastRevealTime}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* 刷新按钮 */}
          <div className="flex justify-center mt-4">
            <Button
              color="primary"
              variant="flat"
              onPress={loadRankingData}
              isLoading={isLoading}
              isDisabled={!isConnected}
            >
              {isLoading ? '加载中...' : '刷新排行榜'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 说明文字 */}
      <Card className="bg-default-50">
        <CardBody>
          <div className="text-center space-y-2">
            <h4 className="font-semibold text-default-700">📊 排行榜说明</h4>
            <div className="space-y-1 text-sm text-default-500">
              <p>• 排行榜基于用户主动揭示的余额进行排名，按照收益从高到低排序</p>
              <p>• 初始余额为 $100,000，收益 = 当前余额 - 初始余额</p>
              <p>• 只有选择公开余额的用户才会出现在榜单中</p>
              <p>• 每位用户只显示最新的一次余额揭示记录</p>
            </div>
            <p className="text-xs text-default-400 pt-2">
              * 余额数据通过 FHE 同态加密技术保护，确保隐私和安全
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};