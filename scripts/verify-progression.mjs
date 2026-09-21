/**
 * The progression rules, exercised in-process.
 *
 * Every figure the specification pins down is asserted here EXACTLY: the cash
 * curve, the rebirth ladder and its multiplier, the ten bills, the four auras,
 * the two upgrades, the three training zones, the two eggs and their odds.
 * Then the server's own services are driven through the paths a client can
 * reach - including every rejection - so "the server decides" is something
 * this script proves rather than something the comments claim.
 *
 * Run after `npm run build:server`.
 */
import * as S from '../shared/dist/index.js';
import { PlayerState } from '../server/dist/rooms/state/PlayerState.js';
import { CashService } from '../server/dist/progression/CashService.js';
import { BillService } from '../server/dist/progression/BillService.js';
import { AuraService } from '../server/dist/progression/AuraService.js';
import { UpgradeService } from '../server/dist/progression/UpgradeService.js';
import { PetService } from '../server/dist/progression/PetService.js';
import { RebirthService } from '../server/dist/progression/RebirthService.js';
import { StageService } from '../server/dist/progression/StageService.js';
import { MovementService } from '../server/dist/movement/MovementService.js';
import { wallet } from '../server/dist/progression/Wallet.js';
import { PROGRESS_KEYS, PROGRESS_TEXT_KEYS } from '../server/dist/persistence/StoredProfile.js';

const PERSISTED = [...PROGRESS_KEYS, ...PROGRESS_TEXT_KEYS];

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`  FAIL  ${message}`);
};
const pass = (message) => console.log(`  ok    ${message}`);
const check = (condition, message) => (condition ? pass(message) : fail(message));
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/** Step the wall clock, so a spam cooldown can be stepped past in a test. */
let clockOffset = 0;
const realNow = Date.now;
Date.now = () => realNow() + clockOffset;
const advanceClock = (ms) => {
  clockOffset += ms;
};

// ---------------------------------------------------------------- the curve
console.log('cash curve and levels');
check(S.cashForNextLevel(0) === 40, 'level 1 costs 40 cash');
check(S.cashForNextLevel(1) === Math.round(40 * 1.22), 'level 2 costs 22% more');
{
  let monotonic = true;
  for (let level = 1; level <= 100; level += 1) {
    if (S.cashForNextLevel(level) <= S.cashForNextLevel(level - 1)) monotonic = false;
  }
  check(monotonic, 'every level costs more than the one before');
  check(S.resolveLevel(0, 25).level === 0, 'no cash is level 0');
  check(S.resolveLevel(S.totalCashToReach(10), 25).level === 10, 'the cumulative table and the resolver agree at 10');
  const capped = S.resolveLevel(1e15, 25);
  check(capped.level === 25 && capped.capped, 'a huge total stops at the cap');
  const higher = S.resolveLevel(1e15, 50);
  check(higher.level === 50 && higher.capped, 'a higher cap lets it go on to 50');
  check(S.formatCash(999) === '999' && S.formatCash(1000) === '1K' && S.formatCash(2500) === '2.5K', '1K and 2.5K abbreviations');
  check(S.formatCash(1_000_000) === '1M' && S.formatCash(250_000_000) === '250M', '1M and 250M abbreviations');
}

console.log('rebirths');
check(S.LEVELS_PER_REBIRTH === 25, 'a rebirth is 25 levels');
check(S.rebirthRequiredLevel(0) === 25 && S.rebirthRequiredLevel(1) === 50 && S.rebirthRequiredLevel(2) === 75, 'the ladder is 25, 50, 75');
check(S.maxLevelForRebirth(0) === 25 && S.maxLevelForRebirth(3) === 100, 'the level cap is 25 more per rebirth');
check(near(S.rebirthMultiplier(0), 1) && near(S.rebirthMultiplier(1), 1.5) && near(S.rebirthMultiplier(4), 3), 'the cash multiplier is 1 + 0.5 per rebirth');
check(S.canRebirth(25, 0) && !S.canRebirth(24, 0) && !S.canRebirth(25, 1) && S.canRebirth(50, 1), 'eligibility follows the ladder');
{
  const base = S.cashBoostFor({ rebirths: 0, auraSlot: 0, ownedAuras: 0, petBoost: 0 });
  const only = S.cashBoostFor({ rebirths: 2, auraSlot: 0, ownedAuras: 0, petBoost: 0 });
  check(near(base, 1) && near(only, 2), 'with nothing else, the boost IS the rebirth multiplier: no hidden multipliers');
}

