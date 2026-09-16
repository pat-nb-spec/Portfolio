# Portfolio Pulse AI v5 — Production Market Sync

Production-ready portable web app with provider-driven ticker search, automatic market quotes, historical charts, and position-only editing.

## What changed in v5

- **Add Position now works end-to-end**: Search ticker/company -> select result -> enter only Quantity + Average Cost -> Add Position -> app immediately pulls the current market quote.
- Users **cannot manually edit market price, symbol metadata, exchange, or market currency**. Those fields are controlled by market-data providers.
- **Automatic quote sync every 30 seconds** by default while the tab is visible.
- Returning to a backgrounded tab triggers an immediate refresh.
- Manual **Refresh Market Data** remains available.
- Batch `/api/quotes` endpoint reduces browser chatter and updates the whole open portfolio in one sync cycle.
- If batch refresh fails, the browser falls back to individual quote requests.
- Existing v4 browser portfolios are migrated automatically to the v5 local-storage key.
- Production deployment support: Node 20+, Vercel serverless API routes, Docker, Docker Compose.

## Market provider chain

Configure one or more keys. The backend tries providers in this order:

1. Twelve Data
2. Finnhub
3. Alpha Vantage

Provider availability and quote freshness depend on your plan/market entitlements. The app displays the provider/status returned by the backend rather than claiming all data is real-time.

## Environment

Copy `.env.example` to `.env` for local/Docker use:

```env
TWELVE_DATA_API_KEY=your_key
FINNHUB_API_KEY=your_key
ALPHA_VANTAGE_API_KEY=your_key
AUTO_REFRESH_MS=30000
PORT=8787
```

At least one market-data key is required for ticker search and market synchronization.

## Local production run

Node.js 20+:

```bash
node server.js
```

Then open:

```text
http://localhost:8787
```

Check backend before using the app:

```text
http://localhost:8787/api/health
```

Expected structure:

```json
{
  "ok": true,
  "providers": {
    "twelve": true,
    "finnhub": false,
    "alpha": true
  },
  "runtime": "node",
  "autoRefreshMs": 30000
}
```

## Docker

```bash
cp .env.example .env
# add provider keys to .env
docker compose up -d --build
```

Open `http://localhost:8787`.

## Vercel production deployment

1. Push the whole folder to a GitHub repository.
2. Import the repository into Vercel.
3. Add Environment Variables in Vercel Project Settings:
   - `TWELVE_DATA_API_KEY`
   - `FINNHUB_API_KEY`
   - `ALPHA_VANTAGE_API_KEY`
   - `AUTO_REFRESH_MS=30000`
4. Deploy.
5. Verify `/api/health` returns JSON before using ticker search.

Do **not** deploy this as static-only hosting such as plain GitHub Pages if you need live market data. API keys must remain server-side.

## Position workflow

### Add

`Manage Positions` -> `Search & Add Stock` -> search company/ticker -> `Add` -> enter:

- Quantity
- Average Cost

The app then synchronizes price/name/exchange/currency from the provider automatically.

### Edit

Users may change only:

- Quantity
- Average Cost

### Delete

Delete removes the holding from the browser portfolio and it will no longer be included in auto-sync.

## API routes

- `GET /api/health`
- `GET /api/search?q=AAPL`
- `GET /api/quote?symbol=AAPL`
- `GET /api/quotes?symbols=AAPL,MSFT,SPY`
- `GET /api/history?symbol=AAPL&range=1Y`

Supported chart ranges in the UI: `1D`, `1W`, `1M`, `3M`, `YTD`, `1Y`, `5Y`, `ALL`.

## Refresh behavior

Default auto refresh: **30 seconds**.

Set `AUTO_REFRESH_MS` if your provider plan requires a slower interval. The backend/browser enforce a minimum of 10 seconds. Quote APIs are cached server-side to reduce duplicate calls.

Historical series are refreshed on demand when the user changes chart range or opens a ticker detail view; they are not polled every 30 seconds.
