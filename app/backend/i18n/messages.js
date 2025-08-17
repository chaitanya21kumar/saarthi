module.exports = {
  voicePrompt(lang='en') {
    const t = {
      en: 'Namaste. This is Saarthi—your friendly EMI reminder. You can say “I want to pay” or “I need more time”. Or press 1 to pay now, 2 for extension, 3 if you cannot pay.',
      hi: 'नमस्ते। यह सारथि — आपका ईएमआई रिमाइंडर। आप कह सकते हैं “मुझे भुगतान करना है” या “मुझे समय चाहिए”, या 1 दबाएँ भुगतान के लिए, 2 समय बढ़ाने के लिए, 3 यदि भुगतान संभव नहीं।',
      ta: 'வணக்கம். இது சார்த்தி — உங்கள் EMI நினைவூட்டல். “பணம் செலுத்த” அல்லது “கால நீட்டிப்பு” என்று சொல்லலாம். 1-இப்போது செலுத்த, 2-நீட்டிப்பு, 3-முடியவில்லை.',
      te: 'నమస్తే. ఇది సార్ధి — మీ EMI రిమైండర్. “నేను చెల్లిస్తాను” లేదా “నాకు సమయం కావాలి” అని చెప్పండి. 1-ఇప్పుడే చెల్లించండి, 2-ఎక్స్‌టెన్షన్, 3-చెల్లించలేను.'
    };
    return t[lang] || t.en;
  },
  waBody(intent, lang='en', link='https://example.com/pay', due=null, support=null) {
    const base = {
      en: {
        pay_now: `Hi! This is Saarthi from TVS Credit.\nGreat—complete your payment here: ${link}\nReply “AGENT” anytime for help.`,
        need_time: `Hi! This is Saarthi from TVS Credit.\n${due ? `Your due date is ${due}. ` : ''}We can assist with extensions. Reply with a preferred date or “AGENT”.`,
        cannot_pay: `Hi! This is Saarthi from TVS Credit.\nWe understand it may be difficult right now.${support?` Call ${support} or`:''} reply “AGENT” to connect with support.`,
        other: `Hi! This is Saarthi from TVS Credit.\nHere’s your payment link: ${link}\nSay what you need, or reply “AGENT”.`
      },
      hi: {
        pay_now: `नमस्ते! TVS Credit से सारथि।\nकृपया यहाँ भुगतान पूरा करें: ${link}\nमदद चाहिए तो “AGENT” लिखें।`,
        need_time: `नमस्ते! TVS Credit से सारथि।\n${due?`आपकी देय तिथि ${due} है. `:''}समय बढ़ाने में मदद कर सकते हैं। पसंदीदा तारीख भेजें या “AGENT” लिखें।`,
        cannot_pay: `नमस्ते! TVS Credit से सारथि।\nयदि अभी भुगतान संभव नहीं है तो${support?` ${support} पर कॉल करें या`:''} “AGENT” लिखें।`,
        other: `नमस्ते! TVS Credit से सारथि।\nयहाँ भुगतान लिंक है: ${link}\nसहायता चाहिए तो “AGENT” लिखें।`
      },
      ta: {
        pay_now: `வணக்கம்! TVS Credit சார்த்தி.\nஇங்கே செலுத்தவும்: ${link}\nஉதவி வேண்டும் என்றால் “AGENT” என பதிலளிக்கவும்.`,
        need_time: `வணக்கம்! TVS Credit சார்த்தி.\n${due?`கட்டணம் ${due}. `:''}நேர நீட்டிப்பில் உதவலாம். விருப்ப தேதியை அனுப்பவும் அல்லது “AGENT”.`,
        cannot_pay: `வணக்கம்! TVS Credit சார்த்தி.\nஇப்போது செலுத்த முடியாவிட்டால்${support?` ${support} அழைக்கவும் அல்லது`:''} “AGENT” என எழுதவும்.`,
        other: `வணக்கம்! TVS Credit சார்த்தி.\nகட்டண இணைப்பு: ${link}\nஉதவி தேவைப்பட்டால் “AGENT” என பதிலளிக்கவும்.`
      },
      te: {
        pay_now: `నమస్తే! TVS Credit నుంచి సార్ధి.\nఇక్కడ చెల్లించండి: ${link}\nసహాయం కావాలంటే “AGENT” అని రాయండి.`,
        need_time: `నమస్తే! TVS Credit నుంచి సార్ధి.\n${due?`మీ డ్యూ ${due}. `:''}ఎక్స్‌టెన్షన్ సహాయం చేస్తాం. మీ తేదీ రాయండి లేదా “AGENT”.`,
        cannot_pay: `నమస్తే! TVS Credit నుంచి సార్ధి.\nఇప్పుడు చెల్లించడం కష్టమైతే${support?` ${support} కు కాల్ చేయండి లేదా`:''} “AGENT” అని రిప్లై చేయండి.`,
        other: `నమస్తే! TVS Credit నుంచి సార్ధి.\nఇది పేమెంట్ లింక్: ${link}\nసహాయం కావాలంటే “AGENT” అని రాయండి.`
      }
    };
    const L = base[lang] || base.en;
    return L[intent] || L.other;
  },
  pickLangForCustomer(cust) {
    return (cust.lang || process.env.DEFAULT_LANG || 'en').toLowerCase();
  }
}
