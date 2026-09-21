/**
 * Static checks on the generated course, and runs through the real simulation.
 *
 * The course is GENERATED from a stage table, so a tuning change can quietly
 * produce a lava span no bridge could pay for or an island a player could
 * skip. This reads the same arrays the renderer and the server read and
 * asserts the rules the builders were written against - then drives
 * `stepPlayer` through the meadow, onto the lava with and without cash, over
 * the far bank, back off it, into a locked training zone and through a jump
 * over the lava, so the rules the specification states are things the
 * simulation is PROVEN to enforce rather than things the comments claim.
 *
 * Run after `npm run build:shared`.
 */
import * as S from '../shared/dist/index.js';

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`  FAIL  ${message}`);
};
const pass = (message) => console.log(`  ok    ${message}`);
const check = (condition, message) => (condition ? pass(message) : fail(message));
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const collision = new S.WorldCollision();
const events = S.createSimEvents();

/** A fresh simulation: a motion at (x, z) on the floor and a wallet holding `cash`. */
const start = (x, z, cash = 0, trainingUnlocked = 0) => {
  const motion = S.createMotion();
  S.resetMotion(motion, x, S.COURSE.floorY, z, 0);
  const bridge = S.createBridgeState();
  // The PERMANENT bills. The crossing supply (`bridge.cash`) is loaded from
  // them at the lava's edge and is what a crossing spends - through a ball
  // the meadow made, which every run here has unless it says otherwise.
  bridge.wallet = cash;
  bridge.active = cash > 0;
  const params = { moveMultiplier: 1, jumpVelocity: S.MOVEMENT.jumpVelocity, time: 0, trainingUnlocked, bridge };
  return { motion, params, bridge, log: { built: 0, spent: 0, crossed: 0, starved: false } };
};

/** Walk a run with an input for `seconds`, stepping at 60 Hz, tallying the events. */
const walk = (run, input, seconds) => {
  const full = { moveX: 0, moveZ: 0, jump: false, cameraYaw: 0, ...input };
  for (let i = 0; i < Math.round(seconds * 60); i += 1) {
    run.params.time += 1 / 60;
    S.stepPlayer(run.motion, full, run.params, 1 / 60, collision, events);
    run.log.built += events.built;
    run.log.spent += events.spent;
    run.log.crossed += events.crossed;
    if (events.starved) run.log.starved = true;
    if (collision.hasFallen(run.motion.x, run.motion.y, run.motion.z)) {
      run.fell = true;
      break;
    }
  }
  return run;
};

