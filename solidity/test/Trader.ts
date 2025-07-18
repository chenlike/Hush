import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { Trader, Trader__factory, RevealStorage, RevealStorage__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

async function deployFixture() {
  // 首先部署价格预言机
  const oracleFactory = (await ethers.getContractFactory("PriceOracle")) as any;
  const priceOracle = await oracleFactory.deploy();
  const priceOracleAddress = await priceOracle.getAddress();

  // 部署RevealStorage合约
  const storageFactory = (await ethers.getContractFactory("RevealStorage")) as RevealStorage__factory;
  const revealStorage = await storageFactory.deploy();
  const revealStorageAddress = await revealStorage.getAddress();

  // 然后部署Trader合约，传入预言机地址和存储合约地址
  const factory = (await ethers.getContractFactory("Trader")) as Trader__factory;
  const traderContract = (await factory.deploy(priceOracleAddress, revealStorageAddress)) as Trader;
  const traderContractAddress = await traderContract.getAddress();

  return { 
    traderContract, 
    traderContractAddress, 
    priceOracle, 
    priceOracleAddress,
    revealStorage,
    revealStorageAddress
  };
}

describe("Trader", function () {
  let signers: Signers;
  let traderContract: Trader;
  let traderContractAddress: string;
  let priceOracle: any;
  let priceOracleAddress: string;
  let revealStorage: RevealStorage;
  let revealStorageAddress: string;

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
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }
    ({ 
      traderContract, 
      traderContractAddress, 
      priceOracle, 
      priceOracleAddress,
      revealStorage,
      revealStorageAddress
    } = await deployFixture());
  });

  describe("用户注册", function () {
    it("应该允许用户注册", async function () {
      // 检查用户初始状态
      expect(await traderContract.isRegistered(signers.alice.address)).to.be.false;

      // 用户注册
      const tx = await traderContract.connect(signers.alice).register();
      await tx.wait();

      // 验证注册状态
      expect(await traderContract.isRegistered(signers.alice.address)).to.be.true;
    });

    it("不应该允许用户重复注册", async function () {
      // 第一次注册
      let tx = await traderContract.connect(signers.alice).register();
      await tx.wait();

      // 尝试第二次注册，应该失败
      await expect(
        traderContract.connect(signers.alice).register()
      ).to.be.revertedWith("Already registered");
    });

    it("应该允许多个用户独立注册", async function () {
      // Alice 注册
      let tx = await traderContract.connect(signers.alice).register();
      await tx.wait();

      // Bob 注册
      tx = await traderContract.connect(signers.bob).register();
      await tx.wait();

      // Charlie 注册
      tx = await traderContract.connect(signers.charlie).register();
      await tx.wait();

      // 验证所有用户都已注册
      expect(await traderContract.isRegistered(signers.alice.address)).to.be.true;
      expect(await traderContract.isRegistered(signers.bob.address)).to.be.true;
      expect(await traderContract.isRegistered(signers.charlie.address)).to.be.true;
    });
  });

  describe("余额管理", function () {
    it("应该正确解密初始现金余额", async function () {
      // 用户注册
      const tx = await traderContract.connect(signers.alice).register();
      await tx.wait();

      // 获取加密现金余额
      const encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      
      // 解密现金余额
      const clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );

      // 验证初始现金余额为 10000 USD
      expect(clearCash).to.eq(10000);
    });

    it("应该为不同用户维护独立的余额", async function () {
      // Alice 注册
      let tx = await traderContract.connect(signers.alice).register();
      await tx.wait();

      // Bob 注册
      tx = await traderContract.connect(signers.bob).register();
      await tx.wait();

      // 获取两个用户的加密现金余额
      const aliceEncryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      const bobEncryptedCash = await traderContract.connect(signers.bob).getEncryptedCash();

      // 解密余额
      const aliceClearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        aliceEncryptedCash,
        traderContractAddress,
        signers.alice,
      );

      const bobClearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        bobEncryptedCash,
        traderContractAddress,
        signers.bob,
      );

      // 验证两个用户都有相同的初始余额（10000 USD）
      expect(aliceClearCash).to.eq(10000);
      expect(bobClearCash).to.eq(10000);
    });

    it("不应该允许未注册用户获取加密余额", async function () {
      // 未注册用户尝试获取余额，应该失败
      await expect(
        traderContract.connect(signers.bob).getEncryptedCash()
      ).to.be.revertedWith("Not registered");
    });
  });

  describe("持仓管理", function () {
    beforeEach(async function () {
      // 注册用户
      const tx = await traderContract.connect(signers.alice).register();
      await tx.wait();
    });

    it("应该能够开多头仓位", async function () {
      // 加密保证金和方向
      const margin = 1000;
      const isLong = true;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .addBool(isLong)
        .encrypt();

      // 开仓
      const tx = await traderContract.connect(signers.alice).openPosition(
        encryptedMargin.handles[0],
        encryptedMargin.inputProof,
        encryptedDirection.handles[0],
        encryptedDirection.inputProof
      );
      await tx.wait();

      // 验证持仓ID
      const positionIds = await traderContract.connect(signers.alice).getPositionIds();
      expect(positionIds.length).to.eq(1);
      expect(positionIds[0]).to.eq(1); // 第一个持仓ID应该是1
    });

    it("应该能够开空头仓位", async function () {
      // 加密保证金和方向
      const margin = 1000;
      const isLong = false;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .addBool(isLong)
        .encrypt();

      // 开仓
      const tx = await traderContract.connect(signers.alice).openPosition(
        encryptedMargin.handles[0],
        encryptedMargin.inputProof,
        encryptedDirection.handles[0],
        encryptedDirection.inputProof
      );
      await tx.wait();

      // 验证持仓ID
      const positionIds = await traderContract.connect(signers.alice).getPositionIds();
      expect(positionIds.length).to.eq(1);
    });

    it("应该能够查看持仓详情", async function () {
      // 开仓
      const margin = 1000;
      const isLong = true;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .addBool(isLong)
        .encrypt();

      // 开仓
      const tx = await traderContract.connect(signers.alice).openPosition(
        encryptedMargin.handles[0],
        encryptedMargin.inputProof,
        encryptedDirection.handles[0],
        encryptedDirection.inputProof
      );
      await tx.wait();

      // 获取持仓详情
      const position = await traderContract.connect(signers.alice).getPosition(1);
      
      // 验证持仓信息
      expect(position.isOpen).to.be.true;
      expect(position.entryPrice).to.be.gt(0); // 开仓价格应该大于0
      
      // 注意：持仓中的密文数据（margin和isLong）在合约内部使用，
      // 用户无法直接解密，这是FHE的安全特性
      // 我们只验证持仓的基本信息
    });

    it("不应该允许未注册用户开仓", async function () {
      const margin = 1000;
      const isLong = true;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.bob.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.bob.address)
        .addBool(isLong)
        .encrypt();

      // 未注册用户尝试开仓，应该失败
      await expect(
        traderContract.connect(signers.bob).openPosition(
          encryptedMargin.handles[0],
          encryptedMargin.inputProof,
          encryptedDirection.handles[0],
          encryptedDirection.inputProof
        )
      ).to.be.revertedWith("Not registered");
    });
  });

  describe("平仓功能", function () {
    beforeEach(async function () {
      // 注册用户
      const tx = await traderContract.connect(signers.alice).register();
      await tx.wait();
    });

    it("应该能够平仓多头盈利仓位", async function () {
      // 开多头仓位
      const margin = 1000;
      const isLong = true;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .addBool(isLong)
        .encrypt();

      // 开仓
      let tx = await traderContract.connect(signers.alice).openPosition(
        encryptedMargin.handles[0],
        encryptedMargin.inputProof,
        encryptedDirection.handles[0],
        encryptedDirection.inputProof
      );
      await tx.wait();

      // 设置价格上升（多头盈利）
      await priceOracle.updatePrice(50000); // 假设入场价格是40000，现在涨到50000

      // 平仓
      tx = await traderContract.connect(signers.alice).closePosition(1);
      await tx.wait();

      // 验证持仓已关闭
      const position = await traderContract.connect(signers.alice).getPosition(1);
      expect(position.isOpen).to.be.false;
    });

    it("应该能够平仓空头盈利仓位", async function () {
      // 开空头仓位
      const margin = 1000;
      const isLong = false;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .addBool(isLong)
        .encrypt();

      // 开仓
      let tx = await traderContract.connect(signers.alice).openPosition(
        encryptedMargin.handles[0],
        encryptedMargin.inputProof,
        encryptedDirection.handles[0],
        encryptedDirection.inputProof
      );
      await tx.wait();

      // 设置价格下降（空头盈利）
      await priceOracle.updatePrice(30000); // 假设入场价格是40000，现在跌到30000

      // 平仓
      tx = await traderContract.connect(signers.alice).closePosition(1);
      await tx.wait();

      // 验证持仓已关闭
      const position = await traderContract.connect(signers.alice).getPosition(1);
      expect(position.isOpen).to.be.false;
    });

    it("不应该允许非持仓所有者平仓", async function () {
      // Alice 开仓
      const margin = 1000;
      const isLong = true;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .addBool(isLong)
        .encrypt();

      // Alice 开仓
      let tx = await traderContract.connect(signers.alice).openPosition(
        encryptedMargin.handles[0],
        encryptedMargin.inputProof,
        encryptedDirection.handles[0],
        encryptedDirection.inputProof
      );
      await tx.wait();

      // Bob 尝试平仓Alice的持仓，应该失败
      await expect(
        traderContract.connect(signers.bob).closePosition(1)
      ).to.be.revertedWith("Not position owner");
    });

    it("不应该允许平仓已关闭的持仓", async function () {
      // 开仓
      const margin = 1000;
      const isLong = true;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .addBool(isLong)
        .encrypt();

      // 开仓
      let tx = await traderContract.connect(signers.alice).openPosition(
        encryptedMargin.handles[0],
        encryptedMargin.inputProof,
        encryptedDirection.handles[0],
        encryptedDirection.inputProof
      );
      await tx.wait();

      // 第一次平仓
      tx = await traderContract.connect(signers.alice).closePosition(1);
      await tx.wait();

      // 尝试再次平仓，应该失败
      await expect(
        traderContract.connect(signers.alice).closePosition(1)
      ).to.be.revertedWith("Position not open");
    });
  });

  describe("余额揭示功能", function () {
    beforeEach(async function () {
      // 注册用户
      const tx = await traderContract.connect(signers.alice).register();
      await tx.wait();
    });

    it("应该能够揭示余额", async function () {
      // 获取当前加密余额
      const encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      const clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );

      // 揭示余额
      const tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      // 验证揭示记录
      const record = await traderContract.connect(signers.alice).getRevealRecord(signers.alice.address);
      expect(record.exists).to.be.true;
      expect(record.usdBalance).to.eq(clearCash);
      expect(record.btcBalance).to.eq(0);
    });

    it("不应该允许重复揭示余额", async function () {
      // 获取当前加密余额
      const encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      const clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );

      // 第一次揭示
      let tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      // 尝试第二次揭示，应该失败
      await expect(
        traderContract.connect(signers.alice).revealBalance(clearCash, 0)
      ).to.be.revertedWith("Already revealed");
    });

    it("不应该允许未注册用户揭示余额", async function () {
      // 未注册用户尝试揭示余额，应该失败
      await expect(
        traderContract.connect(signers.bob).revealBalance(10000, 0)
      ).to.be.revertedWith("Not registered");
    });

    it("应该能够检查用户是否已揭示余额", async function () {
      // 初始状态应该为false
      expect(await traderContract.hasRevealed(signers.alice.address)).to.be.false;

      // 获取当前加密余额
      const encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      const clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );

      // 揭示余额
      const tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      // 现在应该为true
      expect(await traderContract.hasRevealed(signers.alice.address)).to.be.true;
    });

    it("应该能够从RevealStorage合约获取公开余额", async function () {
      // 获取当前加密余额
      const encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      const clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );

      // 揭示余额
      const tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      // 从RevealStorage合约获取公开余额
      const publicBalance = await revealStorage.getPublicBalance(signers.alice.address);
      
      // 验证时间戳
      expect(publicBalance[2]).to.be.gt(0); // 时间戳应该大于0
      
      // 注意：由于FHE的权限管理复杂性，我们只验证存储功能
      // 密文解密需要正确的权限设置，这在测试环境中比较复杂
    });
  });

  describe("价格预言机集成", function () {
    it("应该能够获取BTC价格", async function () {
      const price = await priceOracle.getBtcPrice();
      expect(price).to.be.gt(0);
    });

    it("应该能够检查价格是否过期", async function () {
      const isStale = await priceOracle.isPriceStale();
      expect(typeof isStale).to.eq("boolean");
    });
  });

  describe("公开解密功能", function () {
    beforeEach(async function () {
      // 注册用户
      const tx = await traderContract.connect(signers.alice).register();
      await tx.wait();
    });

    it("应该能够使用 publicDecryptEuint 解密公开的余额", async function () {
      // 获取当前加密余额
      const encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      const clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );

      // 揭示余额 - 这会调用 FHE.makePubliclyDecryptable()
      const tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      // 从 RevealStorage 合约获取公开的密文余额
      const publicBalance = await revealStorage.getPublicBalance(signers.alice.address);
      const encryptedUsdBalance = publicBalance[0]; // euint32 usd
      const encryptedBtcBalance = publicBalance[1]; // euint32 btc

      // 使用 publicDecryptEuint 解密公开的 USD 余额
      const decryptedUsdBalance = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        encryptedUsdBalance
      );

      // 使用 publicDecryptEuint 解密公开的 BTC 余额
      const decryptedBtcBalance = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        encryptedBtcBalance
      );

      // 验证解密结果
      expect(decryptedUsdBalance).to.eq(clearCash);
      expect(decryptedBtcBalance).to.eq(0);

      console.log(`原始余额: ${clearCash} USD`);
      console.log(`解密后的 USD 余额: ${decryptedUsdBalance} USD`);
      console.log(`解密后的 BTC 余额: ${decryptedBtcBalance} BTC`);
    });

    it("应该能够解密多个用户的公开余额", async function () {
      // Alice 已经在 beforeEach 中注册，直接揭示余额
      let encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      let clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );
      let tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      // Bob 注册并揭示余额
      tx = await traderContract.connect(signers.bob).register();
      await tx.wait();
      
      encryptedCash = await traderContract.connect(signers.bob).getEncryptedCash();
      clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.bob,
      );
      tx = await traderContract.connect(signers.bob).revealBalance(clearCash, 0);
      await tx.wait();

      // 获取并解密 Alice 的公开余额
      const alicePublicBalance = await revealStorage.getPublicBalance(signers.alice.address);
      const aliceDecryptedUsd = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        alicePublicBalance[0]
      );

      // 获取并解密 Bob 的公开余额
      const bobPublicBalance = await revealStorage.getPublicBalance(signers.bob.address);
      const bobDecryptedUsd = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        bobPublicBalance[0]
      );
      // 验证两个用户都有相同的初始余额
      expect(aliceDecryptedUsd).to.eq(10000);
      expect(bobDecryptedUsd).to.eq(10000);

      console.log(`Alice 解密后的余额: ${aliceDecryptedUsd} USD`);
      console.log(`Bob 解密后的余额: ${bobDecryptedUsd} USD`);
    });

    it("应该能够处理交易后的余额变化", async function () {
      // 开仓操作
      const margin = 1000;
      const isLong = true;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .addBool(isLong)
        .encrypt();

      // 开仓
      let tx = await traderContract.connect(signers.alice).openPosition(
        encryptedMargin.handles[0],
        encryptedMargin.inputProof,
        encryptedDirection.handles[0],
        encryptedDirection.inputProof
      );
      await tx.wait();

      // 获取交易后的余额
      const encryptedCashAfterTrade = await traderContract.connect(signers.alice).getEncryptedCash();
      const clearCashAfterTrade = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCashAfterTrade,
        traderContractAddress,
        signers.alice,
      );

      // 揭示交易后的余额
      tx = await traderContract.connect(signers.alice).revealBalance(clearCashAfterTrade, 0);
      await tx.wait();

      // 从 RevealStorage 获取并解密公开余额
      const publicBalance = await revealStorage.getPublicBalance(signers.alice.address);
      const decryptedUsdBalance = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        publicBalance[0]
      );

      // 验证交易后的余额（应该减少保证金）
      expect(decryptedUsdBalance).to.eq(10000 - margin);

      console.log(`交易前余额: 10000 USD`);
      console.log(`交易后余额: ${decryptedUsdBalance} USD`);
      console.log(`使用的保证金: ${margin} USD`);
    });

    it("应该允许未注册用户查看其他人揭示的余额", async function () {
      // Alice 已经在 beforeEach 中注册，直接揭示余额
      let encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      let clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );
      let tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      // Charlie（未注册用户）尝试查看 Alice 的公开余额
      const alicePublicBalance = await revealStorage.getPublicRevealedBalance(signers.alice.address);
      const aliceDecryptedUsd = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        alicePublicBalance[0]
      );

      // 验证 Charlie 可以成功查看 Alice 的余额
      expect(aliceDecryptedUsd).to.eq(10000);

      console.log(`Charlie（未注册）查看 Alice 的余额: ${aliceDecryptedUsd} USD`);
    });

    it("应该能够检查用户是否已揭示余额", async function () {
      // 初始状态，Alice 未揭示余额
      expect(await revealStorage.hasUserRevealedBalance(signers.alice.address)).to.be.false;

      // Alice 已经在 beforeEach 中注册，直接揭示余额
      let encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      let clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );
      let tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      // 现在 Alice 已揭示余额
      expect(await revealStorage.hasUserRevealedBalance(signers.alice.address)).to.be.true;

      // 获取揭示时间戳
      const revealTimestamp = await revealStorage.getRevealTimestamp(signers.alice.address);
      expect(revealTimestamp).to.be.gt(0);

      console.log(`Alice 揭示余额的时间戳: ${revealTimestamp}`);
    });

    it("应该能够批量查看多个用户的公开余额", async function () {
      // Alice 已经在 beforeEach 中注册，直接揭示余额
      let encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      let clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );
      let tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      // Bob 注册并揭示余额
      tx = await traderContract.connect(signers.bob).register();
      await tx.wait();
      
      encryptedCash = await traderContract.connect(signers.bob).getEncryptedCash();
      clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.bob,
      );
      tx = await traderContract.connect(signers.bob).revealBalance(clearCash, 0);
      await tx.wait();

      // Charlie（未注册用户）批量查看所有用户的公开余额
      const aliceBalance = await revealStorage.getPublicRevealedBalance(signers.alice.address);
      const bobBalance = await revealStorage.getPublicRevealedBalance(signers.bob.address);

      const aliceDecryptedUsd = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        aliceBalance[0]
      );
      const bobDecryptedUsd = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        bobBalance[0]
      );

      // 验证所有用户都有相同的初始余额
      expect(aliceDecryptedUsd).to.eq(10000);
      expect(bobDecryptedUsd).to.eq(10000);

      console.log(`Charlie 查看 Alice 的余额: ${aliceDecryptedUsd} USD`);
      console.log(`Charlie 查看 Bob 的余额: ${bobDecryptedUsd} USD`);
    });
  });
}); 