# Deploying to Railway

Nexus runs on [Railway](https://railway.app) with PostgreSQL and Redis plugins.
**Secrets are set as Railway Variables — never in code or committed files.** The
repo is public; a token in the code would be leaked immediately.

## 1. Create the project

1. **New Project → Deploy from GitHub repo** → select `Chamso-dev/Nexus-system`.
2. Railway reads `railway.json`:
   - **Build:** `npx prisma generate && npm run build`
   - **Start:** `npx prisma migrate deploy && node dist/index.js`
   - **Healthcheck:** `/health`

## 2. Add the datastores

In the project canvas:

- **+ New → Database → PostgreSQL** — creates a `DATABASE_URL`.
- **+ New → Database → Redis** — creates a `REDIS_URL`.

## 3. Set the bot service Variables

Open the **bot service → Variables** and add:

| Variable | Value |
| --- | --- |
| `DISCORD_TOKEN` | *your bot token* (reset it first — see below) |
| `CLIENT_ID` | `1524829068128948345` |
| `ALLOWED_GUILD_ID` | `1300236472196272208` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres plugin) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (reference the Redis plugin) |
| `NODE_ENV` | `production` |
| `API_AUTH_TOKEN` | a long random string |
| `WEBHOOK_SECRET` | a long random string |
| `DISCORD_OWNER_IDS` | your Discord user ID (for `/admin`) |

> `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` are Railway
> **reference variables** — type them exactly; Railway substitutes the real
> connection strings at deploy time.

Optional provider keys (features degrade gracefully without them):
`ETHERSCAN_API_KEY`, `BSCSCAN_API_KEY`, `POLYGONSCAN_API_KEY`, `ARBISCAN_API_KEY`,
`OPTIMISM_ETHERSCAN_API_KEY`, `BASESCAN_API_KEY`, `SNOWTRACE_API_KEY`,
`COINGECKO_API_KEY`, `CRYPTO_NEWS_API_KEY`, `AI_API_KEY` (+ `AI_SUMMARY_ENABLED=true`).

## 4. Deploy

Railway builds and starts automatically. Because `ALLOWED_GUILD_ID` is set (which
turns on `RESTRICT_TO_GUILD`), the bot **auto-registers all slash commands to your
server on startup — even in production**. No manual command deploy needed.

Watch the deploy logs for:

```
[Ready] Logged in as <bot>#0000
Auto-registered 15 commands to guild 1300236472196272208
[Scheduler] Scheduler started
Nexus is fully operational 🚀
```

## Using the Railway CLI instead

```bash
npm i -g @railway/cli
railway login
railway link                     # select the project
railway add --database postgres
railway add --database redis
railway variables --set "DISCORD_TOKEN=<your-token>" \
                   --set "CLIENT_ID=1524829068128948345" \
                   --set "ALLOWED_GUILD_ID=1300236472196272208" \
                   --set "NODE_ENV=production"
# DATABASE_URL / REDIS_URL are provided automatically by the plugins.
railway up
```

## Notes

- **PORT:** Railway injects a dynamic `PORT`; the app binds the HTTP API to it
  automatically (mapped to `API_PORT`).
- **Migrations** run on every deploy via the start command (`prisma migrate deploy`).
- **Redis** is optional — the bot falls back to an in-memory cache if it's absent.

## 🔒 Reset your token

If you shared the token anywhere (chat, screenshots), reset it:
Developer Portal → your app → **Bot → Reset Token**, then update `DISCORD_TOKEN`
in Railway Variables. Never commit it to the repo.
