import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Starting contract deployment...");

  // 1. First deploy PriceOracle contract
  console.log("Deploying PriceOracle contract...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  
  // BTC/USD price oracle address on Sepolia testnet
  const BTC_USD_AGGREGATOR_SEPOLIA = "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43";
  
  const priceOracle = await PriceOracle.deploy(BTC_USD_AGGREGATOR_SEPOLIA as any);
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();

  console.log(`PriceOracle contract address: ${priceOracleAddress}`);

  // 2. Deploy PositionTrader contract, passing PriceOracle address and initial cash
  console.log("Deploying PositionTrader contract...");
  const PositionTrader = await ethers.getContractFactory("PositionTrader");
  const INITIAL_CASH_BASE = 100000; // User initial virtual assets (USD)
  const positionTrader = await PositionTrader.deploy(priceOracleAddress, INITIAL_CASH_BASE);
  await positionTrader.waitForDeployment();
  const positionTraderAddress = await positionTrader.getAddress();

  console.log(`PositionTrader contract address: ${positionTraderAddress}`);
  console.log(`User initial virtual assets: ${INITIAL_CASH_BASE} USD`);
  
  console.log("\nAll contracts deployed successfully!");
  console.log("PriceOracle:", priceOracleAddress);
  console.log("PositionTrader:", positionTraderAddress);
  console.log("Initial virtual assets:", `${INITIAL_CASH_BASE} USD`);

  // 3. Wait for transaction confirmation and Etherscan sync
  console.log("\nWaiting for transaction confirmation and Etherscan sync...");
  console.log("Waiting 30 seconds...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  // 4. Verify contracts
  console.log("Starting contract verification...");
  
  const verifyContract = async (contractName: string, address: string, constructorArguments: any[] = []) => {
    try {
      console.log(`Verifying ${contractName} contract...`);
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: constructorArguments,
      });
      console.log(`✅ ${contractName} contract verification successful!`);
      return true;
    } catch (error: any) {
      if (error.message.includes("already verified")) {
        console.log(`✅ ${contractName} contract already verified!`);
        return true;
      } else if (error.message.includes("does not have bytecode")) {
        console.log(`⏳ ${contractName} contract bytecode not yet synced to Etherscan, please verify manually later`);
        console.log(`   Address: ${address}`);
        return false;
      } else {
        console.log(`❌ ${contractName} contract verification failed:`, error.message);
        return false;
      }
    }
  };

  // Verify all contracts
  await verifyContract("PriceOracle", priceOracleAddress, [BTC_USD_AGGREGATOR_SEPOLIA]);
  await verifyContract("PositionTrader", positionTraderAddress, [priceOracleAddress, INITIAL_CASH_BASE]);

  console.log("\n🎉 Contract deployment and verification completed!");
  console.log("Contract addresses:");
  console.log("PriceOracle:", priceOracleAddress);
  console.log("PositionTrader:", positionTraderAddress);
  console.log("\nContract configuration:");
  console.log("BTC/USD Price Oracle:", BTC_USD_AGGREGATOR_SEPOLIA);
  console.log("User initial virtual assets:", `${INITIAL_CASH_BASE} USD`);
  
  console.log("\nNote: These are regular contracts, not upgradeable.");
};

export default func;
func.id = "deploy_contracts"; // id required to prevent reexecution
func.tags = ["PriceOracle", "PositionTrader"];