console.log('bills');
{
  const expected = [
    [1, 1, 0], [2, 2, 5], [3, 5, 25], [4, 10, 150], [5, 30, 1000],
    [6, 100, 3000], [7, 350, 12000], [8, 1000, 40000], [9, 4000, 100000], [10, 15000, 250000],
  ];
  check(S.BILLS.length === 10, 'ten bills');
  check(
    expected.every(([slot, gain, wins]) => {
      const bill = S.billForSlot(slot);
      return bill && bill.gain === gain && bill.winsRequired === wins;
    }),
    'every bill has the specified gain and Wins price',
  );
  check(S.ownsBill(S.INITIAL_OWNED_BILLS, 1) && !S.ownsBill(S.INITIAL_OWNED_BILLS, 2), 'the +1 bill is free and the rest are not');
  check(S.bestOwnedBill(S.billBit(1) | S.billBit(4) | S.billBit(2)).slot === 4, 'the best owned bill is the one equipped');
  check(near(S.meadowCashPerUnit(1, 1), S.CASH.meadowCashPerUnit) && near(S.meadowCashPerUnit(4, 1), S.CASH.meadowCashPerUnit * 10), 'a bill multiplies the cash per unit of meadow');
}

console.log('auras');
{
  const expected = [[1, 1.5, 5000], [2, 2, 50000], [3, 3, 1_000_000], [4, 4, 250_000_000]];
  check(S.AURA_TIERS.length === 4, 'four auras: Dust, Nature, Fire, Troll');
  check(expected.every(([slot, boost, wins]) => S.AURA_TIERS.some((t) => t.slot === slot && near(t.boost, boost) && t.winsRequired === wins)), 'every aura has the specified boost and Wins price');
  check(near(S.auraMultiplier(0, 0), 1) && near(S.auraMultiplier(S.auraMask(2), 2), 2), 'no aura is x1; a worn, owned aura is its boost');
  check(near(S.auraMultiplier(0, 2), 1), 'an aura not owned cannot boost even if the slot says so');
}

console.log('upgrades');
{
  const walk = S.upgradeByKind('walkspeed');
  const pets = S.upgradeByKind('maxPets');
  check(walk && walk.cost === 5000, 'Walkspeed costs 5K Wins');
  check(pets && pets.cost === 1_000_000, 'Max Pets costs 1M Wins');
  check(near(S.resolveMovementProfile(0).multiplier, 1) && near(S.resolveMovementProfile(1).multiplier, 18 / 16) && S.resolveMovementProfile(3).moveSpeed === 22, 'each Walkspeed is +2 on a base of 16');
  check(S.maxPetSlots(0) === 3 && S.maxPetSlots(2) === 5, 'three pet slots, plus one per Max Pets');
  check(S.resolveMovementProfile(5).jumpVelocity === S.MOVEMENT.jumpVelocity, 'no upgrade changes the jump');
}

console.log('training zones');
{
  const expected = [[1, 0, 1], [2, 2, 2], [3, 5, 3]];
  check(expected.every(([i, rb, mult]) => S.TRAINING_ZONES.some((z) => z.index === i && z.rebirthsRequired === rb && z.multiplier === mult)), 'three zones at 0, 2 and 5 rebirths for x1, x2, x3');
  check(near(S.trainingCashPerSecond(3, 5, 1, 1), S.CASH.trainingCashPerSecond * 3) && near(S.trainingCashPerSecond(3, 4, 1, 1), 0), 'a locked zone pays nothing');
}

