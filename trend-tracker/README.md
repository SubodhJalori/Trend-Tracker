# 📊 Fashion & Beauty Instagram Trend Tracker

Real-time AI-powered Instagram trend intelligence — by geography, niche, and 30-day momentum.

---

## 🚀 Deploy to Vercel (5 minutes)

### Step 1 — Get the code onto GitHub

1. Go to [github.com](https://github.com) and sign in (or create a free account)
2. Click **"New repository"** → name it `trend-tracker` → click **Create**
3. On your computer, open a terminal in this project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/trend-tracker.git
git push -u origin main
```

---

### Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click **"Add New Project"**
3. Find and select your `trend-tracker` repository → click **Import**
4. Vercel will auto-detect it as a Vite project. Leave all settings as default.
5. Click **"Deploy"** — it will build and give you a live URL in ~60 seconds ✅

---

### Step 3 — Add your Anthropic API key (secret, server-side)

1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from [console.anthropic.com](https://console.anthropic.com)
3. Click **Save**
4. Go to **Deployments** → click the three dots on your latest deploy → **Redeploy**

Your site is now live and your API key is completely hidden from the browser. ✅

---

## 💻 Run locally

```bash
# Install dependencies
npm install

# Create your local env file
cp .env.example .env.local
# → Edit .env.local and add your ANTHROPIC_API_KEY

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🗂 Project structure

```
trend-tracker/
├── api/
│   └── claude.js        ← Serverless proxy (keeps API key secret)
├── src/
│   ├── main.jsx         ← React entry point
│   └── App.jsx          ← Main trend tracker app
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

---

## 🔒 Security note

Your `ANTHROPIC_API_KEY` is **never** exposed to the browser. All API calls go through `/api/claude` — a Vercel serverless function that runs server-side and injects the key privately.
