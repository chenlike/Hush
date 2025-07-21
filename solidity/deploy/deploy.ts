import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, upgrades } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("开始部署可升级合约...");

  // 1. 首先部署 PriceOracle 可升级合约
  console.log("部署 PriceOracle 可升级合约...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await upgrades.deployProxy(PriceOracle, [], {
    initializer: "initialize",
    kind: "uups",
  });
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();

  console.log(`PriceOracle 代理合约地址: ${priceOracleAddress}`);

  // 2. 部署 RevealStorage 可升级合约
  console.log("部署 RevealStorage 可升级合约...");
  const RevealStorage = await ethers.getContractFactory("RevealStorage");
  const revealStorage = await upgrades.deployProxy(RevealStorage, [], {
    initializer: "initialize",
    kind: "uups",
  });
  await revealStorage.waitForDeployment();
  const revealStorageAddress = await revealStorage.getAddress();

  console.log(`RevealStorage 代理合约地址: ${revealStorageAddress}`);

  // 3. 部署 Trader 可升级合约，传入 PriceOracle 和 RevealStorage 的地址
  console.log("部署 Trader 可升级合约...");
  const Trader = await ethers.getContractFactory("Trader");
  const trader = await upgrades.deployProxy(Trader, [priceOracleAddress, revealStorageAddress], {
    initializer: "initialize",
    kind: "uups",
  });
  await trader.waitForDeployment();
  const traderAddress = await trader.getAddress();

  console.log(`Trader 代理合约地址: ${traderAddress}`);
  
  console.log("\n所有可升级合约部署完成！");
  console.log("PriceOracle 代理:", priceOracleAddress);
  console.log("RevealStorage 代理:", revealStorageAddress);
  console.log("Trader 代理:", traderAddress);

  // 4. 等待交易确认和Etherscan同步
  console.log("\n等待交易确认和Etherscan同步...");
  console.log("等待30秒...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  // 5. 验证合约
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

  // 验证所有合约（可升级合约的验证方式略有不同）
  await verifyContract("PriceOracle", priceOracleAddress, []);
  await verifyContract("RevealStorage", revealStorageAddress, []);
  await verifyContract("Trader", traderAddress, [priceOracleAddress, revealStorageAddress]);

  console.log("\n🎉 可升级合约部署和验证完成！");
  console.log("代理合约地址:");
  console.log("PriceOracle 代理:", priceOracleAddress);
  console.log("RevealStorage 代理:", revealStorageAddress);
  console.log("Trader 代理:", traderAddress);
  
  console.log("\n注意：这些是可升级合约，使用代理模式部署。");
  console.log("如需升级合约，请使用 upgrades.upgradeProxy() 方法。");
};

export default func;
func.id = "deploy_upgradeable_contracts"; // id required to prevent reexecution
func.tags = ["PriceOracle", "RevealStorage", "Trader"];