// -------------------------------------------------------------- the layout
console.log('layout');
{
  const stages = S.STAGES;
  check(stages.length === 30 && S.STAGE_COUNT === 30, `exactly ${stages.length} stages are defined`);
  check(stages.every((s) => Number.isFinite(s.crossCost) && s.crossCost > 0 && Number.isInteger(s.winReward) && s.winReward > 0), 'every stage has a cross cost and a Wins reward');
  check(stages[29].index === 30 && stages[29].crossCost < 1e13, `Stage 30 is the last, at ${S.formatCash(stages[29].crossCost)} to cross for ${S.formatWins(stages[29].winReward)} Wins`);
  check(stages.slice(0, 6).every((s, i) => s.crossCost === [500, 2500, 15000, 60000, 250000, 1000000][i] && s.winReward === [5, 15, 40, 100, 300, 1000][i]), 'the first six stages keep their hand-tuned values');
  check(stages.every((s, i) => i === 0 || s.theme !== stages[i - 1].theme), 'no two neighbouring islands share a biome');
  check(stages[0].winReward === 5, 'Stage 1 awards +5 Wins');
  let sequential = true;
  let cursor = S.COURSE_START_Z;
  for (const stage of stages) {
    if (stage.lavaStartZ !== cursor) sequential = false;
    if (stage.lavaEndZ !== stage.islandStartZ) sequential = false;
    if (stage.islandEndZ <= stage.islandStartZ) sequential = false;
    cursor = stage.islandEndZ;
  }
  check(sequential, 'the course runs Spawn -> Lava -> Island -> Lava -> Island with no gaps');
  check(cursor === S.COURSE_END_Z, 'the last island ends where the course ends');
  check(
    stages.every((s, i) => i === 0 || s.crossCost > stages[i - 1].crossCost),
    'every crossing costs more cash than the one before',
  );
  check(
    stages.every((s, i) => i === 0 || s.winReward > stages[i - 1].winReward),
    'every island awards more Wins than the one before',
  );
  check(
    stages.every((s) => near(S.cellCost(s.index) * S.CELLS_ALONG, s.crossCost)),
    'a straight line of cells across a stage costs exactly its cross cost',
  );
  check(
    stages.every((s) => {
      const pad = S.winPadAt(s.winPadX, s.padY, s.winPadZ);
      return pad && pad.index === s.index && s.winPadZ > s.islandStartZ && s.winPadZ < s.islandEndZ;
    }),
    'every win pad stands on its own island',
  );
  check(
    stages.every((s) => S.lavaAt(0, s.lavaStartZ + 1) && S.lavaAt(0, s.lavaEndZ - 1) && !S.lavaAt(0, s.islandStartZ + 1)),
    'the lava fills its span and stops at the island',
  );
  check(
    stages.every((s) => {
      for (let z = s.lavaStartZ + 0.5; z < s.lavaEndZ; z += 1) {
        const id = S.cellIdAt(0, z);
        if (id < 0 || S.cellStage(id) !== s.index) return false;
      }
      return S.cellIdAt(0, s.islandStartZ + 0.5) < 0 && S.cellIdAt(0, s.lavaStartZ - 0.5) < 0;
    }),
    'every point over lava maps to a cell of that stage and nothing beside it does',
  );
  check(
    stages.every((s) => S.cellIdAt(-S.COURSE.halfWidth + 0.5, s.lavaStartZ + 1) >= 0 && S.cellIdAt(S.COURSE.halfWidth - 0.5, s.lavaStartZ + 1) >= 0),
    'the cell grid spans the full width of the lava',
  );
  const encoded = S.encodeBridge(new Set([S.cellId(1, 0, 0), S.cellId(1, 15, 15), S.cellId(3, 7, 9)]));
  const decoded = new Set();
  S.decodeBridge(encoded, decoded);
  check(decoded.size === 3 && decoded.has(S.cellId(3, 7, 9)), 'a bridge survives its replicated encoding');
}

console.log('the meadow and the hub');
{
  check(S.inMeadow(0, (S.COURSE.meadowMinZ + S.COURSE.meadowMaxZ) / 2), 'the middle of the meadow is the meadow');
  check(!S.inMeadow(0, S.SPAWN_POSITION.z), 'the spawn is beside the meadow, not in it');
  check(!S.inMeadow(0, S.COURSE_START_Z - 1), 'the mouth of the course is not the meadow');
  check(S.SPAWN_POSITION.z < S.COURSE.meadowMinZ, 'the spawn stands short of the meadow so the first steps walk into it');
  const stands = S.BILLS.every((b) => {
    const pad = S.billPadAt(S.billPadX(b.slot), S.billPadY(b.slot) + 0.1, S.billPadZ(b.slot));
    return pad === b.slot && S.billPadX(b.slot) > S.COURSE.meadowMaxX;
  });
  check(stands, 'every bill stand sits on the LEFT of the meadow (+X, the player\'s left facing the course) and is claimable on its pad');
  const zones = S.TRAINING_ZONES.every((z) => S.trainingZoneX(z.index) < S.COURSE.meadowMinX && S.trainingZoneAt(S.trainingZoneX(z.index), S.TRAINING.padY, S.trainingZoneZ(z.index)) === z.index);
  check(zones, 'every training zone sits on the RIGHT of the meadow (-X) and is found under its own centre');
  check(S.EGGS.every((e) => Math.abs(e.z - S.SPAWN_POSITION.z) < 130 && e.z > S.COURSE.meadowMaxZ - 40), 'both eggs float near the far end of the meadow, in sight of a player walking the course');
}

