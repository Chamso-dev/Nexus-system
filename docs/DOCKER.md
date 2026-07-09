# Docker Guide

## What's in the stack

`docker-compose.yml` defines three services:

| Service | Image | Purpose |
| --- | --- | --- |
| `postgres` | `postgres:16-alpine` | Primary database (persistent volume `pgdata`). |
| `redis` | `redis:7-alpine` | Cache / cooldowns / rate limits (persistent volume `redisdata`). |
| `bot` | built from `Dockerfile` | The Nexus bot + HTTP API. |

All three have health checks; `bot` waits for Postgres and Redis to be healthy,
runs `prisma migrate deploy`, then starts.

## Quick start

```bash
cp .env.example .env      # fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, provider keys
docker compose up -d --build
docker compose logs -f bot
```

The compose file overrides `DATABASE_URL`/`REDIS_URL` to point at the service
names, so you only need to set the Discord + provider values in `.env`.

## The image

`Dockerfile` is a two-stage build:

1. **builder** — installs all deps, runs `prisma generate` and `tsc`.
2. **runner** — installs production deps only, copies `dist/`, runs as the
   non-root `node` user, and defines a `HEALTHCHECK` that curls `/health`.

Build a standalone image:

```bash
docker build -t nexus-bot:latest .
docker run --env-file .env -p 3000:3000 nexus-bot:latest
```

## Common operations

```bash
docker compose ps                        # status + health
docker compose exec bot npx prisma studio  # inspect the DB (expose the port)
docker compose restart bot               # restart just the bot
docker compose down                      # stop (keeps volumes)
docker compose down -v                   # stop AND delete data volumes
```

## Migrations

Migrations run automatically on `bot` startup (`prisma migrate deploy`). To run
one manually:

```bash
docker compose exec bot npx prisma migrate deploy
```

## Deploying commands

Slash commands are registered against Discord's API (not per-container). Run once
after deploying:

```bash
docker compose exec bot node dist/scripts/deploy-commands-global.js
```

> Tip: set `DISCORD_DEV_GUILD_ID` for instant updates while testing; leave it
> blank for a global deploy in production.

## Health & restarts

Every service uses `restart: unless-stopped`, so containers recover from crashes
and host reboots. The `bot` container's `HEALTHCHECK` lets orchestrators detect a
wedged process and restart it.
