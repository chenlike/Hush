import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("开始部署合约...");

  // 1. 首先部署 PriceOracle 合约
  console.log("部署 PriceOracle 合约...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  
  // Sepolia测试网上的BTC/USD价格预言机地址
  const BTC_USD_AGGREGATOR_SEPOLIA = "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43";
  
  const priceOracle = await PriceOracle.deploy(BTC_USD_AGGREGATOR_SEPOLIA as any);
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();

  console.log(`PriceOracle 合约地址: ${priceOracleAddress}`);

  // 2. 部署 PositionTrader 合约，传入 PriceOracle 的地址和初始现金
  console.log("部署 PositionTrader 合约...");
  const PositionTrader = await ethers.getContractFactory("PositionTrader");
  const INITIAL_CASH_BASE = 100000; // 用户初始虚拟资产 (USD)
  const positionTrader = await PositionTrader.deploy(priceOracleAddress, INITIAL_CASH_BASE);
  await positionTrader.waitForDeployment();
  const positionTraderAddress = await positionTrader.getAddress();

  console.log(`PositionTrader 合约地址: ${positionTraderAddress}`);
  console.log(`用户初始虚拟资产: ${INITIAL_CASH_BASE} USD`);
  
  console.log("\n所有合约部署完成！");
  console.log("PriceOracle:", priceOracleAddress);
  console.log("PositionTrader:", positionTraderAddress);
  console.log("初始虚拟资产:", `${INITIAL_CASH_BASE} USD`);

  // 3. 等待交易确认和Etherscan同步
  console.log("\n等待交易确认和Etherscan同步...");
  console.log("等待30秒...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  // 4. 验证合约
  console.log("开始验证合约...");
  
  const verifyContract = async (contractName: string, address: string, constructorArguments: any[] = []) => {
    try {
      console.log(`验证 ${contractName} 合约...`);
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: constructorArguments,
      });
      console.log(`✅ ${contractName} 合约验证成功！`);
      return true;
    } catch (error: any) {
      if (error.message.includes("already verified")) {
        console.log(`✅ ${contractName} 合约已经验证过了！`);
        return true;
      } else if (error.message.includes("does not have bytecode")) {
        console.log(`⏳ ${contractName} 合约字节码还未同步到Etherscan，请稍后手动验证`);
        console.log(`   地址: ${address}`);
        return false;
      } else {
        console.log(`❌ ${contractName} 合约验证失败:`, error.message);
        return false;
      }
    }
  };

  // 验证所有合约
  await verifyContract("PriceOracle", priceOracleAddress, [BTC_USD_AGGREGATOR_SEPOLIA]);
  await verifyContract("PositionTrader", positionTraderAddress, [priceOracleAddress, INITIAL_CASH_BASE]);

  console.log("\n🎉 合约部署和验证完成！");
  console.log("合约地址:");
  console.log("PriceOracle:", priceOracleAddress);
  console.log("PositionTrader:", positionTraderAddress);
  console.log("\n合约配置:");
  console.log("BTC/USD 价格预言机:", BTC_USD_AGGREGATOR_SEPOLIA);
  console.log("用户初始虚拟资产:", `${INITIAL_CASH_BASE} USD`);
  
  console.log("\n注意：这些都是普通合约，不可升级。");
};

export default func;
func.id = "deploy_contracts"; // id required to prevent reexecution
func.tags = ["PriceOracle", "PositionTrader"];
