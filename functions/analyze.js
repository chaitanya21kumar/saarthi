// /analyze — classify with OpenAI (if key present), send WhatsApp, then TwiML
exports.handler = async function (context, event, callback) {
    const twiml = new Twilio.twiml.VoiceResponse();
  
    // ---------- helpers ----------
    const e164 = (x) => {
      const s = String(x || '').replace(/[^0-9+]/g, '');
      return s ? (s.startsWith('+') ? s : '+' + s) : '';
    };
    const pick = (...xs) => xs.find((v) => v && String(v).trim().length > 0) || '';
    const normalize = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/[“”‘’]/g, "'")
        .replace(/[^a-z0-9\s'+]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
  
    // ---------- OpenAI intent ('pay_now' | 'need_time' | 'cannot_pay' | 'other') ----------
    async function classifyWithOpenAI(utterance) {
      const key = (context.OPENAI_API_KEY || '').trim();
      if (!key) return null;
      try {
        const payload = {
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'Classify the customer utterance. Respond ONLY JSON like '
                + '{"intent":"pay_now|need_time|cannot_pay|other","sentiment":"positive|negative|neutral"}. '
                + 'Rules: wants to pay/pay now -> pay_now; needs more time/extension -> need_time; '
                + 'cannot/won’t pay -> cannot_pay; otherwise other.'
            },
            { role: 'user', content: String(utterance || '') }
          ]
        };
  
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON in model response');
        const parsed = JSON.parse(match[0]);
        const intent = String(parsed.intent || '').toLowerCase();
        const sentiment = String(parsed.sentiment || '').toLowerCase();
        if (!['pay_now','need_time','cannot_pay','other'].includes(intent)) return null;
        return { intent, sentiment };
      } catch (e) {
        console.error('OpenAI classify error:', e?.message || e);
        return null;
      }
    }
  
    // ---------- fallback classifier (used if OpenAI missing/fails) ----------
    function fallbackClassify(speechRaw, digitsRaw) {
      const d = String(digitsRaw || '').trim();
      if (d === '1') return { intent: 'pay_now', sentiment: 'positive' };
      if (d === '2') return { intent: 'need_time', sentiment: 'negative' };
      if (d === '3') return { intent: 'cannot_pay', sentiment: 'negative' };
  
      const s = normalize(speechRaw);
      if (!s) return { intent: 'other', sentiment: 'neutral' };
  
      const NEG = /(don'?t|do\s*not|cannot|can't|won't|will\s*not|not)\s+.*\bpay\b/;
      const DELAY = /\b(delay|extension|postpone|reschedule|later|tomorrow|next\s+(week|month)|time)\b/;
      const POS = /\b(i\s*will\s*pay|will\s*pay|want\s*to\s*pay|ready\s*to\s*pay|can\s*pay|pay\s*now|paid)\b/;
  
      if (NEG.test(s)) return { intent: 'cannot_pay', sentiment: 'negative' };
      if (DELAY.test(s)) return { intent: 'need_time', sentiment: 'negative' };
      if (POS.test(s) || (/\bpay\b/.test(s) && !/(don'?t|do\s*not|cannot|can't|won't|not)/.test(s)))
        return { intent: 'pay_now', sentiment: 'positive' };
  
      return { intent: 'other', sentiment: 'neutral' };
    }
  
    // ---------- callee ----------
    const fromVoice = e164(pick(event.From, event.Caller));
    const to1 = e164(event.To);
    const to2 = e164(event.Called);
    const envVoice = e164(context.TWILIO_VOICE_FROM || '');
    const fallback = e164(context.CALLEE_NUMBER || '');
    const callee =
      (to1 && to1 !== envVoice && to1 !== fromVoice && to1) ||
      (to2 && to2 !== envVoice && to2 !== fromVoice && to2) ||
      fallback;
  
    const speech = String(event.SpeechResult || '');
    const digits = String(event.Digits || '').trim();
  
    let cls = await classifyWithOpenAI(speech);
    if (!cls) cls = fallbackClassify(speech, digits);
    const { intent, sentiment } = cls;
  
    console.log('[analyze]', { speech, digits, intent, sentiment, callee });
  
    // ---------- WhatsApp message templates ----------
    const link = context.PAYMENT_LINK || 'https://example.com/pay';
    const due = (context.DUE_DATE || '').trim();                   // e.g., 2025-08-30
    const support = (context.SUPPORT_PHONE || '').trim();          // e.g., +91XXXXXXXXXX
  
    const msgByIntent = {
      pay_now:
        `Hi! This is Saarthi from TVS Credit.\n`
        + `Thanks for confirming. Complete your payment here: ${link}\n`
        + `We’re here 24x7 if you need help.`,
  
      need_time:
        `Hi! This is Saarthi from TVS Credit.\n`
        + (due ? `Your due date is ${due}. ` : '')
        + `No worries—if you need a little more time, just reply here and we’ll guide you.\n`
        + (support ? `You can also call us at ${support}.` : `We’re here 24x7 if you need help.`),
  
      cannot_pay:
        `Hi! This is Saarthi from TVS Credit.\n`
        + (due ? `Your current due date is ${due}. ` : '')
        + `We understand it may be difficult right now. We can discuss options.\n`
        + (support ? `Reply “AGENT” or call ${support} for assistance.` : `Reply “AGENT” for assistance.`),
  
      other:
        `Hi! This is Saarthi from TVS Credit.\n`
        + `Here’s your payment link: ${link}\n`
        + `Reply if you’d like an agent to assist.`
    };
  
    // ---------- send WhatsApp first ----------
    try {
      if (!callee) throw new Error('No callee number resolved');
      const client = context.getTwilioClient();
      const fromWa = (context.WHATSAPP_FROM || '').trim(); // "whatsapp:+14155238886"
      if (!fromWa.startsWith('whatsapp:')) throw new Error('WHATSAPP_FROM must be whatsapp:+E164');
  
      const toWa = `whatsapp:${callee}`;
      const statusCb = `https://${context.DOMAIN_NAME}/msg_status`;
      const body = msgByIntent[intent] || msgByIntent.other;
  
      const msg = await client.messages.create({
        from: fromWa,
        to: toWa,
        body,
        statusCallback: statusCb
      });
      console.log('✅ WhatsApp queued. SID:', msg.sid, 'intent:', intent);
    } catch (err) {
      console.error('❌ WhatsApp send failed:', err?.code, err?.message || err);
    }
  
    // ---------- voice hangup ----------
    twiml.say(
      { voice: 'Polly.Aditi', language: 'en-IN' },
      'Thank you. I have sent you a WhatsApp message with your payment details. Goodbye.'
    );
    twiml.hangup();
    return callback(null, twiml);
  };
  