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
  david: HardhatEthersSigner;
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

describe("Trader 集成测试", function () {
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
      charlie: ethSigners[3],
      david: ethSigners[4]
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

  describe("完整交易流程测试", function () {
    it("应该完成完整的交易流程：注册 -> 开仓 -> 平仓 -> 揭示余额 -> 公开查看", async function () {
      console.log("=== 开始完整交易流程测试 ===");

      // 步骤1: 用户注册
      console.log("步骤1: Alice 和 Bob 注册");
      let tx = await traderContract.connect(signers.alice).register();
      await tx.wait();
      console.log("✓ Alice 注册成功");

      tx = await traderContract.connect(signers.bob).register();
      await tx.wait();
      console.log("✓ Bob 注册成功");

      // 验证注册状态
      expect(await traderContract.isRegistered(signers.alice.address)).to.be.true;
      expect(await traderContract.isRegistered(signers.bob.address)).to.be.true;

      // 步骤2: 获取初始余额
      console.log("步骤2: 获取初始余额");
      const aliceInitialCash = await traderContract.connect(signers.alice).getEncryptedCash();
      const bobInitialCash = await traderContract.connect(signers.bob).getEncryptedCash();

      const aliceInitialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        aliceInitialCash,
        traderContractAddress,
        signers.alice,
      );
      const bobInitialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        bobInitialCash,
        traderContractAddress,
        signers.bob,
      );

      expect(aliceInitialBalance).to.eq(10000);
      expect(bobInitialBalance).to.eq(10000);
      console.log(`✓ Alice 初始余额: ${aliceInitialBalance} USD`);
      console.log(`✓ Bob 初始余额: ${bobInitialBalance} USD`);

      // 步骤3: Alice 开多头仓位
      console.log("步骤3: Alice 开多头仓位");
      const margin = 2000;
      const isLong = true;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.alice.address)
        .addBool(isLong)
        .encrypt();

      tx = await traderContract.connect(signers.alice).openPosition(
        encryptedMargin.handles[0],
        encryptedMargin.inputProof,
        encryptedDirection.handles[0],
        encryptedDirection.inputProof
      );
      await tx.wait();
      console.log(`✓ Alice 开多头仓位成功，保证金: ${margin} USD`);

      // 验证持仓
      const alicePositions = await traderContract.connect(signers.alice).getPositionIds();
      expect(alicePositions.length).to.eq(1);
      console.log(`✓ Alice 持仓ID: ${alicePositions[0]}`);

      // 步骤4: Bob 开空头仓位
      console.log("步骤4: Bob 开空头仓位");
      const bobMargin = 1500;
      const bobIsLong = false;
      
      const bobEncryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.bob.address)
        .add32(bobMargin)
        .encrypt();

      const bobEncryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.bob.address)
        .addBool(bobIsLong)
        .encrypt();

      tx = await traderContract.connect(signers.bob).openPosition(
        bobEncryptedMargin.handles[0],
        bobEncryptedMargin.inputProof,
        bobEncryptedDirection.handles[0],
        bobEncryptedDirection.inputProof
      );
      await tx.wait();
      console.log(`✓ Bob 开空头仓位成功，保证金: ${bobMargin} USD`);

      // 验证 Bob 持仓
      const bobPositions = await traderContract.connect(signers.bob).getPositionIds();
      expect(bobPositions.length).to.eq(1);
      console.log(`✓ Bob 持仓ID: ${bobPositions[0]}`);

      // 步骤5: 检查开仓后的余额
      console.log("步骤5: 检查开仓后的余额");
      const aliceCashAfterOpen = await traderContract.connect(signers.alice).getEncryptedCash();
      const bobCashAfterOpen = await traderContract.connect(signers.bob).getEncryptedCash();

      const aliceBalanceAfterOpen = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        aliceCashAfterOpen,
        traderContractAddress,
        signers.alice,
      );
      const bobBalanceAfterOpen = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        bobCashAfterOpen,
        traderContractAddress,
        signers.bob,
      );

      expect(aliceBalanceAfterOpen).to.eq(10000 - margin);
      expect(bobBalanceAfterOpen).to.eq(10000 - bobMargin);
      console.log(`✓ Alice 开仓后余额: ${aliceBalanceAfterOpen} USD`);
      console.log(`✓ Bob 开仓后余额: ${bobBalanceAfterOpen} USD`);

      // 步骤6: 模拟价格变化
      console.log("步骤6: 模拟价格变化");
      const initialPrice = await priceOracle.getBtcPrice();
      console.log(`✓ 初始BTC价格: ${initialPrice} USD`);

      // 价格上涨（对多头有利，对空头不利）
      await priceOracle.updatePrice(Number(initialPrice) + 5000);
      const newPrice = await priceOracle.getBtcPrice();
      console.log(`✓ 新BTC价格: ${newPrice} USD (上涨${Number(newPrice) - Number(initialPrice)} USD)`);

      // 步骤7: Alice 平仓（多头盈利）
      console.log("步骤7: Alice 平仓（多头盈利）");
      tx = await traderContract.connect(signers.alice).closePosition(1);
      await tx.wait();
      console.log("✓ Alice 平仓成功");

      // 步骤8: Bob 平仓（空头亏损）
      console.log("步骤8: Bob 平仓（空头亏损）");
      tx = await traderContract.connect(signers.bob).closePosition(2);
      await tx.wait();
      console.log("✓ Bob 平仓成功");

      // 步骤9: 检查平仓后的余额
      console.log("步骤9: 检查平仓后的余额");
      const aliceCashAfterClose = await traderContract.connect(signers.alice).getEncryptedCash();
      const bobCashAfterClose = await traderContract.connect(signers.bob).getEncryptedCash();

      const aliceBalanceAfterClose = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        aliceCashAfterClose,
        traderContractAddress,
        signers.alice,
      );
      const bobBalanceAfterClose = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        bobCashAfterClose,
        traderContractAddress,
        signers.bob,
      );

      console.log(`✓ Alice 平仓后余额: ${aliceBalanceAfterClose} USD`);
      console.log(`✓ Bob 平仓后余额: ${bobBalanceAfterClose} USD`);

      // 步骤10: Alice 揭示余额
      console.log("步骤10: Alice 揭示余额");
      tx = await traderContract.connect(signers.alice).revealBalance(aliceBalanceAfterClose, 0);
      await tx.wait();
      console.log("✓ Alice 揭示余额成功");

      // 步骤11: Bob 揭示余额
      console.log("步骤11: Bob 揭示余额");
      tx = await traderContract.connect(signers.bob).revealBalance(bobBalanceAfterClose, 0);
      await tx.wait();
      console.log("✓ Bob 揭示余额成功");

      // 步骤12: Charlie（未注册用户）查看公开余额
      console.log("步骤12: Charlie（未注册用户）查看公开余额");
      const alicePublicBalance = await revealStorage.getPublicRevealedBalance(signers.alice.address);
      const bobPublicBalance = await revealStorage.getPublicRevealedBalance(signers.bob.address);

      const aliceDecryptedUsd = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        alicePublicBalance[0]
      );
      const bobDecryptedUsd = await fhevm.publicDecryptEuint(
        FhevmType.euint32,
        bobPublicBalance[0]
      );

      console.log(`✓ Charlie 查看 Alice 的公开余额: ${aliceDecryptedUsd} USD`);
      console.log(`✓ Charlie 查看 Bob 的公开余额: ${bobDecryptedUsd} USD`);

      // 验证公开余额与内部余额一致
      expect(aliceDecryptedUsd).to.eq(aliceBalanceAfterClose);
      expect(bobDecryptedUsd).to.eq(bobBalanceAfterClose);

      // 步骤13: 验证揭示状态
      console.log("步骤13: 验证揭示状态");
      expect(await traderContract.hasRevealed(signers.alice.address)).to.be.true;
      expect(await traderContract.hasRevealed(signers.bob.address)).to.be.true;
      expect(await revealStorage.hasUserRevealedBalance(signers.alice.address)).to.be.true;
      expect(await revealStorage.hasUserRevealedBalance(signers.bob.address)).to.be.true;
      console.log("✓ 所有揭示状态验证通过");

      // 步骤14: 获取揭示时间戳
      console.log("步骤14: 获取揭示时间戳");
      const aliceTimestamp = await revealStorage.getRevealTimestamp(signers.alice.address);
      const bobTimestamp = await revealStorage.getRevealTimestamp(signers.bob.address);
      console.log(`✓ Alice 揭示时间戳: ${aliceTimestamp}`);
      console.log(`✓ Bob 揭示时间戳: ${bobTimestamp}`);

      console.log("=== 完整交易流程测试完成 ===");
    });

    it("应该测试多用户并发交易场景", async function () {
      console.log("=== 开始多用户并发交易测试 ===");

      // 注册多个用户
      console.log("步骤1: 注册多个用户");
      const users = [signers.alice, signers.bob, signers.charlie, signers.david];
      const userNames = ["Alice", "Bob", "Charlie", "David"];
      
      for (let i = 0; i < users.length; i++) {
        const tx = await traderContract.connect(users[i]).register();
        await tx.wait();
        console.log(`✓ ${userNames[i]} 注册成功`);
      }

      // 所有用户同时开仓
      console.log("步骤2: 所有用户同时开仓");
      const margins = [1000, 1500, 2000, 2500];
      const directions = [true, false, true, false]; // 多空交替

      for (let i = 0; i < users.length; i++) {
        const encryptedMargin = await fhevm
          .createEncryptedInput(traderContractAddress, users[i].address)
          .add32(margins[i])
          .encrypt();

        const encryptedDirection = await fhevm
          .createEncryptedInput(traderContractAddress, users[i].address)
          .addBool(directions[i])
          .encrypt();

        const tx = await traderContract.connect(users[i]).openPosition(
          encryptedMargin.handles[0],
          encryptedMargin.inputProof,
          encryptedDirection.handles[0],
          encryptedDirection.inputProof
        );
        await tx.wait();
        console.log(`✓ ${userNames[i]} 开${directions[i] ? '多' : '空'}头仓位，保证金: ${margins[i]} USD`);
      }

      // 验证所有持仓
      for (let i = 0; i < users.length; i++) {
        const positions = await traderContract.connect(users[i]).getPositionIds();
        expect(positions.length).to.eq(1);
        console.log(`✓ ${userNames[i]} 持仓ID: ${positions[0]}`);
      }

      // 模拟价格大幅波动
      console.log("步骤3: 模拟价格大幅波动");
      const initialPrice = await priceOracle.getBtcPrice();
      console.log(`✓ 初始价格: ${initialPrice} USD`);

      // 先大幅上涨
      await priceOracle.updatePrice(Number(initialPrice) + 10000);
      console.log(`✓ 价格大幅上涨到: ${await priceOracle.getBtcPrice()} USD`);

      // 再大幅下跌
      await priceOracle.updatePrice(Number(initialPrice) - 5000);
      console.log(`✓ 价格大幅下跌到: ${await priceOracle.getBtcPrice()} USD`);

      // 所有用户平仓
      console.log("步骤4: 所有用户平仓");
      for (let i = 0; i < users.length; i++) {
        const positions = await traderContract.connect(users[i]).getPositionIds();
        const tx = await traderContract.connect(users[i]).closePosition(positions[0]);
        await tx.wait();
        console.log(`✓ ${userNames[i]} 平仓成功`);
      }

      // 所有用户揭示余额
      console.log("步骤5: 所有用户揭示余额");
      for (let i = 0; i < users.length; i++) {
        const encryptedCash = await traderContract.connect(users[i]).getEncryptedCash();
        const clearCash = await fhevm.userDecryptEuint(
          FhevmType.euint32,
          encryptedCash,
          traderContractAddress,
          users[i],
        );
        
        const tx = await traderContract.connect(users[i]).revealBalance(clearCash, 0);
        await tx.wait();
        console.log(`✓ ${userNames[i]} 揭示余额: ${clearCash} USD`);
      }

      // 验证所有用户都可以查看其他人的公开余额
      console.log("步骤6: 验证公开查看功能");
      for (let i = 0; i < users.length; i++) {
        for (let j = 0; j < users.length; j++) {
          if (i !== j) {
            const publicBalance = await revealStorage.getPublicRevealedBalance(users[j].address);
            const decryptedUsd = await fhevm.publicDecryptEuint(
              FhevmType.euint32,
              publicBalance[0]
            );
            console.log(`✓ ${userNames[i]} 查看 ${userNames[j]} 的余额: ${decryptedUsd} USD`);
          }
        }
      }

      console.log("=== 多用户并发交易测试完成 ===");
    });

    it("应该测试错误处理和边界情况", async function () {
      console.log("=== 开始错误处理和边界情况测试 ===");

      // 测试未注册用户尝试开仓
      console.log("测试1: 未注册用户尝试开仓");
      const margin = 1000;
      const isLong = true;
      
      const encryptedMargin = await fhevm
        .createEncryptedInput(traderContractAddress, signers.charlie.address)
        .add32(margin)
        .encrypt();

      const encryptedDirection = await fhevm
        .createEncryptedInput(traderContractAddress, signers.charlie.address)
        .addBool(isLong)
        .encrypt();

      await expect(
        traderContract.connect(signers.charlie).openPosition(
          encryptedMargin.handles[0],
          encryptedMargin.inputProof,
          encryptedDirection.handles[0],
          encryptedDirection.inputProof
        )
      ).to.be.revertedWith("Not registered");
      console.log("✓ 未注册用户开仓被正确拒绝");

      // 测试未注册用户尝试查看公开余额
      console.log("测试2: 未注册用户尝试查看公开余额");
      await expect(
        revealStorage.getPublicRevealedBalance(signers.charlie.address)
      ).to.be.revertedWith("User has not revealed balance");
      console.log("✓ 未注册用户查看公开余额被正确拒绝");

      // 测试重复注册
      console.log("测试3: 重复注册");
      let tx = await traderContract.connect(signers.alice).register();
      await tx.wait();

      await expect(
        traderContract.connect(signers.alice).register()
      ).to.be.revertedWith("Already registered");
      console.log("✓ 重复注册被正确拒绝");

      // 测试重复揭示余额
      console.log("测试4: 重复揭示余额");
      const encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
      const clearCash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCash,
        traderContractAddress,
        signers.alice,
      );
      
      tx = await traderContract.connect(signers.alice).revealBalance(clearCash, 0);
      await tx.wait();

      await expect(
        traderContract.connect(signers.alice).revealBalance(clearCash, 0)
      ).to.be.revertedWith("Already revealed");
      console.log("✓ 重复揭示余额被正确拒绝");

      // 测试查看未揭示用户的余额
      console.log("测试5: 查看未揭示用户的余额");
      await expect(
        revealStorage.getRevealTimestamp(signers.bob.address)
      ).to.be.revertedWith("User has not revealed balance");
      console.log("✓ 查看未揭示用户余额被正确拒绝");

      console.log("=== 错误处理和边界情况测试完成 ===");
    });
  });
}); 