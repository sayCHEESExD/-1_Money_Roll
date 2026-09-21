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

Bloxity Hosting, game id `money-roll`, from `.github/workflows/deploy.yml`:

| branch | channel | backend | frontend |
| --- | --- | --- | --- |
| `dev` | dev | `wss://money-roll.dev.host.bloxity.io` | `https://money-roll.dev.play.bloxity.io` |
| `main` | prod | `wss://money-roll.host.bloxity.io` | `https://money-roll.play.bloxity.io` |

The workflow builds the Colyseus server into a GHCR image (`Dockerfile`, built from the repository root so `@money/shared` resolves), rolls it through Legion with the commit SHA as the version, then builds the Vite client with that channel's backend URL baked in and uploads it as a zip. It needs one repository secret, `LEGION_DEPLOY_TOKEN` (My Games on hosting.bloxity.io, the eye icon). Legion injects `PORT`, `MONGODB_URI`, `BLOXITY_GAME_ID` and `POD_NAME`; the server answers `GET /health` and runs as `node`.

See `CLAUDE.md` for the layout, the rules that must not drift, and where everything is.
