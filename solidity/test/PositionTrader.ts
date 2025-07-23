import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { PriceOracle, PriceOracle__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

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
      const balance = await positionTrader.getBalance(signers.alice.address);
      
      // 验证返回的是有效的FHE密文格式
      expect(balance).to.be.a('string');
      expect(balance.length).to.be.greaterThan(0);
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
}); 
}); 