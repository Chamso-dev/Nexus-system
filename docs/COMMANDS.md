# Command Reference

All commands are Discord **slash commands**. Options marked `*` are required.
Ephemeral replies are visible only to you.

## General

| Command | Description |
| --- | --- |
| `/ping` | Bot latency & gateway status. |
| `/help` | Interactive command catalog (category select menu). |

## Market

| Command | Options | Description |
| --- | --- | --- |
| `/price` | `asset*` (autocomplete) | Live price with 24H/7D/30D change, market cap, volume. |
| `/market` | — | Full dashboard: featured coins, top gainers/losers, trending, Fear & Greed, BTC dominance, global cap/volume. Refresh button. |
| `/gas show` | — | Current gas (gwei) across supported EVM chains. |
| `/gas alert` | `chain*`, `gwei*` | DM when a chain's gas drops to/below `gwei`. |

## Wallet

| Command | Options | Description |
| --- | --- | --- |
| `/wallet add` | `chain*`, `address*`, `label`, `threshold` | Watch a wallet; optional large-transfer USD threshold. |
| `/wallet list` | — | List your watched wallets. |
| `/wallet remove` | `wallet*` (autocomplete) | Stop watching a wallet. |
| `/wallet rename` | `wallet*`, `label*` | Rename a wallet. |
| `/wallet threshold` | `wallet*`, `usd*` | Set the large-transfer threshold. |
| `/whale info` | — | Show default whale thresholds. |
| `/whale feed` | `channel*` | *(Manage Server)* Route the whale feed to a channel. |

## Alerts

| Command | Options | Description |
| --- | --- | --- |
| `/alert price` | `asset*`, `direction*` (above/below), `target*` | Price-cross alert (DM). |
| `/alert move` | `asset*`, `percent*` | 24H percentage-move alert. |
| `/alert list` | — | List your active alerts. |
| `/alert delete` | `alert*` (autocomplete) | Delete an alert. |

## Portfolio

| Command | Options | Description |
| --- | --- | --- |
| `/portfolio view` | — | Value, 24H change, top holdings, allocation, P/L. |
| `/portfolio add` | `asset*`, `amount*`, `cost` | Add/update a holding (cost enables P/L). |
| `/portfolio remove` | `asset*` | Remove a holding. |

## News

| Command | Options | Description |
| --- | --- | --- |
| `/news latest` | `category` | Latest news (paginated), optionally filtered. |
| `/news subscribe` | `category*` | Subscribe to a category. |
| `/news unsubscribe` | `category*` | Unsubscribe. |
| `/news subscriptions` | — | List your subscriptions. |

## Airdrops & Security

| Command | Options | Description |
| --- | --- | --- |
| `/airdrop` | `status` | Browse tracked airdrops (paginated). |
| `/scan` | `chain*`, `address*` | Smart-contract risk scan (informational). |

Context menu: **Apps → "Scan for contract address"** on any message containing a `0x…` address.

## Profile

| Command | Options | Description |
| --- | --- | --- |
| `/profile view` | — | Your wallets, alerts, portfolios, prefs, premium, stats. Settings button. |
| `/profile timezone` | `tz*` | Set your IANA timezone. |

## Admin *(owner only — `DISCORD_OWNER_IDS`)*

| Command | Description |
| --- | --- |
| `/admin stats` | Uptime, guilds, command usage, memory, job stats. |
| `/admin health` | Database, Redis, gateway health. |
| `/admin jobs` | Recent scheduled job runs. |
| `/admin database` | Record counts. |
| `/admin logs` | Command error summary. |
| `/admin reload` | Hot-reload command modules. |
| `/admin cache [clear:<key>]` | Inspect/clear cache. |
| `/admin maintenance enabled:<bool>` | Toggle maintenance mode (pauses the scheduler). |
