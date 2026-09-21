import { LOCOMOTION, PUSH } from '../config/animationConfig.js';
import type { PoseBuffer } from './PoseBuffer.js';

const TAU = Math.PI * 2;

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
};

/** A pose parameter at two depths. */
interface Depth {
  readonly walk: number;
  readonly run: number;
}

/**
 * One procedural walk cycle driven by a phase.
 *
 * Walk and run are the SAME cycle: a blend derived from actual movement speed
 * raises the cadence and strengthens the pose, so the character flows from a
 * stroll into a run rather than snapping between canned animations. Phase
 * advances with distance travelled, so the feet stay planted at any speed.
 *
 * THE PUSH is layered over it: with a ball in front, the arms leave the swing
 * and reach forward onto the money, higher the bigger it is. The legs never
 * stop cycling - the player is walking the ball along.
 */
export class LocomotionCycle {
  private phase = 0;
  /** Eased push weight, so the arms reach out rather than snapping. */
  private pushWeight = 0;
  /** Eased ball size, so the hands climb the growing ball smoothly. */
  private pushLift = 0;

  get currentPhase(): number {
    return this.phase;
  }

  /** How strongly the run pose is applied, 0..1. */
  runBlend(speed: number, multiplier: number): number {
    const scale = Math.max(1, multiplier);
    return smoothstep(LOCOMOTION.walkSpeed * scale, LOCOMOTION.runSpeed * scale, speed);
  }

  /** Advance the cycle. Returns the frequency used, in cycles per second. */
  advance(delta: number, speed: number, push: number): number {
    const frequency = clamp(
      speed / LOCOMOTION.strideDistance,
      LOCOMOTION.minFrequency,
      LOCOMOTION.maxFrequency,
    );
    this.phase = (this.phase + frequency * TAU * delta) % TAU;
    this.easePush(delta, push);
    return frequency;
  }

  /** Ease the push layer toward the ball that is actually there. */
  easePush(delta: number, push: number): void {
    const alpha = 1 - Math.exp(-PUSH.blendRate * delta);
    const target = clamp(push, 0, 1);
    this.pushWeight += ((target > 0.02 ? 1 : 0) - this.pushWeight) * alpha;
    this.pushLift += (target - this.pushLift) * alpha;
  }

  /** Ease the cycle back toward a neutral standing phase. */
  settleTowardNeutral(delta: number, push: number): void {
    const target = this.phase > Math.PI ? TAU : 0;
    const alpha = 1 - Math.exp(-8 * delta);
    this.phase += (target - this.phase) * alpha;
    if (this.phase >= TAU - 1e-4) this.phase = 0;
    this.easePush(delta, push);
  }

  /** The eased push weight, so the idle can hold the arms on the ball too. */
  get push(): number {
    return this.pushWeight;
  }

  /** Write the arms-on-the-ball pose over whatever is in `out`. */
  writePush(out: PoseBuffer, lean = 0): void {
    const w = this.pushWeight;
    if (w <= 0.001) return;
    const arm = lerp(PUSH.armLow, PUSH.armHigh, this.pushLift);
    // The swing is removed by exactly the weight the reach is added with.
    out.set('ArmL1', arm * w, 0, PUSH.armSpread * w);
    out.set('ArmR1', arm * w, 0, -PUSH.armSpread * w);
    out.set('ArmL2', PUSH.elbow * w);
    out.set('ArmR2', PUSH.elbow * w);
    out.add('Spine1', lean * w, 0, 0);
  }

  /** Write the locomotion pose for the current phase. */
  writePose(out: PoseBuffer, speed: number, multiplier: number): void {
    const run = this.runBlend(speed, multiplier);
    const phase = this.phase;

    const depth = (d: Depth): number => lerp(d.walk, d.run, run);

    const hip = depth(LOCOMOTION.hipSwing);
    const knee = depth(LOCOMOTION.kneeBend);
    const arm = depth(LOCOMOTION.armSwing);
    const elbow = depth(LOCOMOTION.elbowBend);
    const twist = depth(LOCOMOTION.torsoTwist);
    const lean = depth(LOCOMOTION.torsoLean);
    const headTwist = depth(LOCOMOTION.headCounterTwist);
    const roll = depth(LOCOMOTION.torsoRoll);
    const bob = depth(LOCOMOTION.bob);

    const swing = Math.sin(phase);
    const oppositeSwing = -swing;

    out.reset();

    // Thighs: a half cycle apart, so the feet alternate.
    out.set('LegL1', hip * swing);
    out.set('LegR1', hip * oppositeSwing);

    // Knees bend during the swing-through only.
    out.set('LegL2', knee * kneeCurve(phase));
    out.set('LegR2', knee * kneeCurve(phase + Math.PI));

    // Arms counter-swing against the leg on the same side - unless a ball is
    // being pushed, in which case the push pose replaces the swing.
    const swingWeight = 1 - this.pushWeight;
    out.set('ArmL1', arm * oppositeSwing * swingWeight, 0, 0);
    out.set('ArmR1', arm * swing * swingWeight, 0, 0);
    out.set('ArmL2', (elbow + elbow * 0.35 * Math.max(0, oppositeSwing)) * swingWeight);
    out.set('ArmR2', (elbow + elbow * 0.35 * Math.max(0, swing)) * swingWeight);

    // The torso leans in, twists with the stride and rolls on the footfall.
    out.set('Spine1', lean, twist * oppositeSwing, roll * Math.sin(phase * 2));
    out.set('Spine2', lean * 0.4, twist * 0.5 * oppositeSwing, 0);
    // The head looks UP the course however far the body leans.
    out.set('Neck1', -lean * 0.7, headTwist * swing, 0);

    out.bobY = -bob * Math.cos(phase * 2);

    this.writePush(out, PUSH.lean * (0.5 + run * 0.5));
  }
}

/** Knee flexion over one cycle: zero while planted, peaking as the foot lifts. */
const kneeCurve = (phase: number): number => {
  const raw = Math.sin(phase - Math.PI / 2.6);
  return raw > 0 ? raw * raw : 0;
};
