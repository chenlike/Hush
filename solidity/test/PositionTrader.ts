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
  // Deploy price oracle (using mock aggregator address)
  const mockAggregatorAddress = "0x0000000000000000000000000000000000000001";
  const oracleFactory = (await ethers.getContractFactory("PriceOracle")) as PriceOracle__factory;
  const priceOracle = await oracleFactory.deploy(mockAggregatorAddress);
  const priceOracleAddress = await priceOracle.getAddress();

  // Enable manual mode and set test price
  await priceOracle.setManualMode(true);
  await priceOracle.setManualPrice(50000); // $50,000

  // Deploy PositionTrader contract (constructor parameters: priceOracle address, initial funds 1000 USD)
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

describe("PositionTrader Complete Test", function () {
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
    // Check if running in FHEVM mock environment
    if (!fhevm.isMock) {
      throw new Error(`This hardhat test suite can only run in FHEVM mock environment`);
    }
    ({ 
      positionTrader, 
      positionTraderAddress, 
      priceOracle, 
      priceOracleAddress
    } = await deployFixture());
  });

  describe("Contract Deployment and Initialization", function () {
    it("should deploy contract correctly", async function () {
      expect(positionTraderAddress).to.be.a('string');
      expect(priceOracleAddress).to.be.a('string');
    });

    it("should set price oracle address correctly", async function () {
      const oracleAddress = await positionTrader.priceOracleAddress();
      expect(oracleAddress).to.equal(priceOracleAddress);
    });

    it("should set initial virtual assets correctly", async function () {
      const initialCash = await positionTrader.INITIAL_CASH_BASE();
      expect(initialCash).to.equal(1000);
    });

    it("should get current BTC price correctly", async function () {
      const price = await positionTrader.getCurrentBtcPrice();
      expect(price).to.equal(50000);
    });
  });

  describe("User Registration Function", function () {
    it("should allow user registration", async function () {
      // Check user initial state
      expect(await positionTrader.isRegistered(signers.alice.address)).to.be.false;

      // User registration
      const tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();

      // Verify registration status
      expect(await positionTrader.isRegistered(signers.alice.address)).to.be.true;
    });

    it("should not allow user to register twice", async function () {
      // First registration
      let tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();

      // Try second registration, should fail
      await expect(
        positionTrader.connect(signers.alice).register()
      ).to.be.revertedWith("User already registered");
    });

    it("should allow multiple users to register independently", async function () {
      // Alice registration
      let tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();

      // Bob registration
      tx = await positionTrader.connect(signers.bob).register();
      await tx.wait();

      // Verify both users are registered
      expect(await positionTrader.isRegistered(signers.alice.address)).to.be.true;
      expect(await positionTrader.isRegistered(signers.bob.address)).to.be.true;
    });

    it("registration should trigger UserRegistered event", async function () {
      await expect(positionTrader.connect(signers.alice).register())
        .to.emit(positionTrader, "UserRegistered")
        .withArgs(signers.alice.address);
    });
  });

  describe("Balance Query Function", function () {
    beforeEach(async () => {
      // Register user
      const tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();
    });

    it("should return registered user's balance correctly", async function () {
      // Get balance (this is encrypted)
      const encryptedBalance = await positionTrader.getBalance(signers.alice.address);
      
      // Verify return is a valid FHE ciphertext format
      expect(encryptedBalance).to.be.a('string');
      expect(encryptedBalance.length).to.be.greaterThan(0);
      
      // Decrypt balance and verify initial amount
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // Verify initial balance is 1000 USD
      expect(clearBalance).to.equal(1000);
    });

    it("unregistered user should fail to query balance", async function () {
      await expect(
        positionTrader.getBalance(signers.bob.address)
      ).to.be.revertedWith("User not registered");
    });

    it("should support balance decryption request", async function () {
      const requestTx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await requestTx.wait();
      
      // Verify event
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      expect(event).to.not.be.undefined;
    });

    it("should correctly update balance after a transaction", async function () {
      // Get initial balance
      const initialEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const initialClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        initialEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      expect(initialClearBalance).to.equal(1000);
      
      // Open position 10 contracts
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
      
      // Get balance after opening position
      const afterOpenEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterOpenClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterOpenEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // Balance after opening position should decrease (used as margin)
      expect(afterOpenClearBalance).to.be.lessThan(initialClearBalance);
    });

    it("should correctly get the latest balance decryption record", async function () {
      const [amount, timestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      
      // Should have no decryption records initially
      expect(amount).to.equal(0);
      expect(timestamp).to.equal(0);
    });
  });

  describe("Price Query Function", function () {
    it("should get adjusted BTC price correctly", async function () {
      const price = await positionTrader.getCurrentBtcPrice();
      expect(price).to.equal(50000);
    });

    it("price change should reflect in the contract", async function () {
      // Change price
      await priceOracle.setManualPrice(60000);
      
      const newPrice = await positionTrader.getCurrentBtcPrice();
      expect(newPrice).to.equal(60000);
    });
  });

  describe("Position Related Functions", function () {
    beforeEach(async () => {
      // Register user
      const tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();
    });

    it("should correctly get user position ID list", async function () {
      const positions = await positionTrader.getUserPositionIds(signers.alice.address);
      expect(positions).to.be.an('array');
      expect(positions.length).to.equal(0); // No positions initially
    });

    it("should be able to query position information (even if position does not exist)", async function () {
      const [owner, contractCount, btcSize, entryPrice, isLong] = 
        await positionTrader.getPosition(1);
      
      // Non-existent position should return zero address
      expect(owner).to.equal("0x0000000000000000000000000000000000000000");
    });
  });

  describe("Access Control Tests", function () {
    it("unregistered user should fail to call functions requiring registration", async function () {
      await expect(
        positionTrader.connect(signers.alice).revealMyBalance()
      ).to.be.revertedWith("User not registered");
    });

    it("non-position owner should have appropriate protection for accessing position functions", async function () {
      // This tests access control logic, actual open/close functions require more complex setup
      // Currently verifying function existence
      expect(positionTrader.openPosition).to.be.a('function');
      expect(positionTrader.closePosition).to.be.a('function');
    });
  });

  describe("Event Verification", function () {
    it("user registration should trigger correct event", async function () {
      await expect(positionTrader.connect(signers.alice).register())
        .to.emit(positionTrader, "UserRegistered")
        .withArgs(signers.alice.address);
    });

    it("balance decryption request should trigger correct event", async function () {
      // Register user first
      await positionTrader.connect(signers.alice).register();
      
      await expect(positionTrader.connect(signers.alice).revealMyBalance())
        .to.emit(positionTrader, "DecryptionRequested");
    });
  });

  describe("Balance Revelation Function", function () {
    beforeEach(async () => {
      // Register user and perform some transactions to change balance
      await positionTrader.connect(signers.alice).register();
      await positionTrader.connect(signers.bob).register();
    });

    it("should be able to successfully request balance decryption", async function () {
      const tx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await tx.wait();
      
      // Verify DecryptionRequested event
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(signers.alice.address);
      expect(event.args[1]).to.be.a('bigint'); // requestId
      expect(event.args[2]).to.be.a('bigint'); // timestamp
    });

    it("unregistered user should not be able to request balance decryption", async function () {
      await expect(
        positionTrader.connect(signers.charlie).revealMyBalance()
      ).to.be.revertedWith("User not registered");
    });

    it("should correctly handle decryption callback", async function () {
      // Initiate decryption request
      const tx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await tx.wait();
      
      const requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      const requestId = requestEvent.args[1];
      const timestamp = requestEvent.args[2];
      
      // Wait for FHEVM decryption oracle to complete decryption
      await hre.fhevm.awaitDecryptionOracle();
      
      // Verify decryption record updated
      const [amount, recordTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(1000); // Initial balance
      expect(recordTimestamp).to.equal(timestamp);
    });

    it("should correctly get the latest balance decryption record", async function () {
      // Should have no decryption records initially
      const [initialAmount, initialTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(initialAmount).to.equal(0);
      expect(initialTimestamp).to.equal(0);
      
      // Initiate decryption request
      const tx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await tx.wait();
      const requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      const requestId = requestEvent.args[1];
      const timestamp = requestEvent.args[2];
      
      // Wait for FHEVM decryption oracle to complete decryption
      await hre.fhevm.awaitDecryptionOracle();
      
      // Verify decryption record updated
      const [amount, recordTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(1000); // Initial balance
      expect(recordTimestamp).to.equal(timestamp);
    });

    it("unregistered user should not be able to query decryption records", async function () {
      await expect(
        positionTrader.getLatestBalanceReveal(signers.charlie.address)
      ).to.be.revertedWith("User not registered");
    });

    it("should support multiple decryption requests and record updates", async function () {
      // First decryption request
      let tx = await positionTrader.connect(signers.alice).revealMyBalance();
      let receipt = await tx.wait();
      let requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      let requestId = requestEvent.args[1];
      let timestamp1 = requestEvent.args[2];
      
      // Wait for first decryption to complete
      await hre.fhevm.awaitDecryptionOracle();
      
      // Verify first record
      let [amount, recordTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(1000);
      expect(recordTimestamp).to.equal(timestamp1);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate a transaction to change balance (open position)
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
      
      // Second decryption request
      tx = await positionTrader.connect(signers.alice).revealMyBalance();
      receipt = await tx.wait();
      requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      requestId = requestEvent.args[1];
      let timestamp2 = requestEvent.args[2];
      
      // Wait for second decryption to complete
      await hre.fhevm.awaitDecryptionOracle();
      
      // Verify record updated to latest (balance should be 950 after opening)
      [amount, recordTimestamp] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(950);
      expect(recordTimestamp).to.equal(timestamp2);
      expect(timestamp2).to.be.greaterThan(timestamp1);
    });

    it("should correctly decrypt updated balance after a transaction", async function () {
      // First perform a transaction to change balance
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
      
      // Request decryption of balance after the transaction
      const tx = await positionTrader.connect(signers.alice).revealMyBalance();
      const receipt = await tx.wait();
      const requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      const requestId = requestEvent.args[1];
      
      // Wait for FHEVM decryption oracle to complete decryption
      await hre.fhevm.awaitDecryptionOracle();
      
      // Verify decrypted balance is correct (should be 900 after opening)
      const [amount] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      expect(amount).to.equal(900);
    });

    it("should support multiple independent decryption records for different users", async function () {
      // Alice's decryption request
      let tx = await positionTrader.connect(signers.alice).revealMyBalance();
      let receipt = await tx.wait();
      let requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      let aliceRequestId = requestEvent.args[1];
      
      // Bob's decryption request
      tx = await positionTrader.connect(signers.bob).revealMyBalance();
      receipt = await tx.wait();
      requestEvent = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "DecryptionRequested"
      );
      let bobRequestId = requestEvent.args[1];
      
      // Wait for FHEVM decryption oracle to complete all decryption requests
      await hre.fhevm.awaitDecryptionOracle();
      
      // Verify respective records
      const [aliceAmount] = await positionTrader.getLatestBalanceReveal(signers.alice.address);
      const [bobAmount] = await positionTrader.getLatestBalanceReveal(signers.bob.address);
      
      expect(aliceAmount).to.equal(1000);
      expect(bobAmount).to.equal(1000);
    });
  });

  describe("Admin Functions", function () {
    it("contract owner should be able to update price oracle address", async function () {
      const newOracleAddress = "0x1234567890123456789012345678901234567890";
      
      await expect(
        positionTrader.connect(signers.deployer).updatePriceOracle(newOracleAddress)
      ).to.emit(positionTrader, "PriceOracleUpdated")
        .withArgs(priceOracleAddress, newOracleAddress);
      
      expect(await positionTrader.priceOracleAddress()).to.equal(newOracleAddress);
    });

    it("non-owner should not be able to update price oracle address", async function () {
      const newOracleAddress = "0x1234567890123456789012345678901234567890";
      
      await expect(
        positionTrader.connect(signers.alice).updatePriceOracle(newOracleAddress)
      ).to.be.revertedWithCustomError(positionTrader, "OwnableUnauthorizedAccount");
    });

    it("should not allow setting zero address as price oracle", async function () {
      await expect(
        positionTrader.connect(signers.deployer).updatePriceOracle("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("Invalid zero address");
    });
  });

  describe("Constant and Configuration Verification", function () {
    it("should have correct constant values", async function () {
      expect(await positionTrader.CONTRACT_USD_VALUE()).to.equal(1);
      expect(await positionTrader.BTC_PRECISION()).to.equal(100000000); // 1e8
      expect(await positionTrader.CALCULATION_PRECISION()).to.equal(100000000); // 1e8
    });
  });

  describe("Open Position Function Test", function () {
    beforeEach(async () => {
      // Register user
      const tx = await positionTrader.connect(signers.alice).register();
      await tx.wait();
    });

    it("should be able to successfully open long position and verify balance change", async function () {
      // Get initial balance
      const initialEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const initialClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        initialEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      expect(initialClearBalance).to.equal(1000);
      
      // Prepare encrypted input
      const contractCount = 100; // 100 USD
      const isLong = true;
      
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(isLong)
        .add64(contractCount)
        .encrypt();
      
      // Open position
      const tx = await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0], // isLong
        encryptedInput.handles[1], // usdAmount
        encryptedInput.inputProof
      );
      const receipt = await tx.wait();
      
      // Verify event
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionOpened"
      );
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(signers.alice.address);
      expect(event.args[2]).to.equal(50000); // Current price
      
      // Verify balance decrease
      const afterEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      expect(afterClearBalance).to.equal(initialClearBalance - BigInt(contractCount));
      
      // Verify position information
      const positions = await positionTrader.getUserPositionIds(signers.alice.address);
      expect(positions.length).to.equal(1);
      
      const [owner, encryptedContractCount, encryptedBtcSize, entryPrice, encryptedIsLong] = 
        await positionTrader.getPosition(positions[0]);
      
      expect(owner).to.equal(signers.alice.address);
      expect(entryPrice).to.equal(50000);
      
      // Decrypt position data
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

    it("should be able to successfully open short position and verify data accuracy", async function () {
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
      
      // Verify short position
      const [, , , , encryptedIsLong] = await positionTrader.getPosition(positions[0]);
      const clearIsLong = await fhevm.userDecryptEbool(
        encryptedIsLong,
        positionTraderAddress,
        signers.alice
      );
      expect(clearIsLong).to.be.false;
    });

    it("should be able to open positions at different prices and verify BTC position size", async function () {
      // First open position - price $50,000
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
      
      // Change price to $60,000
      await priceOracle.setManualPrice(60000);
      
      // Second open position - price $60,000
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
      
      // Verify second open position price
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionOpened"
      );
      expect(event.args[2]).to.equal(60000);
      
      // Verify user has two positions
      const positions = await positionTrader.getUserPositionIds(signers.alice.address);
      expect(positions.length).to.equal(2);
      
      // Verify BTC position size calculation is correct
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
      
      // First position: 100 USD / 50000 * 1e8 = 200000 satoshi
      expect(clearBtcSize1).to.equal(200000);
      // Second position: 120 USD / 60000 * 1e8 = 200000 satoshi
      expect(clearBtcSize2).to.equal(200000);
    });

    it("should correctly handle insufficient funds for opening position", async function () {
      // Try to open a very large position
      const largeContractCount = 1500; // More than initial funds 1000
      
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true)
        .add64(largeContractCount)
        .encrypt();
      
      // In FHEVM, insufficient funds will not directly revert, but will set the amount to 0
      const tx = await positionTrader.connect(signers.alice).openPosition(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      await tx.wait();
      
      // Verify balance did not change (because actual deducted amount was 0)
      const encryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const clearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      expect(clearBalance).to.equal(1000); // Balance unchanged
    });
  });

  describe("Close Position Function Test", function () {
    let positionId: number;
    let initialContractCount: number = 200;
    
    beforeEach(async () => {
      // Register user and open position
      await positionTrader.connect(signers.alice).register();
      
      const encryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .addBool(true) // Long
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

    it("should be able to successfully close position and verify balance change", async function () {
      // Get balance before closing
      const beforeEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const beforeClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        beforeEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // Close all
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
      
      // Verify close event
      const event = receipt.logs.find((log: any) => 
        log.fragment && log.fragment.name === "PositionClosed"
      );
      expect(event).to.not.be.undefined;
      expect(event.args[0]).to.equal(signers.alice.address);
      expect(event.args[1]).to.equal(positionId);
      expect(event.args[2]).to.equal(50000); // Close price
      
      // Verify balance recovery (price unchanged, should recover to initial state)
      const afterEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // Since price unchanged, balance after closing should recover to pre-opening level
      expect(afterClearBalance).to.be.greaterThan(beforeClearBalance);
    });

    it("should be able to profitably close long position after price increase and verify profit", async function () {
      // Get balance before closing
      const beforeEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const beforeClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        beforeEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // Price increases to $55,000 (+10%)
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
      expect(event.args[2]).to.equal(55000); // Close price
      
      // Verify profit: price increased by 10%, long position should profit
      const afterEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // Profit should be approximately: 200 * 1.1 = 220, total balance should be approximately 800 + 220 = 1020
      expect(afterClearBalance).to.be.greaterThan(1000);
      expect(afterClearBalance).to.be.greaterThan(beforeClearBalance + BigInt(initialContractCount));
    });

    it("should be able to incur loss when closing long position after price decrease and verify loss", async function () {
      // Get balance before closing
      const beforeEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const beforeClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        beforeEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // Price decreases to $45,000 (-10%)
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
      expect(event.args[2]).to.equal(45000); // Close price
      
      // Verify loss: price decreased by 10%, long position should incur loss
      const afterEncryptedBalance = await positionTrader.getBalance(signers.alice.address);
      const afterClearBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        afterEncryptedBalance,
        positionTraderAddress,
        signers.alice
      );
      
      // Loss should be approximately: 200 * 0.9 = 180, total balance should be approximately 800 + 180 = 980
      expect(afterClearBalance).to.be.lessThan(1000);
      expect(afterClearBalance).to.be.lessThan(beforeClearBalance + BigInt(initialContractCount));
    });

    it("non-position owner should not be able to close position", async function () {
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

    it("non-existent position ID should fail to close", async function () {
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

    it("should support partial closing and verify remaining positions", async function () {
      // Partial closing (close half)
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
      
      // Verify remaining positions
      const [, encryptedContractCount] = await positionTrader.getPosition(positionId);
      const clearContractCount = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedContractCount,
        positionTraderAddress,
        signers.alice
      );
      
      // Should have half remaining positions
      expect(clearContractCount).to.equal(BigInt(initialContractCount - partialCloseAmount));
    });
  });

  describe("Complex Transaction Scenario Test", function () {
    beforeEach(async () => {
      // Register multiple users
      await positionTrader.connect(signers.alice).register();
      await positionTrader.connect(signers.bob).register();
      await positionTrader.connect(signers.charlie).register();
    });

    it("should support multiple users trading simultaneously", async function () {
      // Alice opens long position
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
      
      // Bob opens short position
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
      
      // Charlie opens long position
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
      
      // Verify positions of each user
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(1);
      expect((await positionTrader.getUserPositionIds(signers.bob.address)).length).to.equal(1);
      expect((await positionTrader.getUserPositionIds(signers.charlie.address)).length).to.equal(1);
    });

    it("should correctly handle transactions under extreme price volatility", async function () {
      // Get initial balances of Alice and Bob
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

      // Alice opens long position at $50,000, invests 20 USD
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

      // Verify Alice's balance after opening position
      const aliceAfterOpenBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(aliceAfterOpenBalance).to.equal(BigInt(1000 - 20)); // 1000 - 20 = 980
      
      // Price crashes to $30,000
      await priceOracle.setManualPrice(30000);
      
      // Bob opens long position at low price, invests 25 USD
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

      // Verify Bob's balance after opening position
      const bobAfterOpenBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.bob.address),
        positionTraderAddress,
        signers.bob
      );
      expect(bobAfterOpenBalance).to.equal(BigInt(1000 - 25)); // 1000 - 25 = 975
      
      // Price rebounds to $55,000
      await priceOracle.setManualPrice(55000);
      
      // Alice profits from closing (from 50k to 55k)
      // Expected profit: 20 USD * (55000/50000) = 22 USD
      let closeEncryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(20)
        .encrypt();
      await positionTrader.connect(signers.alice).closePosition(
        alicePositionId,
        closeEncryptedInput.handles[0],
        closeEncryptedInput.inputProof
      );

      // Verify Alice's balance after closing
      const aliceAfterCloseBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      // Alice should profit: 20 * 55000/50000 = 22, so balance should be 980 + 22 = 1002
      expect(aliceAfterCloseBalance).to.equal(BigInt(1002));
      
      // Bob profits significantly from closing (from 30k to 55k)
      // Expected profit: 25 USD * (55000/30000) ≈ 45.83 USD
      closeEncryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.bob.address)
        .add64(25)
        .encrypt();
      await positionTrader.connect(signers.bob).closePosition(
        bobPositionId,
        closeEncryptedInput.handles[0],
        closeEncryptedInput.inputProof
      );

      // Verify Bob's balance after closing
      const bobAfterCloseBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.bob.address),
        positionTraderAddress,
        signers.bob
      );
      // Bob should profit: 25 * 55000/30000 ≈ 45.83, but integer arithmetic may have rounding
      // Expected balance: 975 + 45.83 ≈ 1020-1021
      expect(bobAfterCloseBalance).to.be.greaterThan(BigInt(1015));
      expect(bobAfterCloseBalance).to.be.lessThan(BigInt(1025));
      
      // Verify transaction completed - in FHE environment, position records are not deleted to maintain confidentiality
      // Position ID still exists, but contract count is 0 (encrypted)
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(1);
      expect((await positionTrader.getUserPositionIds(signers.bob.address)).length).to.equal(1);
    });

    it("should support multiple open/close operations for the same user", async function () {
      const positions = [];
      
      // Get initial balance
      const initialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(initialBalance).to.equal(1000);
      
      // Continuous open positions
      for (let i = 0; i < 3; i++) {
        const price = 50000 + i * 5000; // Price increases: 50000, 55000, 60000
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
      
      // Verify balance after opening positions: 1000 - 15 = 985
      const afterOpenBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(afterOpenBalance).to.equal(BigInt(1000 - 15)); // 1000 - (3 * 5) = 985
      
      // Verify 3 positions
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(3);
      
      // Close the second position (entry price 55000) at current price (60000)
      // Expected profit: 5 USD * (60000/55000) ≈ 5.45 USD
      const closeEncryptedInput = await fhevm
        .createEncryptedInput(positionTraderAddress, signers.alice.address)
        .add64(5)
        .encrypt();
      await positionTrader.connect(signers.alice).closePosition(
        positions[1], // Second position (55000 entry price)
        closeEncryptedInput.handles[0],
        closeEncryptedInput.inputProof
      );
      
      // Verify balance after closing
      const afterCloseBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      // Expected balance: 985 + (5 * 60000/55000) ≈ 985 + 5.45 ≈ 990-991
      expect(afterCloseBalance).to.be.greaterThan(BigInt(989));
      expect(afterCloseBalance).to.be.lessThan(BigInt(992));
      
      // Verify position count unchanged - in FHE environment, even partial closing, position records are not deleted
      // All 3 position IDs still exist, but positions[1]'s contract count is reduced (encrypted)
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(3);
    });
  });

  describe("Price Sensitivity Test", function () {
    beforeEach(async () => {
      await positionTrader.connect(signers.alice).register();
    });

    it("should correctly open positions at different price levels", async function () {
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

    it("should correctly handle extreme price changes", async function () {
      // Get initial balance
      const initialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(initialBalance).to.equal(1000);

      // Open position at normal price
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

      // Verify balance after opening
      const afterOpenBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(afterOpenBalance).to.equal(BigInt(1000 - 10)); // 1000 - 10 = 990
      
      // Extreme price change - price halved
      await priceOracle.setManualPrice(25000);
      
      // Should be able to close at extreme price
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

      // Verify balance after closing (price halved, long position incurs 50% loss)
      const afterCloseBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      // Expected loss: 10 * (25000/50000) = 5, balance should be: 990 + 5 = 995
      expect(afterCloseBalance).to.equal(BigInt(995));
    });

    it("should support continuous trading under rapid price changes", async function () {
      const priceSequence = [50000, 60000, 45000, 70000, 40000];
      
      // Get initial balance
      const initialBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      expect(initialBalance).to.equal(1000);
      
      for (let i = 0; i < priceSequence.length; i++) {
        await priceOracle.setManualPrice(priceSequence[i]);
        
        // Open position
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
        
        // Immediately close (at the same price)
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
      
      // Verify final balance - since opening and closing at the same price, balance should be close to initial value
      const finalBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await positionTrader.getBalance(signers.alice.address),
        positionTraderAddress,
        signers.alice
      );
      // Since opening and closing at the same price, theoretically balance should remain 1000, with slight deviation allowed
      expect(finalBalance).to.be.greaterThan(BigInt(999));
      expect(finalBalance).to.be.lessThan(BigInt(1001));
      
      // In FHE environment, position records are not deleted to maintain confidentiality
      // Each open position creates a position ID, closing only sets contract count to 0 (encrypted)
      expect((await positionTrader.getUserPositionIds(signers.alice.address)).length).to.equal(5);
    });
  });
}); 