// -------------------------------------------------------------- the meadow
console.log('walking the meadow');
{
  const run = walk(start(0, S.SPAWN_POSITION.z), { moveZ: 1 }, 5);
  check(!run.fell && run.motion.z > S.COURSE.meadowMinZ + 30, `a player walks straight from spawn into the meadow (z ${run.motion.z.toFixed(1)})`);
  check(near(run.motion.y, S.COURSE.floorY, 0.05), 'the meadow is walked on the floor, not on top of the money');
  check(run.log.spent === 0 && run.log.built === 0, 'the meadow never spends cash');
}

// ---------------------------------------------------------------- the lava
console.log('lava with no cash');
{
  const run = walk(start(0, S.COURSE_START_Z - 6, 0), { moveZ: 1 }, 6);
  check(run.log.starved, 'a player with no cash is STARVED at the lava edge');
  check(run.log.built === 0 && run.log.spent === 0, 'nothing is built for free');
  check(run.fell, 'and they fall into the lava');
  check(run.motion.z < S.COURSE_START_Z + 6, `they get no further than the first cells (z ${run.motion.z.toFixed(1)})`);
}

console.log('lava with a little cash');
{
  const price = S.cellCost(1);
  const run = walk(start(0, S.COURSE_START_Z - 6, price * 4 + 1), { moveZ: 1 }, 6);
  check(run.log.built === 4 && near(run.log.spent, price * 4), `four cells' worth of cash builds exactly four cells (spent ${run.log.spent})`);
  check(run.bridge.cash < price, 'the supply is spent down to less than one cell');
  check(run.log.starved && run.fell, 'then the player starves and falls');
  check(near(run.bridge.wallet, price * 4 + 1), 'and the permanent bills are exactly what they were: the crossing spent a COPY');
}

console.log('a full crossing');
{
  const stage = S.STAGES[0];
  const spare = 40;
  const run = walk(start(0, S.COURSE_START_Z - 6, stage.crossCost + spare), { moveZ: 1 }, 4.5);
  check(!run.fell, 'a player carrying the cross cost reaches the island');
  check(run.log.crossed === 1, 'the crossing is reported once');
  check(run.log.built === S.CELLS_ALONG, `a straight line builds ${S.CELLS_ALONG} cells`);
  check(near(run.log.spent, stage.crossCost), `the crossing spends exactly the cross cost (${run.log.spent})`);
  check(near(run.bridge.wallet, stage.crossCost + spare), 'the permanent bills are untouched by the crossing');
  check(run.bridge.cash === 0, 'the supply is released on the far bank: the ball is the wallet again');
  check(run.bridge.cells.size === 0, 'the bridge is released once the island is reached');
  check(run.motion.z > stage.islandStartZ && near(run.motion.y, S.COURSE.floorY, 0.05), 'the player stands on the island floor');
  check(run.motion.crossing === 0, 'the crossing flag clears on the island');
  // Straight on to the win pad.
  const toPad = walk(run, { moveZ: 1, moveX: 0 }, 0.8);
  const pad = S.winPadAt(stage.winPadX, stage.padY, stage.winPadZ);
  check(pad && pad.index === 1, 'the Stage 1 win pad is where the stage says');
  check(!toPad.fell && toPad.motion.z < stage.islandEndZ, 'the island can be walked without falling');
  const onward = walk(toPad, { moveZ: 1 }, 3);
  check(onward.fell && onward.log.starved, 'with 40 cash left, the NEXT lava starves the player: every stage must be paid for');
}

