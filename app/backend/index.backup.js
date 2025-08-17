const path=require('path');
require('dotenv').config({ path: path.join(__dirname,'..','..','.env') });
require('dotenv').config();
const express=require('express'), cors=require('cors'), fs=require('fs'), fsp=fs.promises, twilio=require('twilio');
const { rankOptions } = require('./ai/ranker');
const { select, update, rememberDecision, matchDecision, armKeyFromOption } = require('./ai/bandit');
const { writeProof, status: chainStatus } = require('./blockchain');
const i18n=require('./i18n/messages');

const app=express(); const PORT=process.env.DASHBOARD_PORT||4000;
const DATA_DIR=path.join(__dirname,'data'); const EVENTS_FN=path.join(DATA_DIR,'events.json'); const CUST_FN=path.join(DATA_DIR,'customers.json');

const { TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN,TWILIO_PHONE_NUMBER,WHATSAPP_FROM,VOICE_STATUS_WEBHOOK,VOICE_WEBHOOK_URL,CALLEE_NUMBER } = process.env;
const client=(TWILIO_ACCOUNT_SID&&TWILIO_AUTH_TOKEN)?twilio(TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN):null;

async function ensureStore(){ await fsp.mkdir(DATA_DIR,{recursive:true}).catch(()=>{}); try{await fsp.access(EVENTS_FN);}catch{await fsp.writeFile(EVENTS_FN,'[]','utf8');}
  try{await fsp.access(CUST_FN);}catch{const def=[{id:'c1',name:'You',phone:CALLEE_NUMBER||'+919999999999',due_date:'2025-08-20',amount:2300,score:0.8,status:'queued',last_contact:null,next_action:'call'},{id:'c2',name:'Demo2',phone:'+919876543210',due_date:'2025-08-18',amount:1800,score:0.6,status:'queued',last_contact:null,next_action:'call',demo:true}]; await fsp.writeFile(CUST_FN,JSON.stringify(def,null,2),'utf8');}}
async function readEvents(){ await ensureStore(); try{return JSON.parse(await fsp.readFile(EVENTS_FN,'utf8')||'[]');}catch{return[];} }
async function appendEvent(evt){ const a=await readEvents(); a.push(evt); while(a.length>1000)a.shift(); await fsp.writeFile(EVENTS_FN,JSON.stringify(a,null,2),'utf8'); return evt; }
async function readCustomers(){ await ensureStore(); return JSON.parse(await fsp.readFile(CUST_FN,'utf8')); }
async function writeCustomers(list){ await fsp.writeFile(CUST_FN,JSON.stringify(list,null,2),'utf8'); }

app.use(cors()); app.use(express.json());

const clients=new Set();
function broadcast(type,p){const d=JSON.stringify(p); for(const res of clients){ try{res.write(`event: ${type}\n`); res.write(`data: ${d}\n\n`);}catch{}}}
app.get('/stream', async (req,res)=>{ res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache'); res.setHeader('Connection','keep-alive'); res.flushHeaders?.();
  const boot=(await readEvents()).slice(-200); res.write(`event: boot\n`); res.write(`data: ${JSON.stringify(boot)}\n\n`); clients.add(res); req.on('close',()=>clients.delete(res));
  const id=setInterval(()=>{ try{res.write(':\n\n');}catch{} },25000); res.on('close',()=>clearInterval(id)); });

app.post('/ingest', async (req,res)=>{ const evt={...req.body, recvTs:new Date().toISOString(), type:req.body.type||'unknown'};
  try{ await appendEvent(evt); broadcast('event',evt);
    const phone=String(evt.callee||evt.to||'').replace(/[^0-9+]/g,''); const chosen=phone?matchDecision(phone):null;
    if(chosen && evt.intent){ const rewMap={pay_now:1.0, need_time:0.4, cannot_pay:0.0, other:0.1}; update(chosen, rewMap[evt.intent] ?? 0.0); await writeProof('interaction_outcome',{phone,intent:evt.intent,sentiment:evt.sentiment||'na',chosen}); }
    res.json({ok:true}); }catch(e){ res.status(500).json({ok:false}); }});
app.post('/voice_status', async (req,res)=>{ const evt={type:'voice_status',...req.body,recvTs:new Date().toISOString()}; await appendEvent(evt); broadcast('event',evt); res.json({ok:true}); });

app.get('/api/events', async(_req,res)=>res.type('json').send(JSON.stringify(await readEvents())));
app.get('/api/stats', async(_req,res)=>{ const a=await readEvents(); const pick=k=>a.filter(x=>(x.type||'')===k).length; const intents=i=>a.filter(x=>(x.intent||'')===i).length;
  res.json({ total:a.length, voice_status:pick('voice_status'), voice_analyze:pick('voice_analyze'), wa_inbound:pick('wa_inbound'),
    intents:{ pay_now:intents('pay_now'), need_time:intents('need_time'), cannot_pay:intents('cannot_pay'), other:intents('other') } }); });

