// backend/call-direct.js
require('dotenv').config();
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// On Twilio trial, the callee MUST be a verified number
const TO_NUMBER = process.env.CALLEE_NUMBER || '+91XXXXXXXXXX';

async function dialCustomer() {
  // Using YOUR exact <Say> snippet
  const twiml = `
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    Namaste! This is Saarthee, your friendly E M I reminder demo.
  </Say>
</Response>`;

  try {
    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: TO_NUMBER,
      twiml
    });
    console.log('✅ Call queued, SID:', call.sid);
  } catch (err) {
    console.error('❌ Call failed:', err.message);
    process.exit(1);
  }
}

dialCustomer();