console.log('pets and eggs');
{
  const basic = S.eggById('basic');
  const rare = S.eggById('rare');
  check(basic && basic.cost === 5 && rare && rare.cost === 3000, 'the Basic egg is 5 Wins and the Rare egg 3K');
  const odds = [30, 30, 25, 10, 4, 1];
  check([basic, rare].every((egg) => egg.pool.length === 6 && egg.pool.every((p, i) => p.chance === odds[i])), 'both eggs roll 30/30/25/10/4/1');
  check([basic, rare].every((egg) => egg.pool.reduce((sum, p) => sum + p.chance, 0) === 100), 'the odds sum to 100');
  const counts = new Map();
  let seed = 7;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 20000; i += 1) {
    const pet = S.rollPet(basic, random);
    counts.set(pet.id, (counts.get(pet.id) ?? 0) + 1);
  }
  const first = counts.get(basic.pool[0].petId) / 20000;
  const last = counts.get(basic.pool[5].petId) / 20000;
  check(first > 0.27 && first < 0.33 && last > 0.004 && last < 0.02, `20000 rolls land near the odds (first ${(first * 100).toFixed(1)}%, last ${(last * 100).toFixed(2)}%)`);
  check(S.MAX_PET_STORAGE >= 30 && S.BASE_PET_SLOTS === 3, 'thirty pets of storage, three worn');
  const roundTrip = S.decodePets(S.encodePets(['dog', 'king', 'cat']));
  check(roundTrip.length === 3 && roundTrip[1] === 'king', 'the inventory survives its replicated encoding');
  const best = S.bestPetIndices(['dog', 'king', 'cat', 'dragon'], 2);
  check(best.length === 2 && best.includes(1) && best.includes(3), 'Equip Best picks the two strongest');
}

// -------------------------------------------------------------- the services
console.log('server services');

const cash = new CashService();
const bills = new BillService();
const auras = new AuraService();
const upgrades = new UpgradeService();
const pets = new PetService(() => 0.01);
const rebirths = new RebirthService();
const stages = new StageService();
const movement = new MovementService();

const player = new PlayerState();
player.sessionId = 's1';
cash.initialise(player);
bills.initialise(player);
auras.initialise(player);
upgrades.initialise(player);
pets.initialise(player);
stages.initialise('s1');
movement.initialise(player);

/** Put the player somewhere, as the server's own simulation would. */
const place = (x, y, z) => {
  movement.teleport('s1', player, x, y, z, 0);
  player.x = x;
  player.y = y;
  player.z = z;
};

/**
 * Walk the SERVER simulation forward until the player passes `targetZ`, is
 * starved, or `seconds` run out, feeding it move messages the way a client
 * does and stepping the wall clock so the input budget refills.
 */
let nextSeq = 1;
const walkServer = (targetZ, seconds) => {
  const log = { starved: false, spent: 0 };
  for (let i = 0; i < seconds / 0.05; i += 1) {
    advanceClock(50);
    const ok = movement.applyInput('s1', player, { seq: nextSeq++, dt: 0.05, moveX: 0, moveZ: 1, jump: false, cameraYaw: 0 }, i * 0.05);
    if (!ok) throw new Error(`input refused: ${movement.rejectReason ?? 'unknown'}`);
    const events = movement.events;
    log.spent += events.spent;
    if (events.starved) log.starved = true;
    if (player.z >= targetZ || movement.collision.hasFallen(player.x, player.y, player.z)) break;
  }
  return log;
};

/** What the profile store would write for this player: the persisted fields only. */
const snapshotOf = (p) => {
  const out = {};
  for (const key of PERSISTED) out[key] = p[key];
  return out;
};

