import {
  CASH,
  MAX_CASH,
  MAX_SIM_DELTA,
  bestOwnedBill,
  cashBoostFor,
  decodeIndices,
  decodePets,
  describeCashRate,
  inMeadow,
  maxLevelForRebirth,
  meadowCashPerUnit,
  petBoostOf,
  resolveLevel,
  resolveMovementProfile,
  trainingCashPerSecond,
  type CashBoostInputs,
  type MovementProfile,
} from '@money/shared';
import type { MovementService } from '../movement/MovementService.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { logger } from '../util/logger.js';

const SCOPE = 'cash';

/** What the server remembers between two simulated steps for one player. */
interface Tracker {
  /** True until the first step is credited, so spawning pays nothing. */
  fresh: boolean;
  /** The last rate logged, so the log shows changes and not every tick. */
  loggedRate: number;
}

export interface CashGain {
  readonly gained: number;
  readonly levelsGained: number;
}

/**
 * Server authority over EARNING cash and over the level curve.
 *
 * THE ONE PLACE CASH IS EVER EARNED, and it is earned for exactly two things:
 * ground covered in the Money Meadow, and seconds stood in a training zone.
 * The pickups on the lava route go through `grant`, which is the same door.
 * Spending belongs to the simulation (the bridge) and is not here.
 *
 * What the server measures is its OWN simulated step - the distance between
 * two authoritative positions and the zone the simulation derived - never a
 * figure a client chose. Standing still in the meadow pays nothing; a
 * teleport pays nothing; a locked zone pays nothing.
 */
export class CashService {
  private readonly trackers = new Map<string, Tracker>();

  initialise(player: PlayerState): void {
    this.syncDerived(player);
    this.reset(player.sessionId);
  }

  forget(sessionId: string): void {
    this.trackers.delete(sessionId);
  }

  /** Drop the movement baseline. Called on every respawn. */
  reset(sessionId: string): void {
    const existing = this.trackers.get(sessionId);
    this.trackers.set(sessionId, { fresh: true, loggedRate: existing?.loggedRate ?? -1 });
  }

  /**
   * Credit one simulated step and apply any level-ups.
   *
   * @param stepSeconds seconds the step covered
   * @param distance    horizontal distance the authoritative position moved
   * @param onGround    true when the step began and ended grounded
   */
  credit(
    sessionId: string,
    player: PlayerState,
    stepSeconds: number,
    distance: number,
    onGround: boolean,
    movement: MovementService,
  ): CashGain {
    const tracker = this.trackers.get(sessionId);
    if (!tracker) {
      this.reset(sessionId);
      return { gained: 0, levelsGained: 0 };
    }

    const step = Number.isFinite(stepSeconds) ? Math.max(0, Math.min(stepSeconds, MAX_SIM_DELTA)) : 0;
    const boost = cashBoostFor(this.boostInputs(player));

    const perStack = boost * (bestOwnedBill(player.ownedBills).gain);
    if (perStack !== tracker.loggedRate) {
      tracker.loggedRate = perStack;
      logger.info(SCOPE, `${sessionId} rate: ${describeCashRate(player.billSlot, this.boostInputs(player))}`);
    }

    let gained = 0;
    if (!tracker.fresh && step > 0) {
      // THE MEADOW: ground actually covered, on the ground, at a walking pace,
      // and inside the meadow. Anything past the honest maximum is a teleport.
      if (
        onGround &&
        inMeadow(player.x, player.z) &&
        distance >= CASH.movingSpeed * step &&
        distance <= this.maxCreditedStep(player, step)
      ) {
        gained += distance * meadowCashPerUnit(player.billSlot, boost);
        // Collecting in the meadow is what MAKES the money ball.
        movement.activateBall(sessionId, player);
      }
      // A TRAINING ZONE: paid by time. `trainingCashPerSecond` is 0 for a
      // zone the player's rebirth count does not unlock, whatever they stand on.
      if (player.trainingZone > 0) {
        gained += step * trainingCashPerSecond(player.trainingZone, player.rebirths, player.billSlot, boost);
      }
    }
    tracker.fresh = false;

    const beforeLevel = player.level;
    if (gained > 0) this.grant(sessionId, player, gained, movement);
    return { gained, levelsGained: player.level - beforeLevel };
  }

  /**
   * Hand a player cash: the money ball grows, the level curve advances, the
   * lifetime figure climbs. Every cash income in the game ends here.
   */
  grant(sessionId: string, player: PlayerState, amount: number, movement: MovementService): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    movement.addCash(sessionId, player, amount);
    player.levelCash = Math.min(MAX_CASH, player.levelCash + amount);
    player.lifetimeCash = Math.min(MAX_CASH, player.lifetimeCash + amount);
    this.syncDerived(player);
  }

  /**
   * Re-derive level and everything downstream from the current figures.
   *
   * Used on join, on reconnect and whenever an inventory changes: the level
   * from the level-cash total, the cap from the rebirth count, the pet boost
   * from the equipped pets, and the movement profile from the upgrades.
   */
  syncDerived(player: PlayerState): void {
    player.maxLevel = maxLevelForRebirth(player.rebirths);
    player.level = resolveLevel(player.levelCash, player.maxLevel).level;
    player.billSlot = bestOwnedBill(player.ownedBills).slot;
    player.petBoost = petBoostOf(decodePets(player.pets), decodeIndices(player.equippedPets));

    const profile = this.movementProfile(player);
    player.moveMultiplier = profile.multiplier;
    player.jumpVelocity = profile.jumpVelocity;
  }

  /** THE player's movement profile, through the one shared evaluator. */
  movementProfile(player: PlayerState): MovementProfile {
    return resolveMovementProfile(player.speedUpgrades);
  }

  boostInputs(player: PlayerState): CashBoostInputs {
    return {
      rebirths: player.rebirths,
      auraSlot: player.auraSlot,
      ownedAuras: player.ownedAuras,
      petBoost: player.petBoost,
    };
  }

  /** Largest movement the server will credit from one simulated step. */
  private maxCreditedStep(player: PlayerState, stepSeconds: number): number {
    const step = Number.isFinite(stepSeconds) ? Math.max(0, Math.min(stepSeconds, MAX_SIM_DELTA)) : MAX_SIM_DELTA;
    return this.movementProfile(player).moveSpeed * step * CASH.creditSlack + 0.5;
  }
}
