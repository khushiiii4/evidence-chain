const hre = require("hardhat");

async function main() {
  console.log("Deploying Evidence contract...");

  const Evidence = await hre.ethers.getContractFactory("Evidence");
  const evidence = await Evidence.deploy();
  await evidence.waitForDeployment();

  const address = await evidence.getAddress();
  console.log(`\n✅ Evidence contract deployed to: ${address}`);
  console.log(`\nCopy this address into server/.env as CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