console.log('  earning');
{
  place(0, 0, S.SPAWN_POSITION.z);
  const idle = cash.credit('s1', player, 0.05, 0, true, movement);
  check(idle.gained === 0, 'the first tick after a placement pays nothing');
  const still = cash.credit('s1', player, 0.05, 0, true, movement);
  check(still.gained === 0 && player.cash === 0, 'standing beside the meadow pays nothing');
  place(0, 0, -80);
  cash.credit('s1', player, 0.05, 0, true, movement);
  const stillIn = cash.credit('s1', player, 0.05, 0, true, movement);
  check(stillIn.gained === 0, 'standing STILL in the meadow pays nothing');
  const walked = cash.credit('s1', player, 0.05, 0.8, true, movement);
  check(near(walked.gained, 0.8 * S.CASH.meadowCashPerUnit) && near(player.cash, walked.gained), `walking 0.8 units of meadow pays ${walked.gained} cash`);
  const teleported = cash.credit('s1', player, 0.05, 40, true, movement);
  check(teleported.gained === 0, 'a step too long to be walked pays nothing');
  const airborne = cash.credit('s1', player, 0.05, 0.8, false, movement);
  check(airborne.gained === 0, 'a step in the air pays nothing');
  player.trainingZone = 2;
  const locked = cash.credit('s1', player, 1, 0, true, movement);
  check(locked.gained === 0, 'a training zone the rebirth count has not unlocked pays nothing even when reported');
  // The zone a player stands in is DERIVED from the server's own simulation
  // and published from it, so the test stands the simulated body on the pad.
  place(S.trainingZoneX(1), S.TRAINING.padY, S.trainingZoneZ(1));
  movement.motionOf('s1').trainingZone = 1;
  player.trainingZone = 1;
  cash.credit('s1', player, 0.05, 0, true, movement);
  const trained = cash.credit('s1', player, S.MAX_SIM_DELTA, 0, true, movement);
  check(near(trained.gained, S.CASH.trainingCashPerSecond * S.MAX_SIM_DELTA), `a ${S.MAX_SIM_DELTA}s step in zone 1 pays ${trained.gained}`);
  const clamped = cash.credit('s1', player, 5, 0, true, movement);
  check(near(clamped.gained, S.CASH.trainingCashPerSecond * S.MAX_SIM_DELTA), 'a step longer than the simulation allows is clamped, not paid in full');
  movement.motionOf('s1').trainingZone = 0;
  player.trainingZone = 0;
  check(player.lifetimeCash > 0 && near(player.levelCash, player.lifetimeCash), 'cash earned counts toward the level and the lifetime total');
}

console.log('  stages');
{
  place(0, 0, S.SPAWN_POSITION.z);
  const far = stages.claim('s1', player, 1);
  check(!far.granted && far.reason === 'not-on-pad', 'a stage claimed from spawn is refused');
  const stage = S.STAGES[0];
  place(stage.winPadX, stage.padY, stage.winPadZ);
  const won = stages.claim('s1', player, 1);
  check(won.granted && won.wins === 5 && player.wins === 5 && player.bestStage === 1, 'Stage 1 on its pad pays +5 Wins');
  const again = stages.claim('s1', player, 1);
  check(!again.granted && again.reason === 'cooldown', 'claiming twice in a row is refused');
  const wrong = stages.claim('s1', player, 2);
  check(!wrong.granted, 'Stage 2 cannot be claimed from the Stage 1 pad');
  const bogus = stages.claim('s1', player, 99);
  check(!bogus.granted && bogus.reason === 'unknown-stage', 'an unknown stage is refused');
  advanceClock(5000);
  place(stage.winPadX, stage.padY, stage.winPadZ);
  stages.claim('s1', player, 1);
  check(player.wins === 10, 'a second visit pays again');
}