const e164=x=>String(x||'').replace(/[^0-9+]/g,'').replace(/^(\d)/,'+$1');
app.post('/api/call', async (req,res)=>{ try{
  if(!client) throw new Error('Twilio client not configured');
  const to=e164(req.body?.to) || e164(CALLEE_NUMBER||''); if(!to) throw new Error('Provide "to" number');
  const lang=(req.body?.lang||'en').toLowerCase();
  const base=(VOICE_WEBHOOK_URL && VOICE_WEBHOOK_URL.trim()) || 'https://saarthi-3010-dev.twil.io/voice';
  const call=await client.calls.create({ from:TWILIO_PHONE_NUMBER, to, url:`${base}?lang=${encodeURIComponent(lang)}`, method:'POST',
    statusCallback:(VOICE_STATUS_WEBHOOK||'').trim()||undefined, statusCallbackMethod:'POST', statusCallbackEvent:['initiated','ringing','answered','completed'] });
  const evt=await appendEvent({type:'voice_status',action:'dashboard_call',CallSid:call.sid,to,lang,ts:new Date().toISOString()}); broadcast('event',evt);
  res.json({ok:true,sid:call.sid}); }catch(e){ res.status(400).json({ok:false,error:e.message}); }});

app.post('/api/wa', async (req,res)=>{ try{
  if(!client) throw new Error('Twilio client not configured');
  const to=e164(req.body?.to); const body=String(req.body?.body||'').trim(); if(!to||!body) throw new Error('Provide to/body');
  const msg=await client.messages.create({ from:(WHATSAPP_FROM||'').trim(), to:`whatsapp:${to}`, body });
  const evt=await appendEvent({ type:'wa_inbound', from:`whatsapp:${to}`, body, ts:new Date().toISOString(), sentiment:'neutral', intent:'other', source:'dashboard_send' }); broadcast('event',evt);
  res.json({ok:true,sid:msg.sid}); }catch(e){ res.status(400).json({ok:false,error:e.message}); }});

const state={running:false,demo:true,intervalMs:15000,timer:null}; const nowISO=()=>new Date().toISOString();
const daysTo=iso=>{const d=new Date(iso);return Math.floor((d-new Date())/(1000*3600*24));};
function priority(c){ const dueBoost=Math.max(0,7-Math.max(0,daysTo(c.due_date||nowISO()))); const score=Number(c.score||0); const recency=c.last_contact?1:0; return dueBoost+2*score-recency; }
function canActuallyCall(c){ return CALLEE_NUMBER && e164(c.phone)===e164(CALLEE_NUMBER); }
async function mark(list,id,patch){ const i=list.findIndex(x=>x.id===id); if(i>=0){ list[i]={...list[i],...patch}; await writeCustomers(list);} }
async function pickNext(){ const list=await readCustomers(); const eligible=list.filter(c=>(c.status||'queued')!=='done'); if(!eligible.length) return null; eligible.sort((a,b)=>priority(b)-priority(a)); return eligible[0]; }

async function tick(){
  const cand=await pickNext(); if(!cand) return;
  const events=await readEvents(); const ranked=rankOptions(cand, events); const chosen=select(ranked.slice(0,6)); const armKey=armKeyFromOption(chosen);
  const phone=e164(cand.phone); rememberDecision(phone, armKey);
  const decision=await appendEvent({ type:'rank_decision', ts:nowISO(), phone, chosen, armKey, top:ranked.slice(0,3) }); broadcast('event',decision);
  await writeProof('rank_decision', { phone, chosen, top3: ranked.slice(0,3) });
  try { const _p = await writeProof('rank_decision', { phone, chosen, top3: ranked.slice(0,3) });
        broadcast('event', { type:'proof', ts:_p.ts, kind:_p.type, tx:_p.tx, hash:_p.hash }); } catch(_e){}


  const lang=chosen.lang || i18n.pickLangForCustomer(cand); const link=process.env.PAYMENT_LINK || 'https://example.com/pay';
  if(chosen.channel==='voice' && canActuallyCall(cand)){
    try{
      const base=(VOICE_WEBHOOK_URL && VOICE_WEBHOOK_URL.trim()) || 'https://saarthi-3010-dev.twil.io/voice';
      const call=await client.calls.create({ from:TWILIO_PHONE_NUMBER, to:phone, url:`${base}?lang=${encodeURIComponent(lang)}`, method:'POST',
        statusCallback:(VOICE_STATUS_WEBHOOK||'').trim()||undefined, statusCallbackMethod:'POST', statusCallbackEvent:['initiated','ringing','answered','completed'] });
      await appendEvent({ type:'voice_status', source:'campaign', action:'auto_call', CallSid:call.sid, to:phone, lang, ts:nowISO() });
      await mark(await readCustomers(), cand.id, { status:'called', last_contact:nowISO() });
    }catch(e){
      await appendEvent({ type:'voice_status', source:'campaign', action:'error', error:e.message, to:phone, ts:nowISO() });
      await mark(await readCustomers(), cand.id, { status:'error', last_contact:nowISO() });
    }
  } else {
    const body=i18n.waBody('other', lang, link, cand.due_date||null, process.env.SUPPORT_PHONE||null);
    try{
      if(client){ await client.messages.create({ from:(WHATSAPP_FROM||'').trim(), to:`whatsapp:${phone}`, body }); }
      await appendEvent({ type:'wa_inbound', ts:nowISO(), from:`whatsapp:${phone}`, body, intent:'other', sentiment:'neutral', source:'campaign_ranked', lang });
      await mark(await readCustomers(), cand.id, { status:'done', last_contact:nowISO() });
    }catch(e){
      await appendEvent({ type:'wa_inbound', ts:nowISO(), from:`whatsapp:${phone}`, body:'WA send failed', intent:'other', sentiment:'neutral', error:e.message });
    }
  }
}
function stopRunner(){ if(state.timer){clearInterval(state.timer); state.timer=null;} state.running=false; }
function startRunner(){ stopRunner(); state.timer=setInterval(tick, state.intervalMs); state.running=true; }

