require('dotenv').config({ path: require('path').join(__dirname,'..','..','.env') });
const { ethers, keccak256, toUtf8Bytes } = require('ethers');
(async ()=>{
  const RPC=process.env.SAARTHI_RPC_URL, PK=process.env.SAARTHI_PRIVATE_KEY, CA=process.env.SAARTHI_CONTRACT;
  const provider=new ethers.JsonRpcProvider(RPC);
  const wallet=new ethers.Wallet(PK, provider);
  const abi=["function storeProof(bytes32 key, string typ, string meta) public"];
  const c=new ethers.Contract(CA, abi, wallet);
  const meta=JSON.stringify({ping:"ok", ts:new Date().toISOString()});
  const hash=keccak256(toUtf8Bytes(meta));
  const tx=await c.storeProof(hash,"health",meta);
  const rc=await tx.wait();
  console.log("tx", rc.hash);
})().catch(e=>{ console.error(e); process.exit(1); });
