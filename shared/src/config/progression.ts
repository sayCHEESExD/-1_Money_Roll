import { rebirthMultiplier } from './rebirth.js';

/**
 * Progression tuning. Cash, level, Wins, rebirths, bills, auras, pets and
 * upgrades are all SERVER-AUTHORITATIVE; the client may predict for UI feel
 * but never decides any of them.
 */

/**
 * The largest Wins total that can be held. Wins are a `float64` on the wire;
 * this is the largest integer that is still exact, and every path that adds
 * Wins saturates at it.
 */
export const MAX_WINS = Number.MAX_SAFE_INTEGER;

/** The same ceiling for the cash pile and the level curve. */
export const MAX_CASH = Number.MAX_SAFE_INTEGER;

export { rebirthMultiplier };
