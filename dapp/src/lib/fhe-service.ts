import { initSDK, createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";
import type { FhevmInstance, DecryptedResults } from "@zama-fhe/relayer-sdk/bundle";
import type { Signer } from "ethers";
import type { WalletClient } from "viem";


// 扩展 Window 接口以包含 ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

let fheInstance: FhevmInstance | null = null;

function getFheInstance(): FhevmInstance {
  if (!fheInstance) {
    throw new Error("FHE 实例未初始化");
  }
  return fheInstance;
}

export class FHEService {
  private static instance: FHEService;
  private isInitialized = false;
  private hasFailed = false;

  private constructor() {}

  static getInstance(): FHEService {
    if (!FHEService.instance) {
      FHEService.instance = new FHEService();
    }
    return FHEService.instance;
  }

  /** 初始化 FHE SDK 并连接 MetaMask 到 Sepolia */
  async initialize() {
    if (this.isInitialized || this.hasFailed) return;
    try {
      await initSDK();

      if (!window.ethereum) {
        throw new Error("未检测到以太坊提供者，请安装 MetaMask。");
      }

      // 切换或添加 Sepolia
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia",
                nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } else {
          console.warn("切换网络失败，可能已在其它网络：", switchError);
        }
      }
      const config = { ...SepoliaConfig, network: window.ethereum };
      fheInstance = await createInstance(config);

      this.isInitialized = true;
      console.log("✅ FHE SDK 初始化完成");
    } catch (err) {
      console.error("❌ 初始化 FHE SDK 失败：", err);
      this.hasFailed = true;
      throw err;
    }
  }

  /** 创建加密输入实例 */
  createEncryptedInput(contractAddress: string, userAddress: string) {
    if (!this.isInitialized) throw new Error("FHE 服务未初始化");
    return getFheInstance().createEncryptedInput(contractAddress, userAddress);
  }

  /**
   * 使用 ethers Signer 签名并解密多个 ciphertext handles
   * @param handles 密文句柄数组
   * @param contractAddress 合约地址
   * @param signer ethers Signer 实例（含 address）
   */
  async decryptMultipleValues(
    handles: string[],
    contractAddress: string,
    signer: Signer
  ): Promise<DecryptedResults> {
    if (!this.isInitialized) throw new Error("FHE 服务未初始化");

    const instance = getFheInstance();

    // 1. 生成用户临时密钥对
    const keypair = instance.generateKeypair();
    const publicKey = keypair.publicKey;
    const privateKey = keypair.privateKey;

    // 2. 构造 EIP-712 签名请求
    const startTimestamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10"; // 可按需调整
    const contractAddresses = [contractAddress];
    const eip712 = instance.createEIP712(
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays
    );

    // 3. 使用 ethers Signer 签名 (signTypedData)
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    // 去除 0x 前缀
    const sig = signature.replace(/^0x/, "");

    // 4. 调用 FHEVM SDK 进行解密
    const handlePairs = handles.map(handle => ({ handle, contractAddress }));
    const results = await instance.userDecrypt(
      handlePairs,
      privateKey,
      publicKey,
      sig,
      contractAddresses,
      await signer.getAddress(),
      startTimestamp,
      durationDays
    );

    return results;
  }

  /**
   * 解密单个 ciphertext handle
   * @param handle 密文句柄
   * @param contractAddress 合约地址
   * @param signer ethers Signer 实例
   */
  async decryptSingleValue(
    handle: string,
    contractAddress: string,
    signer: Signer
  ): Promise<any> {
    const results = await this.decryptMultipleValues([handle], contractAddress, signer);
    return results[handle];
  }

  /**
   * 使用 WalletClient 解密多个 ciphertext handles
   * @param handles 密文句柄数组
   * @param contractAddress 合约地址
   * @param walletClient wagmi WalletClient 实例
   */
  async decryptMultipleValuesWithWalletClient(
    handles: string[],
    contractAddress: string,
    walletClient: WalletClient
  ): Promise<DecryptedResults> {
    if (!this.isInitialized) throw new Error("FHE 服务未初始化");
    if (!walletClient.account) throw new Error("钱包账户未连接");

    const instance = getFheInstance();

    // 1. 生成用户临时密钥对
    const keypair = instance.generateKeypair();
    const publicKey = keypair.publicKey;
    const privateKey = keypair.privateKey;

    // 2. 构造 EIP-712 签名请求
    const startTimestamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10"; // 可按需调整
    const contractAddresses = [contractAddress];
    const eip712 = instance.createEIP712(
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays
    );
    // 3. 使用 WalletClient 签名
    const signature = await walletClient.signTypedData({
      account: walletClient.account,
      domain: {
        ...eip712.domain,
        verifyingContract: eip712.domain.verifyingContract as `0x${string}`,
      },
      types: eip712.types,
      primaryType: 'UserDecryptRequestVerification',
      message: eip712.message,
    });
    
    // 去除 0x 前缀
    const sig = signature.replace(/^0x/, "");
console.log(sig,'???');
    // 4. 调用 FHEVM SDK 进行解密
    const handlePairs = handles.map(handle => ({ handle, contractAddress }));
    const results = await instance.userDecrypt(
      handlePairs,
      privateKey,
      publicKey,
      sig,
      contractAddresses,
      walletClient.account?.address || '',
      startTimestamp,
      durationDays
    );

    return results;
  }

  isReady(): boolean {
    return this.isInitialized && fheInstance !== null;
  }
  hasInitializationFailed(): boolean {
    return this.hasFailed;
  }
}

// 导出单例
export const fheService = FHEService.getInstance();
