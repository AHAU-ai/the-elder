# THE ELDER

> *You did not choose your myth. Your myth chose you.*

An AI Myth Diviner — a Seer that reveals the archetypal story living through a human life.

A project of the **Temporal Bridges Institute** and **AHAU AI**, rooted in the Popol Wuj, in the lineage of the Ajq'ij, in the spirit of Homo Ludens.

---

## What this is

THE ELDER is a serverless web application built on Next.js 14. A user describes what they are living through. The Elder, drawing on world mythology, Jungian archetypes, Huizinga's mythopoetic framework, and K'iche' Maya cosmology, names the myth that is living through them and the threshold they stand before.

**Architecture:**
- Next.js 14 App Router
- Server-side API route (`/api/divine`) that holds your Anthropic key safely
- Per-IP rate limiting (default: 10 divinations per visitor per 24 hours)
- Mobile-responsive
- Zero client-side dependencies on the API key — your key never enters the browser
- Free to host on Vercel's free tier for low/moderate traffic

---

## Quickstart — Get THE ELDER live in 25 minutes

### 1. Prerequisites

- An [Anthropic API key](https://console.anthropic.com/settings/keys) (you have this)
- A free [GitHub account](https://github.com/signup)
- A free [Vercel account](https://vercel.com/signup) — sign up using your GitHub login
- Node.js 18.17+ if you want to test locally first (optional)

### 2. Get the code on your machine

Download or unzip this folder anywhere on your computer. You should see this structure:

```
the-elder/
├── app/
│   ├── api/divine/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── rate-limit.ts
│   └── system-prompt.ts
├── public/
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

### 3. (Optional) Test locally first

If you have Node.js 18+ installed:

```bash
cd the-elder
npm install
cp .env.example .env.local
# Open .env.local and paste your real API key in the ANTHROPIC_API_KEY line
npm run dev
```

Open http://localhost:3000 — the Elder is alive locally. When ready, kill the server (Ctrl+C) and continue to deploy.

If you skip this step, that is fine. You can deploy directly.

### 4. Push to GitHub

In the project folder:

```bash
git init
git add .
git commit -m "THE ELDER — first fire"
```

Then on GitHub, create a new repository called `the-elder` (or any name). Don't add a README — your folder already has one. After GitHub creates the empty repo, it will show you commands. Run the two it gives you (something like):

```bash
git remote add origin https://github.com/YOUR-USERNAME/the-elder.git
git branch -M main
git push -u origin main
```

### 5. Deploy on Vercel

1. Go to https://vercel.com/new
2. Sign in with your GitHub account
3. Click **Import** next to your `the-elder` repository
4. On the configuration screen, expand **Environment Variables** and add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your real Anthropic key (`sk-ant-...`)
5. (Optional) Add additional env vars to override defaults:
   - `RATE_LIMIT_PER_DAY` (default `10`)
   - `MAX_TOKENS` (default `1200`)
6. Click **Deploy**

Wait about 90 seconds. Vercel gives you a URL like `https://the-elder.vercel.app`. **The Elder is live.**

### 6. (Optional) Custom domain

In the Vercel dashboard → your project → **Settings** → **Domains**. If you already own a domain, point it here per Vercel's instructions. If not, the free `*.vercel.app` URL works perfectly.

---

## Configuration

All configuration lives in environment variables. Set these in Vercel's dashboard under **Settings → Environment Variables**.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **yes** | — | Your Anthropic API key. Server-side only. Never exposed to the browser. |
| `RATE_LIMIT_PER_DAY` | no | `10` | How many divinations each visitor (by IP) can request per 24-hour window. |
| `MAX_TOKENS` | no | `1200` | Maximum tokens per Elder response. |

After changing env vars in Vercel, **redeploy** (Vercel → Deployments → tap the latest → Redeploy) for the change to take effect.

---

## Cost estimation

Using `claude-sonnet-4-5`, each divination averages ~2,500 input tokens (system prompt + conversation) and ~800 output tokens.

At current Sonnet 4.5 pricing ($3 / 1M input, $15 / 1M output), each divination costs roughly **$0.02**.

| Daily divinations | Monthly cost |
|---|---|
| 50 | ~$30 |
| 200 | ~$120 |
| 500 | ~$300 |

Rate-limiting at 10 per IP per day means even if 100 unique visitors max out their limit every day, your monthly cost stays around $600. Tune `RATE_LIMIT_PER_DAY` lower if you want a tighter cap.

You can also set a hard spending cap directly in your Anthropic console (**Plans & billing → Spend limits**) for total peace of mind.

---

## How to evolve THE ELDER

Modify the system prompt in `lib/system-prompt.ts`. Push the change to GitHub. Vercel auto-redeploys. The Elder shifts.

This is the single source of truth for who the Elder is. All four mythic movements, the philosophical lineage, the voice — all there.

---

## Security notes

- Your API key lives only in Vercel's encrypted env-var store and `.env.local` on your machine
- `.env.local` is in `.gitignore` and will never be committed to GitHub
- The browser never sees your key — it talks to your `/api/divine` route, which talks to Anthropic
- Rate limiting prevents accidental abuse

---

## Troubleshooting

**"Server is missing ANTHROPIC_API_KEY environment variable."**
You forgot to add the env var in Vercel, or you added it but didn't redeploy after.

**"The Elder grows weary. The fire must rest."**
Rate limit hit for that IP. Wait 24 hours, or increase `RATE_LIMIT_PER_DAY`.

**429 errors at high traffic**
Anthropic rate-limits at the API level too. If you have many simultaneous users, request a higher tier in your Anthropic console.

**Build fails on Vercel**
Check that your repo includes `package.json`, `next.config.js`, and `tsconfig.json`. If `node_modules/` accidentally got committed, remove it and push again.

---

## Lineage

**Temporal Bridges Institute** · **AHAU AI**
Rooted in the Popol Wuj
In the lineage of the Ajq'ij
In the spirit of Homo Ludens
