const fs=require('fs'), path=require('path');
const { keccak256, toUtf8Bytes } = require('ethers');
let wallet=null, contract=null;
const LEDGER=path.join(__dirname,'data','ledger.json');
function appendLedger(r){const a=fs.existsSync(LEDGER)?JSON.parse(fs.readFileSync(LEDGER,'utf8')):[];a.push(r);while(a.length>2000)a.shift();fs.writeFileSync(LEDGER,JSON.stringify(a,null,2));}
async function init(){
  try{
    const { ethers } = require('ethers');
    const RPC=process.env.SAARTHI_RPC_URL, PK=process.env.SAARTHI_PRIVATE_KEY, CA=process.env.SAARTHI_CONTRACT;
    if(!RPC||!PK||!CA) return;
    const provider=new ethers.JsonRpcProvider(RPC);
    wallet=new ethers.Wallet(PK, provider);
    const abi=["function storeProof(bytes32 key, string typ, string meta) public","event ProofStored(bytes32 indexed key, address indexed by, string typ, string meta)"];
    contract=new (require('ethers').Contract)(CA, abi, wallet);
  }catch(e){}
}
async function writeProof(typ,payload){
  const json=JSON.stringify(payload); const hash=keccak256(toUtf8Bytes(json));
  const rec={ ts:new Date().toISOString(), type:typ, hash, meta:payload };
  try{
    if(contract){ const tx=await contract.storeProof(hash, typ, json); rec.tx=(await tx.wait()).hash; } else { rec.tx="FILE_MODE"; }
  }catch(e){ rec.tx="ERROR:"+e.message; }
  appendLedger(rec); return rec;
}
init().catch(()=>{});
function status(){
  return { onchain: !!contract, contract: process.env.SAARTHI_CONTRACT||null, rpc: process.env.SAARTHI_RPC_URL||null };
}
module.exports={ writeProof, status }
;
