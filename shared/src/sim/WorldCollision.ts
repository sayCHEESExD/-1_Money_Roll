import {
  COURSE,
  COURSE_END_Z,
  COURSE_SOLIDS,
  cellIdAt,
  corridorHalfWidthAt,
  lavaAt,
  stageAt,
  winPadAt,
  type CourseSolid,
  type StageDefinition,
} from '../config/course.js';
import { MOVEMENT } from '../config/movement.js';
import { isZoneUnlocked, trainingZoneFootprintAt } from '../config/training.js';
import { DEATH_PLANE_Y, PLAYER_HEIGHT, PLAYER_RADIUS } from '../constants/world.js';

/**
 * The gameplay shape of the world: what you can stand on, what stops you, and
 * what kills you.
 *
 * Lives in `shared` because BOTH sides collide against it - the server
 * re-simulates movement against this object and the client predicts against
 * an identical one. The renderer builds its meshes from the same
 * `COURSE_SOLIDS` array rather than from geometry of its own.
 *
 * Two things here are PER PLAYER and are set on the object before every step,
 * exactly as the clock is: the BRIDGE (the set of cells this player has built,
 * which is floor for them and nobody else) and the TRAINING UNLOCK mask (a
 * locked pad is a wall). `stepPlayer` sets both from its params, so a whole
 * step - and a whole replay - is evaluated against one consistent state.
 */

/** Z span of one spatial bucket, in world units. */
const BUCKET_SIZE = 24;

/** How far BELOW a surface the player may be and still land on it. Equals the step height. */
const LANDING_TOLERANCE = MOVEMENT.stepHeight;

/** Slack on the head test, so grazing an underside does not snag. */
const CEILING_TOLERANCE = 0.05;

/** What the player walked into this step. Every field is independent. */
export interface CourseTriggers {
  /** Stage whose win pad the player is standing on, or null. */
  winStage: StageDefinition | null;
  /** True if the player has fallen into the lava, or out of the world. */
  fell: boolean;
}

export class WorldCollision {
  /** Static solids indexed by Z bucket. A solid appears in every bucket it spans. */
  private readonly buckets = new Map<number, CourseSolid[]>();

  private readonly minBucket: number;
  private readonly maxBucket: number;

  /** The instant every query is evaluated at. Set once per simulation step. */
  private time = 0;

  /** The bridge of the player being simulated. Set once per step. */
  private bridge: ReadonlySet<number> | null = null;

  /** Which training zones the player being simulated may enter. */
  private trainingUnlocked = 0;

  constructor() {
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;

    for (const solid of COURSE_SOLIDS) {
      const from = bucketOf(solid.minZ);
      const to = bucketOf(solid.maxZ);
      lowest = Math.min(lowest, from);
      highest = Math.max(highest, to);
      for (let b = from; b <= to; b += 1) push(this.buckets, b, solid);
    }

    this.minBucket = Number.isFinite(lowest) ? lowest : 0;
    this.maxBucket = Number.isFinite(highest) ? highest : 0;
  }

  /** The instant to evaluate against. Called once per simulation step. */
  setTime(time: number): void {
    this.time = Number.isFinite(time) ? time : 0;
  }

  get now(): number {
    return this.time;
  }

  /** The bridge the current step walks on. Called once per simulation step. */
  setBridge(cells: ReadonlySet<number> | null): void {
    this.bridge = cells;
  }

  /** The training pads the current step may enter. Called once per simulation step. */
  setTrainingUnlocked(mask: number): void {
    this.trainingUnlocked = mask | 0;
  }

  /** Solids that could touch a body centred at this Z. Never allocates. */
  private near(z: number): readonly CourseSolid[] {
    const bucket = bucketOf(z);
    if (bucket < this.minBucket - 1 || bucket > this.maxBucket + 1) return EMPTY;

    SCRATCH.length = 0;
    for (let b = bucket - 1; b <= bucket + 1; b += 1) {
      const list = this.buckets.get(b);
      if (list) for (const solid of list) SCRATCH.push(solid);
    }
    return SCRATCH;
  }

  /**
   * Height of the walkable surface under the player, or null over a gap.
   *
   * Static solids, and then the player's OWN bridge: a built cell under any
   * part of the body's footprint is floor at `COURSE.bridgeTopY`. A cell built
   * by somebody else is not floor - every player crosses on their own money.
   */
  surfaceYAt(x: number, z: number, feetY: number): number | null {
    const ceiling = feetY + MOVEMENT.stepHeight;
    let best: number | null = null;
    for (const solid of this.near(z)) {
      if (x < solid.minX - PLAYER_RADIUS || x > solid.maxX + PLAYER_RADIUS) continue;
      if (z < solid.minZ - PLAYER_RADIUS || z > solid.maxZ + PLAYER_RADIUS) continue;
      if (solid.maxY > ceiling) continue;
      if (best === null || solid.maxY > best) best = solid.maxY;
    }

    if (this.bridge && this.bridge.size > 0 && COURSE.bridgeTopY <= ceiling) {
      if (best === null || COURSE.bridgeTopY > best) {
        if (this.bridgeUnder(x, z)) best = COURSE.bridgeTopY;
      }
    }
    return best;
  }

