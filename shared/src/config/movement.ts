/**
 * Movement tuning for a WALKING CHARACTER pushing a ball of money.
 *
 * The client predicts with these numbers and the server simulates with them,
 * so they must not diverge - which is why there is one copy, here.
 *
 * ONE ground gait and ONE airborne mechanic: a walk, and a jump on a fresh
 * press from the ground. There is no sprint. The only thing that changes the
 * walking speed is the Walkspeed upgrade in the Upgrades menu.
 */
export interface MovementConfig {
  /** Base walking speed in world units per second: Roblox's own 16. */
  readonly moveSpeed: number;
  /** Ground acceleration, world units per second squared. */
  readonly acceleration: number;
  /** Ground deceleration when the stick is released. */
  readonly deceleration: number;
  /** Fraction of ground acceleration retained while airborne (0..1). */
  readonly airControl: number;
  /** Downward acceleration, world units per second squared. */
  readonly gravity: number;
  /** Upward velocity applied by a jump, world units per second. */
  readonly jumpVelocity: number;
  /** Turn rate toward the movement direction, radians per second. */
  readonly turnSpeed: number;
  /** Largest distance the simulation will integrate in one substep. */
  readonly maxSubstepDistance: number;
  /** Most substeps one step may take, so a pathological speed cannot hang. */
  readonly maxSubsteps: number;
  /**
   * Height the character steps up without jumping. Every pad and deck lip in
   * the spawn area is below this. Must stay equal to `LANDING_TOLERANCE`.
   */
  readonly stepHeight: number;
}

export const MOVEMENT: MovementConfig = {
  moveSpeed: 16,
  acceleration: 96,
  deceleration: 80,
  airControl: 0.55,
  gravity: 62,
  // A short, punchy hop: 0.71 s of air, 3.9 units of rise, 11 units of reach
  // at the base speed. The lava is 48 units across, so no leap crosses it.
  jumpVelocity: 22,
  turnSpeed: 11,
  maxSubstepDistance: 0.6,
  maxSubsteps: 48,
  stepHeight: 1.0,
};

/** World units of speed each Walkspeed upgrade adds. "+2 Speed", as specified. */
export const SPEED_PER_WALKSPEED_UPGRADE = 2;

/** How the Walkspeed upgrades combine into ONE movement profile. */
export interface MovementProfile {
  /** Multiplier on `moveSpeed`. */
  readonly multiplier: number;
  /** Resolved walking speed in world units per second. */
  readonly moveSpeed: number;
  /** Resolved jump velocity. */
  readonly jumpVelocity: number;
}

/**
 * Resolve the profile a player actually moves at.
 *
 * THE single evaluator. Only the Walkspeed upgrade count feeds it: rebirths,
 * level, auras and pets multiply CASH and never movement, as specified. The
 * jump does not grow with speed, so a faster player hops further but never
 * higher - and never over the lava.
 *
 * @param speedUpgrades how many Walkspeed upgrades the player has bought
 */
export const resolveMovementProfile = (speedUpgrades: number): MovementProfile => {
  const bought = Math.max(0, Math.floor(Number.isFinite(speedUpgrades) ? speedUpgrades : 0));
  const moveSpeed = MOVEMENT.moveSpeed + bought * SPEED_PER_WALKSPEED_UPGRADE;
  return {
    multiplier: moveSpeed / MOVEMENT.moveSpeed,
    moveSpeed,
    jumpVelocity: MOVEMENT.jumpVelocity,
  };
};
