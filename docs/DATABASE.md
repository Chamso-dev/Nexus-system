# Database Schema

Nexus uses **PostgreSQL** via **Prisma**. The schema is normalized: each
aggregate owns its rows, related data is linked by foreign keys with
`onDelete: Cascade`, and hot query paths are indexed. Full definitions live in
[`prisma/schema.prisma`](../prisma/schema.prisma).

## Entity relationships

```
Guild 1───1 GuildSetting

User 1───1 UserSetting
User 1───* Wallet 1───* Transaction
User 1───* Alert
User 1───* Portfolio 1───* Holding
                    1───* PortfolioSnapshot
User 1───* WatchlistItem
User 1───* NewsSubscription

NewsArticle   (standalone cache, unique by url)
Airdrop       (standalone)
LogEntry      (standalone)
JobRun        (standalone)
```

## Tables

| Table | Purpose | Notable columns / indexes |
| --- | --- | --- |
| `guilds` | One row per Discord server | `premiumTier`, `locale` |
| `guild_settings` | Per-guild channel routing & feature flags | `whaleChannelId`, `newsChannelId`, `*FeedEnabled` |
| `users` | One row per Discord user | `premiumTier`, `premiumUntil`, `timezone`, `locale` |
| `user_settings` | Notification prefs | `dmAlerts`, `whaleAlerts`, `priceAlerts`, `gasAlerts`, `newsAlerts` |
| `wallets` | Watched wallets | unique `(userId, chain, address)`; index `(chain, active)`; `alertThreshold`, `lastCursor` |
| `transactions` | Observed on-chain txs | unique `(walletId, hash, assetSymbol)`; index `(chain, timestamp)`; `direction`, `kind`, `usdValue` |
| `alerts` | Price/gas/movement alerts | index `(type, status)`, `(userId, status)`; `threshold`, `comparator`, `meta` |
| `portfolios` | Named holding collections | unique `(userId, name)` |
| `holdings` | Positions in a portfolio | unique `(portfolioId, assetId)`; `amount`, `costBasisUsd` |
| `portfolio_snapshots` | Historical valuations | index `(portfolioId, takenAt)` |
| `watchlist_items` | User watchlist | unique `(userId, assetId)` |
| `news_subscriptions` | Category subscriptions | unique `(userId, category)` |
| `news_articles` | Cached/summarized articles | unique `url`; index `(category, publishedAt)` |
| `airdrops` | Tracked airdrops | index `(status, deadline)` |
| `log_entries` | Structured DB logs | index `(level, createdAt)` |
| `job_runs` | Scheduler run history | index `(name, status)`, `(createdAt)`; `attempts`, `durationMs`, `lastError` |

## Enums

- `Chain` — BITCOIN, ETHEREUM, BNB, POLYGON, SOLANA, ARBITRUM, OPTIMISM, BASE, AVALANCHE
- `AlertType` — PRICE_ABOVE, PRICE_BELOW, PERCENT_MOVE, VOLUME_SPIKE, MARKET_CAP_CHANGE, GAS_BELOW, WHALE_TRANSFER
- `AlertStatus` — ACTIVE, TRIGGERED, PAUSED, EXPIRED
- `TransactionDirection` — IN, OUT, SELF, UNKNOWN
- `TransactionKind` — TOKEN_TRANSFER, NATIVE_TRANSFER, NFT_TRANSFER, CONTRACT_CALL, FAILED
- `NewsCategory` — BITCOIN, ETHEREUM, ALTCOINS, DEFI, NFT, SECURITY, REGULATION, MARKET
- `PremiumTier` — FREE, PLUS, PRO
- `JobStatus` — PENDING, RUNNING, SUCCESS, FAILED, RETRYING

## Migrations

```bash
npm run prisma:migrate       # dev: create + apply a migration
npm run prisma:deploy        # prod: apply committed migrations
npm run prisma:studio        # browse data in a GUI
```

Monetary/quantity columns use `Decimal` (not float) to avoid precision loss:
token amounts at `Decimal(38,18)`, USD values at `Decimal(38,8)`.
