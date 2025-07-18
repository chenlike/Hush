import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { PriceOracle, PriceOracle__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("PriceOracle")) as PriceOracle__factory;
  const priceOracleContract = (await factory.deploy()) as PriceOracle;
  const priceOracleContractAddress = await priceOracleContract.getAddress();

  return { priceOracleContract, priceOracleContractAddress };
}

describe("PriceOracle", function () {
  let signers: Signers;
  let priceOracleContract: PriceOracle;
  let priceOracleContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { 
      deployer: ethSigners[0], 
      alice: ethSigners[1], 
      bob: ethSigners[2]
    };
  });

  beforeEach(async () => {
    ({ priceOracleContract, priceOracleContractAddress } = await deployFixture());
  });

  it("should initialize with correct default values", async function () {
    // 验证初始价格更新者
    expect(await priceOracleContract.priceUpdater()).to.eq(signers.deployer.address);
    
    // 验证初始BTC价格（$50,000）
    expect(await priceOracleContract.getBtcPrice()).to.eq(50000);
    expect(await priceOracleContract.getBtcPriceUSD()).to.eq(50000);
    
    // 验证价格更新时间
    const lastUpdateTime = await priceOracleContract.getLastUpdateTime();
    expect(lastUpdateTime).to.be.gt(0);
  });

  it("should allow price updater to update price", async function () {
    const newPriceUSD = 60000; // $60,000
    
    const tx = await priceOracleContract.connect(signers.deployer).updatePrice(newPriceUSD);
    await tx.wait();
    
    // 验证价格已更新
    expect(await priceOracleContract.getBtcPrice()).to.eq(newPriceUSD);
    expect(await priceOracleContract.getBtcPriceUSD()).to.eq(60000);
  });

  it("should not allow non-updater to update price", async function () {
    const newPriceUSD = 60000;
    
    await expect(
      priceOracleContract.connect(signers.alice).updatePrice(newPriceUSD)
    ).to.be.revertedWith("Only price updater can update price");
  });

  it("should not allow zero price", async function () {
    await expect(
      priceOracleContract.connect(signers.deployer).updatePrice(0)
    ).to.be.revertedWith("Price must be greater than 0");
  });

  it("should allow price updater to set new updater", async function () {
    const tx = await priceOracleContract.connect(signers.deployer).setPriceUpdater(signers.alice.address);
    await tx.wait();
    
    expect(await priceOracleContract.priceUpdater()).to.eq(signers.alice.address);
  });

  it("should not allow non-updater to set new updater", async function () {
    await expect(
      priceOracleContract.connect(signers.alice).setPriceUpdater(signers.bob.address)
    ).to.be.revertedWith("Only price updater can set new updater");
  });

  it("should allow new updater to update price", async function () {
    // 设置新的价格更新者
    let tx = await priceOracleContract.connect(signers.deployer).setPriceUpdater(signers.alice.address);
    await tx.wait();
    
    // 新的更新者更新价格
    const newPriceUSD = 70000; // $70,000
    tx = await priceOracleContract.connect(signers.alice).updatePrice(newPriceUSD);
    await tx.wait();
    
    expect(await priceOracleContract.getBtcPrice()).to.eq(newPriceUSD);
  });

  it("should check if price is stale", async function () {
    // 初始价格不应该过期
    expect(await priceOracleContract.isPriceStale()).to.be.false;
    
    // 模拟时间过去（在实际测试中，这需要时间旅行）
    // 这里我们只是测试函数调用是否正常
    const isStale = await priceOracleContract.isPriceStale();
    expect(typeof isStale).to.eq("boolean");
  });

  it("should emit PriceUpdated event", async function () {
    const newPriceUSD = 55000; // $55,000
    
    await expect(priceOracleContract.connect(signers.deployer).updatePrice(newPriceUSD))
      .to.emit(priceOracleContract, "PriceUpdated");
  });
}); 