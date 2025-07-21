# 可升级合约说明

本项目中的所有合约都已经修改为可升级合约，使用OpenZeppelin的UUPS代理模式。

## 修改的合约

1. **RevealStorage.sol** - 存储合约
2. **PriceOracle.sol** - 价格预言机合约  
3. **Trader.sol** - 交易合约

## 主要变更

### 1. 继承关系
所有合约现在都继承以下OpenZeppelin合约：
- `Initializable` - 提供初始化功能
- `UUPSUpgradeable` - 提供UUPS升级功能
- `OwnableUpgradeable` - 提供所有权管理

### 2. 构造函数和初始化
- 构造函数现在只调用 `_disableInitializers()`
- 添加了 `initialize()` 函数作为初始化函数
- 使用 `initializer` 修饰符确保只能初始化一次

### 3. 升级授权
- 添加了 `_authorizeUpgrade()` 函数，只有合约所有者可以升级

## 部署方法

### 1. 安装依赖
确保package.json中包含了必要的依赖：
```json
{
  "dependencies": {
    "@openzeppelin/contracts-upgradeable": "^5.4.0"
  },
  "devDependencies": {
    "@openzeppelin/hardhat-upgrades": "^3.9.1"
  }
}
```

### 2. 部署合约
```bash
npm run deploy
```

这将使用代理模式部署所有合约。

## 升级合约

### 1. 修改合约代码
当需要升级合约时，修改相应的合约文件。

### 2. 升级步骤
```bash
# 运行升级脚本（会自动从部署记录中获取代理合约地址）
npm run upgrade
```

或者手动运行：
```bash
npx hardhat deploy --tags upgrade --network sepolia
```

## 注意事项

### 1. 存储布局
- 升级时不能删除或重新排序现有的状态变量
- 只能在现有变量之后添加新的状态变量

### 2. 初始化函数
- 每个合约只能初始化一次
- 升级时不会重新执行初始化函数

### 3. 代理模式
- 用户与代理合约交互
- 实现合约包含实际逻辑
- 升级时只更新实现合约，代理地址保持不变

### 4. 权限控制
- 只有合约所有者可以升级合约
- 使用 `onlyOwner` 修饰符控制升级权限

## 验证合约

部署后，可以使用以下命令验证合约：
```bash
npx hardhat verify --network sepolia <代理合约地址>
```

## 测试

运行测试以确保升级后的合约功能正常：
```bash
npm test
```

## 安全考虑

1. **升级权限**：确保只有可信的地址拥有升级权限
2. **测试**：在升级前充分测试新版本
3. **时间锁**：考虑添加时间锁机制
4. **多签**：考虑使用多签钱包作为合约所有者

## 故障排除

### 常见问题

1. **初始化失败**：确保只调用一次初始化函数
2. **升级失败**：检查存储布局是否兼容
3. **权限错误**：确保调用者拥有升级权限

### 调试命令

```bash
# 检查合约是否已初始化
npx hardhat console --network sepolia
> const contract = await ethers.getContractAt("ContractName", "proxyAddress")
> await contract.owner()
```

## 更多信息

- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [UUPS Proxy Pattern](https://docs.openzeppelin.com/contracts/4.x/api/proxy#UUPSUpgradeable)
- [Hardhat Upgrades Plugin](https://docs.openzeppelin.com/upgrades-plugins/1.x/hardhat-upgrades) 