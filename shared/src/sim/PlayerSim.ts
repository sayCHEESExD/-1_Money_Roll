import { cellCost, cellIdAt, cellStage, lavaStageAt } from '../config/course.js';
import { MOVEMENT } from '../config/movement.js';
import { trainingZoneAt } from '../config/training.js';
import { PLAYER_HEIGHT, SPAWN_POSITION, SPAWN_ROTATION_Y } from '../constants/world.js';
import { rotateTowards } from '../types/math.js';
import type { WorldCollision } from './WorldCollision.js';

/**
 * The authoritative physics step, shared by the server and by client
 * prediction.
 *
 * This is THE movement simulation. The server runs it to own the result and
 * the client runs the identical function to predict ahead of the network, so
 * the two can only ever disagree through inputs, never through different
 * maths. Do not reimplement any part of it anywhere else.
 *
 * THE MONEY BRIDGE LIVES HERE. Crossing the lava changes where the player
 * goes AND what they carry, so the bridge is part of the shared step: every
 * substep that puts the player over an unbuilt cell of lava buys that cell
 * out of the cash they carry, and the cell is floor from then on. The server
 * owns the cash and the cells; the client predicts both with the same numbers
 * and is corrected on every patch.
 *
 * Deliberately framework-free and allocation-free.
 */

/** Everything that makes up a player's physical state. */
export interface PlayerMotion {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  /** Edge-detect for the jump control, so a hold is one leap, not sixty. */
  jumpLatched: boolean;
  /** Monotonic count of jumps, replicated so remotes can mirror them. */
  jumpCount: number;
  /** Training zone the player is standing in, or 0. Derived from position. */
  trainingZone: number;
  /** Seconds of coyote time left. */
  coyote: number;
  /**
   * The stage whose lava the player is currently crossing, or 0.
   *
   * Set when the player is over lava and cleared when they reach either bank.
   * Reaching the FAR bank is the crossing that completes the stage, and it is
   * this field that lets the step tell the far bank from a retreat.
   */
  crossing: number;
}

/**
 * The player's MONEY, as the simulation sees it: what they carry, and what
 * they have already laid across the lava. Held apart from `PlayerMotion`
 * because the server writes the cash (the meadow, the zones, the pickups) and
 * the step only ever SPENDS it.
 */
export interface BridgeState {
  /**
   * THE PERMANENT BILLS. Owned by the server's cash service (the client
   * mirrors the replicated figure). The simulation only ever READS it: it is
   * what a crossing is allowed to draw on, never what a crossing spends.
   */
  wallet: number;
  /**
   * THE CROSSING SUPPLY: a temporary copy of the wallet taken the moment the
   * player steps onto lava, spent note by note on the way over, and gone once
   * they reach a bank or die. Spending it never touches `wallet`, so a death
   * on the lava costs the run and nothing else.
   */
  cash: number;
  /** Cell ids this player has built. Their floor over the lava. */
  cells: Set<number>;
}

/** One frame of player intent. Carries no position - only what was pressed. */
export interface MovementInput {
  moveX: number;
  moveZ: number;
  jump: boolean;
  cameraYaw: number;
}

/** Server-owned tuning the step reads but never changes (except the bridge, which it spends). */
export interface SimParams {
  /** Authoritative movement multiplier from the Walkspeed upgrades. */
  moveMultiplier: number;
  /** Authoritative jump velocity. */
  jumpVelocity: number;
  /** The world clock, in seconds. */
  time: number;
  /** Which training zones this player may enter. See `trainingUnlockMask`. */
  trainingUnlocked: number;
  /** The cash and the bridge. Spent by the step. */
  bridge: BridgeState;
}

/** Edges this step produced, consumed by the animator and the effects. */
export interface SimEvents {
  jumpStarted: boolean;
  landed: boolean;
  /** Cells laid this step. */
  built: number;
  /** Cash spent this step. */
  spent: number;
  /** The stage whose far bank was reached this step, or 0. */
  crossed: number;
  /** True while the player is over lava with nothing to build with. */
  starved: boolean;
}

/** Largest single step the simulation will take, in seconds. */
export const MAX_SIM_DELTA = 0.1;

/** Seconds after leaving the ground during which a jump still counts. */
const COYOTE_TIME = 0.11;

/**
 * How hard a player over UNBUILT lava is pulled down and stopped.
 *
 * The rule "jumping never bypasses lava" is enforced here rather than by the
 * jump's height: a player who is over lava with no cell under them - because
 * they could not pay for it - loses their horizontal speed and drops, however
 * fast they were walking and however far their hop would otherwise carry. A
 * player WITH cash builds the cell under them mid-air and lands on it.
 */
