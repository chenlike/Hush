# 余额解密功能测试

## 功能概述

我们已经实现了基于FHE（全同态加密）的余额解密功能，参考了你提供的测试代码。主要功能包括：

1. **获取加密余额**：从智能合约获取用户的加密余额（USD和BTC）
2. **用户签名**：使用EIP712标准获取用户签名
3. **FHE解密**：使用Zama FHE SDK进行解密
4. **格式化显示**：将解密结果格式化为可读的余额

## 实现细节

### FHE服务 (`web/lib/fhe-service.ts`)

添加了 `decryptBalance` 方法：

```typescript
async decryptBalance(encryptedHandles: string[], contractAddress: string, userAddress: string) {
  // 1. 生成FHE密钥对（用于解密）
  const keypair = instance.generateKeypair();
  
  // 2. 创建EIP712签名数据
  const eip712 = instance.createEIP712(keypair.publicKey, [contractAddress], startTimestamp, durationDays);
  
  // 3. 使用MetaMask等钱包获取用户签名
  const signature = await window.ethereum.request({
    method: 'eth_signTypedData_v4',
    params: [userAddress, JSON.stringify(eip712Data)]
  });
  
  // 4. 执行解密（使用FHE密钥对和钱包签名）
  const decryptedResults = await instance.userDecrypt(encryptedHandles, keypair.privateKey, keypair.publicKey, signature, [contractAddress], userAddress, startTimestamp, durationDays);
  
  return decryptedResults;
}
```

### 余额显示组件 (`web/app/components/balance-display.tsx`)

主要功能：

1. **获取用户注册状态**：检查用户是否已注册
2. **获取加密余额**：从合约获取 `(euint64, euint64)` 格式的余额
3. **手动解密**：用户点击按钮触发解密
4. **格式化显示**：将解密结果转换为可读格式

## 测试步骤

### 1. 环境准备
- 确保连接到 Sepolia 测试网
- 确保钱包中有足够的测试ETH
- 确保FHE SDK已正确初始化

### 2. 用户注册
- 连接钱包
- 点击"注册"按钮
- 等待交易确认

### 3. 测试余额解密
- 在余额显示组件中，点击"解密余额"按钮
- 钱包会弹出签名请求
- 确认签名后，等待解密完成
- 查看解密后的余额显示

### 4. 预期结果
- 初始余额：USD = $10,000.00, BTC = 0.00000000
- 解密过程需要用户签名
- 解密成功后显示格式化的余额

## 技术要点

### 参考的测试代码模式
```typescript
// 生成FHE密钥对（用于解密）
const aliceKeypair = fhevm.generateKeypair();

// 创建EIP712签名数据
const aliceEip712 = fhevm.createEIP712(aliceKeypair.publicKey, [contractAddress], startTimestamp, durationDays);

// 使用钱包签名（在EVM环境中）
const aliceSignature = await signers.alice.signTypedData(aliceEip712.domain, { UserDecryptRequestVerification: aliceEip712.types.UserDecryptRequestVerification }, aliceEip712.message);

// 执行解密（使用FHE密钥对和钱包签名）
const decrytepResults = await fhevm.userDecrypt([{ handle: encryptedBool, contractAddress: contractAddress }, { handle: encryptedUint32, contractAddress: contractAddress }, { handle: encryptedUint64, contractAddress: contractAddress }], aliceKeypair.privateKey, aliceKeypair.publicKey, aliceSignature, [contractAddress], signers.alice.address, startTimestamp, durationDays);
```

### 关键改进
1. **用户友好的界面**：添加了手动解密按钮，避免自动触发
2. **错误处理**：完善的错误处理和用户提示
3. **状态管理**：清晰的状态显示（解密中、成功、失败）
4. **格式化显示**：考虑小数精度的余额格式化

## 注意事项

1. **网络要求**：必须在Sepolia测试网上运行
2. **钱包支持**：需要支持EIP712签名的钱包（如MetaMask）
3. **FHE初始化**：首次使用需要初始化FHE SDK
4. **用户签名**：每次解密都需要用户签名确认

## 故障排除

### 常见问题
1. **FHE初始化失败**：检查网络连接和钱包状态
2. **签名失败**：确保钱包支持EIP712签名
3. **解密失败**：检查合约地址和用户注册状态
4. **余额显示错误**：检查小数精度设置

### 调试信息
- 查看浏览器控制台的错误信息
- 检查FHE SDK的初始化状态
- 验证合约调用的返回值 