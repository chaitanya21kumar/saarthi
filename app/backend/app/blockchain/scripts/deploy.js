const hre = require("hardhat");
async function main() {
  const C = await hre.ethers.deployContract("SaarthiProofs");
  await C.waitForDeployment();
  console.log("SaarthiProofs deployed to:", await C.getAddress());
}
main().catch((e)=>{ console.error(e); process.exit(1); });
