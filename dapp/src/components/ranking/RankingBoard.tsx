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

  // Format time display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 24 * 60) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hours ago`;
    } else {
      const days = Math.floor(diffInMinutes / (24 * 60));
      return `${days} days ago`;
    }
  };

  // Load leaderboard data
  const loadRankingData = async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const balanceReveals = await contractActions.getAllBalanceReveals();
      console.log(balanceReveals);
      if (balanceReveals && balanceReveals.length > 0) {
        // Convert data format and add ranking
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
        
        // Set current user ranking
        const userRank = rankingUsers.find(user => user.isCurrentUser);
        setCurrentUserRank(userRank || null);
        
        setLastUpdateTime(new Date());
      } else {
        setRankings([]);
        setCurrentUserRank(null);
      }
    } catch (error) {
      console.error('Failed to load leaderboard data:', error);
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
        return 'warning'; // Gold
      case 2:
        return 'default'; // Silver
      case 3:
        return 'secondary'; // Bronze
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
      {/* Current user ranking card */}
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
                <h3 className="text-lg font-semibold text-primary-800">Your Ranking</h3>
                <p className="text-sm text-primary-600">Current position: #{currentUserRank.rank}</p>
              </div>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xl font-bold text-primary-700">{formatBalance(currentUserRank.balance)}</p>
                <p className="text-xs text-primary-500">Current Balance</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold ${currentUserRank.profit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {formatProfit(currentUserRank.profit)}
                </p>
                <p className="text-xs text-primary-500">Total P&L</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold ${currentUserRank.profitPercentage >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {formatProfitPercentage(currentUserRank.profitPercentage)}
                </p>
                <p className="text-xs text-primary-500">Return Rate</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-primary-700">{currentUserRank.lastRevealTime}</p>
                <p className="text-xs text-primary-500">Last Update</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Leaderboard main content */}
      <Card>
        <CardHeader className="flex gap-3">
          <div className="flex flex-col flex-1">
            <p className="text-md font-semibold">🏆 Trading Leaderboard</p>
            <p className="text-small text-default-500">Real-time ranking based on public balances</p>
          </div>
          {lastUpdateTime && (
            <div className="text-right">
              <p className="text-xs text-default-400">
                Last update: {lastUpdateTime.toLocaleTimeString('en-US')}
              </p>
              <p className="text-xs text-default-400">
                {rankings.length} users total
              </p>
            </div>
          )}
        </CardHeader>
        <Divider/>
        <CardBody>
          {/* Empty state or loading state */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner size="lg" />
              <p className="text-sm text-default-500 mt-4">Loading leaderboard data...</p>
            </div>
          ) : rankings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-default-400">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">No ranking data yet</h3>
              <p className="text-sm text-center max-w-md">
                No users have revealed their balances yet. Be the first to reveal your balance!
              </p>
              <p className="text-xs text-center mt-2 text-default-400">
                Click "Balance Reveal" in the user info panel to reveal your balance
              </p>
            </div>
          ) : (
            /* Leaderboard table */
            <Table 
              aria-label="Leaderboard"
              classNames={{
                wrapper: "min-h-[400px]",
              }}
            >
              <TableHeader>
                <TableColumn>Rank</TableColumn>
                <TableColumn>User Address</TableColumn>
                <TableColumn>Current Balance</TableColumn>
                <TableColumn>Total P&L</TableColumn>
                <TableColumn>Return Rate</TableColumn>
                <TableColumn>Last Update</TableColumn>
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
                            You
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

          {/* Refresh button */}
          <div className="flex justify-center mt-4">
            <Button
              color="primary"
              variant="flat"
              onPress={loadRankingData}
              isLoading={isLoading}
              isDisabled={!isConnected}
            >
              {isLoading ? 'Loading...' : 'Refresh Leaderboard'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Description */}
      <Card className="bg-default-50">
        <CardBody>
          <div className="text-center space-y-2">
            <h4 className="font-semibold text-default-700">📊 Leaderboard Information</h4>
            <div className="space-y-1 text-sm text-default-500">
              <p>• Leaderboard is based on users' voluntarily revealed balances, ranked by profit from high to low</p>
              <p>• Initial balance is $100,000, profit = current balance - initial balance</p>
              <p>• Only users who choose to reveal their balances will appear on the leaderboard</p>
              <p>• Only the latest balance reveal record is shown for each user</p>
            </div>
            <p className="text-xs text-default-400 pt-2">
              * Balance data is protected by FHE (Fully Homomorphic Encryption) technology, ensuring privacy and security
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};