console.log('turning back');
{
  const stage = S.STAGES[0];
  const run = walk(start(0, S.COURSE_START_Z - 6, stage.crossCost), { moveZ: 1 }, 2.2);
  check(run.motion.crossing === 1 && run.bridge.cells.size > 0 && run.bridge.cells.size < S.CELLS_ALONG, `part way across, ${run.bridge.cells.size} cells are laid`);
  const laid = run.bridge.cells.size;
  const back = walk(run, { moveZ: -1 }, 3);
  check(!back.fell, 'walking back over the laid notes is safe');
  // Momentum carries the player a step further before the turn, which may buy one more cell.
  check(back.bridge.cells.size >= laid && back.bridge.cells.size <= laid + 1, `notes already laid are KEPT when the player retreats (${laid} -> ${back.bridge.cells.size})`);
  check(near(back.log.spent, back.bridge.cells.size * S.cellCost(1)), 'and walking back over them charges nothing: the spend is exactly the cells laid');
  check(back.motion.z < S.COURSE_START_Z && back.motion.crossing === 0, 'the player is back on the bank with the crossing flag cleared');
}

console.log('no ball, no crossing');
{
  // Bills in the wallet but no ball made in the meadow: the lava's edge starves the player.
  const run = start(0, S.COURSE_START_Z - 6, S.STAGES[0].crossCost + 100);
  run.bridge.active = false;
  walk(run, { moveZ: 1 }, 6);
  check(run.log.starved && run.fell && run.log.built === 0, 'a player who skipped the meadow cannot cross, however many bills they hold');
  check(near(run.bridge.wallet, S.STAGES[0].crossCost + 100), 'and loses none of them');
}

console.log('the same bills cross again');
{
  // Cross Stage 1 with exactly its cost, and Stage 2 (five times dearer) is
  // still paid for from the SAME permanent figure, because a crossing never
  // spends the bills themselves.
  const wallet = S.STAGES[1].crossCost;
  const first = walk(start(0, S.COURSE_START_Z - 6, wallet), { moveZ: 1 }, 4.5);
  check(first.log.crossed === 1 && near(first.bridge.wallet, wallet), `Stage 1 crossed; the bills still read ${first.bridge.wallet}`);
  const second = walk(start(0, S.STAGES[1].lavaStartZ - 6, wallet), { moveZ: 1 }, 4.5);
  check(second.log.crossed === 2 && near(second.log.spent, S.STAGES[1].crossCost) && near(second.bridge.wallet, wallet), 'Stage 2 is crossed on the same bills, spending its full cost from the supply');
  // Half way across, the supply reads the remainder while the wallet does not move.
  const mid = walk(start(0, S.COURSE_START_Z - 6, 1000), { moveZ: 1 }, 2.2);
  check(mid.motion.crossing === 1 && mid.bridge.cash < 1000 && near(mid.bridge.wallet, 1000), `mid-crossing the supply is ${mid.bridge.cash.toFixed(1)} and the bills are still 1000`);
  // Stepping back onto the bank returns the ball to the wallet.
  const back = walk(mid, { moveZ: -1 }, 3);
  check(back.motion.crossing === 0 && back.bridge.cash === 0 && near(back.bridge.wallet, 1000), 'back on the bank the supply is dropped and the bills are whole');
}

console.log('the bridge is the player\'s own');
{
  const stage = S.STAGES[0];
  const builder = walk(start(0, S.COURSE_START_Z - 6, stage.crossCost + 5), { moveZ: 1 }, 8);
  check(builder.log.crossed === 1, 'the builder crosses');
  const other = walk(start(0, S.COURSE_START_Z - 6, 0), { moveZ: 1 }, 6);
  check(other.fell && other.log.starved, 'a second player with no cash cannot walk someone else\'s bridge');
}

console.log('jumping over lava');
{
  // Jump at the very edge, with no cash, the whole way.
  const run = start(0, S.COURSE_START_Z - 2.5, 0);
  walk(run, { moveZ: 1, jump: true }, 0.05);
  walk(run, { moveZ: 1, jump: false }, 0.05);
  walk(run, { moveZ: 1, jump: true }, 5);
  check(run.fell, 'a player who jumps onto the lava with no cash lands in it and dies');
  check(run.log.built === 0, 'nothing was built in the air');
  const stage = S.STAGES[0];
  const longest = (S.MOVEMENT.jumpVelocity * 2) / S.MOVEMENT.gravity * S.MOVEMENT.moveSpeed;
  check(longest * 1.5 < S.COURSE.lavaLength, `the longest possible jump (${longest.toFixed(1)}) is far shorter than the lava (${stage.lavaEndZ - stage.lavaStartZ})`);
}

