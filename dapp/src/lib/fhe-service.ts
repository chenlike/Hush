import { initSDK, createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";
import type { FhevmInstance, DecryptedResults } from "@zama-fhe/relayer-sdk/bundle";
import type { Signer } from "ethers";
import type { WalletClient } from "viem";


// Extend Window interface to include ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

let fheInstance: FhevmInstance | null = null;

function getFheInstance(): FhevmInstance {
  if (!fheInstance) {
    throw new Error("FHE instance not initialized");
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

  /** Initialize FHE SDK and connect MetaMask to Sepolia */
  async initialize() {
    if (this.isInitialized || this.hasFailed) return;
    try {
      await initSDK();

      if (!window.ethereum) {
        throw new Error("Ethereum provider not detected, please install MetaMask.");
      }

      // Switch to or add Sepolia
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
          console.warn("Failed to switch network, may already be on another network:", switchError);
        }
      }
      const config = { ...SepoliaConfig, network: window.ethereum };
      fheInstance = await createInstance(config);

      this.isInitialized = true;
      console.log("✅ FHE SDK initialization completed");
    } catch (err) {
      console.error("❌ FHE SDK initialization failed:", err);
      this.hasFailed = true;
      throw err;
    }
  }

  /** Create encrypted input instance */
  createEncryptedInput(contractAddress: string, userAddress: string) {
    if (!this.isInitialized) throw new Error("FHE service not initialized");
    return getFheInstance().createEncryptedInput(contractAddress, userAddress);
  }

  /**
   * Sign and decrypt multiple ciphertext handles using ethers Signer
   * @param handles Array of ciphertext handles
   * @param contractAddress Contract address
   * @param signer ethers Signer instance (with address)
   */
  async decryptMultipleValues(
    handles: string[],
    contractAddress: string,
    signer: Signer
  ): Promise<DecryptedResults> {
    if (!this.isInitialized) throw new Error("FHE service not initialized");

    const instance = getFheInstance();

    // 1. Generate user temporary keypair
    const keypair = instance.generateKeypair();
    const publicKey = keypair.publicKey;
    const privateKey = keypair.privateKey;

    // 2. Construct EIP-712 signature request
    const startTimestamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10"; // Can be adjusted as needed
    const contractAddresses = [contractAddress];
    const eip712 = instance.createEIP712(
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays
    );

    // 3. Sign using ethers Signer (signTypedData)
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    // Remove 0x prefix
    const sig = signature.replace(/^0x/, "");

    // 4. Call FHEVM SDK for decryption
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
   * Decrypt a single ciphertext handle
   * @param handle Ciphertext handle
   * @param contractAddress Contract address
   * @param signer ethers Signer instance
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
   * Decrypt multiple ciphertext handles using WalletClient
   * @param handles Array of ciphertext handles
   * @param contractAddress Contract address
   * @param walletClient wagmi WalletClient instance
   */
  async decryptMultipleValuesWithWalletClient(
    handles: string[],
    contractAddress: string,
    walletClient: WalletClient
  ): Promise<DecryptedResults> {
    if (!this.isInitialized) throw new Error("FHE service not initialized");
    if (!walletClient.account) throw new Error("Wallet account not connected");

    const instance = getFheInstance();

    // 1. Generate user temporary keypair
    const keypair = instance.generateKeypair();
    const publicKey = keypair.publicKey;
    const privateKey = keypair.privateKey;

    // 2. Construct EIP-712 signature request
    const startTimestamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10"; // Can be adjusted as needed
    const contractAddresses = [contractAddress];
    const eip712 = instance.createEIP712(
      publicKey,
      contractAddresses,
      startTimestamp,
      durationDays
    );
    // 3. Sign using WalletClient
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
    
    // Remove 0x prefix
    const sig = signature.replace(/^0x/, "");
    // 4. Call FHEVM SDK for decryption
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

// Export singleton
export const fheService = FHEService.getInstance();
