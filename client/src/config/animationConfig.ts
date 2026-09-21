import { DEATH_HOLD_SECONDS } from '@money/shared';
import type { PoseDefinition } from '../animation/PoseBuffer.js';

const deg = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Procedural animation tuning.
 *
 * THREE ANIMATIONS, as specified: the WALK (pushing the ball when there is
 * one), the JUMP, and the idle in between. Plus the short fall-over for a
 * death. Every number lives here; all rotations are in CHARACTER space.
 */

/** The walk cycle. ONE cycle, deepening into a run with speed. */
export const LOCOMOTION = {
  minFrequency: 0.7,
  maxFrequency: 3.2,
  /** World units between two footfalls. */
  strideDistance: 5.0,
  /** Below this speed the character is standing still. */
  idleSpeed: 0.6,
  /** Speed at which the WALK pose is fully in, before the multiplier. */
  walkSpeed: 4,
  /** Speed at which the RUN pose is fully in, before the multiplier. */
  runSpeed: 18,

  hipSwing: { walk: deg(24), run: deg(42) },
  kneeBend: { walk: deg(30), run: deg(58) },
  armSwing: { walk: deg(20), run: deg(40) },
  elbowBend: { walk: deg(14), run: deg(44) },
  torsoTwist: { walk: deg(4), run: deg(7) },
  torsoLean: { walk: deg(3), run: deg(11) },
  headCounterTwist: { walk: deg(2), run: deg(4) },
  torsoRoll: { walk: deg(2), run: deg(3) },
  /** Vertical bob, in world units, twice per cycle. */
  bob: { walk: 0.05, run: 0.11 },
  /** How far the whole body banks into a turn. */
  bankAngle: deg(9),
  bankRate: 8,
} as const;

/**
 * THE PUSH: what the arms do when there is a ball in front of the player.
 *
 * Blended in by how much cash is carried. The arms reach forward onto the
 * ball rather than swinging, and they lift as the ball grows - a small ball
 * is pushed at the hip, a huge one at the shoulder. The legs keep cycling.
 */
export const PUSH = {
  /** Arm pitch at the smallest ball and at the largest. Negative is forward. */
  armLow: deg(-48),
  armHigh: deg(-98),
  /** Elbows bend a little so the hands sit on the curve. */
  elbow: deg(18),
  /** Hands spread slightly onto the ball. */
  armSpread: deg(10),
  /** The body leans into the push, more at speed. */
  lean: deg(9),
  /** How fast the push pose blends in and out, per second. */
  blendRate: 7,
} as const;

/** The idle: breathing, and nothing else. */
export const IDLE = {
  breathFrequency: 0.35,
  breathAmount: deg(1.8),
  breathBob: 0.012,
  basePose: {
    ArmL1: { x: deg(4), z: deg(6) },
    ArmR1: { x: deg(4), z: deg(-6) },
    ArmL2: { x: deg(10) },
    ArmR2: { x: deg(10) },
  } satisfies PoseDefinition,
} as const;

/** The push-off: a brief crouch and arm throw as the feet leave the ground. */
export const JUMP_START = {
  duration: 0.1,
  pose: {
    LegL1: { x: deg(-30) },
    LegR1: { x: deg(-30) },
    LegL2: { x: deg(46) },
    LegR2: { x: deg(46) },
    ArmL1: { x: deg(-70), z: deg(14) },
    ArmR1: { x: deg(-70), z: deg(-14) },
    Spine1: { x: deg(8) },
  } satisfies PoseDefinition,
  bobY: -0.18,
} as const;

/** In the air: a rising pose and a falling pose, blended by vertical velocity. */
export const AIRBORNE = {
  velocityReference: 14,
  rise: {
    LegL1: { x: deg(-42) },
    LegR1: { x: deg(12) },
    LegL2: { x: deg(66) },
    LegR2: { x: deg(24) },
    ArmL1: { x: deg(-120), z: deg(22) },
    ArmR1: { x: deg(-120), z: deg(-22) },
    ArmL2: { x: deg(20) },
    ArmR2: { x: deg(20) },
    Spine1: { x: deg(-6) },
    Neck1: { x: deg(-8) },
  } satisfies PoseDefinition,
  fall: {
    LegL1: { x: deg(14) },
    LegR1: { x: deg(-8) },
    LegL2: { x: deg(30) },
    LegR2: { x: deg(20) },
    ArmL1: { x: deg(-40), z: deg(48) },
    ArmR1: { x: deg(-40), z: deg(-48) },
    ArmL2: { x: deg(30) },
    ArmR2: { x: deg(30) },
    Spine1: { x: deg(10) },
    Neck1: { x: deg(6) },
  } satisfies PoseDefinition,
} as const;

/** The landing crouch. Short: a walker lands and keeps going. */
export const LANDING = {
  duration: 0.16,
  pose: {
    LegL1: { x: deg(-34) },
    LegR1: { x: deg(-34) },
    LegL2: { x: deg(58) },
    LegR2: { x: deg(58) },
    ArmL1: { x: deg(-18), z: deg(20) },
    ArmR1: { x: deg(-18), z: deg(-20) },
    Spine1: { x: deg(14) },
  } satisfies PoseDefinition,
  bobY: -0.32,
} as const;

/** The jump's playback rate, so the arc reads rather than snaps. Visual only. */
export const JUMP_ANIMATION = {
  playbackRate: 0.8,
  airBlendRate: 9,
} as const;

/** The fall into the lava. Readable, brief, and deliberately not gruesome. */
export const DEATH = {
  /** THE SERVER'S NUMBER. See `DEATH_HOLD_SECONDS`. */
  duration: DEATH_HOLD_SECONDS,
  /** How far the body keels over sideways, in radians. */
  roll: deg(70),
  /** How far it pitches forward as it goes. */
  pitch: deg(24),
  /** How far the body sinks. */
  drop: 1.6,
  pose: {
    ArmL1: { x: deg(-120), z: deg(30) },
    ArmR1: { x: deg(-120), z: deg(-30) },
    LegL1: { x: deg(-20) },
    LegR1: { x: deg(10) },
    Spine1: { x: deg(10) },
    Neck1: { x: deg(-12) },
  } satisfies PoseDefinition,
} as const;

/** Seconds a pose change takes to blend in. */
export const TRANSITIONS = {
  toLocomotion: 0.14,
  toJumpStart: 0.05,
  toAirborne: 0.16,
  toLanding: 0.06,
  toDeath: 0.12,
} as const;
