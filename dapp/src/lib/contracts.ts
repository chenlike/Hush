import { hexlify } from 'ethers';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWalletClient } from 'wagmi';
import { CONTRACTS } from './base-contracts';
import { fheService } from './fhe-service';
import type { WalletClient } from 'viem';

// 辅助函数：将Uint8Array转换为hex字符串
const uint8ArrayToHex = (array: Uint8Array): `0x${string}` => {
  return `0x${Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
};

// 类型定义
export interface PositionInfo {
  owner: string;
  contractCount: string;
  btcSize: string;
  entryPrice: string;
  isLong: boolean;
}

export interface DecryptedPositionInfo {
  owner: string;
  contractCount: string;
  btcSize: string;
  entryPrice: string;
  isLong: boolean;
  error?: string;
}

export interface BalanceRevealInfo {
  amount: string;
  timestamp: string;
}

export interface ContractResult<T = any> {
  data?: T;
  error?: string;
  isLoading: boolean;
}

// 合约操作类
export class TradingContractService {
  
  /**
   * 用户注册
   */
  static async register(writeContract: any): Promise<void> {
    try {
      writeContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'register',
        args: [],
      });
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  }

  /**
   * 开仓交易
   */
  static async openPosition(
    writeContract: any,
    address: string,
    isLong: boolean,
    usdAmount: string
  ): Promise<void> {
    if (!address || !usdAmount || !fheService.isReady()) {
      throw new Error('开仓前置条件不满足');
    }

    try {
      console.log("开始开仓流程", { address, usdAmount, isLong });

      // 创建加密输入实例
      const encryptedInput = fheService.createEncryptedInput(CONTRACTS.TRADER.address, address);
      
      // 添加交易方向 (ebool)
      encryptedInput.addBool(isLong);
      
      // 添加USD金额 (euint64)
      const usdValue = parseInt(usdAmount);
      encryptedInput.add64(BigInt(usdValue));
      
      // 加密所有输入
      const encryptedResult = await encryptedInput.encrypt();
      
      console.log('加密结果:', encryptedResult);
      
      // 调用开仓合约
      const isLongHandle = uint8ArrayToHex(encryptedResult.handles[0]);
      const usdAmountHandle = uint8ArrayToHex(encryptedResult.handles[1]);
      
      writeContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'openPosition',
        args: [
          isLongHandle, // _isLong
          usdAmountHandle, // _usdAmount
          hexlify(encryptedResult.inputProof) as any // proof
        ]
      });
      
      console.log("开仓调用完成");
    } catch (error) {
      console.error('开仓失败:', error);
      throw error;
    }
  }

  /**
   * 平仓交易
   */
  static async closePosition(
    writeContract: any,
    address: string,
    positionId: string,
    closeUsdAmount: string
  ): Promise<void> {
    if (!positionId || !address || !fheService.isReady() || !closeUsdAmount) {
      throw new Error('平仓前置条件不满足');
    }
    
    try {
      // 创建加密输入实例
      const encryptedInput = fheService.createEncryptedInput(CONTRACTS.TRADER.address, address);
      
      // 添加平仓USD金额 (euint64)
      const usdValue = parseInt(closeUsdAmount);
      encryptedInput.add64(BigInt(usdValue));
      
      // 加密所有输入
      const encryptedResult = await encryptedInput.encrypt();
      
      // 调用平仓合约
      const usdValueHandle = uint8ArrayToHex(encryptedResult.handles[0]);

      writeContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'closePosition',
        args: [
          BigInt(positionId),
          usdValueHandle,
          hexlify(encryptedResult.inputProof) as any
        ]
      });
      
      console.log("平仓调用完成");
    } catch (error) {
      console.error('平仓失败:', error);
      throw error;
    }
  }

  /**
   * 私人解密余额（不提交交易）
   */
  static async decryptBalance(
    encryptedBalance: any,
    address: string,
    walletClient: WalletClient
  ): Promise<string> {
    if (!encryptedBalance || !address || !walletClient) {
      throw new Error('解密余额前置条件不满足');
    }

    try {
      const balanceHandle = String(encryptedBalance);
      const results = await fheService.decryptMultipleValuesWithWalletClient(
        [balanceHandle],
        CONTRACTS.TRADER.address,
        walletClient
      );
      
      const balance = results[balanceHandle];
      return balance?.toString() || 'N/A';
    } catch (error: any) {
      console.error('余额解密失败:', error);
      if (error.message.includes('user rejected')) {
        throw new Error('用户取消了签名');
      } else {
        throw new Error(`解密失败: ${error.message}`);
      }
    }
  }

  /**
   * 公开揭示余额（提交交易到链上）
   */
  static async revealBalance(writeContract: any): Promise<void> {
    try {
      writeContract({
        address: CONTRACTS.TRADER.address,
        abi: CONTRACTS.TRADER.abi,
        functionName: 'revealMyBalance',
        args: [],
      });
    } catch (error) {
      console.error('余额揭示请求失败:', error);
      throw error;
    }
  }

  /**
   * 解密持仓信息
   */
  static async decryptPosition(
    positionInfo: any,
    address: string,
    walletClient: WalletClient
  ): Promise<DecryptedPositionInfo> {
    if (!positionInfo || !address || !walletClient) {
      throw new Error('解密持仓前置条件不满足');
    }

    try {
      // 持仓信息结构: [owner, contractCount, btcSize, entryPrice, isLong]
      // contractCount, btcSize 和 isLong 是加密的，需要解密
      const contractCountHandle = String(positionInfo[1]);
      const btcSizeHandle = String(positionInfo[2]);
      const isLongHandle = String(positionInfo[4]);

      const handles = [contractCountHandle, btcSizeHandle, isLongHandle];
      console.log("handles", handles);
      
      const results = await fheService.decryptMultipleValuesWithWalletClient(
        handles,
        CONTRACTS.TRADER.address,
        walletClient
      );

      console.log('持仓解密结果:', results);

      const contractCount = results[contractCountHandle];
      const btcSize = results[btcSizeHandle];
      const isLong = results[isLongHandle];
      
      // 格式化显示
      const contractCountFormatted = contractCount?.toString() || 'N/A';
      const btcSizeFormatted = (Number(btcSize) / 1e8).toFixed(8);

      return {
        owner: positionInfo[0],
        contractCount: contractCountFormatted,
        btcSize: btcSizeFormatted,
        entryPrice: positionInfo[3]?.toString() || 'N/A',
        isLong: Boolean(isLong)
      };
    } catch (error: any) {
      console.error('解密持仓失败:', error);
      if (error.message.includes('user rejected')) {
        return { 
          owner: positionInfo[0],
          contractCount: 'N/A',
          btcSize: 'N/A', 
          entryPrice: 'N/A',
          isLong: false,
          error: '用户取消了签名' 
        };
      } else {
        return { 
          owner: positionInfo[0],
          contractCount: 'N/A',
          btcSize: 'N/A',
          entryPrice: 'N/A', 
          isLong: false,
          error: `解密失败: ${error.message}` 
        };
      }
    }
  }

  /**
   * 格式化余额揭示信息
   */
  static formatBalanceReveal(latestBalanceReveal: any): BalanceRevealInfo | null {
    if (latestBalanceReveal && latestBalanceReveal[0] > 0) {
      return {
        amount: latestBalanceReveal[0].toString(),
        timestamp: new Date(Number(latestBalanceReveal[1]) * 1000).toLocaleString()
      };
    }
    return null;
  }
}

// Hooks 封装 - 为了保持与现有代码的兼容性
export const useTradingContracts = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  // 检查用户是否已注册
  const useIsRegistered = () => useReadContract({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // 获取当前 BTC 价格
  const useBtcPrice = () => useReadContract({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getCurrentBtcPrice',
    args: [],
  });

  // 获取用户余额（加密的）
  const useEncryptedBalance = () => useReadContract({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getBalance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // 获取用户持仓ID列表
  const useUserPositionIds = () => useReadContract({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getUserPositionIds',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // 获取用户最新的余额揭示记录
  const useLatestBalanceReveal = () => useReadContract({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getLatestBalanceReveal',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // 查询持仓信息
  const usePosition = (positionId: string) => useReadContract({
    address: CONTRACTS.TRADER.address,
    abi: CONTRACTS.TRADER.abi,
    functionName: 'getPosition',
    args: positionId ? [BigInt(positionId)] : undefined,
    query: {
      enabled: !!positionId,
    },
  });

  // 合约写操作
  const useContractOperations = () => {
    const { writeContract: register, data: registerData } = useWriteContract();
    const { writeContract: openPosition, data: openPositionData } = useWriteContract();
    const { writeContract: closePosition, data: closePositionData } = useWriteContract();
    const { writeContract: revealBalance, data: revealBalanceData } = useWriteContract();

    // 等待交易完成的状态
    const { isLoading: isRegistering } = useWaitForTransactionReceipt({ hash: registerData });
    const { isLoading: isOpening } = useWaitForTransactionReceipt({ hash: openPositionData });
    const { isLoading: isClosing } = useWaitForTransactionReceipt({ hash: closePositionData });
    const { isLoading: isRevealing } = useWaitForTransactionReceipt({ hash: revealBalanceData });

    return {
      register,
      openPosition,
      closePosition,
      revealBalance,
      isRegistering,
      isOpening,
      isClosing,
      isRevealing,
    };
  };

  return {
    address,
    walletClient,
    useIsRegistered,
    useBtcPrice,
    useEncryptedBalance,
    useUserPositionIds,
    useLatestBalanceReveal,
    usePosition,
    useContractOperations,
  };
};

// 导出合约服务
export { CONTRACTS } from './base-contracts';







