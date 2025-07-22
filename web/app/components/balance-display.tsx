'use client';

import { useAccount, useContractRead, useWalletClient } from 'wagmi';
import { CONTRACTS } from '../../lib/contracts';
import { fheService } from '../../lib/fhe-service';
import { useState, useEffect } from 'react';

export function BalanceDisplay() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasDecrypted, setHasDecrypted] = useState(false);

  // 连接完成后初始化FHE服务
  useEffect(() => {
    if (isConnected && !fheService.isReady() && !fheService.hasInitializationFailed()) {
      fheService.initialize().catch(console.error);
    }
  }, [isConnected]);

  // 获取用户注册状态
  const { data: isRegistered } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // 获取加密余额
  const { data: encryptedBalance } = useContractRead({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getBalance',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!isRegistered },
  });

  // 解密余额
  const handleDecryptBalance = async () => {
    if (!encryptedBalance || !address || !walletClient) return;

    setIsDecrypting(true);
    setHasDecrypted(true);

    try {
      const handles = [String(encryptedBalance[0]), String(encryptedBalance[1])];
      const results = await fheService.decryptMultipleValuesWithWalletClient(
        handles,
        CONTRACTS.TRADER.address,
        walletClient
      );

      const cash = results[handles[0]];
      const btc = results[handles[1]];
      const cashFormatted = (Number(cash) / 1e8).toFixed(2);
      const btcFormatted = (Number(btc) / 1e8).toFixed(8);
      setDecryptedBalance(`现金: $${cashFormatted}, BTC: ${btcFormatted}`);
    } catch (error: any) {
      console.error('解密余额失败:', error);
      if (error.message.includes('user rejected')) {
        setDecryptedBalance('用户取消了签名');
      } else {
        setDecryptedBalance(`解密失败: ${error.message}`);
      }
    } finally {
      setIsDecrypting(false);
    }
  };

  if (!isConnected || !isRegistered) {
    return null;
  }

  return (
    <div className="bg-card rounded-lg p-6 shadow-sm">
      <h2 className="text-2xl font-semibold mb-4">账户余额</h2>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          加密余额: {encryptedBalance ? '已获取' : '未获取'}
        </p>
        {isDecrypting ? (
          <p className="text-sm text-blue-500">正在解密余额...</p>
        ) : decryptedBalance ? (
          <p className="text-sm text-green-600">解密余额: {decryptedBalance}</p>
        ) : (
          <button
            onClick={handleDecryptBalance}
            disabled={!encryptedBalance}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            解密余额
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          注意：余额使用全同态加密技术保护，解密过程需要用户签名
        </p>
      </div>
    </div>
  );
}
