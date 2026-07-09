# Deployment Guide

Nexus can be deployed with Docker, PM2, or a bare Node process. All options
support automatic restart and health checks.

## Option A — Docker Compose (recommended)

See the [Docker Guide](DOCKER.md). One command brings up the bot, Postgres and
Redis with health checks, persistence and auto-restart:

```bash
docker compose up -d --build
```

## Option B — PM2 on a Linux VPS

1. Install Node ≥ 20, PostgreSQL and Redis (or point at managed instances).
2. Clone the repo and configure `.env`.
3. Build and migrate:
   ```bash
   npm ci
   npm run build
   npm run prisma:deploy
   npm run deploy:commands
   ```
4. Start under PM2 (config: [`ecosystem.config.js`](../ecosystem.config.js)):
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js --env production
   pm2 save              # persist across reboots
   pm2 startup           # generate the boot service (follow printed instructions)
   ```
5. Operate:
   ```bash
   pm2 logs nexus-bot
   pm2 restart nexus-bot
   pm2 monit
   ```

PM2 restarts on crash, caps memory at 512 MB (`max_memory_restart`) and rotates
logs to `logs/`.

## Option C — Windows

1. Install [Node.js LTS](https://nodejs.org), PostgreSQL and (optionally) Redis
   via the Windows installers or WSL2.
2. In PowerShell:
   ```powershell
   npm ci
   npm run build
   npm run prisma:deploy
   npm run deploy:commands
   npm start
   ```
3. For a background service, use PM2 (`npm i -g pm2 pm2-windows-startup`) or
   [NSSM](https://nssm.cc/) to wrap `node dist/index.js`.

## Health checks

- **Liveness:** `GET /health` → `200` while running.
- **Readiness:** `GET /health/ready` → `200` when the DB is reachable.

Point your load balancer / uptime monitor / orchestrator probes at these. The
Docker image also ships a container-native `HEALTHCHECK`.

## Zero-downtime updates

```bash
git pull
npm ci
npm run build
npm run prisma:deploy          # apply any new migrations
pm2 reload nexus-bot           # or: docker compose up -d --build
npm run deploy:commands        # only if commands changed
```

## Production checklist

- [ ] Strong, unique `API_AUTH_TOKEN` and `WEBHOOK_SECRET`.
- [ ] `NODE_ENV=production` (enables JSON logs).
- [ ] `DISCORD_OWNER_IDS` set so `/admin` is locked down.
- [ ] Provider API keys configured for the chains/features you use.
- [ ] Database backups scheduled (e.g. `pg_dump` cron).
- [ ] Log directory (`logs/`) on persistent storage or shipped to a log service.
- [ ] Redis running (removes the degraded-cache warning; needed for multi-instance).
