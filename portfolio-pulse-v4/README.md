# Portfolio Pulse AI v4 — Market Data Driven

## What changed
- Ticker/company is selected from provider search; no manual ticker metadata entry.
- Current market price and daily change are fetched by the server; users cannot type market price.
- User-editable position fields are only **Quantity** and **Average Cost** plus Add/Delete position.
- Price provider failover: Twelve Data -> Finnhub -> Alpha Vantage.
- Historical data: Twelve Data primary, Alpha Vantage fallback where supported.
- API keys stay server-side.

## Run
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set at least one provider key.
3. Load env vars in your hosting platform or terminal.
4. Run `node server.js` or double-click `start.bat` on Windows.
5. Open http://localhost:8787

> Node itself does not automatically load `.env`. On Docker/Vercel/hosting, configure environment variables in the platform. On local Windows, use `set TWELVE_DATA_API_KEY=...` before starting, or add the variables in System Environment Variables.

## Provider behavior
- Twelve Data: symbol search, latest quote and time series; preferred provider.
- Finnhub: search + quote fallback.
- Alpha Vantage: search + quote + daily historical fallback.
- Freshness depends on provider subscription/market entitlement. UI labels the actual source/status and does not promise realtime when a plan only provides delayed/latest data.

## Static-file note
Opening `index.html` directly still shows the UI/cached demo data, but **live ticker search and market prices require `server.js`** because API keys must not be embedded in browser code.
