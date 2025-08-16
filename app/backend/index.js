// app/backend/index.js
// Dashboard backend with SSE stream, ingest endpoints, actions (/api/call, /api/wa),
// and an "Agentic Campaign Runner" that auto-picks & calls contacts.
// Node 22+

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); // load root .env first
require('dotenv').config(); // then local .env if present

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = fs.promises;
const twilio = require('twilio');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 4000;

// ---- data store ----
const DATA_DIR   = path.join(__dirname, 'data');
const EVENTS_FN  = path.join(DATA_DIR, 'events.json');
const CUST_FN    = path.join(DATA_DIR, 'customers.json');

// ---- twilio ----
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  WHATSAPP_FROM,
  VOICE_STATUS_WEBHOOK,
  VOICE_WEBHOOK_URL,
  CALLEE_NUMBER, // your verified number on trial
} = process.env;

const client = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN)
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

// ----------------- helpers (fs) -----------------
async function ensureStore() {
  await fsp.mkdir(DATA_DIR, { recursive: true }).catch(()=>{});
  try { await fsp.access(EVENTS_FN); } catch { await fsp.writeFile(EVENTS_FN, '[]', 'utf8'); }
  // customers.json created by you (step 2). If missing, we'll create a tiny default.
  try { await fsp.access(CUST_FN); } catch {
    const def = [
      { id:'c1', name:'You',   phone: CALLEE_NUMBER || '+919999999999', due_date: '2025-08-20', amount: 2300, score: 0.8, status:'queued', last_contact:null, next_action:'call' },
      { id:'c2', name:'Demo2', phone: '+919876543210',                   due_date: '2025-08-18', amount: 1800, score: 0.6, status:'queued', last_contact:null, next_action:'call', demo:true }
    ];
    await fsp.writeFile(CUST_FN, JSON.stringify(def, null, 2), 'utf8');
  }
}
async function readEvents(){ await ensureStore(); try { return JSON.parse(await fsp.readFile(EVENTS_FN, 'utf8')||'[]'); } catch { return []; } }
async function appendEvent(evt){
  const arr = await readEvents();
  arr.push(evt);
  while (arr.length > 1000) arr.shift();
  await fsp.writeFile(EVENTS_FN, JSON.stringify(arr, null, 2), 'utf8');
  return evt;
}
async function readCustomers(){ await ensureStore(); return JSON.parse(await fsp.readFile(CUST_FN, 'utf8')); }
async function writeCustomers(list){ await fsp.writeFile(CUST_FN, JSON.stringify(list, null, 2), 'utf8'); }

// ----------------- express base -----------------
app.use(cors());
app.use(express.json());

