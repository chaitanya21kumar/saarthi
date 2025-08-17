# 🎙️ Saarthi — Agentic Collections Studio

*Saarthi* is a *multilingual AI VoiceBot* for *EMI collections & payment reminders*.  
It auto-prioritises customers, auto-dials via Twilio, detects intent + sentiment, and follows up with *WhatsApp messages & secure pay-links*.

> *Built for the TVS Credit E.P.I.C 7.0 IT Challenge* — “Agentic VoiceBots for EMI Collections/Payments.”

---

## ✨ Key Features
- 🔄 *Agentic workflow* — picks the next borrower by due-date + risk score  
- 📞 *Twilio voice calls* — multilingual reminders with NLP analytics  
- 💬 *WhatsApp follow-ups* — instant reminders & pay-links  
- 🤖 *OpenAI NLP* — intents: pay_now, need_time, cannot_pay  
- 📊 *Live dashboard* — intent donut, sentiment bars, campaign timeline  
- 🔒 *Secure payments* — verified links, no card data stored on our servers  
- ☁️ *Cloud-ready & scalable* — containerised, API-first design

---

## 🖼️ Screenshots
| Dashboard | Campaign |
|-----------|----------|
| ![Dashboard](screenshot_dashboard.png) | ![Campaign](screenshot_campaign.png) |

---

## 🛠️ Tech Stack
| Layer     | Tech                                   |
|-----------|----------------------------------------|
| Front-end | React + TailwindCSS                    |
| Back-end  | Node.js + Express                      |
| Telephony | Twilio Voice & WhatsApp APIs           |
| AI / NLP  | OpenAI (intent & sentiment)            |
| Database  | MongoDB                                |
| DevOps    | Docker-ready                           |

---

## 🚀 Local Setup (single README.md copy-paste friendly)

> Follow these steps in order. All terminal commands are shown *without prompts* (pasteable).

### 1) Clone repository
bash
git clone https://github.com/chaitanya21kumar/saarthi.git
cd saarthi


### 2) Create .env file (root of repo)
Create a .env file and paste the contents below (update values):

text
# --- Twilio ---
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# --- WhatsApp Sandbox ---
WHATSAPP_FROM=whatsapp:+14155238886

# --- Server ---
PORT=4000

# --- OpenAI (optional) ---
OPENAI_API_KEY=your_openai_key

# --- MongoDB ---
MONGODB_URI=mongodb://localhost:27017/saarthi

# Optional: other config you may need
# WEBHOOK_SECRET=...
# MONGODB_USER=...
# MONGODB_PASS=...


> *Do not commit .env*. Add it to .gitignore if not already listed.

### 3) Install dependencies (frontend + backend)
If repository splits into frontend/ and backend/:

bash
# frontend
cd frontend
npm install
# keep this terminal for frontend dev server
# open a new terminal for backend after this step


bash
# backend
cd ../backend
npm install


If the repo uses different folders (e.g., server/, functions/) adapt accordingly.

### 4) Run MongoDB (local)
Option A — start local mongod (if installed):

bash
mongod --dbpath /path/to/your/db


Option B — run via Docker:

bash
docker run -d --name saarthi-mongo -p 27017:27017 -v mongodata:/data/db mongo:6


### 5) Start backend
From the backend folder:

bash
# Option 1 (if package.json has dev/start scripts)
npm run dev           # for dev (nodemon)
# or
npm start             # production / start script

# Or directly (if index file is named index.js)
node index.js


### 6) Start frontend
From the frontend folder:

bash
npm run dev
# frontend typically served at http://localhost:3000 (check output)


### 7) Expose backend to Twilio (Ngrok)
Install or run ngrok and forward the backend port (default 4000):

bash
ngrok http 4000


Note the generated https://<ngrok-id>.ngrok.io URL. In Twilio Console set the Voice webhook URL to:


https://<ngrok-id>.ngrok.io/voice


(Replace <ngrok-id> with your actual ngrok host.)

### 8) Quick test — dashboard & quick call
- Open dashboard (example): http://localhost:4000 (or frontend URL)
- Use *Quick Call* in the dashboard to trigger a test call and watch the intents update in real time.

### 9) Common troubleshooting
- EADDRINUSE → port already used: change PORT in .env or free the port.
- Twilio webhooks not firing → ensure ngrok running and webhook set correctly (https required).
- DB connection errors → confirm MONGODB_URI and that mongod is running.
- Missing env values → backend will typically log missing keys on startup.

### 10) Stopping services
- Backend / frontend: Ctrl+C in terminals.
- Ngrok: Ctrl+C where it runs.
- Docker Mongo: docker stop saarthi-mongo && docker rm saarthi-mongo

---

## 📊 Workflow (high-level)
mermaid
flowchart LR
    A[CRM – EMI due] --> B[Saarthi VoiceBot]
    B --> C{Call outcome}
    C -->|pay_now| D[Send pay-link]
    C -->|need_time| E[Schedule reminder]
    C -->|cannot_pay| F[Escalate to human]
    D --> G[CRM update]
    E --> G
    F --> G
    G --> H[Analytics dashboard]


---

## 📂 Folder Structure (example)
text
saarthi/
├─ backend/      # Express + Twilio handlers (node)
├─ functions/    # serverless / NLP helpers, WhatsApp integration
├─ frontend/     # React UI
├─ public/       # Static assets + screenshots
├─ scripts/      # helper scripts (migrations, seed)
└─ README.md


---

## 🔁 Deployment notes (tips)
- Use Docker for both backend and MongoDB for reproducible deployments.
- Store secrets in a secure provider (GitHub Secrets, Vault, or managed env in your PaaS).
- For production Twilio callbacks, use a stable HTTPS endpoint (no ngrok). Use the Twilio Console to verify webhooks.
- If using OpenAI in production, monitor usage and set rate/usage limits.

---

## 🤝 Contributing
Pull requests are welcome. Please:
1. Open an issue describing the change before a large feature.
2. Create a branch: git checkout -b feat/your-feature
3. Add tests (where applicable), update docs, and open a PR.

---

## ⚖️ License
MIT — feel free to reuse and adapt. Please keep attribution if you republish significant parts.
