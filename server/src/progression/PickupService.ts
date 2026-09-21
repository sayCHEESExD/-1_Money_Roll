import { COURSE, STAGES, stageByIndex } from '@money/shared';
import type { PickupState } from '../rooms/state/CourseState.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';

/**
 * How the popups are timed. DELIBERATELY IRREGULAR: the gap to the next
 * burst is drawn from an exponential distribution, so there are lulls with
 * nothing for a while and moments when three land at once. Nothing here is
 * a fixed timer or a fixed pattern.
 */
const SPAWN = {
  /** Mean seconds between bursts. */
  meanGap: 11,
  /** Shortest and longest gap that can be drawn. */
  minGap: 2.5,
  maxGap: 40,
  /** Chance a burst is 1, 2 or 3 pickups. */
  burstOdds: [0.58, 0.3, 0.12] as const,
  /** Seconds a pickup floats before it fades away. */
  lifetime: 32,
  /** Radius within which a player collects one. */
  reach: 2.6,
} as const;

/** The three figures a stage-one pickup can pay, scaled by the stage's crossing cost. */
const AMOUNTS = [100, 150, 300] as const;

/**
 * Server authority over the CASH PICKUPS on the lava route.
 *
 * Spawned on a random schedule, on the stretches of lava players can actually
 * reach, and collected against the positions the server itself simulated.
 * They are emergency, risk-reward money: worth a fraction of a crossing, in
 * the middle of the lava, so a player has to build toward them.
 */
export class PickupService {
  private nextSpawnAt = 0;

  constructor(private readonly random: () => number = Math.random) {}

  reset(pickups: readonly PickupState[], elapsed: number): void {
    for (const pickup of pickups) pickup.active = false;
    this.nextSpawnAt = elapsed + this.gap() * 0.5;
  }

  /** Expire the old, spawn the new. */
  update(pickups: readonly PickupState[], elapsed: number, players: Iterable<PlayerState>): void {
    for (const pickup of pickups) {
      if (pickup.active && elapsed - pickup.bornAt > SPAWN.lifetime) pickup.active = false;
    }

    if (elapsed < this.nextSpawnAt) return;
    this.nextSpawnAt = elapsed + this.gap();

    // Only where somebody could plausibly go: up to one stage past the best
    // anybody in the room has banked.
    let furthest = 1;
    for (const player of players) furthest = Math.max(furthest, Math.min(STAGES.length, player.bestStage + 1));

    const count = this.burstSize();
    for (let i = 0; i < count; i += 1) {
      const free = pickups.find((pickup) => !pickup.active);
      if (!free) return;
      const stage = stageByIndex(1 + Math.floor(this.random() * furthest));
      if (!stage) return;
      const scale = stage.crossCost / (STAGES[0]?.crossCost ?? 500);
      const base = AMOUNTS[Math.floor(this.random() * AMOUNTS.length)] ?? 100;
      free.active = true;
      free.stage = stage.index;
      free.amount = Math.round(base * scale);
      // Inside the river, clear of both banks and both walls.
      free.x = (this.random() * 2 - 1) * (COURSE.halfWidth - 5);
      free.z = stage.lavaStartZ + 6 + this.random() * (COURSE.lavaLength - 12);
      free.bornAt = elapsed;
    }
  }

  /** The cash a player standing on a pickup collects, deactivating it. 0 for none. */
  collect(pickups: readonly PickupState[], player: PlayerState): number {
    if (player.y < COURSE.bridgeTopY - 1.5 || player.y > COURSE.bridgeTopY + 4.5) return 0;
    for (const pickup of pickups) {
      if (!pickup.active) continue;
      if (Math.abs(pickup.x - player.x) > SPAWN.reach || Math.abs(pickup.z - player.z) > SPAWN.reach) continue;
      pickup.active = false;
      return pickup.amount;
    }
    return 0;
  }

  private gap(): number {
    const u = Math.max(1e-6, 1 - this.random());
    return Math.min(SPAWN.maxGap, Math.max(SPAWN.minGap, -Math.log(u) * SPAWN.meanGap));
  }

  private burstSize(): number {
    const roll = this.random();
    let acc = 0;
    for (let i = 0; i < SPAWN.burstOdds.length; i += 1) {
      acc += SPAWN.burstOdds[i] ?? 0;
      if (roll < acc) return i + 1;
    }
    return SPAWN.burstOdds.length;
  }
}
