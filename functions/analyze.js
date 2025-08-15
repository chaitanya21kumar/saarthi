// /analyze — send WhatsApp first, then return voice TwiML
exports.handler = async function (context, event, callback) {
    const twiml = new Twilio.twiml.VoiceResponse();
  
    // --- helpers ---
    const e164 = (x) => {
      const s = String(x || '').replace(/[^0-9+]/g, '');
      return s ? (s.startsWith('+') ? s : '+' + s) : '';
    };
    const pick = (...xs) => xs.find((v) => v && String(v).trim().length > 0) || '';
  
    // caller/callee discovery (works for both inbound & outbound)
    const fromVoice = e164(pick(event.From, event.Caller));    // your Twilio voice #
    const to1       = e164(event.To);                           // usually the callee
    const to2       = e164(event.Called);                       // sometimes used in voice webhooks
    const envVoice  = e164(context.TWILIO_VOICE_FROM || '');    // set in .env to your Twilio voice #
    const fallback  = e164(context.CALLEE_NUMBER || '');        // verified callee on trial
  
    let callee = to1 && to1 !== envVoice && to1 !== fromVoice ? to1
              : to2 && to2 !== envVoice && to2 !== fromVoice ? to2
              : fallback;
  
    console.log('[analyze] fromVoice=', fromVoice, 'envVoice=', envVoice, 'to1=', to1, 'to2=', to2, 'callee=', callee);
  
    // sentiment / intent
    const speech = (event.SpeechResult || '').toLowerCase();
    const digits = (event.Digits || '').trim();
    const NEG = ['problem','issue','tension','worried','cannot','delay','late','bad','no money','help'];
    const POS = ['pay','payment','will pay','paid','yes','ok','okay','fine','ready','i want to pay'];
    let sentiment = 'neutral';
    try {
      if (speech && NEG.some(w => speech.includes(w))) sentiment = 'negative';
      else if (speech && POS.some(w => speech.includes(w))) sentiment = 'positive';
      else if (digits) sentiment = 'neutral';
    } catch (e) { /* ignore */ }
    console.log('[analyze] speech=', speech, 'digits=', digits, 'sentiment=', sentiment);
  
    // ---- SEND WHATSAPP FIRST (synchronous, quick) ----
    try {
      if (!callee) throw new Error('No callee number resolved');
      const client = context.getTwilioClient();
      const fromWa = (context.WHATSAPP_FROM || '').trim(); // e.g., "whatsapp:+14155238886"
      if (!fromWa.startsWith('whatsapp:')) throw new Error('WHATSAPP_FROM must be like whatsapp:+14155238886');
  
      const toWa = `whatsapp:${callee}`;
      const link = context.PAYMENT_LINK || 'https://example.com/pay';
      const statusCb = `https://${context.DOMAIN_NAME}/msg_status`;
  
      const body = (sentiment === 'negative')
        ? `Hi! This is Saarthee from TVS Credit.\nI sensed some concerns. Pay securely: ${link}\nNeed help? Reply here.`
        : `Hi! This is Saarthee from TVS Credit.\nThanks for confirming. Complete your payment: ${link}\nWe’re here 24x7 if you need help.`;
  
      // If you later add CONTENT_SID for templates, switch to contentSid flow.
      const msg = await client.messages.create({
        from: fromWa,
        to:   toWa,
        body,
        statusCallback: statusCb
      });
  
      console.log('✅ WhatsApp queued. SID:', msg.sid, 'to:', toWa);
    } catch (err) {
      console.error('❌ WhatsApp send failed:', err?.code, err?.message || err);
      // Common causes to look for in Live Logs:
      // 63003: not joined the WA sandbox from that phone
      // 63016: outside the 24h session window (use a template / send "hi" from handset first)
      // 21606/21608: bad "from" or "to" formatting
    }
  
    // ---- now answer the call immediately ----
    twiml.say({ voice: 'alice' }, 'Thanks. I have sent you a WhatsApp message with your payment link. Goodbye.');
    twiml.hangup();
    return callback(null, twiml);
  };
  