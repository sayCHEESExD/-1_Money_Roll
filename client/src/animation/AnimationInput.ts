/**
 * The gameplay signals the animator consumes each frame. It reads these and
 * never writes back: it cannot move the player or decide an outcome.
 *
 * The local player fills it from its own prediction and every remote player
 * from replicated state, so both run the exact same animation code.
 */
export interface AnimationInput {
  grounded: boolean;
  /** Horizontal speed in world units per second. */
  horizontalSpeed: number;
  /** The player's authoritative movement multiplier, so gaits scale with it. */
  moveMultiplier: number;
  verticalVelocity: number;
  /** -1..1 steering, for the bank. */
  turn: number;
  /** True on the frame the jump starts. */
  jumpStarted: boolean;
  landed: boolean;
  /** True while the death animation should play. */
  dying: boolean;
  /**
   * How much of a ball is in front of the player, 0..1.
   *
   * 0 is empty-handed and the arms swing; 1 is a ball as big as they get and
   * the arms reach up onto it. The size of the money ball, in other words.
   */
  push: number;
}

export const createAnimationInput = (): AnimationInput => ({
  grounded: true,
  horizontalSpeed: 0,
  moveMultiplier: 1,
  verticalVelocity: 0,
  turn: 0,
  jumpStarted: false,
  landed: false,
  dying: false,
  push: 0,
});
