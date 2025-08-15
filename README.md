# Saarthi

Voice ➜ intent detection ➜ tailored WhatsApp message.  
Indian voice (Polly Aditi). OpenAI-powered intent with rule-based fallback.

## Prerequisites
- Node.js 18+ (project uses Node 22 in runtime)
- Twilio CLI logged in (`twilio login`)
- Twilio trial tips:
  - The **callee number** must be verified in your Twilio console
  - Join the WhatsApp Sandbox from that phone: send “hi” to **+1-415-523-8886**
- Optional: `OPENAI_API_KEY` for smarter intent

## Quick Start

```bash
# 1) Clone & enter
git clone https://github.com/chaitanya21kumar/saarthi.git
cd saarthi

# 2) Install
npm install

# 3) Create your env file (then edit .env with real values)
cp -n .env.example .env
# Fill at least:
#   TWILIO_ACCOUNT_SID=
#   TWILIO_AUTH_TOKEN=
#   TWILIO_PHONE_NUMBER=+1...
#   TWILIO_VOICE_FROM=+1...
#   CALLEE_NUMBER=+91...
#   WHATSAPP_FROM=whatsapp:+14155238886
#   PAYMENT_LINK=https://example.com/pay
# Optional:
#   OPENAI_API_KEY=sk-...
#   DUE_DATE=YYYY-MM-DD
#   SUPPORT_PHONE=+91...

# 4) Deploy Twilio Functions
npm run deploy

# 5) Test the flow
# Terminal A: tail logs
twilio serverless:logs --environment dev --tail

# Terminal B: place the test call
npm run call
