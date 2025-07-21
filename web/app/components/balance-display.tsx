'use client';

import { useAccount, useContractRead } from 'wagmi';
import { CONTRACTS } from '../../lib/contracts';

export function BalanceDisplay() {
  const { address, isConnected } = useAccount();

  // 获取用户注册状态
  const { data: isRegistered } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // 获取加密余额
  const { data: encryptedCash } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getEncryptedCash',
    args: [],
    query: {
      enabled: !!address && !!isRegistered,
    },
  });

  if (!isConnected || !isRegistered) {
    return null;
  }

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm">
      <h2 className="text-2xl font-semibold mb-4">账户余额</h2>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          加密余额: {encryptedCash ? '已加密' : '未获取'}
        </p>
        <p className="text-xs text-muted-foreground">
          注意：余额使用全同态加密技术保护，无法直接查看具体数值
        </p>
      </div>
    </div>
  );
} 