import { auraMultiplier } from './auras.js';
import { billForSlot } from './bills.js';
import { rebirthMultiplier } from './rebirth.js';
import { trainingMultiplier } from './training.js';

/**
 * CASH: the resource the whole game turns on.
 *
 * Cash is EARNED by walking through the Money Meadow and by standing in a
 * training zone. It piles up as the money ball in front of the player, and it
 * is SPENT - physically, note by note - building a bridge across the lava.
 * Every unit of cash a player earns also feeds the level curve, so level is
 * "cash earned since the last rebirth" read through a geometric table.
 *
 * Cash is granted by the SERVER, from movement and time it observed. The
 * client displays the replicated pile and predicts only what the bridge
 * spends of it, which the server confirms on every patch.
 *
 * THE RATE has exactly these terms and no others:
 *
 *   meadow:   distance walked x CASH.meadowCashPerUnit x bill.gain x boost
 *   training: seconds stood   x CASH.trainingCashPerSecond x zone.multiplier
 *                             x bill.gain x boost
 *   boost = rebirth multiplier x aura boost x (1 + pet boosts)
 *
 * `cashBoostFor` is the ONE place `boost` is computed.
 */
export interface CashConfig {
  /** Cash stacks picked up per world unit walked through the meadow, at +1. */
  readonly meadowCashPerUnit: number;
  /** Cash stacks a training zone pays per second, at x1 and +1. */
  readonly trainingCashPerSecond: number;
  /** Ground speed below which the player counts as NOT MOVING in the meadow. */
  readonly movingSpeed: number;
  /** Largest credited step, as a multiple of the honest maximum. A teleport pays nothing. */
  readonly creditSlack: number;
  /** Cash to go from level 0 to level 1. */
  readonly levelBase: number;
  /** Each level costs this much more than the one before. */
  readonly levelGrowth: number;
}

export const CASH: CashConfig = {
  meadowCashPerUnit: 0.5,
  trainingCashPerSecond: 4,
  movingSpeed: 1.5,
  creditSlack: 1.6,
  levelBase: 40,
  levelGrowth: 1.22,
};

/** Everything that decides how much a stack of cash is worth. */
export interface CashBoostInputs {
  readonly rebirths: number;
  readonly auraSlot: number;
  readonly ownedAuras: number;
  /** Sum of the equipped pets' boosts, as a fraction (0.25 = +25%). */
  readonly petBoost: number;
}

/** THE cash boost: rebirth x aura x pets. The one formula. */
export const cashBoostFor = (inputs: CashBoostInputs): number =>
  rebirthMultiplier(inputs.rebirths) *
  auraMultiplier(inputs.auraSlot, inputs.ownedAuras) *
  (1 + Math.max(0, Number.isFinite(inputs.petBoost) ? inputs.petBoost : 0));

/** Cash paid per world unit walked in the meadow, for a given bill and boost. */
export const meadowCashPerUnit = (billSlot: number, boost: number): number =>
  CASH.meadowCashPerUnit * billForSlot(billSlot).gain * boost;

/** Cash paid per second stood in a training zone. 0 for a zone the player has not unlocked. */
export const trainingCashPerSecond = (
  zone: number,
  rebirths: number,
  billSlot: number,
  boost: number,
): number => CASH.trainingCashPerSecond * trainingMultiplier(zone, rebirths) * billForSlot(billSlot).gain * boost;

/** A human-readable breakdown, for the server log. */
export const describeCashRate = (billSlot: number, inputs: CashBoostInputs): string => {
  const bill = billForSlot(billSlot);
  return (
    `+${bill.gain} x rebirth ${rebirthMultiplier(inputs.rebirths)} x aura ${auraMultiplier(inputs.auraSlot, inputs.ownedAuras)}` +
    ` x pets ${(1 + inputs.petBoost).toFixed(2)} = ${(bill.gain * cashBoostFor(inputs)).toFixed(2)} per stack`
  );
};

// ---------------------------------------------------------------- the curve

/**
 * Cash needed to advance FROM `level` to the next one. Level 0 -> 1 costs
 * `levelBase`; every level after costs `levelGrowth` times more. Rounded, so
 * the HUD's "into / required" and the cumulative table agree exactly.
 */
export const cashForNextLevel = (level: number): number => {
  const step = Math.max(0, Math.floor(level));
  return Math.round(CASH.levelBase * CASH.levelGrowth ** step);
};

/** Cumulative cash needed to have REACHED `level`. Level 0 costs nothing. */
export const totalCashToReach = (level: number): number => {
  const target = Math.max(0, Math.floor(level));
  let total = 0;
  for (let i = 0; i < target; i += 1) total += cashForNextLevel(i);
  return total;
};

/** Where a level-cash total sits on the level curve. */
export interface LevelProgress {
  /** Current level. Everyone starts at 0. */
  readonly level: number;
  /** Cash earned toward the next level. */
  readonly into: number;
  /** Cash needed for the next level. */
  readonly required: number;
  /** 0..1 fill for the level bar. */
  readonly fraction: number;
  /** True when the level cap has been reached and the bar is full. */
  readonly capped: boolean;
}

/**
 * Resolve a level-cash total into a level and a bar position, capped at
 * `levelCap` (the next rebirth's requirement).
 */
export const resolveLevel = (levelCash: number, levelCap: number): LevelProgress => {
  const cap = Math.max(1, Math.floor(levelCap));
  const total = Number.isFinite(levelCash) ? Math.max(0, levelCash) : 0;

  let level = 0;
  let spent = 0;
  while (level < cap) {
    const cost = cashForNextLevel(level);
    if (spent + cost > total) break;
    spent += cost;
    level += 1;
  }

  if (level >= cap) {
    const required = cashForNextLevel(cap - 1);
    return { level: cap, into: required, required, fraction: 1, capped: true };
  }
  const required = cashForNextLevel(level);
  const into = total - spent;
  return {
    level,
    into,
    required,
    fraction: required > 0 ? Math.min(Math.max(into / required, 0), 1) : 0,
    capped: false,
  };
};

/**
 * Compact display form: 940, 2.5K, 13.2K, 1M, 250M, 4B.
 *
 * Upper-case suffixes, one decimal at most and none when it is zero, as
 * specified. Lives in shared so the server can log the figures the player
 * sees.
 */
export const formatCash = (value: number): string => {
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
  const compact = (divisor: number, suffix: string): string => {
    const scaled = amount / divisor;
    const text = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, '');
    return `${text}${suffix}`;
  };
  if (amount >= 1_000_000_000_000) return compact(1_000_000_000_000, 'T');
  if (amount >= 1_000_000_000) return compact(1_000_000_000, 'B');
  if (amount >= 1_000_000) return compact(1_000_000, 'M');
  if (amount >= 1_000) return compact(1_000, 'K');
  return Math.floor(amount).toString();
};

/** Wins use the same abbreviations as cash. */
export const formatWins = formatCash;
