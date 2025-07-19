import { HardhatRuntimeEnvironment } from "hardhat/types";

async function main(hre: HardhatRuntimeEnvironment) {
  const { run } = hre;
  const { deployments } = hre as any;

  console.log("开始手动验证合约...");

  try {
    // 从部署记录中获取合约地址
    const priceOracle = await deployments.get("PriceOracle");
    const revealStorage = await deployments.get("RevealStorage");
    const trader = await deployments.get("Trader");

    console.log("从部署记录中获取的合约地址:");
    console.log("PriceOracle:", priceOracle.address);
    console.log("RevealStorage:", revealStorage.address);
    console.log("Trader:", trader.address);

    // 验证 PriceOracle 合约
    console.log("\n验证 PriceOracle 合约...");
    try {
      await run("verify:verify", {
        address: priceOracle.address,
        constructorArguments: [],
      });
      console.log("✅ PriceOracle 合约验证成功！");
    } catch (error: any) {
      if (error.message.includes("already verified")) {
        console.log("✅ PriceOracle 合约已经验证过了！");
      } else if (error.message.includes("does not have bytecode")) {
        console.log("⏳ PriceOracle 合约字节码还未同步到Etherscan");
        console.log("请等待几分钟后再次运行验证");
      } else {
        console.log("❌ PriceOracle 合约验证失败:", error.message);
      }
    }

    // 验证 RevealStorage 合约
    console.log("\n验证 RevealStorage 合约...");
    try {
      await run("verify:verify", {
        address: revealStorage.address,
        constructorArguments: [],
      });
      console.log("✅ RevealStorage 合约验证成功！");
    } catch (error: any) {
      if (error.message.includes("already verified")) {
        console.log("✅ RevealStorage 合约已经验证过了！");
      } else if (error.message.includes("does not have bytecode")) {
        console.log("⏳ RevealStorage 合约字节码还未同步到Etherscan");
        console.log("请等待几分钟后再次运行验证");
      } else {
        console.log("❌ RevealStorage 合约验证失败:", error.message);
      }
    }

    // 验证 Trader 合约
    console.log("\n验证 Trader 合约...");
    try {
      await run("verify:verify", {
        address: trader.address,
        constructorArguments: [priceOracle.address, revealStorage.address],
      });
      console.log("✅ Trader 合约验证成功！");
    } catch (error: any) {
      if (error.message.includes("already verified")) {
        console.log("✅ Trader 合约已经验证过了！");
      } else if (error.message.includes("does not have bytecode")) {
        console.log("⏳ Trader 合约字节码还未同步到Etherscan");
        console.log("请等待几分钟后再次运行验证");
      } else {
        console.log("❌ Trader 合约验证失败:", error.message);
      }
    }

  } catch (error) {
    console.log("❌ 无法获取部署记录，请确保已经运行过部署脚本");
    console.log("错误:", error);
  }

  console.log("\n验证完成！");
}

// 如果直接运行此脚本
if (require.main === module) {
  const hre = require("hardhat");
  main(hre)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main as verifyContractsManually }; 