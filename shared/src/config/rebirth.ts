/**
 * Rebirth: the prestige ladder, EXACTLY as specified.
 *
 *   Rebirth 1 at level 25 -> x1.5 cash, max level 50
 *   Rebirth 2 at level 50 -> x2   cash, max level 75
 *   Rebirth 3 at level 75 -> x2.5 cash, max level 100
 *   ... every 25 levels, +0.5x each, for ever.
 *
 * A rebirth resets LEVELS and CASH (the level curve and the money ball) and
 * leaves everything else alone: Wins, bills, auras, pets and upgrades are
 * permanent.
 *
 * The cash multiplier is `1 + rebirths * 0.5` and nothing else feeds it.
 */

/** Levels between one rebirth and the next. The whole ladder is this step. */
export const LEVELS_PER_REBIRTH = 25;

/** Cash multiplier added per rebirth. */
export const MULTIPLIER_PER_REBIRTH = 0.5;

/** The largest rebirth count that can be replicated (a uint32 field). */
export const MAX_REPLICATED_REBIRTHS = 4294967295;

/** Level the NEXT rebirth needs, given how many have been performed. */
export const rebirthRequiredLevel = (count: number): number =>
  LEVELS_PER_REBIRTH * (Math.max(0, Math.floor(count)) + 1);

/**
 * Highest level reachable at this rebirth count. It is exactly the level the
 * next rebirth needs, so reaching the cap and unlocking the rebirth are the
 * same moment: the cap is a gate, never a dead end.
 */
export const maxLevelForRebirth = (count: number): number => rebirthRequiredLevel(count);

/** Cash multiplier granted by `count` completed rebirths: 1 + count * 0.5. */
export const rebirthMultiplier = (count: number): number =>
  1 + Math.max(0, Math.floor(count)) * MULTIPLIER_PER_REBIRTH;

/** A player may rebirth once they have reached their current max level. */
export const canRebirth = (level: number, count: number): boolean =>
  Math.floor(level) >= rebirthRequiredLevel(count);
