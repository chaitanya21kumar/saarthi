// backend/call.js  ── simple helper to queue an outbound call
require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function dialCustomer(toNumber) {
  try {
    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,          // +14062984261
      to:   toNumber,                                 // e.g. +917869711689 (verified)
      url:  'https://6aff5d924e88.ngrok-free.app/voice'   // current ngrok URL
    });
    console.log('✅ Call queued, SID:', call.sid);
  } catch (err) {
    console.error('❌ Call failed:', err.message);
  }
}

// ---- run it (comment out later if you embed in another module) ----
dialCustomer('+917869711689');