console.log('  bills');
{
  const pad = (slot) => place(S.billPadX(slot), S.billPadY(slot) + 0.05, S.billPadZ(slot));
  place(0, 0, S.SPAWN_POSITION.z);
  const far = bills.claim(player, 2, cash);
  check(!far.granted && far.reason === 'not-on-pad', 'a bill claimed away from its pad is refused');
  pad(3);
  const poor = bills.claim(player, 3, cash);
  check(!poor.granted && poor.reason === 'too-few-wins', 'a bill the player cannot afford is refused');
  pad(2);
  const bought = bills.claim(player, 2, cash);
  check(bought.granted && player.wins === 5 && S.ownsBill(player.ownedBills, 2) && player.billSlot === 2, 'the +2 bill costs 5 Wins and is equipped at once');
  advanceClock(1000);
  const dup = bills.claim(player, 2, cash);
  check(!dup.granted && dup.reason === 'already-owned', 'a bill is bought once');
  const one = bills.claim(player, 1, cash);
  check(!one.granted, 'the free bill is already owned');
  const unknown = bills.claim(player, 42, cash);
  check(!unknown.granted && unknown.reason === 'unknown-slot', 'an unknown slot is refused');
}

console.log('  the bills survive a death; only a rebirth resets them');
{
  /**
   * The whole loop the specification describes, through the SERVER's own
   * movement service and cash service: farm bills, step onto the lava, watch
   * the supply go, starve, die, respawn, and read the profile.
   */
  const bank = S.STAGES[1];
  place(0, 0, bank.lavaStartZ - 4);
  movement.setCash('s1', player, 1000);
  const walked = walkServer(bank.lavaStartZ + 20, 6);
  check(player.crossing === 2 && player.crossingCash < 1000 && player.cash === 1000, `on the lava the supply is spent (${player.crossingCash.toFixed(0)} left) while the bills read ${player.cash}`);
  check(walked.starved, 'with 1,000 bills against a 2,500 crossing the player starves');
  check(movement.collision.hasFallen(player.x, player.y, player.z) || player.y < S.COURSE.lavaDeathY, 'and is pulled into the lava');
  // What the room does on a death: drop the supply. Then what a placement does.
  movement.dropSupply('s1', player);
  check(player.crossingCash === 0 && player.cash === 1000, 'death drops the supply and leaves the bills at 1,000');
  movement.teleport('s1', player, S.SPAWN_POSITION.x, S.SPAWN_POSITION.y, S.SPAWN_POSITION.z, 0);
  cash.reset('s1');
  check(player.cash === 1000 && player.bridge === '', 'the respawn keeps the bills and drops the bridge');
  const saved = snapshotOf(player);
  check(saved.cash === 1000 && !('crossingCash' in saved), 'the profile stores the permanent bills and never the crossing supply');
  // Another crossing has the FULL figure again.
  place(0, 0, S.COURSE_START_Z - 4);
  walkServer(S.COURSE_START_Z + 14, 3);
  check(player.crossing === 1 && near(player.crossingCash, 1000 - player.bridge.split(',').length * S.cellCost(1)) && player.cash === 1000, `the next crossing draws on the full 1,000 again (supply ${player.crossingCash.toFixed(0)}, bills ${player.cash})`);
  place(0, 0, S.SPAWN_POSITION.z);
  check(player.crossingCash === 0 && player.cash === 1000, 'a placement clears only the supply');
}

console.log('  rebirth');
{
  check(!rebirths.isEligible(player), 'a level-0 player cannot rebirth');
  const refused = rebirths.rebirth(player, cash, movement);
  check(!refused.ok && refused.reason === 'not-eligible', 'and the request is refused');
  player.levelCash = S.totalCashToReach(25);
  cash.syncDerived(player);
  check(player.level === 25 && player.maxLevel === 25, 'reaching the cap is level 25');
  wallet.add(player, 100);
  const winsBefore = player.wins;
  const billsBefore = player.ownedBills;
  movement.setCash('s1', player, 123);
  check(player.cash === 123, 'the bills are set for the test');
  const done = rebirths.rebirth(player, cash, movement);
  check(done.ok && done.rebirths === 1 && near(done.multiplier, 1.5), 'at level 25 the rebirth is granted for x1.5');
  check(player.level === 0 && player.levelCash === 0 && player.cash === 0, 'levels and cash reset');
  check(player.maxLevel === 50, 'the cap rises to 50');
  check(player.wins === winsBefore && player.ownedBills === billsBefore, 'Wins and bills are untouched');
  check(!rebirths.isEligible(player), 'level 0 of the second cycle cannot rebirth');
  player.levelCash = S.totalCashToReach(25);
  cash.syncDerived(player);
  check(!rebirths.isEligible(player), 'level 25 is no longer enough: 50 is needed now');
  player.levelCash = S.totalCashToReach(50);
  cash.syncDerived(player);
  check(rebirths.isEligible(player), 'level 50 is');
  const boost = S.cashBoostFor(cash.boostInputs(player));
  check(near(boost, 1.5), 'the rebirth multiplier now applies to every stack');
}

