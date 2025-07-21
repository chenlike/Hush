import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, upgrades } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  console.log("开始升级可升级合约...");

  // 从部署记录中获取代理合约地址
  try {
    const priceOracleDeployment = await hre.deployments.get("PriceOracle");
    const revealStorageDeployment = await hre.deployments.get("RevealStorage");
    const traderDeployment = await hre.deployments.get("Trader");

    console.log("从部署记录中获取的代理合约地址:");
    console.log("PriceOracle 代理:", priceOracleDeployment.address);
    console.log("RevealStorage 代理:", revealStorageDeployment.address);
    console.log("Trader 代理:", traderDeployment.address);

    // 升级 PriceOracle 合约
    console.log("\n升级 PriceOracle 合约...");
    const PriceOracleV2 = await ethers.getContractFactory("PriceOracle");
    await upgrades.upgradeProxy(priceOracleDeployment.address, PriceOracleV2);
    console.log("✅ PriceOracle 升级成功");

    // 升级 RevealStorage 合约
    console.log("升级 RevealStorage 合约...");
    const RevealStorageV2 = await ethers.getContractFactory("RevealStorage");
    await upgrades.upgradeProxy(revealStorageDeployment.address, RevealStorageV2);
    console.log("✅ RevealStorage 升级成功");

    // 升级 Trader 合约
    console.log("升级 Trader 合约...");
    const TraderV2 = await ethers.getContractFactory("Trader");
    await upgrades.upgradeProxy(traderDeployment.address, TraderV2);
    console.log("✅ Trader 升级成功");

    console.log("\n🎉 所有可升级合约升级完成！");
    console.log("升级后的代理合约地址:");
    console.log("PriceOracle 代理:", priceOracleDeployment.address);
    console.log("RevealStorage 代理:", revealStorageDeployment.address);
    console.log("Trader 代理:", traderDeployment.address);

    // 等待交易确认和Etherscan同步
    console.log("\n等待交易确认和Etherscan同步...");
    console.log("等待30秒...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 验证升级后的合约
    console.log("开始验证升级后的合约...");
    
    const verifyContract = async (contractName: string, address: string, constructorArguments: any[] = []) => {
      try {
        console.log(`验证升级后的 ${contractName} 合约...`);
        await hre.run("verify:verify", {
          address: address,
          constructorArguments: constructorArguments,
        });
        console.log(`✅ 升级后的 ${contractName} 合约验证成功！`);
        return true;
      } catch (error: any) {
        if (error.message.includes("already verified")) {
          console.log(`✅ 升级后的 ${contractName} 合约已经验证过了！`);
          return true;
        } else if (error.message.includes("does not have bytecode")) {
          console.log(`⏳ 升级后的 ${contractName} 合约字节码还未同步到Etherscan，请稍后手动验证`);
          console.log(`   地址: ${address}`);
          return false;
        } else {
          console.log(`❌ 升级后的 ${contractName} 合约验证失败:`, error.message);
          return false;
        }
      }
    };

    // 验证所有升级后的合约
    await verifyContract("PriceOracle", priceOracleDeployment.address, []);
    await verifyContract("RevealStorage", revealStorageDeployment.address, []);
    await verifyContract("Trader", traderDeployment.address, [priceOracleDeployment.address, revealStorageDeployment.address]);

    console.log("\n🎉 可升级合约升级和验证完成！");
    console.log("升级后的代理合约地址:");
    console.log("PriceOracle 代理:", priceOracleDeployment.address);
    console.log("RevealStorage 代理:", revealStorageDeployment.address);
    console.log("Trader 代理:", traderDeployment.address);

  } catch (error) {
    console.error("❌ 升级失败:", error);
    console.log("请确保已经运行过部署脚本，并且部署记录存在");
    process.exit(1);
  }
};

export default func;
func.id = "upgrade_all_contracts"; // id required to prevent reexecution
func.tags = ["upgrade", "PriceOracle", "RevealStorage", "Trader"]; 