const STARVED_DRAG = 14;
const STARVED_GRAVITY = 40;

export const createMotion = (): PlayerMotion => ({
  x: SPAWN_POSITION.x,
  y: SPAWN_POSITION.y,
  z: SPAWN_POSITION.z,
  vx: 0,
  vy: 0,
  vz: 0,
  yaw: SPAWN_ROTATION_Y,
  grounded: true,
  jumpLatched: false,
  jumpCount: 0,
  trainingZone: 0,
  coyote: 0,
  crossing: 0,
});

export const createBridgeState = (): BridgeState => ({ wallet: 0, cash: 0, cells: new Set() });

export const createSimEvents = (): SimEvents => ({
  jumpStarted: false,
  landed: false,
  built: 0,
  spent: 0,
  crossed: 0,
  starved: false,
});

export const createMovementInput = (): MovementInput => ({
  moveX: 0,
  moveZ: 0,
  jump: false,
  cameraYaw: 0,
});

/** Copy motion state, e.g. when snapping prediction to the server. */
export const copyMotion = (from: PlayerMotion, to: PlayerMotion): void => {
  to.x = from.x;
  to.y = from.y;
  to.z = from.z;
  to.vx = from.vx;
  to.vy = from.vy;
  to.vz = from.vz;
  to.yaw = from.yaw;
  to.grounded = from.grounded;
  to.jumpLatched = from.jumpLatched;
  to.jumpCount = from.jumpCount;
  to.trainingZone = from.trainingZone;
  to.coyote = from.coyote;
  to.crossing = from.crossing;
};

/** Reset to a spawn transform. Used by both sides on respawn. */
export const resetMotion = (
  motion: PlayerMotion,
  x = SPAWN_POSITION.x,
  y = SPAWN_POSITION.y,
  z = SPAWN_POSITION.z,
  yaw = SPAWN_ROTATION_Y,
): void => {
  motion.x = x;
  motion.y = y;
  motion.z = z;
  motion.vx = 0;
  motion.vy = 0;
  motion.vz = 0;
  motion.yaw = yaw;
  motion.grounded = true;
  motion.jumpLatched = false;
  motion.trainingZone = 0;
  motion.coyote = 0;
  motion.crossing = 0;
};

export const horizontalSpeed = (motion: PlayerMotion): number =>
  Math.hypot(motion.vx, motion.vz);

/** Sanitise one input before it is simulated. Applied on the SERVER. */
export const sanitiseInput = (input: Partial<MovementInput> | undefined): MovementInput => {
  const finite = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;

  let moveX = finite(input?.moveX);
  let moveZ = finite(input?.moveZ);
  const magnitude = Math.hypot(moveX, moveZ);
  if (magnitude > 1) {
    moveX /= magnitude;
    moveZ /= magnitude;
  }

  return {
    moveX,
    moveZ,
    jump: input?.jump === true,
    cameraYaw: finite(input?.cameraYaw),
  };
};

/** Scratch for the boundary clamp. Single-threaded, so sharing is safe. */
const BOUNDS = { x: 0, z: 0 };

/**
 * Advance one player by one step.
 *
 * @param motion    mutated in place
 * @param input     already sanitised intent
 * @param params    server-owned tuning; its bridge is SPENT
 * @param delta     seconds; clamped internally to [0, MAX_SIM_DELTA]
 * @param collision the course the player moves through
 * @param events    mutated in place with the edges this step produced
 */
export const stepPlayer = (
  motion: PlayerMotion,
  input: MovementInput,
  params: SimParams,
  delta: number,
  collision: WorldCollision,
  events: SimEvents,
): void => {
  events.jumpStarted = false;
  events.landed = false;
  events.built = 0;
  events.spent = 0;
  events.crossed = 0;
  events.starved = false;

  const dt = Number.isFinite(delta) ? Math.min(Math.max(delta, 0), MAX_SIM_DELTA) : 0;
  if (dt === 0) return;

  // ONE instant, ONE bridge and ONE unlock mask for the whole step, every
  // substep and every replayed step included.
  collision.setTime(params.time);
  collision.setBridge(params.bridge.cells);
  collision.setTrainingUnlocked(params.trainingUnlocked);

  const wasGrounded = motion.grounded;
  const fromZ = motion.z;

  applyJump(motion, input, params, events);
  applyHorizontal(motion, input, params, dt);
  motion.vy -= MOVEMENT.gravity * dt;

  // SUBSTEPPING: subdivided until no substep travels further than
  // `maxSubstepDistance`, so collision is as reliable at any Walkspeed.
  const travel = Math.hypot(motion.vx, motion.vy, motion.vz) * dt;
  const substeps = Math.max(
    1,
    Math.min(Math.ceil(travel / MOVEMENT.maxSubstepDistance), MOVEMENT.maxSubsteps),
  );
  const sub = dt / substeps;

  for (let i = 0; i < substeps; i += 1) {
    integrate(motion, params, sub, collision, events);
  }

  if (motion.grounded) motion.coyote = COYOTE_TIME;
  else motion.coyote = Math.max(0, motion.coyote - dt);

  resolveCrossing(motion, params, fromZ, events);

  motion.trainingZone = motion.grounded ? trainingZoneAt(motion.x, motion.y, motion.z) : 0;

  if (!wasGrounded && motion.grounded) events.landed = true;
};