console.log('  auras');
{
  player.wins = 4999;
  const poor = auras.buy(player, 1, cash);
  check(!poor.ok && poor.reason === 'too-few-wins', '4,999 Wins does not buy Dust');
  player.wins = 5000;
  const bought = auras.buy(player, 1, cash);
  check(bought.ok && player.wins === 0 && S.isAuraOwned(player.ownedAuras, 1), 'Dust costs exactly 5K Wins');
  advanceClock(1000);
  const dup = auras.buy(player, 1, cash);
  check(!dup.ok && dup.reason === 'already-owned', 'an aura is bought once');
  const notOwned = auras.equip(player, 2, cash);
  check(!notOwned.ok && notOwned.reason === 'not-owned', 'an aura not owned cannot be worn');
  const worn = auras.equip(player, 1, cash);
  check(worn.ok && player.auraSlot === 1, 'an owned aura is worn');
  check(near(S.cashBoostFor(cash.boostInputs(player)), 1.5 * 1.5), 'the worn aura multiplies with the rebirth');
  const off = auras.equip(player, 0, cash);
  check(off.ok && player.auraSlot === 0, 'and can be taken off');
  const bogus = auras.buy(player, 'troll', cash);
  check(!bogus.ok && bogus.reason === 'unknown-slot', 'a non-numeric slot is refused');
}

console.log('  upgrades');
{
  player.wins = 4999;
  const poor = upgrades.buy(player, 'walkspeed', cash);
  check(!poor.ok && poor.reason === 'too-few-wins', '4,999 Wins does not buy Walkspeed');
  player.wins = 5000;
  const bought = upgrades.buy(player, 'walkspeed', cash);
  check(bought.ok && bought.level === 1 && player.wins === 0 && player.speedUpgrades === 1, 'Walkspeed costs exactly 5K Wins');
  check(near(player.moveMultiplier, 18 / 16), 'and the replicated speed is 18 on a base of 16');
  advanceClock(1000);
  const unknown = upgrades.buy(player, 'sprint', cash);
  check(!unknown.ok && unknown.reason === 'unknown-upgrade', 'there is no sprint upgrade');
  player.wins = 1_000_000;
  const slots = upgrades.buy(player, 'maxPets', cash);
  check(slots.ok && player.petSlotUpgrades === 1 && player.wins === 0, 'Max Pets costs exactly 1M Wins');
  check(S.maxPetSlots(player.petSlotUpgrades) === 4, 'and adds a fourth slot');
}

