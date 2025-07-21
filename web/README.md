# Hush Trading Frontend

隐私保护的加密货币交易平台前端界面。

## 功能特性

- 🔐 钱包连接 (RainbowKit)
- 📝 用户注册
- 📊 交易界面
- 🌙 暗黑模式支持
- 🎨 现代化 UI (shadcn/ui)

## 技术栈

- React Router
- RainbowKit + Wagmi
- Tailwind CSS
- shadcn/ui 组件库

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置合约地址

在 `lib/contracts.ts` 文件中更新合约地址：

```typescript
export const CONTRACTS = {
  TRADER: {
    address: '0x你的合约地址' as `0x${string}`,
    // ...
  }
}
```

### 3. 配置 WalletConnect

在 `lib/wagmi.ts` 文件中更新项目 ID：

```typescript
export const config = getDefaultConfig({
  appName: 'Hush Trading',
  projectId: '你的_WALLETCONNECT_PROJECT_ID',
  // ...
});
```

### 4. 启动开发服务器

```bash
npm run dev
```

## 项目结构

```
web/
├── app/
│   ├── components/
│   │   ├── navbar.tsx          # 导航栏
│   │   ├── trading-interface.tsx # 交易界面
│   │   └── providers.tsx       # 钱包提供者
│   ├── routes/
│   │   └── home.tsx           # 主页面
│   └── root.tsx               # 根组件
├── lib/
│   ├── contracts.ts           # 合约配置
│   ├── utils.ts              # 工具函数
│   └── wagmi.ts              # Wagmi 配置
└── components.json           # shadcn/ui 配置
```

## 开发指南

### 添加新的合约交互

1. 在 `lib/contracts.ts` 中添加合约 ABI
2. 在组件中使用 `useContractRead` 和 `useContractWrite` hooks
3. 处理交易状态和错误

### 样式定制

项目使用 Tailwind CSS 和 shadcn/ui，可以在 `app/app.css` 中自定义主题。

## 部署

构建生产版本：

```bash
npm run build
```

## 注意事项

- 确保合约已正确部署到 Sepolia 测试网
- 更新合约地址和 ABI
- 配置正确的 WalletConnect Project ID
