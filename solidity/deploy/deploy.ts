import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // 1. 首先部署 PriceOracle 合约
  const deployedPriceOracle = await deploy("PriceOracle", {
    from: deployer,
    log: true,
  });

  console.log(`PriceOracle contract: `, deployedPriceOracle.address);

  // 2. 部署 RevealStorage 合约
  const deployedRevealStorage = await deploy("RevealStorage", {
    from: deployer,
    log: true,
  });

  console.log(`RevealSt
    orage contract: `, deployedRevealStorage.address);

  // 3. 部署 Trader 合约，传入 PriceOracle 和 RevealStorage 的地址
  const deployedTrader = await deploy("Trader", {
    from: deployer,
    log: true,
    args: [deployedPriceOracle.address, deployedRevealStorage.address],
  });

  console.log(`Trader contract: `, deployedTrader.address);
  
  console.log("所有合约部署完成！");
  console.log("PriceOracle:", deployedPriceOracle.address);
  console.log("RevealStorage:", deployedRevealStorage.address);
  console.log("Trader:", deployedTrader.address);

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

  // 验证所有合约
  await verifyContract("PriceOracle", deployedPriceOracle.address, []);
  await verifyContract("RevealStorage", deployedRevealStorage.address, []);
  await verifyContract("Trader", deployedTrader.address, [deployedPriceOracle.address, deployedRevealStorage.address]);

  console.log("\n🎉 部署和验证完成！");
  console.log("合约地址:");
  console.log("PriceOracle:", deployedPriceOracle.address);
  console.log("RevealStorage:", deployedRevealStorage.address);
  console.log("Trader:", deployedTrader.address);
};

export default func;
func.id = "deploy_all_contracts"; // id required to prevent reexecution
func.tags = ["PriceOracle", "RevealStorage", "Trader"];
