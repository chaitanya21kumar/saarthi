// scripts/call.js
require('dotenv').config();
const twilio = require('twilio');

// --- read env ---
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  CALLEE_NUMBER,
  VOICE_WEBHOOK_URL,              // optional override
} = process.env;

// basic validation
function fail(msg) { console.error('❌', msg); process.exit(1); }
if (!TWILIO_ACCOUNT_SID) fail('Set TWILIO_ACCOUNT_SID in .env');
if (!TWILIO_AUTH_TOKEN)  fail('Set TWILIO_AUTH_TOKEN in .env');
if (!TWILIO_PHONE_NUMBER) fail('Set TWILIO_PHONE_NUMBER (your Twilio voice number, e.g. +1406...)');
if (!CALLEE_NUMBER)      fail('Set CALLEE_NUMBER (must be verified on trial)');

// fallback to your deployed Function URL if VOICE_WEBHOOK_URL not set
const defaultVoiceUrl = 'https://saarthi-3010-dev.twil.io/voice';
const url = (VOICE_WEBHOOK_URL && VOICE_WEBHOOK_URL.trim()) || defaultVoiceUrl;

if (!/^https?:\/\//.test(url)) fail('VOICE_WEBHOOK_URL must be an http(s) URL');

// place the call
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
console.log('📞 Placing call:', { from: TWILIO_PHONE_NUMBER, to: CALLEE_NUMBER, url });

client.calls
  .create({ from: TWILIO_PHONE_NUMBER, to: CALLEE_NUMBER, url, method: 'POST' })
  .then(c => console.log('✅ Call placed. SID:', c.sid))
  .catch(e => {
    console.error('❌ Call failed:', e.code, e.message);
    process.exit(1);
  });
