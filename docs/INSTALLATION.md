# Installation Guide

This guide walks you through running Nexus locally from scratch.

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20 | LTS recommended |
| npm | ≥ 9 | ships with Node |
| PostgreSQL | ≥ 14 | or use the Docker Compose stack |
| Redis | ≥ 6 | optional but recommended (graceful fallback if absent) |
| Docker | latest | optional, for the containerized stack |

## 2. Create a Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Under **Bot**, click **Add Bot**, then **Reset Token** and copy it → `DISCORD_TOKEN`.
3. Copy the **Application ID** (General Information) → `DISCORD_CLIENT_ID`.
4. Invite the bot using this URL (replace `CLIENT_ID`):
   ```
   https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=274877959168
   ```
   The permission integer grants *Send Messages*, *Embed Links* and *Use Slash Commands*.
5. Copy your private server's ID (enable Developer Mode → right-click the server →
   Copy Server ID) → `ALLOWED_GUILD_ID`. In development the bot **auto-registers
   all slash commands to this guild on startup** and only operates there.

> **Environment variable names.** `CLIENT_ID` and `ALLOWED_GUILD_ID` are the
> primary names; `DISCORD_CLIENT_ID` / `DISCORD_DEV_GUILD_ID` are accepted as
> aliases. Set either.

## 3. Clone & install

```bash
git clone https://github.com/Chamso-dev/Nexus-system.git
cd Nexus-system
npm install
```

## 4. Configure environment

```bash
cp .env.example .env
```

Fill in at minimum: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URL`.
Provider API keys (Etherscan family, CoinGecko Pro, news, AI) are **optional** —
each feature degrades gracefully when its key is absent. See `.env.example` for
the full annotated list.

## 5. Set up the database

```bash
npm run prisma:generate     # generate the typed client
npm run prisma:migrate      # apply migrations (creates all tables)
```

> Prefer Docker for the datastores? `docker compose up -d postgres redis` gives
> you both, then point `DATABASE_URL`/`REDIS_URL` at `localhost`.

## 6. Register slash commands

In **development** you don't need to do anything — the bot **auto-registers all
commands to `ALLOWED_GUILD_ID` on startup**. To register manually or for
production:

```bash
npm run deploy:commands            # guild-scoped (uses ALLOWED_GUILD_ID) — instant
npm run deploy:commands:global     # global (production) — up to ~1h to propagate
```

## 7. Run

```bash
npm run dev          # development (hot reload)
# or
npm run build && npm start
```

You should see `Nexus is fully operational 🚀` and be able to run `/ping` in
your server. Hit `http://localhost:3000/health` to confirm the API is up.

## Troubleshooting

- **Bot exits immediately with an env error** — a required variable is missing;
  the log lists exactly which one.
- **Commands don't appear** — re-run `npm run deploy:commands`; global commands
  take time to propagate. Use a dev guild for testing.
- **`Redis unavailable` warning** — the bot runs fine with an in-memory cache
  fallback; start Redis to remove it.
