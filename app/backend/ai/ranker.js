const { pickLangForCustomer } = require('../i18n/messages');
const CH = ['voice','wa'], LG = ['en','hi','ta','te'], TS = ['morn','aft','eve'];
const oneHot = (arr, k) => arr.map(x => x===k ? 1 : 0);
const norm = (x,d)=> Math.max(0, Math.min(1, x/d));
const daysTo = iso => Math.floor((new Date(iso)-new Date())/(1000*3600*24));
function historySignals(events, phone){
  const e=(events||[]).filter(ev => (ev.callee===phone || ev.from===`whatsapp:${phone}` || ev.to===phone));
  const count = k => e.filter(x=>x.intent===k).length;
  const lastPay = e.slice().reverse().find(x=>x.intent==='pay_now');
  return { payNow:count('pay_now'), needTime:count('need_time'), cannotPay:count('cannot_pay'),
    lastPayAgo: lastPay ? (Date.now()-new Date(lastPay.ts||lastPay.recvTs||Date.now()))/3600000 : 999 };
}
function customerVec(c,h){
  const dueUrg=1-Math.tanh(Math.max(0, daysTo(c.due_date||new Date().toISOString()))/10);
  const sc=Number(c.score||0), amt=norm(Number(c.amount||0), 5000);
  const pos=Math.min(1,h.payNow/5), neg=Math.min(1,h.cannotPay/3);
  return [dueUrg, sc, amt, pos, neg];
}
function optionVec(o){ return [].concat(
  oneHot(CH,o.channel), oneHot(LG,o.lang), oneHot(TS,o.slot)
);}
function projectCustomer(v){
  const [u,s,a,p,n]=v;
  return [0.8*u+0.6*s, 0.6*u+0.7*p, 0.7*u, 0.1*s, 0.1*a, 0.1*p, 0.1*a, 0.7*u, 0.6*s, 0.5*(1-n)];
}
const dot=(a,b)=>a.reduce((m,ai,i)=>m+ai*b[i],0);
function buildOptions(c){
  const lang=pickLangForCustomer(c);
  const hr=new Date().getHours();
  const slots= hr<12?['morn','aft','eve']: hr<18?['aft','eve','morn']:['eve','morn','aft'];
  const langs=[lang,'en'].filter((v,i,a)=>a.indexOf(v)===i);
  const out=[]; for(const channel of CH){ for(const lg of langs){ for(const s of slots){ out.push({channel,lang:lg,slot:s}); }}}
  return out;
}
function rankOptions(customer, events){
  const phone=String(customer.phone).replace(/[^0-9+]/g,'');
  const hist=historySignals(events, phone);
  const cVec=projectCustomer(customerVec(customer, hist));
  const scored=buildOptions(customer).map(o=>({...o, score: dot(cVec, optionVec(o))}));
  scored.sort((a,b)=>b.score-a.score);
  return scored;
}
module.exports = { rankOptions };