  /** True when a built cell lies under any part of the body's footprint. */
  bridgeUnder(x: number, z: number): boolean {
    const bridge = this.bridge;
    if (!bridge || bridge.size === 0) return false;
    const r = PLAYER_RADIUS * 0.9;
    for (const dx of [-r, 0, r]) {
      for (const dz of [-r, 0, r]) {
        const id = cellIdAt(x + dx, z + dz);
        if (id > 0 && bridge.has(id)) return true;
      }
    }
    return false;
  }

  /** Underside of the lowest solid the player is about to head-butt, or null. */
  ceilingYAt(x: number, z: number, previousHeadY: number): number | null {
    let best: number | null = null;
    for (const solid of this.near(z)) {
      if (x < solid.minX || x > solid.maxX) continue;
      if (z < solid.minZ || z > solid.maxZ) continue;
      if (previousHeadY > solid.minY + CEILING_TOLERANCE) continue;
      if (best === null || solid.minY < best) best = solid.minY;
    }
    return best;
  }

  /** True when the player may snap down onto `surfaceY` from `previousY`. */
  canLandOn(previousY: number, surfaceY: number): boolean {
    return previousY >= surfaceY - LANDING_TOLERANCE;
  }

  /**
   * Push the body out of anything it has walked into along ONE axis.
   *
   * Axis-separated resolution: the caller moves X, calls this with axis 0, then
   * moves Z and calls it with axis 2. Exact for an axis-aligned world.
   */
  resolveAxis(axis: 0 | 2, value: number, other: number, feetY: number): number {
    const headY = feetY + PLAYER_HEIGHT;
    const stepTop = feetY + MOVEMENT.stepHeight;
    let out = value;

    for (const solid of this.near(axis === 2 ? value : other)) {
      if (solid.maxY <= stepTop) continue;
      if (solid.minY >= headY) continue;

      const minA = axis === 0 ? solid.minX : solid.minZ;
      const maxA = axis === 0 ? solid.maxX : solid.maxZ;
      const minB = axis === 0 ? solid.minZ : solid.minX;
      const maxB = axis === 0 ? solid.maxZ : solid.maxX;

      if (other + PLAYER_RADIUS <= minB || other - PLAYER_RADIUS >= maxB) continue;
      if (out + PLAYER_RADIUS <= minA || out - PLAYER_RADIUS >= maxA) continue;

      const pushLow = minA - PLAYER_RADIUS;
      const pushHigh = maxA + PLAYER_RADIUS;
      out = out - pushLow < pushHigh - out ? pushLow : pushHigh;
    }

    return out;
  }

  /**
   * True when this horizontal position is inside a training pad the current
   * player has NOT unlocked. The simulation refuses a move that would enter
   * one, so a locked zone is a wall rather than a sign.
   */
  lockedZoneAt(x: number, z: number): boolean {
    const zone = trainingZoneFootprintAt(x, z);
    if (zone === 0) return false;
    return !isZoneUnlocked(this.trainingUnlocked, zone);
  }

  /**
   * Invisible boundary keeping the player inside the world. A CLAMP rather
   * than a wall collider, applied after the substep has integrated.
   */
  clampToBounds(x: number, z: number, out: { x: number; z: number }): void {
    const limit = corridorHalfWidthAt(z);
    out.x = x < -limit ? -limit : x > limit ? limit : x;
    out.z =
      z < COURSE.hubMinZ + 2
        ? COURSE.hubMinZ + 2
        : z > COURSE_END_Z - 1.5
          ? COURSE_END_Z - 1.5
          : z;
  }

  /** True when this X lies OUTSIDE the corridor at this Z. */
  outsideCorridorAt(x: number, z: number): boolean {
    return Math.abs(x) > corridorHalfWidthAt(z);
  }

  /** Sample every trigger volume at the player's current position. */
  sampleTriggers(x: number, y: number, z: number, time: number): CourseTriggers {
    this.setTime(time);
    return {
      winStage: winPadAt(x, y, z),
      fell: this.hasFallen(x, y, z),
    };
  }

  /**
   * True when the player has fallen out of the world: past the global death
   * plane, or into the lava. The lava is the shallower of the two on purpose -
   * being swallowed a couple of units under the bridge reads far better than
   * falling twenty units past it first.
   */
  hasFallen(x: number, y: number, z: number): boolean {
    if (y <= DEATH_PLANE_Y) return true;
    const lava = lavaAt(x, z);
    return lava !== null && y <= lava.deathY;
  }

  /** The stage containing a Z, or null. Re-exported so callers need one import. */
  stageAt(z: number): StageDefinition | null {
    return stageAt(z);
  }
}

/** Shared scratch list for `near`. Single-threaded, so sharing is safe. */
const SCRATCH: CourseSolid[] = [];
const EMPTY: readonly CourseSolid[] = [];

const push = <T>(map: Map<number, T[]>, key: number, value: T): void => {
  let list = map.get(key);
  if (!list) {
    list = [];
    map.set(key, list);
  }
  list.push(value);
};

const bucketOf = (z: number): number => Math.floor(z / BUCKET_SIZE);
