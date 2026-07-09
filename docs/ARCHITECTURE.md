# Architecture

Nexus follows clean-architecture principles: dependencies point **inward**, from
delivery mechanisms (Discord, HTTP) toward the domain services, which depend on
repository and adapter **interfaces** rather than concrete infrastructure.

## Layered overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Delivery / Presentation                         │
│                                                                          │
│  discord.js Gateway            Express API              node-cron         │
│        │                          │                        │             │
│        ▼                          ▼                        ▼             │
│  events/interactionCreate    api/routes/*            jobs/scheduler       │
│   (router + guards)          (health,status,          + jobs/*.job        │
│        │                      market,webhook)             │              │
└────────┼──────────────────────────┼──────────────────────┼──────────────┘
         │                          │                       │
         ▼                          ▼                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             Application / Services                       │
│  price · gas · whale · news · ai · airdrop · contract · wallet ·          │
│  portfolio · alert · user · notification · cache · metrics · maintenance │
└───────────────┬─────────────────────────────┬──────────────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌────────────────────────────────────────┐
│      Chain Adapters        │   │            Repositories                │
│  IChainAdapter interface   │   │  UserRepo · WalletRepo · AlertRepo ·   │
│  ├─ EvmAdapter (7 chains)  │   │  PortfolioRepo · News/Airdrop/Guild/   │
│  ├─ BitcoinAdapter         │   │  Job repos  (Prisma)                   │
│  └─ SolanaAdapter          │   └───────────────────┬────────────────────┘
│  registry.ts (DI)          │                       │
└───────────────┬────────────┘                       ▼
                │                        ┌────────────────────────────┐
                ▼                        │   PostgreSQL   ·   Redis    │
        External provider APIs          └────────────────────────────┘
   (explorers, CoinGecko, news, AI)
```

## Directory map

```
src/
├── api/            Express server + routes (health, status, market, webhooks)
├── assets/         Static assets
├── buttons/        Button interaction handlers (customId-routed)
├── commands/       Slash commands, grouped by module
├── config/         env (Zod-validated) + constants (chains, colors, limits)
├── contextmenus/   Right-click context-menu commands
├── core/           NexusClient + dynamic module loaders
├── database/       Prisma client, Redis, repositories/
├── events/         Gateway event handlers (interactionCreate, ready, guild*)
├── jobs/           Scheduler + individual jobs + registry
├── middlewares/    Command guards + Express middlewares
├── scripts/        deploy-commands
├── selectmenus/    Select-menu interaction handlers
├── services/       Business logic + chains/ adapters
├── types/          Shared domain & Discord contracts
└── utils/          logger, http, errors, format, validation, embeds, pagination, i18n, cooldown
```

## Key design decisions

- **Interaction router + guards.** `events/interactionCreate.ts` dispatches every
  interaction. Commands declare metadata (`cooldown`, `permissions`, `premium`,
  `ownerOnly`, `guildOnly`); `middlewares/guards.ts` enforces them uniformly, so
  commands stay focused on their own logic.

- **Self-registering modules.** `core/loaders.ts` walks the `commands/`,
  `events/`, `buttons/`, `selectmenus/` and `contextmenus/` trees and registers
  each module on the client. Adding a command is *just adding a file*.

- **Chain adapters behind an interface.** Everything on-chain goes through
  `IChainAdapter`. A single `EvmAdapter` serves all seven EVM chains; Bitcoin and
  Solana have their own. The `registry` maps `Chain → adapter`.

- **Repository pattern.** No service touches Prisma directly; all queries live in
  `database/repositories`, making services unit-testable with mocks.

- **Cache-first providers.** Every external read is wrapped by `CacheService`
  (Redis with in-memory fallback), so we respect provider rate limits and scale
  to thousands of servers.

- **Resilient scheduler.** `jobs/scheduler.ts` runs the every-minute pipeline
  with per-job retry + exponential backoff, overlap protection, `JobRun`
  persistence and metrics.

## Adding a new chain

1. Add the value to the `Chain` enum in `prisma/schema.prisma` and migrate.
2. Add a `ChainMeta` entry in `src/config/constants.ts` (symbol, decimals,
   explorer URLs, `evm` flag, CoinGecko id).
3. If it's EVM-compatible, add its explorer API base URL to `EvmAdapter` and a
   line in `chains/registry.ts`. Otherwise implement `IChainAdapter` in a new
   `*.adapter.ts` and register it.

That's it — validation, wallet watching, whale detection, gas (if supported) and
the risk scanner all pick it up through the interface.

## Request lifecycle (example: `/price bitcoin`)

1. Gateway delivers the interaction → `interactionCreate` router.
2. Guards run (cooldown, permissions…). 
3. `commands/market/price.ts` calls `priceService.getQuote('bitcoin')`.
4. `PriceService` checks Redis; on a miss it calls CoinGecko via the retrying
   HTTP client and caches the result.
5. The command renders a `priceEmbed` and replies. Metrics record the latency.