/**
 * One substep: move, then resolve, one axis at a time - and BUILD.
 *
 * A locked training pad refuses the move that would enter it. A cell of lava
 * under the settled horizontal position is bought before the ground test,
 * so a player who walked onto it this substep is standing on it this substep.
 */
const integrate = (
  motion: PlayerMotion,
  params: SimParams,
  dt: number,
  collision: WorldCollision,
  events: SimEvents,
): void => {
  const previousY = motion.y;
  const fromX = motion.x;
  const fromZ = motion.z;

  motion.x += motion.vx * dt;
  const correctedX = collision.resolveAxis(0, motion.x, motion.z, motion.y);
  if (correctedX !== motion.x) {
    motion.x = correctedX;
    motion.vx = 0;
  }
  if (collision.lockedZoneAt(motion.x, fromZ) && !collision.lockedZoneAt(fromX, fromZ)) {
    motion.x = fromX;
    motion.vx = 0;
  }

  motion.z += motion.vz * dt;
  const correctedZ = collision.resolveAxis(2, motion.z, motion.x, motion.y);
  if (correctedZ !== motion.z) {
    motion.z = correctedZ;
    motion.vz = 0;
  }
  if (collision.lockedZoneAt(motion.x, motion.z) && !collision.lockedZoneAt(motion.x, fromZ)) {
    motion.z = fromZ;
    motion.vz = 0;
  }

  // The corridor narrowing is a WALL: a move that would carry the body from
  // inside the corridor to outside it is refused rather than clamped.
  if (!collision.outsideCorridorAt(motion.x, fromZ) && collision.outsideCorridorAt(motion.x, motion.z)) {
    motion.z = fromZ;
    motion.vz = 0;
  }

  motion.y += motion.vy * dt;

  collision.clampToBounds(motion.x, motion.z, BOUNDS);
  motion.x = BOUNDS.x;
  motion.z = BOUNDS.z;

  buildUnder(motion, params, dt, events);

  resolveCeiling(motion, previousY, collision);
  resolveGround(motion, previousY, collision);
};

/**
 * THE MONEY BRIDGE: buy the cell of lava under the player, if there is one
 * and they can pay for it.
 *
 * Only the cell under the body's CENTRE is bought, so a player walking
 * straight lays one lane of notes and pays exactly the stage's crossing cost;
 * one who wanders sideways pays for every cell they wander onto. A cell is
 * bought whether the player is on the ground or in the air over it - which is
 * what makes a hop across the lava cost exactly what a walk does.
 *
 * With no cash for the cell the player is STARVED: dragged to a stop and
 * pulled down, so the lava is reached and not the far bank.
 *
 * The first cell of lava a player reaches from a bank STARTS A CROSSING: the
 * supply is loaded from the permanent wallet then, and it is the supply that
 * every cell is bought from. The wallet is never debited here.
 */
const buildUnder = (motion: PlayerMotion, params: SimParams, dt: number, events: SimEvents): void => {
  const id = cellIdAt(motion.x, motion.z);
  if (id <= 0) return;
  // Already fallen past the bridge: nothing to build on the way down.
  if (motion.y < -0.9) return;

  const bridge = params.bridge;
  if (motion.crossing === 0) {
    motion.crossing = cellStage(id);
    bridge.cash = bridge.wallet;
  }
  if (!bridge.cells.has(id)) {
    const price = cellCost(cellStage(id));
    if (bridge.cash >= price) {
      bridge.cash -= price;
      bridge.cells.add(id);
      events.built += 1;
      events.spent += price;
    }
  }

  if (!bridge.cells.has(id)) {
    events.starved = true;
    const drag = Math.exp(-STARVED_DRAG * dt);
    motion.vx *= drag;
    motion.vz *= drag;
    motion.vy -= STARVED_GRAVITY * dt;
    motion.grounded = false;
  }
};

