# +1 Money Escape

A browser multiplayer "money obby": walk the **Money Meadow** to fill a **money ball**, push it onto the **lava river**, where it is spent laying a bridge of notes, reach the next island for **Wins**. Three.js client, Colyseus authoritative server, one shared deterministic simulation. Hosted on Bloxity.

## Layout

```
shared/   @money/shared  - framework-free TS: every gameplay value, the course, the simulation
server/   @money/server  - Colyseus room (port 2576), services, persistence (JSON dev store / MongoDB)
client/   @money/client  - Three.js + Vite (dev 5182, preview 4182); publicDir is the repo-level assets/
scripts/  verification scripts (see below)
assets/   the SUPPLIED art and audio; never modified, digests checked by verify:assets
```

Node 20+, npm workspaces. `npm install` once at the root.

## Commands

| command | what |
| --- | --- |
| `npm run dev` | shared build, then server (tsx watch) + client (vite) together |
| `npm run build` | shared, server, client |
| `npm run typecheck` | every workspace |
| `npm run verify` | course + progression + assets (in-process; no server needed) |
| `npm run verify:capacity` | against a RUNNING server: 15-player rooms, overflow routing, empty rooms close |
| `npm run verify:persistence` | spawns the built server with Bloxity stubbed: guests, accounts, migration, restarts, Bux grants |
| `npm run size:client` | client/dist against the 12 MB budget |

The `.claude/launch.json` entry `dev` runs `npm run dev` on port 5182 for the in-app browser.

## The rules that must not drift

- **Everything gameplay is server-authoritative.** Cash is earned only in `server/src/progression/CashService.ts` (meadow distance, training-zone time, pickups via `grant`), spent only inside the shared simulation (`shared/src/sim/PlayerSim.ts`, `buildUnder`). Wins are paid only by `StageService`, spent only through `Wallet`. The client sends intentions (`MessageType`), never figures.
- **Every tunable lives in `shared/src/config/*`**: `cash.ts` (rates, level curve), `rebirth.ts` (25 levels per rebirth, ×1 + 0.5 per rebirth, no other multipliers), `bills.ts` (10 bills), `auras.ts` (4), `upgrades.ts` (Walkspeed 5K, Max Pets 1M), `training.ts` (3 zones at 0/2/5 rebirths), `pets.ts` (12 pets, 2 eggs, 30/30/25/10/4/1), `course.ts` (stage table `STAGE_TUNING`, the layout, the cell grid). Add a stage by adding a row to `STAGE_TUNING`.
- **Bills (cash) are permanent; a crossing spends a COPY.** `PlayerState.cash` is the wallet: raised only by `CashService`, reset only by `RebirthService`, and it is what the profile saves. Stepping onto lava loads `BridgeState.cash` (the crossing supply, replicated as `crossingCash`, never persisted) from the wallet; the bridge is bought from the supply; a death or a placement drops the supply and leaves the wallet alone. `MovementService.publish` must never write `player.cash` from the simulation (`verify:progression` proves the death → respawn → 1,000 bills loop).
- **The course is Spawn → Lava → Island → Lava → Island…** with no obstacles, parkour, mazes or checkpoints. Lava is crossed only by paying from the crossing supply; jumping cannot bypass it (`verify:course` proves both). Reaching an island drops the bridge and the supply; a starved player is dragged to a stop, pulled into the lava, dies, and respawns with their bills intact. Wins are never touched by any of that.
- **No client-local progression.** `localStorage` holds only the guest id (`money.playerId`) and cosmetic conveniences. Profiles are per key (guest id or `acct:` account id) in the JSON store (`MONEY_DATA_DIR`, default `server/data`) or MongoDB (`MONGODB_URI`).
- **No Render, no Netlify.** Deploy is the Dockerfile + `.github/workflows/deploy.yml` for Bloxity (slug `money-escape`).
- **Supplied assets are never renamed or edited.** `robot steps.mp3` keeps its space and is referenced as `robot%20steps.mp3`.

## Where things are

- Simulation: `shared/src/sim/PlayerSim.ts` (`stepPlayer`, `BridgeState`, events built/spent/crossed/starved) and `WorldCollision.ts` (solids by Z bucket, per-player bridge cells, training lock, lava death).
- Room: `server/src/rooms/CourseRoom.ts`. Services under `server/src/progression/`. Persistence under `server/src/persistence/` (`ProfileStorage`, `JsonStorage`, `MongoStorage`, `WriteQueue`).
- Client composition root: `client/src/core/Game.ts`. Prediction + reconciliation: `client/src/player/LocalPlayer.ts`. World: `client/src/world/MoneyWorld.ts` and its parts (BillStands, TrainingZones, PetShop, MoneyBridges, CashPickups, StageSigns, Scoreboard, Sky). HUD: `client/src/ui/` (candy style in `hudStyles.ts`).
- All textures are drawn on canvas at runtime (`client/src/world/WorldTextures.ts`): `studs` for floors, pads, props and hills (props go through `MoneyWorld.propMaterial`, their outline is `shade(colour, 0.68)`), `brick` for the block walls, `bills` for money, `lava`. The only image files are the player texture and the nine HUD icons in `assets/ui/` (Bills, Pets, Sound, Upgrades, trophy, rebirth, aura, shoe, shop), used as supplied.

## Conventions

- Movement is camera-relative; in the simulation `moveX = +1` is the camera's right, which is world −X when the yaw is 0.
- Rail hotkeys: R Rebirth, P Pets, U Upgrades, I Auras, M Sound; E hatch, Q multi-hatch beside an egg. No sprint.
- **HUD sizing is one unit.** `--hu` in `hudStyles.ts` is `clamp(6.5px, min(0.92vw, 1.55dvh), 12.5px)`; every HUD length (tiles, gaps, borders, type, the cash bar, the egg card, panels) is a multiple of it, so the HUD scales with the viewport between a phone floor and a desktop ceiling. Anchors: rail left + vertical centre, cash bar bottom + horizontal centre, corner stats bottom-left, account chip top-right, egg card right-middle (above the jump button with touch controls). Never add a per-device scale multiplier; change the unit's bounds or an element's multiple.
- `verify:*` scripts are the acceptance tests. Change a rule, change the script that asserts it, and run `npm run verify`.
