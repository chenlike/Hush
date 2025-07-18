import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { Trader, Trader__factory } from "../types";
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

  // 然后部署Trader合约，传入预言机地址
  const factory = (await ethers.getContractFactory("Trader")) as Trader__factory;
  const traderContract = (await factory.deploy(priceOracleAddress)) as Trader;
  const traderContractAddress = await traderContract.getAddress();

  return { traderContract, traderContractAddress, priceOracle, priceOracleAddress };
}

describe("Trader", function () {
  let signers: Signers;
  let traderContract: Trader;
  let traderContractAddress: string;
  let priceOracle: any;
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
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }
    ({ traderContract, traderContractAddress, priceOracle, priceOracleAddress } = await deployFixture());
  });

  it("should allow user to register", async function () {
    // 检查用户初始状态
    expect(await traderContract.isRegistered(signers.alice.address)).to.be.false;

    // 用户注册
    const tx = await traderContract.connect(signers.alice).register();
    await tx.wait();

    // 验证注册状态
    expect(await traderContract.isRegistered(signers.alice.address)).to.be.true;
  });

  it("should not allow user to register twice", async function () {
    // 第一次注册
    let tx = await traderContract.connect(signers.alice).register();
    await tx.wait();

    // 尝试第二次注册，应该失败
    await expect(
      traderContract.connect(signers.alice).register()
    ).to.be.revertedWith("User already registered");
  });

  it("should initialize encrypted balances after registration", async function () {
    // 用户注册
    const tx = await traderContract.connect(signers.alice).register();
    await tx.wait();

    // 获取加密余额
    const encryptedCash = await traderContract.connect(signers.alice).getEncryptedCash();
    const encryptedBTC = await traderContract.connect(signers.alice).getEncryptedBTC();

    // 验证加密余额不为零（表示已初始化）
    expect(encryptedCash).to.not.eq(ethers.ZeroHash);
    expect(encryptedBTC).to.not.eq(ethers.ZeroHash);
  });

  it("should not allow unregistered user to get encrypted balances", async function () {
    // 未注册用户尝试获取余额，应该失败
    await expect(
      traderContract.connect(signers.bob).getEncryptedCash()
    ).to.be.revertedWith("Not registered");

    await expect(
      traderContract.connect(signers.bob).getEncryptedBTC()
    ).to.be.revertedWith("Not registered");
  });

  it("should allow multiple users to register independently", async function () {
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

  it("should decrypt initial cash balance correctly", async function () {
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

  it("should decrypt initial BTC balance correctly", async function () {
    // 用户注册
    const tx = await traderContract.connect(signers.alice).register();
    await tx.wait();

    // 获取加密BTC余额
    const encryptedBTC = await traderContract.connect(signers.alice).getEncryptedBTC();
    
    // 解密BTC余额
    const clearBTC = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedBTC,
      traderContractAddress,
      signers.alice,
    );

    // 验证初始BTC余额为 0
    expect(clearBTC).to.eq(0);
  });

  it("should maintain separate balances for different users", async function () {
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

  it("should allow user to buy BTC with cash", async function () {
    // 用户注册
    const tx = await traderContract.connect(signers.alice).register();
    await tx.wait();

    // 加密购买金额 1000 USD
    const buyAmount = 1000;
    const encryptedBuyAmount = await fhevm
      .createEncryptedInput(traderContractAddress, signers.alice.address)
      .add32(buyAmount)
      .encrypt();

    // 执行购买操作
    const buyTx = await traderContract
      .connect(signers.alice)
      .buy(encryptedBuyAmount.handles[0], encryptedBuyAmount.inputProof);
    await buyTx.wait();

    // 获取更新后的余额
    const encryptedCashAfter = await traderContract.connect(signers.alice).getEncryptedCash();
    const encryptedBTCAfter = await traderContract.connect(signers.alice).getEncryptedBTC();

    // 解密余额
    const clearCashAfter = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCashAfter,
      traderContractAddress,
      signers.alice,
    );

    const clearBTCAfter = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedBTCAfter,
      traderContractAddress,
      signers.alice,
    );

    // 验证现金余额减少了 1000 USD
    expect(clearCashAfter).to.eq(10000 - buyAmount);
    
    // 验证BTC余额增加了 (1000 * 2) = 2000 (0.002 BTC)
    expect(clearBTCAfter).to.eq(2000);
  });

  it("should allow user to sell BTC for cash", async function () {
    // 用户注册
    const tx = await traderContract.connect(signers.alice).register();
    await tx.wait();

    // 先购买一些BTC
    const buyAmount = 1000;
    const encryptedBuyAmount = await fhevm
      .createEncryptedInput(traderContractAddress, signers.alice.address)
      .add32(buyAmount)
      .encrypt();

    let buyTx = await traderContract
      .connect(signers.alice)
      .buy(encryptedBuyAmount.handles[0], encryptedBuyAmount.inputProof);
    await buyTx.wait();

    // 现在卖出一些BTC
    const sellAmount = 1000; // 卖出 1000 单位的BTC (0.001 BTC)
    const encryptedSellAmount = await fhevm
      .createEncryptedInput(traderContractAddress, signers.alice.address)
      .add32(sellAmount)
      .encrypt();

    const sellTx = await traderContract
      .connect(signers.alice)
      .sell(encryptedSellAmount.handles[0], encryptedSellAmount.inputProof);
    await sellTx.wait();

    // 获取更新后的余额
    const encryptedCashAfter = await traderContract.connect(signers.alice).getEncryptedCash();
    const encryptedBTCAfter = await traderContract.connect(signers.alice).getEncryptedBTC();

    // 解密余额
    const clearCashAfter = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCashAfter,
      traderContractAddress,
      signers.alice,
    );

    const clearBTCAfter = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedBTCAfter,
      traderContractAddress,
      signers.alice,
    );

    // 验证现金余额：初始10000 - 购买1000 + 卖出(1000 * 50000) = 10000 - 1000 + 50000000 = 50009000
    expect(clearCashAfter).to.eq(50009000);
    
    // 验证BTC余额：购买2000 - 卖出1000 = 1000
    expect(clearBTCAfter).to.eq(1000);
  });

  it("should not allow unregistered user to buy", async function () {
    // 未注册用户尝试购买，应该失败
    const buyAmount = 1000;
    const encryptedBuyAmount = await fhevm
      .createEncryptedInput(traderContractAddress, signers.bob.address)
      .add32(buyAmount)
      .encrypt();

    await expect(
      traderContract
        .connect(signers.bob)
        .buy(encryptedBuyAmount.handles[0], encryptedBuyAmount.inputProof)
    ).to.be.revertedWith("Not registered");
  });

  it("should not allow unregistered user to sell", async function () {
    // 未注册用户尝试卖出，应该失败
    const sellAmount = 1000;
    const encryptedSellAmount = await fhevm
      .createEncryptedInput(traderContractAddress, signers.bob.address)
      .add32(sellAmount)
      .encrypt();

    await expect(
      traderContract
        .connect(signers.bob)
        .sell(encryptedSellAmount.handles[0], encryptedSellAmount.inputProof)
    ).to.be.revertedWith("Not registered");
  });
}); 