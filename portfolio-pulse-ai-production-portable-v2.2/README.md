# Portfolio Pulse AI — Production Portable Edition 2.0

Self-hosted portfolio intelligence dashboard with resilient market-data and news provider failover. Node.js only: no runtime npm dependencies.

## Run

1. Install Node.js 20+ (22 LTS recommended).
2. Copy `.env.example` to `.env` and add provider keys.
3. Windows: double-click `start.bat`; Linux/macOS: `./start.sh`.
4. Open `http://localhost:8787`.

Without API keys the app stays fully usable in clearly marked DEMO mode.

## Production provider strategy

### Price failover
Default order:
1. Twelve Data
2. Finnhub
3. Alpha Vantage
4. In-memory last-known quote
5. Demo portfolio price

Configure with `PRICE_PROVIDER_ORDER=twelve,finnhub,alpha`.

The app does **not** claim a quote is real-time merely because a provider answered. Configure the `*_FRESHNESS` variables to match your actual data entitlement.

### News resilience
Configured news providers are queried in parallel, merged, normalized, then near-duplicate headlines are clustered/deduplicated:
- Alpha Vantage News & Sentiment
- NewsAPI
- Finnhub company news
- RSS feeds that you are legally allowed to consume

This lets one or two sources fail/rate-limit without blanking the News page. The system links to original articles and does not bypass paywalls.

## Reliability / security
- Atomic state writes
- Automatic rotating JSON backups in `data/backups/`
- Quote/news TTL caches
- Circuit breaker after repeated provider failures
- Provider health diagnostics
- Request timeout and payload-size guard
- Per-IP rate limiting
- Optional API bearer token (`APP_API_TOKEN`)
- Security headers and restrictive CSP
- Graceful SIGTERM/SIGINT shutdown
- `/healthz` and `/readyz`
- Docker health check
- Persistent Docker volume

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Use a reverse proxy (Caddy/Nginx/Traefik) with HTTPS for internet exposure. Do not expose port 8787 directly to the public internet without TLS and access control.

## API endpoints
- `GET /healthz`
- `GET /readyz`
- `GET /api/state`
- `POST /api/state`
- `GET /api/quote?symbol=AAPL`
- `GET /api/quotes?symbols=AAPL,MSFT,SPY`
- `GET /api/news`
- `GET /api/diagnostics`

If `APP_API_TOKEN` is set, API calls require `Authorization: Bearer <token>` or `X-API-Token`.

## Data
`data/state.json` is the active state. Previous versions are retained in `data/backups/`. Back up the entire `data/` directory externally as part of your server backup policy.

## News publishers
For Yahoo Finance, Bloomberg, MarketWatch, Seeking Alpha, Investing.com, etc., use official/licensed API/RSS/aggregator feeds permitted by the publisher. Do not scrape or bypass paywalls.

## Important
This is analytical decision-support software. Scenario ranges, sentiment, event impacts, and technical labels are not guarantees or personalized investment advice.

## Alpha Picks / Seeking Alpha Intelligence

The **Alpha Picks** page deliberately separates two data classes:

1. **Subscriber imports** — Alpha Picks emails/messages/content you already receive or can lawfully access. Paste the content in the app, or copy `.eml`, `.txt`, or `.html` files into `data/alpha-picks-inbox/` and click **Scan inbox folder**.
2. **Public Seeking Alpha ideas** — public recommendation/Quant/Strong Buy items loaded from public or authorized RSS/Atom feeds configured with `SEEKING_ALPHA_PUBLIC_FEEDS`.

The app does **not** scrape subscriber-only pages, bypass a paywall, or use third-party leaks to reconstruct hidden Alpha Picks. Public recommendations are never mislabeled as official Alpha Picks.

For hands-free ingestion, an email automation can save/forward Seeking Alpha messages into `data/alpha-picks-inbox/` or call the local import endpoint from your own trusted automation.

## Seeking Alpha public research module
The app includes a **Seeking Alpha** page that discovers public research and recommendation-style content without using email, personal data, or bypassing subscription controls. It can surface public Analysis, Analyst's Pick, Editor's Pick, Strong Buy research, rating upgrades/downgrades, and public price-target commentary. The app labels these as public research ideas, not official Alpha Picks unless Seeking Alpha publicly identifies the item that way. Discovery can use public RSS endpoints you configure and Google News RSS queries restricted to `seekingalpha.com`.
