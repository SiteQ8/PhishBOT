# 🎣 PhishBOT

> Real-time phishing detection engine with REST API, React dashboard, and Telegram bot.

---

## Architecture

```
PhishBOT/
├── backend/          # Node.js + Express API (SQLite)
│   ├── server.js     # Entry point
│   ├── detector.js   # Detection engine
│   ├── db.js         # SQLite schema + seed data
│   └── routes/
│       ├── scan.js       # POST /api/scan
│       ├── keywords.js   # CRUD /api/keywords
│       ├── logs.js       # GET  /api/logs
│       └── allowlist.js  # CRUD /api/allowlist
├── frontend/         # React dashboard
└── bot/              # Telegram bot (Python)
```

---

## Quick Start

### 1. Backend API

```bash
cd backend
npm install
node server.js
# API running at http://localhost:3001
```

### 2. Frontend Dashboard

```bash
cd frontend
npm install
npm start
# Dashboard at http://localhost:3000
```

### 3. Telegram Bot

```bash
cd bot
pip install -r requirements.txt
cp ../.env.example ../.env
# Edit .env and set TELEGRAM_TOKEN
TELEGRAM_TOKEN=your_token API_BASE_URL=http://localhost:3001 python bot.py
```

### Docker (all-in-one)

```bash
cp .env.example .env
# Edit .env
docker-compose up -d                          # API + Frontend
docker-compose --profile telegram up -d      # Include Telegram bot
```

---

## API Reference

### Scan

```http
POST /api/scan
Content-Type: application/json

{
  "input": "https://paypa1-secure.verify-login.tk/account",
  "type": "auto",       // auto | url | text | email
  "source": "my-app"   // optional tag
}
```

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "verdict": "phishing",
  "score": 85,
  "inputType": "url",
  "signals": [
    { "signal": "Suspicious TLD: .tk", "score": 25 },
    { "signal": "Brand keyword \"paypal\" embedded in domain", "score": 30 }
  ],
  "matchedKw": []
}
```

### Keywords

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/keywords` | List all keywords |
| POST | `/api/keywords` | Add keyword(s) |
| PATCH | `/api/keywords/:id` | Update severity/category |
| DELETE | `/api/keywords/:id` | Delete keyword |

**Add single keyword:**
```json
POST /api/keywords
{ "keyword": "verify your account", "category": "credential", "severity": "high" }
```

**Bulk add:**
```json
POST /api/keywords
{
  "keywords": [
    { "keyword": "reset your pin", "severity": "high" },
    { "keyword": "wire transfer",  "severity": "medium" }
  ]
}
```

**Severity levels:** `low` | `medium` | `high` | `critical`

**Categories:** `general` | `credential` | `urgency` | `financial` | `brand-abuse` | `scam`

### Logs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/logs` | Paginated scan history |
| GET | `/api/logs/summary` | Dashboard stats |
| DELETE | `/api/logs/:id` | Delete a log |

### Allowlist

```http
POST /api/allowlist
{ "domain": "trusted-company.com" }
```

---

## Detection Engine

The engine applies multiple layers of analysis:

1. **Allowlist check** — skip known-good domains
2. **URL structural analysis** — IP hosting, URL encoding, subdomain depth, suspicious TLDs, URL shorteners, homograph attacks
3. **Brand impersonation** — typosquatting detection via Levenshtein distance against 20+ major brands
4. **Text/email heuristics** — urgency language, credential requests, generic salutations
5. **Keyword database matching** — user-managed keywords with configurable severity weights

**Scoring:**
- `0–34` → ✅ Clean
- `35–69` → ⚠️ Suspicious  
- `70+`   → 🚨 Phishing

---

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/scan <input>` | Scan a URL or text |
| `/stats` | View detection statistics |
| `/keywords` | List active keywords |
| `/addkeyword <kw> [cat] [sev]` | Add keyword (admin) |
| `/help` | Show help |

Auto-scan is enabled by default — the bot will automatically scan any URL or long message posted in the chat.

---

## Built by [@SiteQ8](https://github.com/SiteQ8)