console.log('lava heights');
{
  check(S.COURSE.lavaSurfaceY < S.COURSE.floorY && S.COURSE.lavaDeathY < S.COURSE.floorY, 'the lava sits below the floor');
  check(S.COURSE.bridgeTopY === S.COURSE.floorY, 'a laid note is level with the banks');
  check(collision.hasFallen(0, S.COURSE.lavaDeathY - 0.05, S.COURSE_START_Z + 10), 'touching the lava is death');
  check(!collision.hasFallen(0, S.COURSE.floorY, S.COURSE_START_Z + 10), 'standing at floor height over it is not');
  check(!collision.hasFallen(0, S.COURSE.lavaDeathY - 0.05, S.SPAWN_POSITION.z), 'the same height in the hub is only under the floor, not lava');
}

// ---------------------------------------------------------- training zones
console.log('training zones');
{
  const z2 = S.TRAINING_ZONES[1];
  const x = S.trainingZoneX(z2.index);
  const z = S.trainingZoneZ(z2.index);
  // moveX = +1 is the camera's right, which is world -X at yaw 0: toward the zones.
  const locked = walk(start(x + S.TRAINING.size, z, 0, S.trainingUnlockMask(0)), { moveX: 1, cameraYaw: 0 }, 3);
  check(S.trainingZoneAt(locked.motion.x, locked.motion.y, locked.motion.z) !== z2.index && locked.motion.x > x, `zone ${z2.index} refuses a player with 0 rebirths (stopped at x ${locked.motion.x.toFixed(1)})`);
  check(locked.motion.trainingZone === 0, 'and the simulation reports no zone');
  const open = walk(start(x + S.TRAINING.size, z, 0, S.trainingUnlockMask(z2.rebirthsRequired)), { moveX: 1, cameraYaw: 0 }, 1.4);
  check(S.trainingZoneAt(open.motion.x, open.motion.y, open.motion.z) === z2.index, `zone ${z2.index} admits a player with ${z2.rebirthsRequired} rebirths (x ${open.motion.x.toFixed(1)})`);
  check(open.motion.trainingZone === z2.index, 'and the simulation reports the zone they stand in');
  check(S.trainingMultiplier(z2.index, 0) === 0 && S.trainingMultiplier(z2.index, z2.rebirthsRequired) === z2.multiplier, 'a locked zone pays nothing; an open one pays its multiplier');
  check(S.trainingUnlockMask(0) === 1 && S.trainingUnlockMask(2) === 3 && S.trainingUnlockMask(5) === 7, 'the unlock mask opens 1, 2 then 3 zones at 0, 2 and 5 rebirths');
}

console.log('the walls');
{
  const run = walk(start(0, S.SPAWN_POSITION.z, 0), { moveZ: -1 }, 3);
  check(!run.fell && run.motion.z >= S.COURSE.hubMinZ, 'the back wall holds');
  const side = walk(start(0, S.SPAWN_POSITION.z, 0), { moveX: 1 }, 10);
  check(!side.fell && side.motion.x <= S.COURSE.hubMaxX + 0.01, 'the side wall holds');
  const edge = walk(start(0, S.STAGES[0].islandStartZ + 5, 0), { moveX: -1 }, 5);
  check(edge.fell || Math.abs(edge.motion.x) <= S.COURSE.corridorHalfWidth + 0.01, 'the island edge is either a wall or a fall, never a way round');
  check(!edge.fell, 'the corridor rails keep a player on the island');
}

if (failures > 0) {
  console.error(`\n${failures} course check(s) failed.`);
  process.exit(1);
}
console.log('\ncourse OK');
