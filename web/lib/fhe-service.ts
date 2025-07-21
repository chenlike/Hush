import { initSDK, createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/bundle";
let fheInstance: FhevmInstance | null = null;

function getFheInstance(): FhevmInstance {
  if (!fheInstance) {
    throw new Error("FHE instance not initialized");
  }
  return fheInstance!;
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

  async initialize() {
    if (this.isInitialized || this.hasFailed) return;

    try {
      await initSDK(); // Load FHE WASM
      
      // 检查是否有可用的以太坊提供者
      if (!window.ethereum) {
        throw new Error('No Ethereum provider found. Please install MetaMask or another wallet.');
      }

      // 确保连接到 Sepolia 网络
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
        });
      } catch (switchError: any) {
        // 如果 Sepolia 网络不存在，尝试添加它
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xaa36a7',
                chainName: 'Sepolia',
                nativeCurrency: {
                  name: 'Sepolia Ether',
                  symbol: 'SEP',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              }],
            });
          } catch (addError) {
            console.error('Failed to add Sepolia network:', addError);
          }
        }
      }

      const config = { ...SepoliaConfig, network: window.ethereum };
      console.log("FHE config", config);
      fheInstance = await createInstance(config);
      console.log("fheInstance", fheInstance);
      this.isInitialized = true;
      console.log('FHE SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FHE SDK:', error);
      this.hasFailed = true;
      throw error;
    }
  }

  // 创建加密输入实例
  createEncryptedInput(contractAddress: string, userAddress: string) {
    if (!this.isInitialized) {
      throw new Error('FHE service not initialized');
    }
    
    const instance = getFheInstance();
    return instance.createEncryptedInput(contractAddress, userAddress);
  }

  isReady(): boolean {
    return this.isInitialized && fheInstance !== null;
  }

  hasInitializationFailed(): boolean {
    return this.hasFailed;
  }
}

export const fheService = FHEService.getInstance(); 