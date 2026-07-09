# API Documentation

Nexus runs an Express HTTP server alongside the bot (default port `3000`, set by
`API_PORT`). It exposes health, status, metrics, a public market summary and a
webhook receiver.

Base URL: `http://<host>:<API_PORT>`

## Authentication

- **Public** endpoints need no auth (rate-limited by IP).
- **Protected** endpoints require `Authorization: Bearer <API_AUTH_TOKEN>`.
- **Webhooks** require an HMAC signature header (see below).

---

## Endpoints

### `GET /health` — liveness *(public)*
Always `200` while the process is running.
```json
{ "status": "ok", "uptime": 1234.5, "timestamp": "2026-01-01T00:00:00.000Z" }
```

### `GET /health/ready` — readiness *(public)*
`200` when the database is reachable, else `503`. Redis is non-critical.
```json
{ "ready": true, "database": { "ok": true, "latencyMs": 3 }, "redis": { "ok": true, "degraded": false } }
```

### `GET /status` — bot status *(public)*
```json
{ "status": "online", "guilds": 128, "commands": 12, "uptimeMs": 3600000 }
```

### `GET /metrics` — detailed metrics *(protected)*
```bash
curl -H "Authorization: Bearer $API_AUTH_TOKEN" http://localhost:3000/metrics
```
```json
{
  "uptimeMs": 3600000,
  "totalCommands": 540,
  "totalErrors": 2,
  "jobRuns": 60,
  "jobFailures": 0,
  "avgApiLatencyMs": 42,
  "memoryMb": 96,
  "commands": { "price": { "count": 210, "avgMs": 180, "errors": 0 } },
  "guilds": 128
}
```

### `GET /market/summary` — market overview *(public, rate-limited 30/min)*
```json
{
  "featured": [{ "symbol": "BTC", "usd": 65000, "change24h": 1.2 }],
  "btcDominance": 52.3,
  "totalMarketCap": 2500000000000,
  "totalVolume24h": 90000000000,
  "fearGreed": { "value": 61, "classification": "Greed" },
  "trending": [{ "id": "solana", "symbol": "sol", "name": "Solana" }]
}
```

---

## Webhooks

### `POST /webhooks/provider` *(signature-verified)*

Send a JSON body plus an HMAC-SHA256 signature of the **raw JSON** using
`WEBHOOK_SECRET`, in the `x-nexus-signature` header (hex).

```bash
BODY='{"type":"ping"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')
curl -X POST http://localhost:3000/webhooks/provider \
  -H "Content-Type: application/json" \
  -H "x-nexus-signature: $SIG" \
  -d "$BODY"
```

Supported event types (validated with Zod):

| `type` | Fields | Effect |
| --- | --- | --- |
| `ping` | — | Returns `{ ok: true, pong: true }`. |
| `airdrop.upsert` | `project*`, `deadline?`, `requirements?`, `estReward?`, `status?`, `riskLevel?`, `officialUrl?` | Adds a tracked airdrop surfaced by `/airdrop`. |

Invalid signatures return `401`; invalid payloads return `400` with the Zod issues.

---

## Errors

All errors are JSON: `{ "error": "message", "code": "CODE" }`. Status codes follow
the typed error hierarchy (400 validation, 401 auth, 402 premium, 403
forbidden/limit, 404 not found, 429 rate-limited, 502 upstream provider).
