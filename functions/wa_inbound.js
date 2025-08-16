// functions/wa_inbound.js
/* Handle inbound WhatsApp messages:
   - Classify intent (OpenAI if key present, else rule-based)
   - Reply from WhatsApp sandbox number
   - Post event to DASHBOARD_WEBHOOK for the UI timeline
*/
exports.handler = async function (context, event, callback) {
    const client = context.getTwilioClient();
  
    const from = String(event.From || '');          // e.g., "whatsapp:+91..."
    const body = String(event.Body || '').trim();
    const serviceDomain = `https://${context.DOMAIN_NAME}`;
  
    // --- helpers ---
    const nowIso = () => new Date().toISOString();
    const e164 = (x) => String(x || '').replace(/[^0-9+]/g, '').replace(/^(\d)/, '+$1');
    const normalize = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/[“”‘’]/g, "'")
        .replace(/[^a-z0-9\s'+]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
  
    // --- intent via OpenAI (if available) ---
    async function classifyOpenAI(utterance) {
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
                'You are an EMI collections assistant for TVS Credit. ' +
                'Return ONLY JSON: {"intent":"pay_now|need_time|cannot_pay|other","sentiment":"positive|neutral|negative"}. ' +
                'Examples: "I will pay today"->pay_now; "need extension"->need_time; "cannot pay"->cannot_pay.'
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
        console.log('OpenAI classify error:', e.message);
        return null;
      }
    }
  
    // --- fallback intent ---
    function classifyFallback(utterance) {
      const s = normalize(utterance);
      if (!s) return { intent: 'other', sentiment: 'neutral' };
  
      const POS = /\b(i\s*will\s*pay|will\s*pay|want\s*to\s*pay|ready\s*to\s*pay|can\s*pay|pay\s*now|paid)\b/;
      const DELAY = /\b(delay|extension|postpone|reschedule|later|tomorrow|next\s+(week|month)|time)\b/;
      const NEG = /(don'?t|do\s*not|cannot|can't|won't|will\s*not|not)\s+.*\bpay\b/;
  
      if (NEG.test(s)) return { intent: 'cannot_pay', sentiment: 'negative' };
      if (DELAY.test(s)) return { intent: 'need_time', sentiment: 'negative' };
      if (POS.test(s)) return { intent: 'pay_now', sentiment: 'positive' };
      return { intent: 'other', sentiment: 'neutral' };
    }
  
    // --- pick classifier ---
    let cls = await classifyOpenAI(body);
    if (!cls) cls = classifyFallback(body);
    const { intent, sentiment } = cls;
  
    // --- response templates ---
    const link = context.PAYMENT_LINK || 'https://example.com/pay';
    const due = (context.DUE_DATE || '').trim();          // optional
    const support = (context.SUPPORT_PHONE || '').trim(); // optional
  
    const replyByIntent = {
      pay_now:
        `Hi! This is Saarthi from TVS Credit.\n` +
        `Great—complete your payment here: ${link}\n` +
        `Reply “AGENT” anytime for help.`,
      need_time:
        `Hi! This is Saarthi from TVS Credit.\n` +
        (due ? `Your current due date is ${due}. ` : '') +
        `We can assist with extensions. Reply with a preferred date or “AGENT”.`,
      cannot_pay:
        `Hi! This is Saarthi from TVS Credit.\n` +
        `We understand it may be difficult right now. ` +
        (support ? `Call ${support} or ` : '') +
        `reply “AGENT” to connect with support.`,
      other:
        `Hi! This is Saarthi from TVS Credit.\n` +
        `Here’s your payment link: ${link}\n` +
        `Say what you need, or reply “AGENT”.`
    };
    const bodyOut = replyByIntent[intent] || replyByIntent.other;
  
    // --- send WhatsApp reply ---
    try {
      const msg = await client.messages.create({
        from: (context.WHATSAPP_FROM || '').trim(), // e.g., "whatsapp:+14155238886"
        to: from,
        body: bodyOut,
        statusCallback: `${serviceDomain}/msg_status`
      });
      console.log('WA reply sent, SID:', msg.sid, 'intent:', intent);
    } catch (err) {
      console.error('WA reply failed:', err.code, err.message);
    }
  
    // --- post to dashboard (if configured) ---
    try {
      const hook = (context.DASHBOARD_WEBHOOK || '').trim();
      if (hook) {
        await fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'wa_inbound',
            ts: nowIso(),
            from,
            body,
            intent,
            sentiment
          })
        });
      }
    } catch (e) {
      console.log('dashboard post failed:', e.message);
    }
  
    return callback(null, 'ok');
  };
  