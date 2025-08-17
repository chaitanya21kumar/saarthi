const fs=require('fs'), path=require('path');
const STORE=path.join(__dirname,'..','data','bandit.json');
const DEC=path.join(__dirname,'..','data','decisions.json');
const load=(p,d)=>{try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return d;}};
const save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2));
const key=o=>`${o.channel}|${o.lang}|${o.slot}`;
const totalN=s=>Object.values(s).reduce((a,b)=>a+(b.n||0),0);
function select(cs,eps=0.15){
  const s=load(STORE,{});
  if(Math.random()<eps) return cs[Math.floor(Math.random()*cs.length)];
  return cs.map(o=>{const k=key(o),x=s[k]||{n:0,r:0},avg=x.n?x.r/x.n:0.5,bonus=Math.sqrt(Math.log(1+totalN(s))/(1+x.n));return {...o,bandit:avg+0.7*bonus};}).sort((a,b)=>b.bandit-a.bandit)[0];
}
function update(arm,reward){const s=load(STORE,{});const x=s[arm]||{n:0,r:0};x.n+=1;x.r+=Number(reward||0);s[arm]=x;save(STORE,s);}
function rememberDecision(phone,chosen){const m=load(DEC,{});m[phone]={chosen,ts:Date.now()};save(DEC,m);}
function matchDecision(phone,maxAge=900000){const m=load(DEC,{});const d=m[phone];if(!d) return null;return (Date.now()-d.ts)>maxAge?null:d.chosen;}
const armKeyFromOption=o=>`${o.channel}|${o.lang}|${o.slot}`;
module.exports={select,update,rememberDecision,matchDecision,armKeyFromOption};
