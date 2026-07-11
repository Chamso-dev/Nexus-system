<div align="center">

# 🪐 Nexus — Discord Crypto Bot

**A production-ready, modular Discord bot that unifies wallet watching, whale alerts, portfolio tracking, price/gas alerts, AI news summaries, airdrops, a smart-contract risk scanner, and full market & admin dashboards.**

Built with Node.js · TypeScript · discord.js v14 · PostgreSQL · Prisma · Redis · Express · Docker

`Not financial advice.`

</div>

---

## ✨ Features

| Module | What it does |
| --- | --- |
| 👛 **Wallet Watch** | Add/remove/rename wallets; alerts on received/sent/NFT/large/failed transfers with custom USD thresholds. Multi-wallet, multi-chain. |
| 🐋 **Whale Alerts** | Flags large transfers with amount, USD value, chain, block, tx hash, sender/receiver, explorer link and time. |
| 📊 **Portfolio** | Value, 24H/7D/30D change, top holdings, P/L, allocation chart, history snapshots. |
| 🔔 **Price Alerts** | Above/below price, % moves, volume/market-cap triggers — delivered instantly by DM. |
| ⛽ **Gas Tracker** | Live gas for Ethereum, Base, Polygon, Arbitrum, Optimism + gas-drop alerts. |
| 📰 **Crypto News** | Categorized news (BTC, ETH, Altcoins, DeFi, NFT, Security, Regulation, Market) with optional AI summaries & subscriptions. |
| 🚀 **Airdrops** | Track upcoming airdrops: project, deadline, requirements, reward, status, risk, links. |
| 🛡️ **Contract Risk Scanner** | Verified source, ownership, proxy, mint/pause/blacklist, audits — informational only. |
| 🌐 **Market Dashboard** | `/market`: BTC/ETH/SOL/BNB, top gainers/losers, trending, Fear & Greed, dominance, global cap & volume. |
| 👤 **User Profiles** | Wallets, alerts, portfolios, watchlist, notification prefs, timezone, premium, stats. |
| 🛠️ **Admin Dashboard** | `/admin` reload · cache · stats · health · jobs · database · logs · maintenance. |

**Discord UX:** slash commands, autocomplete, buttons, embeds, pagination, context menus, permission & role checks, cooldowns, premium flags, localization (EN/ES/FR).

**Supported chains:** Bitcoin · Ethereum · BNB Chain · Polygon · Solana · Arbitrum · Optimism · Base · Avalanche — *and adding more is a few lines* (see [Architecture](docs/ARCHITECTURE.md)).

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/Chamso-dev/Nexus-system.git
cd Nexus-system
npm install

# 2. Configure
cp .env.example .env         # then fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, DATABASE_URL…

# 3. Database
npm run prisma:generate
npm run prisma:migrate       # creates tables

# 4. Register slash commands
npm run deploy:commands      # set DISCORD_DEV_GUILD_ID for instant dev deploy

# 5. Run
npm run dev                  # hot-reload development
# or
npm run build && npm start   # production
```

### 🐳 Docker (recommended)

```bash
cp .env.example .env         # fill in Discord + provider keys
docker compose up -d --build # starts Postgres, Redis and the bot
```

See the [Docker Guide](docs/DOCKER.md) and [Deployment Guide](docs/DEPLOYMENT.md) for PM2/VPS/Windows.

---

## 🧱 Tech Stack & Architecture

```
Discord Gateway ──► NexusClient ──► Interaction Router ──► Guards ──► Commands
                                                                        │
                          ┌─────────────────────────────────────────────┤
                          ▼                     ▼                        ▼
                    Service Layer         Chain Adapters            Repositories
              (price, gas, whale,    (EVM · Bitcoin · Solana,     (Prisma / PostgreSQL)
               news, portfolio,       registry-based, pluggable)
               alert, contract…)
                          │                     │                        │
                          └───────► Cache (Redis) ◄────────── Scheduler (node-cron)
                                                                  │
                                                          Express API + Webhooks
```

Full diagram & rationale: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

- **Clean architecture:** commands → services → repositories; adapters behind interfaces; DI-friendly singletons.
- **Repository pattern** isolates all Prisma access.
- **Strong typing** end-to-end; **Zod** validates env, input and webhooks.
- **Resilience:** retry + exponential backoff on HTTP & jobs, Redis-with-memory-fallback cache, graceful shutdown, centralized error handling.

---

## 📚 Documentation

| Doc | Contents |
| --- | --- |
| [Installation](docs/INSTALLATION.md) | Prerequisites, local setup, Discord app creation. |
| [Commands](docs/COMMANDS.md) | Every slash command & option. |
| [Architecture](docs/ARCHITECTURE.md) | Diagram, layers, adding a chain. |
| [Database Schema](docs/DATABASE.md) | Tables & relationships. |
| [API](docs/API.md) | REST endpoints & webhooks. |
| [Docker](docs/DOCKER.md) | Compose stack, images, health checks. |
| [Railway](docs/RAILWAY.md) | One-click PaaS deploy with Postgres & Redis plugins. |
| [Deployment](docs/DEPLOYMENT.md) | PM2, VPS, Windows, restart & health. |

---

## 🧪 Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Hot-reload development server. |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run the compiled bot. |
| `npm test` | Run the Jest unit suite. |
| `npm run lint` / `lint:fix` | ESLint. |
| `npm run deploy:commands` | Register slash commands with Discord. |
| `npm run prisma:migrate` | Run DB migrations. |

---

## 🔐 Security

Secrets live only in environment variables (never committed). Input is sanitized and Zod-validated, webhooks are HMAC-verified, API endpoints are bearer-authenticated and rate-limited, and permission/owner checks gate sensitive commands. See [`.env.example`](.env.example).

---

## ⚠️ Disclaimer

Nexus provides **informational** data only. Nothing it outputs — prices, risk scores, alerts — is financial advice or a guarantee of safety. Always do your own research.

## 📄 License

MIT © Nexus Contributors
