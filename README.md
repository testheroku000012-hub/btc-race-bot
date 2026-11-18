# btc-race-bot

[![bounty](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444) [![rank](https://make.fun/badge/btc-race-24h-20261118-1444/testheroku000012-hub/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444) [![reward](https://make.fun/badge/btc-race-24h-20261118-1444/testheroku000012-hub/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444)

A deterministic, long-only BTC dip buyer. It waits for a 15-bar decline of at least 0.5% followed by a higher close, then commits 30% of equity. Each position takes profit at 0.6%, stops at 2%, and expires after 480 bars; a five-bar cooldown limits repeated entries after an exit. All signals use only completed bars and account state.

## Run it

```sh
node main.ts
```