// ----------------- SSE stream -------------------
const clients = new Set();
function broadcast(type, payload){
  const data = JSON.stringify(payload);
  for (const res of clients){
    try { res.write(`event: ${type}\n`); res.write(`data: ${data}\n\n`); } catch {}
  }
}
app.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const boot = (await readEvents()).slice(-200);
  res.write(`event: boot\n`);
  res.write(`data: ${JSON.stringify(boot)}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
  const id = setInterval(()=>{ try { res.write(':\n\n'); } catch {} }, 25000);
  res.on('close', ()=> clearInterval(id));
});

// --------------- ingest from Functions ----------
app.post('/ingest', async (req, res) => {
  const evt = { ...req.body, recvTs: new Date().toISOString(), type: req.body.type || 'unknown' };
  try { await appendEvent(evt); broadcast('event', evt); res.json({ ok:true }); }
  catch(e){ console.error('ingest', e.message); res.status(500).json({ ok:false }); }
});
app.post('/voice_status', async (req, res) => {
  const evt = { type:'voice_status', ...req.body, recvTs: new Date().toISOString() };
  await appendEvent(evt); broadcast('event', evt);
  res.json({ ok:true });
});

// --------------- REST for UI --------------------
app.get('/api/events', async (_req, res)=> res.type('json').send(JSON.stringify(await readEvents())));
app.get('/api/stats', async (_req, res) => {
  const a = await readEvents();
  const pick = k => a.filter(x => (x.type||'')===k).length;
  const intents = i => a.filter(x => (x.intent||'')===i).length;
  res.json({
    total: a.length,
    voice_status: pick('voice_status'),
    voice_analyze: pick('voice_analyze'),
    wa_inbound: pick('wa_inbound'),
    intents: {
      pay_now: intents('pay_now'),
      need_time: intents('need_time'),
      cannot_pay: intents('cannot_pay'),
      other: intents('other')
    }
  });
});

// --------------- actions: place call / send WA --
const e164 = x => String(x||'').replace(/[^0-9+]/g,'').replace(/^(\d)/,'+$1');

app.post('/api/call', async (req, res) => {
  try {
    if (!client) throw new Error('Twilio client not configured');
    const to = e164(req.body?.to) || e164(CALLEE_NUMBER || '');
    if (!to) throw new Error('Provide "to" number (E.164)');
    const url = (VOICE_WEBHOOK_URL && VOICE_WEBHOOK_URL.trim()) || 'https://saarthi-3010-dev.twil.io/voice';
    const call = await client.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to, url, method:'POST',
      statusCallback: (VOICE_STATUS_WEBHOOK || '').trim() || undefined,
      statusCallbackMethod:'POST',
      statusCallbackEvent: ['initiated','ringing','answered','completed']
    });
    const evt = await appendEvent({ type:'voice_status', action:'dashboard_call', CallSid:call.sid, to, ts:new Date().toISOString() });
    broadcast('event', evt);
    res.json({ ok:true, sid: call.sid });
  } catch(e){ res.status(400).json({ ok:false, error:e.message }); }
});

app.post('/api/wa', async (req, res) => {
  try {
    if (!client) throw new Error('Twilio client not configured');
    const to = e164(req.body?.to); const body = String(req.body?.body||'').trim();
    if (!to || !body) throw new Error('Provide "to" (E.164) and "body"');
    const msg = await client.messages.create({ from: (WHATSAPP_FROM||'').trim(), to: `whatsapp:${to}`, body });
    const evt = await appendEvent({ type:'wa_inbound', from:`whatsapp:${to}`, body, ts:new Date().toISOString(), sentiment:'neutral', intent:'other', source:'dashboard_send' });
    broadcast('event', evt);
    res.json({ ok:true, sid: msg.sid });
  } catch(e){ res.status(400).json({ ok:false, error:e.message }); }
});

// --------------- agentic campaign runner --------
const state = {
  running: false,
  demo: true,                 // default: simulate non-verified contacts
  intervalMs: 15000,          // default cadence
  timer: null
};
const nowISO = () => new Date().toISOString();
const daysTo = (iso) => {
  const d = new Date(iso); const t = (d - new Date())/(1000*3600*24);
  return Math.floor(t);
};
function priority(c){
  // higher is earlier to contact
  const dueBoost = Math.max(0, 7 - Math.max(0, daysTo(c.due_date||nowISO()))); // nearer due -> higher
  const score = Number(c.score||0);         // risk/propensity score [0..1]
  const recencyPenalty = c.last_contact ? 1 : 0; // contacted recently? small penalty
  return dueBoost + 2*score - recencyPenalty;
}
function canActuallyCall(c){
  // On trial we can call only verified numbers. Let’s only place a real call to CALLEE_NUMBER.
  return CALLEE_NUMBER && e164(c.phone) === e164(CALLEE_NUMBER);
}
async function mark(list, id, patch){
  const i = list.findIndex(x=>x.id===id);
  if (i>=0){ list[i] = { ...list[i], ...patch }; await writeCustomers(list); }
}
async function pickNext(){
  const list = await readCustomers();
  const eligible = list.filter(c => (c.status||'queued') !== 'done');
  if (!eligible.length) return null;
  eligible.sort((a,b)=> priority(b) - priority(a));
  return eligible[0];
}
async function tick(){
  const cand = await pickNext();
  if (!cand) return;
  const list = await readCustomers();

  if (canActuallyCall(cand)){
    // real call through Twilio
    try {
      const to = e164(cand.phone);
      const url = (VOICE_WEBHOOK_URL && VOICE_WEBHOOK_URL.trim()) || 'https://saarthi-3010-dev.twil.io/voice';
      const call = await client.calls.create({
        from: TWILIO_PHONE_NUMBER, to, url, method:'POST',
        statusCallback: (VOICE_STATUS_WEBHOOK||'').trim() || undefined,
        statusCallbackMethod:'POST',
        statusCallbackEvent: ['initiated','ringing','answered','completed']
      });
      await appendEvent({ type:'voice_status', source:'campaign', action:'auto_call', CallSid:call.sid, to, ts: nowISO() });
      broadcast('event', { type:'voice_status', source:'campaign', action:'auto_call', to, ts: nowISO() });
      await mark(list, cand.id, { status:'called', last_contact: nowISO() });
    } catch(e){
      await appendEvent({ type:'voice_status', source:'campaign', action:'error', error:e.message, to:cand.phone, ts: nowISO() });
      await mark(list, cand.id, { status:'error', last_contact: nowISO() });
    }
  } else {
    // simulate (for non-verified contacts) so charts still look rich
    const intents = ['pay_now','need_time','cannot_pay','other'];
    // basic heuristic: if due within 2 days -> need_time; else random with more weight to pay_now/need_time
    const due = daysTo(cand.due_date||nowISO());
    let intent = (due <= 2) ? 'need_time' : intents[Math.random()<0.5?0:(Math.random()<0.8?1:3)];
    const sentiment = intent==='pay_now' ? 'positive' : (intent==='cannot_pay' ? 'negative' : 'neutral');

    await appendEvent({ type:'voice_analyze', intent, sentiment, callee: e164(cand.phone), speech:'(simulated)', ts: nowISO() });
    await appendEvent({ type:'voice_status', callStatus:'simulated', to: e164(cand.phone), ts: nowISO(), source:'campaign' });
    broadcast('event', { type:'voice_analyze', intent, sentiment, callee: e164(cand.phone), speech:'(simulated)', ts: nowISO() });

    await mark(list, cand.id, { status:'done', last_contact: nowISO() });
  }
}

function stopRunner(){
  if (state.timer){ clearInterval(state.timer); state.timer = null; }
  state.running = false;
}
function startRunner(){
  stopRunner();
  state.timer = setInterval(tick, state.intervalMs);
  state.running = true;
}

// endpoints to control campaign
app.get('/api/campaign/status', async (_req,res)=>{
  const list = await readCustomers();
  const total = list.length;
  const queued = list.filter(c => (c.status||'queued')==='queued').length;
  const done   = list.filter(c => c.status==='done').length;
  const called = list.filter(c => c.status==='called').length;
  const next = await pickNext();
  res.json({
    running: state.running, demo: state.demo, intervalMs: state.intervalMs,
    counts: { total, queued, called, done },
    next: next ? { id: next.id, name: next.name, phone: next.phone, due_date: next.due_date, amount: next.amount, score: next.score, priority: priority(next) } : null
  });
});
app.post('/api/campaign/start', async (req,res)=>{
  if (typeof req.body?.intervalMs === 'number' && req.body.intervalMs >= 3000) state.intervalMs = req.body.intervalMs;
  state.demo = !!req.body?.demo;
  startRunner();
  res.json({ ok:true, running: state.running, intervalMs: state.intervalMs, demo: state.demo });
});
app.post('/api/campaign/stop', async (_req,res)=>{ stopRunner(); res.json({ ok:true, running:false }); });
app.post('/api/campaign/reset', async (_req,res)=>{
  const list = await readCustomers();
  for (const c of list){ c.status='queued'; c.last_contact=null; }
  await writeCustomers(list);
  res.json({ ok:true });
});

// --------------- static UI ----------------------
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'dashboard.html')));
app.get('/healthz', (_req, res) => res.send('ok'));

app.listen(PORT, () => console.log(`✅ Dashboard (SSE+Actions+Campaign) on http://localhost:${PORT}`));