app.get('/api/campaign/status', async (_req,res)=>{ const list=await readCustomers(); const total=list.length; const queued=list.filter(c=>(c.status||'queued')==='queued').length; const done=list.filter(c=>c.status==='done').length; const called=list.filter(c=>c.status==='called').length; const next=await pickNext();
  res.json({ running:state.running, demo:state.demo, intervalMs:state.intervalMs, counts:{ total, queued, called, done }, next: next?{ id:next.id,name:next.name,phone:next.phone,due_date:next.due_date,amount:next.amount,score:next.score,priority:priority(next)}:null });});
app.post('/api/campaign/start', async (req,res)=>{ if(typeof req.body?.intervalMs==='number' && req.body.intervalMs>=3000) state.intervalMs=req.body.intervalMs; state.demo=!!req.body?.demo; startRunner(); setTimeout(tick,100); res.json({ok:true,running:state.running,intervalMs:state.intervalMs,demo:state.demo}); });
app.post('/api/campaign/stop', async (_req,res)=>{ stopRunner(); res.json({ok:true,running:false}); });
app.post('/api/campaign/reset', async (_req,res)=>{ const list=await readCustomers(); for(const c of list){ c.status='queued'; c.last_contact=null; } await writeCustomers(list); res.json({ok:true}); });


app.get('/api/ledger/tail', async (req,res)=>{
  try{
    const n = Math.max(1, Math.min(50, parseInt(req.query.n||'10',10)));
    const p = require('path').join(__dirname,'data','ledger.json');
    const arr = require('fs').existsSync(p) ? JSON.parse(require('fs').readFileSync(p,'utf8')||'[]') : [];
    res.json(arr.slice(-n));
  } catch(e){ res.status(500).json({ok:false,error:e.message}); }
});
app.get('/api/config', (_req,res)=>{
  res.json({ chain: chainStatus(), defaultLang: process.env.DEFAULT_LANG||'en', payment: process.env.PAYMENT_LINK||null });
});
app.get('/api/bandit', (_req,res)=>{
  try{
    const p = require('path').join(__dirname,'data','bandit.json');
    const obj = require('fs').existsSync(p) ? JSON.parse(require('fs').readFileSync(p,'utf8')||'{}') : {};
    res.json(obj);
  }catch(e){ res.json({}); }
});
app.get('/api/prompt', (req,res)=>{
  try{
    const lang = String(req.query.lang||'en').toLowerCase();
    const msg = require('./i18n/messages').voicePrompt(lang);
    res.json({ lang, prompt: msg });
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/', (_req,res)=> res.sendFile(path.join(__dirname,'..','frontend','dashboard.html')));
app.get('/healthz', (_req,res)=> res.send('ok'));



// --- Auto-ring: prefer verified number and call immediately on Start ---
(function(){
  const COOLDOWN_MS = Number(process.env.PRIORITY_COOLDOWN_MS||120000);
  const _origPick = pickNext;
  pickNext = async function(){
    try{
      const list = await readCustomers();
      const e = x=>String(x||'').replace(/[^0-9+]/g,'').replace(/^([0-9])/,'+$1');
      const verified = (CALLEE_NUMBER||'').trim();
      const v = list.find(c=> e(c.phone)===e(verified));
      const recent = c => c && c.last_contact && (Date.now()-Date.parse(c.last_contact) < COOLDOWN_MS);
      if (v && (v.status||'queued')!=='done' && !recent(v)) return v;
    }catch{}
    return _origPick();
  };
})();
app.listen(PORT, ()=> console.log(`✅ Dashboard (AI+Bandit+Chain) on http://localhost:${PORT}`));
