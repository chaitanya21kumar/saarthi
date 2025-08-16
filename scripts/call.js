// scripts/call.js
require('dotenv').config();
const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  CALLEE_NUMBER,
  VOICE_WEBHOOK_URL,          // optional override
  VOICE_STATUS_WEBHOOK        // optional: dashboard status endpoint
} = process.env;

function fail(m){ console.error('❌', m); process.exit(1); }
if (!TWILIO_ACCOUNT_SID) fail('Set TWILIO_ACCOUNT_SID');
if (!TWILIO_AUTH_TOKEN)  fail('Set TWILIO_AUTH_TOKEN');
if (!TWILIO_PHONE_NUMBER) fail('Set TWILIO_PHONE_NUMBER');
if (!CALLEE_NUMBER)      fail('Set CALLEE_NUMBER');

const defaultVoiceUrl = 'https://saarthi-3010-dev.twil.io/voice';
const url = (VOICE_WEBHOOK_URL && VOICE_WEBHOOK_URL.trim()) || defaultVoiceUrl;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
console.log('📞 Placing call:', { from: TWILIO_PHONE_NUMBER, to: CALLEE_NUMBER, url });

client.calls
  .create({
    from: TWILIO_PHONE_NUMBER,
    to: CALLEE_NUMBER,
    url,
    method: 'POST',
    statusCallback: (VOICE_STATUS_WEBHOOK || '').trim() || undefined,
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['initiated','ringing','answered','completed']
  })
  .then(c => console.log('✅ Call placed. SID:', c.sid))
  .catch(e => { console.error('❌ Call failed:', e.code, e.message); process.exit(1); });
