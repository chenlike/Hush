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
  Tabs,
  Tab
} from '@heroui/react';
import { Progress } from '@heroui/progress';
import { useTradingContractActions } from '@/lib/contracts';

interface RankingUser {
  rank: number;
  address: string;
  balance: string;
  totalTrades: number;
  winRate: number;
  pnl: string;
  lastRevealTime: string;
  isCurrentUser?: boolean;
}

export const RankingBoard: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('balance');
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState<RankingUser | null>(null);

  const contractActions = useTradingContractActions();

  // 模拟排行榜数据
  const mockRankings: RankingUser[] = [
    {
      rank: 1,
      address: '0x1234...5678',
      balance: '125,500.50',
      totalTrades: 247,
      winRate: 84,
      pnl: '+$45,230.25',
      lastRevealTime: '2 分钟前',
    },
    {
      rank: 2,
      address: '0xabcd...efgh',
      balance: '98,750.00',
      totalTrades: 189,
      winRate: 78,
      pnl: '+$32,150.75',
      lastRevealTime: '5 分钟前',
    },
    {
      rank: 3,
      address: '0x9876...4321',
      balance: '87,320.25',
      totalTrades: 156,
      winRate: 82,
      pnl: '+$28,940.50',
      lastRevealTime: '12 分钟前',
    },
    {
      rank: 4,
      address: contractActions.address || '0x5555...6666',
      balance: '76,890.00',
      totalTrades: 134,
      winRate: 75,
      pnl: '+$22,340.00',
      lastRevealTime: '18 分钟前',
      isCurrentUser: true,
    },
    {
      rank: 5,
      address: '0xdef0...1234',
      balance: '65,420.75',
      totalTrades: 98,
      winRate: 73,
      pnl: '+$18,750.25',
      lastRevealTime: '25 分钟前',
    },
    {
      rank: 6,
      address: '0x7890...abcd',
      balance: '54,680.50',
      totalTrades: 87,
      winRate: 69,
      pnl: '+$15,230.80',
      lastRevealTime: '31 分钟前',
    },
    {
      rank: 7,
      address: '0x3456...7890',
      balance: '48,920.25',
      totalTrades: 76,
      winRate: 71,
      pnl: '+$12,890.45',
      lastRevealTime: '45 分钟前',
    },
    {
      rank: 8,
      address: '0xbcde...f012',
      balance: '42,150.00',
      totalTrades: 65,
      winRate: 68,
      pnl: '+$9,450.30',
      lastRevealTime: '1 小时前',
    },
  ];

  useEffect(() => {
    // 模拟加载排行榜数据
    setIsLoading(true);
    setTimeout(() => {
      setRankings(mockRankings);
      // 设置当前用户排名
      const userRank = mockRankings.find(user => user.isCurrentUser);
      setCurrentUserRank(userRank || null);
      setIsLoading(false);
    }, 1500);
  }, [contractActions.address]);

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

  const getSortedRankings = () => {
    switch (selectedTab) {
      case 'balance':
        return [...rankings].sort((a, b) => parseFloat(b.balance.replace(/,/g, '')) - parseFloat(a.balance.replace(/,/g, '')));
      case 'trades':
        return [...rankings].sort((a, b) => b.totalTrades - a.totalTrades);
      case 'winrate':
        return [...rankings].sort((a, b) => b.winRate - a.winRate);
      case 'pnl':
        return [...rankings].sort((a, b) => parseFloat(b.pnl.replace(/[+$,]/g, '')) - parseFloat(a.pnl.replace(/[+$,]/g, '')));
      default:
        return rankings;
    }
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
                <p className="text-xl font-bold text-primary-700">${currentUserRank.balance}</p>
                <p className="text-xs text-primary-500">余额</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-primary-700">{currentUserRank.totalTrades}</p>
                <p className="text-xs text-primary-500">交易数</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-primary-700">{currentUserRank.winRate}%</p>
                <p className="text-xs text-primary-500">胜率</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-success-600">{currentUserRank.pnl}</p>
                <p className="text-xs text-primary-500">盈亏</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 排行榜主体 */}
      <Card>
        <CardHeader className="flex gap-3">
          <div className="flex flex-col">
            <p className="text-md font-semibold">🏆 交易排行榜</p>
            <p className="text-small text-default-500">基于公开余额的实时排名</p>
          </div>
        </CardHeader>
        <Divider/>
        <CardBody>
          {/* 排序选项卡 */}
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="mb-4"
          >
            <Tab key="balance" title="余额排名" />
            <Tab key="trades" title="交易量" />
            <Tab key="winrate" title="胜率" />
            <Tab key="pnl" title="盈亏" />
          </Tabs>

          {/* 排行榜表格 */}
          <Table 
            aria-label="排行榜"
            classNames={{
              wrapper: "min-h-[400px]",
            }}
          >
            <TableHeader>
              <TableColumn>排名</TableColumn>
              <TableColumn>用户</TableColumn>
              <TableColumn>余额</TableColumn>
              <TableColumn>交易数</TableColumn>
              <TableColumn>胜率</TableColumn>
              <TableColumn>盈亏</TableColumn>
              <TableColumn>更新时间</TableColumn>
            </TableHeader>
            <TableBody isLoading={isLoading}>
              {getSortedRankings().map((user, index) => (
                <TableRow 
                  key={user.address}
                  className={user.isCurrentUser ? "bg-primary-50" : ""}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Chip 
                        color={getRankColor(index + 1)} 
                        variant="flat"
                        size="sm"
                      >
                        {getRankIcon(index + 1)}
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
                      ${user.balance}
                    </span>
                  </TableCell>
                  <TableCell>{user.totalTrades}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{user.winRate}%</span>
                      <Progress 
                        value={user.winRate} 
                        color="success"
                        size="sm"
                        className="w-16"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono font-semibold ${
                      user.pnl.startsWith('+') ? 'text-success-600' : 'text-danger-600'
                    }`}>
                      {user.pnl}
                    </span>
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

          {/* 刷新按钮 */}
          <div className="flex justify-center mt-4">
            <Button
              color="primary"
              variant="flat"
              onPress={() => {
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 1000);
              }}
              isLoading={isLoading}
            >
              刷新排行榜
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 说明文字 */}
      <Card className="bg-default-50">
        <CardBody>
          <div className="text-center space-y-2">
            <h4 className="font-semibold text-default-700">📊 排行榜说明</h4>
            <p className="text-sm text-default-500">
              排行榜基于用户主动揭示的余额进行排名，只有选择公开余额的用户才会出现在榜单中。
              数据实时更新，展示真实的交易实力。
            </p>
            <p className="text-xs text-default-400">
              * 余额数据通过同态加密技术保护，确保隐私和安全
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};