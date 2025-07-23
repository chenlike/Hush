import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { PriceOracle, PriceOracle__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import * as hre from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

async function deployFixture() {
  // 部署价格预言机（使用模拟的聚合器地址）
  const mockAggregatorAddress = "0x0000000000000000000000000000000000000001";
  const oracleFactory = (await ethers.getContractFactory("PriceOracle")) as PriceOracle__factory;
  const priceOracle = await oracleFactory.deploy(mockAggregatorAddress);
  const priceOracleAddress = await priceOracle.getAddress();

  // 启用手动模式并设置测试价格
  await priceOracle.setManualMode(true);
  await priceOracle.setManualPrice(50000); // $50,000

  // 部署PositionTrader合约（构造函数参数：priceOracle地址，初始资金1000 USD）
  const factory = (await ethers.getContractFactory("PositionTrader")) as any;
  const positionTrader = (await factory.deploy(priceOracleAddress, 1000)) as any;
  const positionTraderAddress = await positionTrader.getAddress();

  return { 
    positionTrader, 
    positionTraderAddress, 
    priceOracle, 
    priceOracleAddress
  };
}

describe("PositionTrader 完整测试", function () {
  let signers: Signers;
  let positionTrader: any;
  let positionTraderAddress: string;
  let priceOracle: PriceOracle;
  let priceOracleAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { 
      deployer: ethSigners[0], 
      alice: ethSigners[1], 
      bob: ethSigners[2], 
      charlie: ethSigners[3] 
    };
  });

  beforeEach(async () => {
    // 检查是否在FHEVM模拟环境中运行
    if (!fhevm.isMock) {
      throw new Error(`此hardhat测试套件只能在FHEVM模拟环境中运行`);
    }
    ({ 
      positionTrader, 
      positionTraderAddress, 
      priceOracle, 
      priceOracleAddress
    } = await deployFixture());
  });

  describe("合约部署和初始化", function () {
    it("应该正确部署合约", async function () {
      expect(positionTraderAddress).to.be.a('string');
      expect(priceOracleAddress).to.be.a('string');
    });

    it("应该正确设置价格预言机地址", async function () {
      const oracleAddress = await positionTrader.priceOracleAddress();
      expect(oracleAddress).to.equal(priceOracleAddress);
    });

    it("应该正确设置初始虚拟资产", async function () {
      const initialCash = await positionTrader.INITIAL_CASH_BASE();
      expect(initialCash).to.equal(1000);
    });

    it("应该正确获取当前BTC价格", async function () {
      const price = await positionTrader.getCurrentBtcPrice();
      expect(price).to.equal(50000);
    });
  });

  describe("用户注册功能", function () {
    it("应该允许用户注册", async function () {
      // 检查用户初始状态
      expect(await positionTrader.isRegistered(signers.alice.address)).to.be.false;

      // 用户注册
      const tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();

      // 验证注册状态
      expect(await positionTrader.isRegistered(signers.alice.address)).to.be.true;
    });

    it("不应该允许用户重复注册", async function () {
      // 第一次注册
      let tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();

      // 尝试第二次注册，应该失败
      await expect(
        positionTrader.connect(signers.alice).register()
      ).to.be.revertedWith("User already registered");
    });

    it("应该允许多个用户独立注册", async function () {
      // Alice 注册
      let tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();

      // Bob 注册
      tx = await positionTrader.connect(signers.bob).register();
      await tx.wait();

      // 验证两个用户都已注册
      expect(await positionTrader.isRegistered(signers.alice.address)).to.be.true;
      expect(await positionTrader.isRegistered(signers.bob.address)).to.be.true;
    });

    it("注册时应该触发UserRegistered事件", async function () {
      await expect(positionTrader.connect(signers.alice).register())
        .to.emit(positionTrader, "UserRegistered")
        .withArgs(signers.alice.address);
    });
  });

  describe("余额查询功能", function () {
    beforeEach(async () => {
      // 注册用户
      const tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();
    });

    it("应该正确返回注册用户的余额", async function () {
      // 获取余额（这是密文）
      const encryptedBalance = await positionTrader.getBalance(signers.alice.address);
      
      // 验证返回的是有效的FHE密文格式
      expect(encryptedBalance).to.be.a('string');
      expect(encryptedBalance.length).to.be.greaterThan(0);
      
      // 解密余额并验证初始金额
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // 验证初始余额为1000 USD
      expect(clearBalance).to.equal(1000);
    });

    it("未注册用户查询余额应该失败", async function () {
      await expect(
        positionTrader.getBalance(signers.bob.address)
      ).to.be.revertedWith("User not registered");
    });

    it("应该支持余额解密请求", async function () {
      const requestTx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await requestTx.wait();
      
      // 验证事件
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      expect(event).to.not.be.undefined;
    });

    it("应该在交易后正确更新余额", async function () {
      // 获取初始余额
      const initialEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const initialClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        initialEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      expect(initialClearBalance).to.equal(1000);
      
      // 开仓10张合约
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true)
        .add64(10)
        .encrypt();
      
      await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      
      // 获取开仓后余额
      const afterOpenEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterOpenClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterOpenEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // 开仓后余额应该减少（被用作保证金）
      expect(afterOpenClearBalance).to.be.lessThan(initialClearBalance);
    });

    it("应该正确获取最新的余额解密记录", async function () {
      const [amount, timestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      
      // 初始时应该没有解密记录
      expect(amount).to.equal(0);
      expect(timestamp).to.equal(0);
    });
  });

  describe("价格获取功能", function () {
    it("应该正确获取调整后的BTC价格", async function () {
      const price = await positionTrader.getCurrentBtcPrice();
      expect(price).to.equal(50000);
    });

    it("价格变化时应该反映在合约中", async function () {
      // 更改价格
      await priceOracle.setManualPrice(60000);
      
      const newPrice = await positionTrader.getCurrentBtcPrice();
      expect(newPrice).to.equal(60000);
    });
  });

  describe("持仓相关功能", function () {
    beforeEach(async () => {
      // 注册用户
      const tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();
    });

    it("应该正确获取用户持仓ID列表", async function () {
      const positions = await positionTrader.getUserPositionIds(signers.alice.address);
      expect(positions).to.be.an('array');
      expect(positions.length).to.equal(0); // 初始时没有持仓
    });

    it("应该能查询持仓信息（即使持仓不存在）", async function () {
      const [owner, contractCount, btcSize, entryPrice, isLong] = 
        await positionTrader.getPosition(1);
      
      // 不存在的持仓应该返回零地址
      expect(owner).to.equal("0x0000000000000000000000000000000000000000");
    });
  });

  describe("访问控制测试", function () {
    it("未注册用户调用需要注册的函数应该失败", async function () {
      await expect(
        positionTrader.connect(signers.alice).revealMyBalance()
      ).to.be.revertedWith("User not registered");
    });

    it("非持仓所有者访问持仓功能应该有适当的保护", async function () {
      // 这里测试访问控制逻辑，实际的开仓/平仓功能需要更复杂的设置
      // 目前验证函数存在性
      expect(positionTrader.openPosition).to.be.a('function');
      expect(positionTrader.closePosition).to.be.a('function');
    });
  });

  describe("事件验证", function () {
    it("用户注册应该触发正确的事件", async function () {
      await expect(positionTrader.connect(signers.alice).register())
        .to.emit(positionTrader, "UserRegistered")
        .withArgs(signers.alice.address);
    });

    it("余额解密请求应该触发正确的事件", async function () {
      // 先注册用户
      await positionTrader.connect(signers.alice).register();
      
      await expect(positionTrader.connect(signers.alice).revealMyBalance())
        .to.emit(positionTrader, "DecryptionRequested");
    });
  });

  describe("余额揭示功能", function () {
    beforeEach(async () => {
      // 注册用户并进行一些交易以改变余额
      await positionTrader.connect(signers.alice).register();
      await positionTrader.connect(signers.bob).register();
    });

    it("应该能成功请求余额解密", async function () {
      const tx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await tx.wait();
      
      // 验证DecryptionRequested事件
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(signers.alice.address);
      expect(event.args[1]).to.be.a('bigint'); // requestId
      expect(event.args[2]).to.be.a('bigint'); // timestamp
    });

    it("未注册用户不应该能请求余额解密", async function () {
      await expect(
        positionTrader.connect(signers.charlie).revealMyBalance()
      ).to.be.revertedWith("User not registered");
    });

    it("应该正确处理解密回调", async function () {
      // 发起解密请求
      const tx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await tx.wait();
      
      const requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      const requestId = requestEvent.args[1];
      const timestamp = requestEvent.args[2];
      
      // 等待FHEVM解密预言机完成解密
      await hre.fhevm.awaitDecryptionOracle();
      
      // 验证解密记录已更新
      const [amount, recordTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(1000); // 初始余额
      expect(recordTimestamp).to.equal(timestamp);
    });

    it("应该正确获取最新的余额解密记录", async function () {
      // 初始时应该没有解密记录
      const [initialAmount, initialTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(initialAmount).to.equal(0);
      expect(initialTimestamp).to.equal(0);
      
      // 发起解密请求
      const tx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await tx.wait();
      const requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      const requestId = requestEvent.args[1];
      const timestamp = requestEvent.args[2];
      
      // 等待FHEVM解密预言机完成解密
      await hre.fhevm.awaitDecryptionOracle();
      
      // 验证解密记录已更新
      const [amount, recordTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(1000); // 初始余额
      expect(recordTimestamp).to.equal(timestamp);
    });

    it("未注册用户不应该能查询解密记录", async function () {
      await expect(
        positionTrader.getLatestBalanceReveal(signers.charlie.address)
      ).to.be.revertedWith("User not registered");
    });

    it("应该支持多次解密请求和记录更新", async function () {
      // 第一次解密请求
      let tx = await positionTrader.connect(signers.alice).revealMyBalance();
      let receipt = await tx.wait();
      let requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      let requestId = requestEvent.args[1];
      let timestamp1 = requestEvent.args[2];
      
      // 等待第一次解密完成
      await hre.fhevm.awaitDecryptionOracle();
      
      // 验证第一次记录
      let [amount, recordTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(1000);
      expect(recordTimestamp).to.equal(timestamp1);
      
      // 等待一下以确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 模拟一笔交易改变余额（开仓）
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true)
        .add64(50)
        .encrypt();
      
      await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      
      // 第二次解密请求
      tx = await positionTrader.connect(signers.alice).revealMyBalance();
      receipt = await tx.wait();
      requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      requestId = requestEvent.args[1];
      let timestamp2 = requestEvent.args[2];
      
      // 等待第二次解密完成
      await hre.fhevm.awaitDecryptionOracle();
      
      // 验证记录已更新为最新的（开仓后余额应该是950）
      [amount, recordTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(950);
      expect(recordTimestamp).to.equal(timestamp2);
      expect(timestamp2).to.be.greaterThan(timestamp1);
    });

    it("应该在交易后能正确解密更新的余额", async function () {
      // 先进行一笔交易改变余额
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true)
        .add64(100)
        .encrypt();
      
      await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      
      // 请求解密交易后的余额
      const tx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await tx.wait();
      const requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      const requestId = requestEvent.args[1];
      
      // 等待FHEVM解密预言机完成解密
      await hre.fhevm.awaitDecryptionOracle();
      
      // 验证解密的余额正确（开仓后应该是900）
      const [amount] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(900);
    });

    it("应该支持多用户独立的解密记录", async function () {
      // Alice的解密请求
      let tx = await positionTrader.connect(signers.alice).revealMyBalance();
      let receipt = await tx.wait();
      let requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      let aliceRequestId = requestEvent.args[1];
      
      // Bob的解密请求
      tx = await positionTrader.connect(signers.bob).revealMyBalance();
      receipt = await tx.wait();
      requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      let bobRequestId = requestEvent.args[1];
      
      // 等待FHEVM解密预言机完成所有解密请求
      await hre.fhevm.awaitDecryptionOracle();
      
      // 验证各自的记录
      const [aliceAmount] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      const [bobAmount] = await positionTrader.getLatestBalanceReveal(signers.bob.address);
      
      expect(aliceAmount).to.equal(1000);
      expect(bobAmount).to.equal(1000);
    });
  });

  describe("管理员功能", function () {
    it("合约所有者应该能更新价格预言机地址", async function () {
      const newOracleAddress = "0x1234567890123456789012345678901234567890";
      
      await expect(
        positionTrader.connect(signers.deployer).updatePriceOracle(newOracleAddress)
      ).to.emit(positionTrader, "PriceOracleUpdated")
        .withArgs(priceOracleAddress, newOracleAddress);
      
      expect(await positionTrader.priceOracleAddress()).to.equal(newOracleAddress);
    });

    it("非所有者不应该能更新价格预言机地址", async function () {
      const newOracleAddress = "0x1234567890123456789012345678901234567890";
      
      await expect(
        positionTrader.connect(signers.alice).updatePriceOracle(newOracleAddress)
      ).to.be.revertedWithCustomError(positionTrader, "OwnableUnauthorizedAccount");
    });

    it("不应该允许设置零地址作为价格预言机", async function () {
      await expect(
        positionTrader.connect(signers.deployer).updatePriceOracle("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("Invalid zero address");
    });
  });

  describe("常量和配置验证", function () {
    it("应该有正确的常量值", async function () {
      expect(await positionTrader.CONTRACT_USD_VALUE()).to.equal(1);
      expect(await positionTrader.BTC_PRECISION()).to.equal(100000000); // 1e8
      expect(await positionTrader.CALCULATION_PRECISION()).to.equal(100000000); // 1e8
    });
  });

  describe("开仓功能测试", function () {
    beforeEach(async () => {
      // 注册用户
      const tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();
    });

    it("应该能成功开多头仓位并验证余额变化", async function () {
      // 获取初始余额
      const initialEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const initialClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        initialEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      expect(initialClearBalance).to.equal(1000);
      
      // 准备加密输入
      const contractCount = 100; // 100 USD
      const isLong = true;
      
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(isLong)
        .add64(contractCount)
        .encrypt();
      
      // 开仓
      const tx = await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0], // isLong
        encryptedInput.handles[1], // usdAmount
        encryptedInput.inputProof
      );
      const receipt = await tx.wait();
      
      // 验证事件
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionOpened"
      );
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(signers.alice.address);
      expect(event.args[2]).to.equal(50000); // 当前价格
      
      // 验证余额减少
      const afterEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      expect(afterClearBalance).to.equal(initialClearBalance - BigInt(contractCount));
      
      // 验证持仓信息
      const positions = await positionTrader.getUserPositionIds(signers.alice.address);
      expect(positions.length).to.equal(1);
      
      const [owner, encryptedContractCount, encryptedBtcSize, entryPrice, encryptedIsLong] = 
        await positionTrader.getPosition(positions[0]);
      
      expect(owner).to.equal(signers.alice.address);
      expect(entryPrice).to.equal(50000);
      
      // 解密持仓数据
      const clearContractCount = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedContractCount,
        positionTraderAddress,
        signers.alice
      );
      expect(clearContractCount).to.equal(contractCount);
      
      const clearIsLong = await fhevm.userDecryptEbool(
        encryptedIsLong,
        positionTraderAddress,
        signers.alice
      );
      expect(clearIsLong).to.be.true;
    });

    it("应该能成功开空头仓位并验证数据准确性", async function () {
      const contractCount = 200; // 200 USD
      const isLong = false;
      
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(isLong)
        .add64(contractCount)
        .encrypt();
      
      const tx = await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      const receipt = await tx.wait();
      
      const positions = await positionTrader.getUserPositionIds(signers.alice.address);
      expect(positions.length).to.equal(1);
      
      // 验证空头仓位
      const [, , , , encryptedIsLong] = await positionTrader.getPosition(positions[0]);
      const clearIsLong = await fhevm.userDecryptEbool(
        encryptedIsLong,
        positionTraderAddress,
        signers.alice
      );
      expect(clearIsLong).to.be.false;
    });

    it("应该能在不同价格下开仓并验证BTC持仓大小", async function () {
      // 第一次开仓 - 价格 $50,000
      const amount1 = 100;
      let encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true)
        .add64(amount1)
        .encrypt();
      
      await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      
      // 改变价格到 $60,000
      await priceOracle.setManualPrice(60000);
      
      // 第二次开仓 - 价格 $60,000
      const amount2 = 120;
      encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(false)
        .add64(amount2)
        .encrypt();
      
      const tx = await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      const receipt = await tx.wait();
      
      // 验证第二次开仓的价格
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionOpened"
      );
      expect(event.args[2]).to.equal(60000);
      
      // 验证用户有两个持仓
      const positions = await positionTrader.getUserPositionIds(signers.alice.address);
      expect(positions.length).to.equal(2);
      
      // 验证BTC持仓大小计算正确
      const [, , encryptedBtcSize1] = await positionTrader.getPosition(positions[0]);
      const [, , encryptedBtcSize2] = await positionTrader.getPosition(positions[1]);
      
      const clearBtcSize1 = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBtcSize1,
        positionTraderAddress,
        signers.alice
      );
      
      const clearBtcSize2 = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBtcSize2,
        positionTraderAddress,
        signers.alice
      );
      
      // 第一个仓位: 100 USD / 50000 * 1e8 = 200000 satoshi
      expect(clearBtcSize1).to.equal(200000);
      // 第二个仓位: 120 USD / 60000 * 1e8 = 200000 satoshi
      expect(clearBtcSize2).to.equal(200000);
    });

    it("资金不足时开仓应该正确处理", async function () {
      // 尝试开超大仓位
      const largeContractCount = 1500; // 超过初始资金1000
      
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true)
        .add64(largeContractCount)
        .encrypt();
      
      // 在FHEVM中，资金不足不会直接revert，而是会将金额设为0
      const tx = await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      await tx.wait();
      
      // 验证余额没有变化（因为实际扣除金额为0）
      const encryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      expect(clearBalance).to.equal(1000); // 余额不变
    });
  });

  describe("平仓功能测试", function () {
    let positionId: number;
    let initialContractCount: number = 200;
    
    beforeEach(async () => {
      // 注册用户并开仓
      await positionTrader.connect(signers.alice).register();
      
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true) // 多头
        .add64(initialContractCount)
        .encrypt();
      
      const tx = await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionOpened"
      );
      positionId = event.args[1];
    });

    it("应该能成功平仓并验证余额变化", async function () {
      // 获取平仓前余额
      const beforeEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const beforeClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        beforeEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // 全部平仓
      const closeAmount = initialContractCount;
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(closeAmount)
        .encrypt();
      
      const tx = await positionTrader.connect(signers.alice).closePosition(
        positionId,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
      const receipt = await tx.wait();
      
      // 验证平仓事件
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionClosed"
      );
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(signers.alice.address);
      expect(event.args[1]).to.equal(positionId);
      expect(event.args[2]).to.equal(50000); // 平仓价格
      
      // 验证余额恢复（价格未变，应该恢复到初始状态）
      const afterEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // 由于价格未变，平仓后余额应该恢复到开仓前的水平
      expect(afterClearBalance).to.be.greaterThan(beforeClearBalance);
    });

    it("应该能在价格上涨后盈利平仓多头并验证盈利", async function () {
      // 获取平仓前余额
      const beforeEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const beforeClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        beforeEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // 价格上涨到 $55,000 (+10%)
      await priceOracle.setManualPrice(55000);
      
      const closeAmount = initialContractCount;
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(closeAmount)
        .encrypt();
      
      const tx = await positionTrader.connect(signers.alice).closePosition(
        positionId,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionClosed"
      );
      expect(event.args[2]).to.equal(55000); // 平仓价格
      
      // 验证盈利：价格上涨10%，多头应该盈利
      const afterEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // 盈利应该约为: 200 * 1.1 = 220, 总余额应该约为 800 + 220 = 1020
      expect(afterClearBalance).to.be.greaterThan(1000);
      expect(afterClearBalance).to.be.greaterThan(beforeClearBalance + BigInt(initialContractCount));
    });

    it("应该能在价格下跌后亏损平仓多头并验证亏损", async function () {
      // 获取平仓前余额
      const beforeEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const beforeClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        beforeEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // 价格下跌到 $45,000 (-10%)
      await priceOracle.setManualPrice(45000);
      
      const closeAmount = initialContractCount;
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(closeAmount)
        .encrypt();
      
      const tx = await positionTrader.connect(signers.alice).closePosition(
        positionId,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionClosed"
      );
      expect(event.args[2]).to.equal(45000); // 平仓价格
      
      // 验证亏损：价格下跌10%，多头应该亏损
      const afterEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // 亏损应该约为: 200 * 0.9 = 180, 总余额应该约为 800 + 180 = 980
      expect(afterClearBalance).to.be.lessThan(1000);
      expect(afterClearBalance).to.be.lessThan(beforeClearBalance + BigInt(initialContractCount));
    });

    it("非持仓所有者不应该能平仓", async function () {
      const closeAmount = 50;
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.bob.address)
        .add64(closeAmount)
        .encrypt();
      
      await expect(
        positionTrader.connect(signers.bob).closePosition(
          positionId,
          encryptedInput.handles[0],
          encryptedInput.inputProof
        )
      ).to.be.revertedWith("Not position owner");
    });

    it("不存在的持仓ID应该平仓失败", async function () {
      const nonExistentId = 9999;
      const closeAmount = 50;
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(closeAmount)
        .encrypt();
      
      await expect(
        positionTrader.connect(signers.alice).closePosition(
          nonExistentId,
          encryptedInput.handles[0],
          encryptedInput.inputProof
        )
      ).to.be.revertedWith("Not position owner");
    });

    it("应该支持部分平仓并验证余下持仓", async function () {
      // 部分平仓（平掉一半）
      const partialCloseAmount = initialContractCount / 2;
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(partialCloseAmount)
        .encrypt();
      
      const tx = await positionTrader.connect(signers.alice).closePosition(
        positionId,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
      await tx.wait();
      
      // 验证余下持仓
      const [, encryptedContractCount] = await positionTrader.getPosition(positionId);
      const clearContractCount = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedContractCount,
        positionTraderAddress,
        signers.alice
      );
      
      // 应该还剩一半持仓
      expect(clearContractCount).to.equal(BigInt(initialContractCount - partialCloseAmount));
    });
  });

  describe("复杂交易场景测试", function () {
    beforeEach(async () => {
      // 注册多个用户
      await positionTrader.connect(signers.alice).register();
      await positionTrader.connect(signers.bob).register();
      await positionTrader.connect(signers.charlie).register();
    });

    it("应该支持多用户同时交易", async function () {
      // Alice 开多头
      let encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true)
        .add64(10)
        .encrypt();
      await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      
      // Bob 开空头
      encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.bob.address)
        .addBool(false)
        .add64(15)
        .encrypt();
      await positionTrader.connect(signers.bob).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      
      // Charlie 开多头
      encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.charlie.address)
        .addBool(true)
        .add64(8)
        .encrypt();
      await positionTrader.connect(signers.charlie).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      
      // 验证各用户持仓
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(1);
      expect((await positionTrader.getUserPositionIds(signers.bob.address)).length).to.equal(1);
      expect((await positionTrader.getUserPositionIds(signers.charlie.address)).length).to.equal(1);
    });

    it("应该正确处理价格剧烈波动下的交易", async function () {
      // 获取Alice和Bob的初始余额
      const aliceInitialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      const bobInitialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.bob.address),
        positionTraderAddress,
        signers.bob
      );
      expect(aliceInitialBalance).to.equal(1000);
      expect(bobInitialBalance).to.equal(1000);

      // Alice 在 $50,000 开多头，投入20 USD
      let encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true)
        .add64(20)
        .encrypt();
      const tx1 = await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      const receipt1 = await tx1.wait();
      const alicePositionId = receipt1.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionOpened"
      ).args[1];

      // 验证Alice开仓后余额
      const aliceAfterOpenBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(aliceAfterOpenBalance).to.equal(BigInt(1000 - 20)); // 1000 - 20 = 980
      
      // 价格暴跌到 $30,000
      await priceOracle.setManualPrice(30000);
      
      // Bob 在低价开多头，投入25 USD
      encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.bob.address)
        .addBool(true)
        .add64(25)
        .encrypt();
      const tx2 = await positionTrader.connect(signers.bob).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      const receipt2 = await tx2.wait();
      const bobPositionId = receipt2.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionOpened"
      ).args[1];

      // 验证Bob开仓后余额
      const bobAfterOpenBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.bob.address),
        positionTraderAddress,
        signers.bob
      );
      expect(bobAfterOpenBalance).to.equal(BigInt(1000 - 25)); // 1000 - 25 = 975
      
      // 价格反弹到 $55,000
      await priceOracle.setManualPrice(55000);
      
      // Alice 盈利平仓（从50k到55k）
      // 预期盈利：20 USD * (55000/50000) = 22 USD
      let closeEncryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(20)
        .encrypt();
      await positionTrader.connect(signers.alice).closePosition(
        alicePositionId,
        closeEncryptedInput.handles[0],
        closeEncryptedInput.inputProof
      );

      // 验证Alice平仓后余额
      const aliceAfterCloseBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      // Alice应该盈利：20 * 55000/50000 = 22，所以余额应该是 980 + 22 = 1002
      expect(aliceAfterCloseBalance).to.equal(BigInt(1002));
      
      // Bob 大幅盈利平仓（从30k到55k）
      // 预期盈利：25 USD * (55000/30000) ≈ 45.83 USD
      closeEncryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.bob.address)
        .add64(25)
        .encrypt();
      await positionTrader.connect(signers.bob).closePosition(
        bobPositionId,
        closeEncryptedInput.handles[0],
        closeEncryptedInput.inputProof
      );

      // 验证Bob平仓后余额
      const bobAfterCloseBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.bob.address),
        positionTraderAddress,
        signers.bob
      );
      // Bob应该盈利：25 * 55000/30000 ≈ 45.83，但由于整数运算可能有舍入
      // 预期余额：975 + 45.83 ≈ 1020-1021之间
      expect(bobAfterCloseBalance).to.be.greaterThan(BigInt(1015));
      expect(bobAfterCloseBalance).to.be.lessThan(BigInt(1025));
      
      // 验证交易完成 - 在FHE环境中，持仓记录不会被删除以保持机密性
      // 持仓ID仍然存在，但合约数量已为0（密文）
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(1);
      expect((await positionTrader.getUserPositionIds(signers.bob.address)).length).to.equal(1);
    });

    it("应该支持同一用户多次开平仓操作", async function () {
      const positions = [];
      
      // 获取初始余额
      const initialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(initialBalance).to.equal(1000);
      
      // 连续开仓
      for (let i = 0; i < 3; i++) {
        const price = 50000 + i * 5000; // 价格递增：50000, 55000, 60000
        await priceOracle.setManualPrice(price);
        
        const encryptedInput = await fhevm
          .createEncryptedInput(positionTraderAddress, signers.alice.address)
          .addBool(true)
          .add64(5)
          .encrypt();
        const tx = await positionTrader.connect(signers.alice).openPosition(
          encryptedInput.handles[0],
          encryptedInput.handles[1],
          encryptedInput.inputProof
        );
        const receipt = await tx.wait();
        const positionId = receipt.logs.find((log: any) => 
          log.fragment && log.fragment.name === "PositionOpened"
        ).args[1];
        positions.push(positionId);
      }
      
      // 验证开仓后余额：1000 - 15 = 985
      const afterOpenBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(afterOpenBalance).to.equal(BigInt(1000 - 15)); // 1000 - (3 * 5) = 985
      
      // 验证有3个持仓
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(3);
      
      // 在当前价格（60000）平仓第二个持仓（入场价55000）
      // 预期盈利：5 USD * (60000/55000) ≈ 5.45 USD
      const closeEncryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(5)
        .encrypt();
      await positionTrader.connect(signers.alice).closePosition(
        positions[1], // 第二个持仓（55000入场价）
        closeEncryptedInput.handles[0],
        closeEncryptedInput.inputProof
      );
      
      // 验证平仓后余额
      const afterCloseBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      // 预期余额：985 + (5 * 60000/55000) ≈ 985 + 5.45 ≈ 990-991
      expect(afterCloseBalance).to.be.greaterThan(BigInt(989));
      expect(afterCloseBalance).to.be.lessThan(BigInt(992));
      
      // 验证持仓数量不变 - 在FHE环境中，即使部分平仓，持仓记录也不会被删除
      // 所有3个持仓ID仍然存在，但positions[1]的合约数量已减少（密文）
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(3);
    });
  });

  describe("价格敏感性测试", function () {
    beforeEach(async () => {
      await positionTrader.connect(signers.alice).register();
    });

    it("应该在不同价格水平下正确开仓", async function () {
      const testPrices = [10000, 30000, 50000, 80000, 100000];
      const positions = [];
      
      for (const price of testPrices) {
        await priceOracle.setManualPrice(price);
        
        const encryptedInput = await fhevm
          .createEncryptedInput(positionTraderAddress, signers.alice.address)
          .addBool(true)
          .add64(5)
          .encrypt();
        const tx = await positionTrader.connect(signers.alice).openPosition(
          encryptedInput.handles[0],
          encryptedInput.handles[1],
          encryptedInput.inputProof
        );
        const receipt = await tx.wait();
        
        const event = receipt.logs.find((log: any) => 
          log.fragment && log.fragment.name === "PositionOpened"
        );
        expect(event.args[2]).to.equal(price);
        positions.push(event.args[1]);
      }
      
      expect(positions.length).to.equal(testPrices.length);
    });

    it("应该正确处理极端价格变化", async function () {
      // 获取初始余额
      const initialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(initialBalance).to.equal(1000);

      // 在正常价格开仓
      await priceOracle.setManualPrice(50000);
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true)
        .add64(10)
        .encrypt();
      const tx = await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      const receipt = await tx.wait();
      const positionId = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionOpened"
      ).args[1];

      // 验证开仓后余额
      const afterOpenBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(afterOpenBalance).to.equal(BigInt(1000 - 10)); // 1000 - 10 = 990
      
      // 极端价格变化 - 价格腰斩
      await priceOracle.setManualPrice(25000);
      
      // 应该能在极端价格下平仓
      const closeEncryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(10)
        .encrypt();
      const closeTx = await positionTrader.connect(signers.alice).closePosition(
        positionId,
        closeEncryptedInput.handles[0],
        closeEncryptedInput.inputProof
      );
      const closeReceipt = await closeTx.wait();
      
      const closeEvent = closeReceipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionClosed"
      );
      expect(closeEvent.args[2]).to.equal(25000);

      // 验证平仓后余额（价格腰斩，多头亏损50%）
      const afterCloseBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      // 预期亏损：10 * (25000/50000) = 5，余额应该是：990 + 5 = 995
      expect(afterCloseBalance).to.equal(BigInt(995));
    });

    it("应该支持快速价格变化下的连续交易", async function () {
      const priceSequence = [50000, 60000, 45000, 70000, 40000];
      
      // 获取初始余额
      const initialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(initialBalance).to.equal(1000);
      
      for (let i = 0; i < priceSequence.length; i++) {
        await priceOracle.setManualPrice(priceSequence[i]);
        
        // 开仓
        const encryptedInput = await fhevm
          .createEncryptedInput(positionTraderAddress, signers.alice.address)
          .addBool(i % 2 === 0)
          .add64(3)
          .encrypt();
        const openTx = await positionTrader.connect(signers.alice).openPosition(
          encryptedInput.handles[0],
          encryptedInput.handles[1],
          encryptedInput.inputProof
        );
        const openReceipt = await openTx.wait();
        const positionId = openReceipt.logs.find((log: any) => 
          log.fragment && log.fragment.name === "PositionOpened"
        ).args[1];
        
        // 立即平仓（在同一价格下）
        const closeEncryptedInput = await fhevm
          .createEncryptedInput(positionTraderAddress, signers.alice.address)
          .add64(3)
          .encrypt();
        await positionTrader.connect(signers.alice).closePosition(
          positionId,
          closeEncryptedInput.handles[0],
          closeEncryptedInput.inputProof
        );
      }
      
      // 验证最终余额 - 由于在相同价格开仓和平仓，余额应该接近初始值
      const finalBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      // 由于在相同价格开平仓，理论上余额应该保持1000，允许小幅偏差
      expect(finalBalance).to.be.greaterThan(BigInt(999));
      expect(finalBalance).to.be.lessThan(BigInt(1001));
      
      // 在FHE环境中，持仓记录不会被删除以保持机密性
      // 每次开仓都会创建持仓ID，平仓只是将合约数量设为0（密文）
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(5);
    });
  });
}); 