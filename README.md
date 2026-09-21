# +1 Money Escape

Walk the Money Meadow, roll a growing ball of cash in front of you, and push it onto the lava river: every step over lava spends the ball on a bridge of money notes. Reach the next island for **Wins**, the permanent currency that buys better bills, auras, upgrades and pet eggs. Fifteen players a room, everything decided by the server.

## Run it

```bash
npm install
npm run dev
```

Client on <http://localhost:5182>, Colyseus server on port 2576. Without `MONGODB_URI` the server keeps profiles in `server/data/profiles.json`.

## Verify it

```bash
npm run verify              # course rules, progression rules, supplied assets (no server needed)
npm run build && npm run size:client
npm run verify:capacity     # with a server running: the 15-player limit
npm run verify:persistence  # spawns its own servers: guests, accounts, restarts, Mongo when a mongod is found
```

## Deploy

`Dockerfile` builds the whole monorepo and serves the client from the server; `.github/workflows/deploy.yml` is the Bloxity pipeline. Environment: `PORT`, `MONGODB_URI`, `MONEY_DATA_DIR`, `BLOXITY_GAME_ID` (`money-escape`).

See `CLAUDE.md` for the layout, the rules that must not drift, and where everything is.
