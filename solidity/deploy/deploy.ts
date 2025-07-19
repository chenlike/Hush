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

  console.log(`RevealStorage contract: `, deployedRevealStorage.address);

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
};

export default func;
func.id = "deploy_all_contracts"; // id required to prevent reexecution
func.tags = ["PriceOracle", "RevealStorage", "Trader"];