/**
 * Which lava the player is over, and whether they just reached the far bank.
 *
 * `crossing` is set on the way over and cleared on either bank, and the
 * crossing supply goes with it: on a bank the ball is the wallet again.
 * Reaching the far bank - a Z at or past the lava's end - is the crossing
 * that completes a stage: the bridge is CONSUMED (its cells are dropped) and
 * `events.crossed` reports the stage. Retreating to the near bank keeps the
 * notes laid, so a player who turns back does not pay twice for the same
 * ground.
 */
const resolveCrossing = (motion: PlayerMotion, params: SimParams, fromZ: number, events: SimEvents): void => {
  const over = lavaStageAt(motion.z);
  if (over) {
    motion.crossing = over.index;
    return;
  }
  if (motion.crossing === 0) return;

  const stage = motion.crossing;
  motion.crossing = 0;
  params.bridge.cash = 0;
  const wasOver = lavaStageAt(fromZ);
  if (wasOver && wasOver.index === stage && motion.z >= wasOver.lavaEndZ) {
    events.crossed = stage;
    for (const id of params.bridge.cells) {
      if (cellStage(id) === stage) params.bridge.cells.delete(id);
    }
  }
};

/** The jump: ONE impulse on the frame the key goes down, from the ground or coyote. */
const applyJump = (
  motion: PlayerMotion,
  input: MovementInput,
  params: SimParams,
  events: SimEvents,
): void => {
  const pressed = input.jump && !motion.jumpLatched;
  motion.jumpLatched = input.jump;
  if (!pressed) return;
  if (!motion.grounded && motion.coyote <= 0) return;

  motion.vy = Math.max(motion.vy, params.jumpVelocity);
  motion.grounded = false;
  motion.coyote = 0;
  motion.jumpCount += 1;
  events.jumpStarted = true;
};

const applyHorizontal = (
  motion: PlayerMotion,
  input: MovementInput,
  params: SimParams,
  dt: number,
): void => {
  const hasInput = input.moveX !== 0 || input.moveZ !== 0;

  // Rotate the raw stick into world space using the camera's yaw. The camera
  // looks along (sin, cos); its RIGHT is (-cos, sin).
  const sin = Math.sin(input.cameraYaw);
  const cos = Math.cos(input.cameraYaw);
  const dirX = input.moveZ * sin - input.moveX * cos;
  const dirZ = input.moveZ * cos + input.moveX * sin;

  const targetSpeed = MOVEMENT.moveSpeed * params.moveMultiplier;
  const control = motion.grounded ? 1 : MOVEMENT.airControl;

  if (hasInput) {
    const accel = MOVEMENT.acceleration * params.moveMultiplier * control * dt;
    const rate = Math.min(accel / targetSpeed, 1);
    motion.vx += (dirX * targetSpeed - motion.vx) * rate;
    motion.vz += (dirZ * targetSpeed - motion.vz) * rate;

    const desiredYaw = Math.atan2(dirX, dirZ);
    motion.yaw = rotateTowards(motion.yaw, desiredYaw, MOVEMENT.turnSpeed * dt);
  } else if (motion.grounded) {
    const drop = MOVEMENT.deceleration * params.moveMultiplier * dt;
    const speed = horizontalSpeed(motion);
    if (speed <= drop || speed < 1e-6) {
      motion.vx = 0;
      motion.vz = 0;
    } else {
      const scale = (speed - drop) / speed;
      motion.vx *= scale;
      motion.vz *= scale;
    }
  }
};

const resolveCeiling = (
  motion: PlayerMotion,
  previousY: number,
  collision: WorldCollision,
): void => {
  if (motion.vy <= 0) return;

  const ceiling = collision.ceilingYAt(motion.x, motion.z, previousY + PLAYER_HEIGHT);
  if (ceiling === null) return;
  if (motion.y + PLAYER_HEIGHT <= ceiling) return;

  motion.y = ceiling - PLAYER_HEIGHT;
  motion.vy = 0;
};

const resolveGround = (
  motion: PlayerMotion,
  previousY: number,
  collision: WorldCollision,
): void => {
  const surfaceY = collision.surfaceYAt(motion.x, motion.z, previousY);

  if (surfaceY === null || motion.vy > 0 || motion.y > surfaceY) {
    motion.grounded = false;
    return;
  }

  if (!collision.canLandOn(previousY, surfaceY)) {
    motion.grounded = false;
    return;
  }

  motion.y = surfaceY;
  motion.vy = 0;
  motion.grounded = true;
};
