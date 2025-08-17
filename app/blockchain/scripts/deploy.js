const fs = require('fs'); const path = require('path'); const hre = require("hardhat");
async function main(){ const C = await hre.ethers.deployContract("SaarthiProofs"); await C.waitForDeployment(); const addr = await C.getAddress(); console.log("SaarthiProofs deployed to:", addr); fs.writeFileSync(path.join(__dirname,'..','deployment.json'), JSON.stringify({address: addr}, null, 2)); }
main().catch(e=>{ console.error(e); process.exit(1); });
