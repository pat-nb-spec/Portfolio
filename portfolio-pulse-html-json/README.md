# Portfolio Pulse AI — HTML + JSON Portable Edition

## Use immediately
- Offline/demo: double-click `index.html`.
- JSON mode: serve this folder with any static web server, e.g. `python -m http.server 8080`, nginx, Apache, GitHub Pages, Cloudflare Pages, S3 static hosting.
- When served over HTTP/HTTPS, the app automatically loads JSON from `/data/*.json`.
- When opened as `file://`, browsers usually block `fetch()` to local JSON; the app falls back to embedded demo data.

## Important security rule
Do **not** place API keys inside `index.html`, `app.js`, `data/*.json`, or `config/providers.json`. Browser-visible files are public to anyone who can open DevTools.
Use a server-side proxy/API gateway for Twelve Data, Finnhub, Alpha Vantage, NewsAPI, etc., then write normalized outputs into the JSON files or expose same-origin JSON endpoints.

## Provider failover design
Price: Twelve Data -> Finnhub -> Alpha Vantage -> last-known cache.
News: Alpha Vantage News + NewsAPI + Finnhub News + RSS, merge and dedupe.
Research: Seeking Alpha public research + licensed/news aggregator + RSS. No paywall bypass.

## Core data files
- `data/portfolio.json`
- `data/events.json`
- `data/dividends.json`
- `data/earnings.json`
- `data/news.json`
- `data/seeking-alpha.json`
- `data/analysts.json`
- `data/settings.json`
- `config/providers.json`

## Updating data
Any backend, cron job, Power Automate, GitHub Action, Python/Node script, n8n or Make workflow can update the JSON files. The UI reads them on page load.

## Notes
This edition is intentionally dependency-free on the frontend. It can be copied to a USB drive, shared as a folder, deployed to static hosting, or embedded behind an authenticated reverse proxy.
