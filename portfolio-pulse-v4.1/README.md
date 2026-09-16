# Portfolio Pulse AI v4.1 — Market Driven

This build fixes the common `Unexpected token '<' / <!DOCTYPE is not valid JSON` error.

## Why that error happens
The browser requested `/api/search`, but a static host returned `index.html` instead of JSON. Market search/quotes require a backend because API keys must stay private.

## Local / VPS / Docker-style Node hosting
1. Copy `.env.example` to `.env` or set environment variables in your host.
2. Set at least one key: `TWELVE_DATA_API_KEY`, `FINNHUB_API_KEY`, or `ALPHA_VANTAGE_API_KEY`.
3. Run `node server.js`.
4. Open `http://localhost:8787`.

## Vercel
This package now includes `/api/*.js` serverless functions and `vercel.json`.
1. Upload/push the whole folder to GitHub.
2. Import the repo into Vercel.
3. Add the API keys in Vercel Project Settings -> Environment Variables.
4. Redeploy.
5. Verify `/api/health` returns JSON before using ticker search.

## Static-only hosting
GitHub Pages, plain object storage, or any host that serves only HTML/CSS/JS cannot securely use private market-data API keys. The UI still opens, but live ticker search and market data will display a clear backend-not-active message instead of the old JSON parser error.

## User-entered data
Users only edit holdings quantity and average cost. Symbol metadata and live/latest market data come from configured providers.