console.log('  pets');
{
  const basic = S.eggById('basic');
  place(0, 0, S.SPAWN_POSITION.z);
  player.wins = 100;
  const far = pets.hatch(player, 'basic', 1, cash);
  check(!far.ok && far.reason === 'not-at-egg', 'an egg cannot be hatched from spawn');
  place(basic.x, 0, basic.z + 3);
  const bad = pets.hatch(player, 'basic', 2, cash);
  check(!bad.ok && bad.reason === 'bad-count', 'only 1 or the multi count is accepted');
  player.wins = 4;
  const poor = pets.hatch(player, 'basic', 1, cash);
  check(!poor.ok && poor.reason === 'too-few-wins', '4 Wins does not hatch a 5-Win egg');
  player.wins = 5;
  const one = pets.hatch(player, 'basic', 1, cash);
  check(one.ok && one.pets.length === 1 && player.wins === 0 && S.decodePets(player.pets).length === 1, 'the Basic egg costs exactly 5 Wins and gives one pet');
  check(S.decodeIndices(player.equippedPets).length === 1 && player.petBoost > 0, 'a hatched pet follows at once while a slot is free, and boosts cash');
  advanceClock(2000);
  player.wins = 15;
  const three = pets.hatch(player, 'basic', S.MULTI_HATCH_COUNT, cash);
  check(three.ok && three.pets.length === 3 && player.wins === 0 && S.decodePets(player.pets).length === 4, 'the multi hatch costs three eggs and gives three pets');
  check(S.decodeIndices(player.equippedPets).length === S.maxPetSlots(player.petSlotUpgrades), `the slot limit (${S.maxPetSlots(player.petSlotUpgrades)}) holds: the team is full`);
  const unknown = pets.hatch(player, 'golden', 1, cash);
  check(!unknown.ok && unknown.reason === 'unknown-egg', 'an unknown egg is refused');
  const twice = pets.equip(player, 0, cash);
  check(!twice.ok && twice.reason === 'already', 'a pet is worn once');
  advanceClock(2000);
  player.wins = 5;
  pets.hatch(player, 'basic', 1, cash);
  check(S.decodePets(player.pets).length === 5 && !S.decodeIndices(player.equippedPets).includes(4), 'a pet hatched into a full team is stored, not worn');
  const full = pets.equip(player, 4, cash);
  check(!full.ok && full.reason === 'slots-full', 'and cannot be worn until a slot is freed');
  const off = pets.unequip(player, 0, cash);
  check(off.ok && !S.decodeIndices(player.equippedPets).includes(0), 'a pet can be taken off');
  const notWorn = pets.unequip(player, 0, cash);
  check(!notWorn.ok && notWorn.reason === 'not-equipped', 'and only once');
  const wornNow = pets.equip(player, 4, cash);
  check(wornNow.ok && S.decodeIndices(player.equippedPets).includes(4), 'then the stored pet can be worn');
  const boostBefore = player.petBoost;
  pets.equipBest(player, cash);
  check(player.petBoost >= boostBefore && S.decodeIndices(player.equippedPets).length === S.maxPetSlots(player.petSlotUpgrades), 'Equip Best fills every slot with the strongest');
  const removed = pets.delete(player, 4, cash);
  check(removed.ok && S.decodePets(player.pets).length === 4, 'a pet can be deleted');
  const worn = S.decodeIndices(player.equippedPets);
  check(worn.every((i) => i < 4), 'deleting keeps the worn indices valid');
  const bogus = pets.delete(player, 99, cash);
  check(!bogus.ok && bogus.reason === 'bad-index', 'an index out of range is refused');
  player.wins = 5 * S.MAX_PET_STORAGE;
  let stored = S.decodePets(player.pets).length;
  while (stored < S.MAX_PET_STORAGE) {
    advanceClock(2000);
    const r = pets.hatch(player, 'basic', 1, cash);
    if (!r.ok) break;
    stored = S.decodePets(player.pets).length;
  }
  advanceClock(2000);
  const overflow = pets.hatch(player, 'basic', 1, cash);
  check(stored === S.MAX_PET_STORAGE && !overflow.ok && overflow.reason === 'storage-full', `storage stops at ${S.MAX_PET_STORAGE}`);
}

console.log('  the wallet');
{
  player.wins = 10;
  check(!wallet.spend(player, 11) && player.wins === 10, 'a purchase the player cannot afford leaves the wallet alone');
  check(wallet.spend(player, 10) && player.wins === 0, 'an exact purchase empties it');
  check(wallet.add(player, -5) === 0 && player.wins === 0, 'a negative grant is ignored');
  check(wallet.add(player, Number.NaN) === 0 && player.wins === 0, 'a NaN grant is ignored');
  wallet.add(player, S.MAX_WINS);
  wallet.add(player, 10);
  check(player.wins <= S.MAX_WINS, 'Wins never pass the ceiling');
}

if (failures > 0) {
  console.error(`\n${failures} progression check(s) failed.`);
  process.exit(1);
}
console.log('\nprogression OK');
