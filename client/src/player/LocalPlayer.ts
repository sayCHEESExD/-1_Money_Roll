import {
  MOVEMENT,
  WorldCollision,
  copyMotion,
  createBridgeState,
  createMotion,
  createSimEvents,
  decodeBridge,
  horizontalSpeed,
  resetMotion,
  stepPlayer,
  trainingUnlockMask,
  type MoveMessage,
  type MovementInput,
  type PlayerMotion,
  type SimParams,
} from '@money/shared';
import { Vector3 } from 'three';
import { createAnimationInput, type AnimationInput } from '../animation/AnimationInput.js';
import type { AnimationState } from '../animation/PlayerAnimator.js';
import { DEATH } from '../config/animationConfig.js';
import type { InputState } from '../input/InputState.js';
import { NamePlate } from './NamePlate.js';
import { PlayerCharacter } from './PlayerCharacter.js';

/** The pace the run cycle plays at while a player trains on a pad, in world units per second. */
const TRAINING_RUN_SPEED = 14;

const MAX_PENDING_INPUTS = 240;
const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
const ARRIVE_DURATION = 0.16;
const RESPAWN_ACK_TIMEOUT = 1.5;
const RESPAWN_NUDGE_INTERVAL = 0.75;
const SNAP_DISTANCE = 5;
const CORRECTION_RATE = 14;

const lerp = (from: number, to: number, alpha: number): number => from + (to - from) * alpha;

const EMPTY_INPUTS: MoveMessage[] = [];

export type PlacementKind = 'none' | 'respawn' | 'correction';

interface PendingInput {
  seq: number;
  dt: number;
  input: MovementInput;
}

/**
 * The authoritative fields the client reconciles against.
 *
 * This must cover EVERY field of `PlayerMotion` AND the money: replay re-runs
 * `stepPlayer`, which spends cash and lays cells, and a replay from the
 * client's own idea of either would derive a different bridge than the
 * server did.
 */
export interface AuthoritativeMotion {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  grounded: boolean;
  jumpCount: number;
  lastInputSeq: number;
  jumpLatched: boolean;
  coyote: number;
  crossing: number;
  cash: number;
  crossingCash: number;
  ballActive: boolean;
  bridge: string;
}

/**
 * The locally controlled character: a PREDICTION of a server-owned simulation.
 *
 * Runs the identical `stepPlayer` from shared so the character responds
 * instantly - including the ball shrinking as the bridge is bought - keeps
 * every input the server has not acknowledged, and on each server update
 * snaps to the authoritative state and replays those inputs.
 */
export class LocalPlayer {
  readonly character: PlayerCharacter;
  readonly position = new Vector3();
  readonly velocity = new Vector3();

  private readonly previous = { x: 0, y: 0, z: 0 };
  private readonly motion: PlayerMotion = createMotion();
  private readonly events = createSimEvents();
  private readonly replayEvents = createSimEvents();
  private readonly collision: WorldCollision;
  private readonly params: SimParams = {
    moveMultiplier: 1,
    jumpVelocity: MOVEMENT.jumpVelocity,
    time: 0,
    trainingUnlocked: trainingUnlockMask(0),
    bridge: createBridgeState(),
  };

  private readonly pending: PendingInput[] = [];
  private nextSeq = 1;
  private readonly outgoing: MoveMessage[] = [];
  private accumulator = 0;
  private readonly correction = new Vector3();
  private placement: PlacementKind = 'none';
  private deathTime = -1;
  private arriveTime = -1;
  private awaitingRespawn = false;
  private respawnWait = 0;
  private stuckTime = -1;
  private turnSignal = 0;
  private readonly animationInput: AnimationInput = createAnimationInput();
  private readonly plate = new NamePlate();

  /** What the last frame's steps did, for sounds and effects. */
  private builtThisFrame = 0;
  private crossedThisFrame = 0;
  private starvedThisFrame = false;

  /** The last replicated cash figure, so a patch is applied once. */
  private lastServerCash = -1;

  constructor(collision: WorldCollision) {
    this.collision = collision;
    this.character = new PlayerCharacter();
    this.character.root.add(this.plate.sprite);
    this.previous.x = this.motion.x;
    this.previous.y = this.motion.y;
    this.previous.z = this.motion.z;
    this.syncFromMotion();
    this.syncCharacter();
  }

  get horizontalSpeed(): number {
    return horizontalSpeed(this.motion);
  }

  get rotationY(): number {
    return this.motion.yaw;
  }

  get isGrounded(): boolean {
    return this.motion.grounded;
  }

  get justLanded(): boolean {
    return this.events.landed;
  }

  get justJumped(): boolean {
    return this.events.jumpStarted;
  }

  /** Cells laid this frame, for the note-laying sound. */
  get justBuilt(): number {
    return this.builtThisFrame;
  }

  /** The stage whose far bank was reached this frame, or 0. */
  get justCrossed(): number {
    return this.crossedThisFrame;
  }

  /** True while over lava with nothing to pay for the next cell. */
  get isStarved(): boolean {
    return this.starvedThisFrame;
  }

  /** The PERMANENT bills, as the server last said. What the HUD shows. */
  get cash(): number {
    return this.params.bridge.wallet;
  }

  /**
   * What the ball holds right now, PREDICTED: the crossing supply while a
   * crossing is under way (shrinking the frame a note is laid), the wallet
   * on a bank.
   */
  get ballCash(): number {
    if (!this.params.bridge.active) return 0;
    return this.motion.crossing > 0 ? this.params.bridge.cash : this.params.bridge.wallet;
  }

  /** Whether there is a ball at all: made in the meadow, gone on death. */
  get ballActive(): boolean {
    return this.params.bridge.active;
  }

  /**
   * How much of the ball is left, 0..1: the supply over the wallet while a
   * crossing is under way, whole on a bank. What the ball's SIZE follows.
   */
  get ballFraction(): number {
    if (this.motion.crossing === 0) return 1;
    const wallet = this.params.bridge.wallet;
    if (wallet <= 0) return 0;
    return Math.max(0, Math.min(1, this.params.bridge.cash / wallet));
  }

  /** The ball's current drawn radius, for the rolling sound. */
  get ballRadius(): number {
    return this.character.ball.currentRadius;
  }

  /** The predicted bridge, for drawing. */
  get bridgeCells(): ReadonlySet<number> {
    return this.params.bridge.cells;
  }

  /** The stage the player is crossing, or 0. */
  get crossing(): number {
    return this.motion.crossing;
  }

  get trainingZone(): number {
    return this.motion.trainingZone;
  }

  get animationState(): AnimationState {
    return this.character.animationState;
  }

  drainOutgoing(): MoveMessage[] {
    if (this.outgoing.length === 0) return EMPTY_INPUTS;
    const batch = this.outgoing.slice();
    this.outgoing.length = 0;
    return batch;
  }

  get movementMultiplier(): number {
    return this.params.moveMultiplier;
  }

  /** Actual walking speed in world units per second. */
  get maxRunSpeed(): number {
    return MOVEMENT.moveSpeed * this.params.moveMultiplier;
  }

  /** Apply the server's movement profile and unlocks. */
  setProfile(multiplier: number, jumpVelocity: number, rebirths: number): void {
    if (Number.isFinite(multiplier) && multiplier > 0) this.params.moveMultiplier = multiplier;
    if (Number.isFinite(jumpVelocity) && jumpVelocity > 0) this.params.jumpVelocity = jumpVelocity;
    this.params.trainingUnlocked = trainingUnlockMask(rebirths);
  }

  setCosmetics(billSlot: number, auraSlot: number, pets: string, equippedPets: string): void {
    this.character.setCosmetics(billSlot, auraSlot, pets, equippedPets);
  }

  setDisplayName(displayName: string, avatarUrl: string): void {
    this.plate.set(displayName, avatarUrl, this.character.height);
  }

  setWorldTime(time: number): void {
    if (Number.isFinite(time)) this.params.time = time;
  }

  teleport(x: number, y: number, z: number, rotationY: number): void {
    resetMotion(this.motion, x, y, z, rotationY);
    this.params.bridge.cells.clear();
    this.params.bridge.cash = 0;
    this.params.bridge.active = false;
    this.previous.x = x;
    this.previous.y = y;
    this.previous.z = z;
    this.pending.length = 0;
    this.outgoing.length = 0;
    this.accumulator = 0;
    this.correction.set(0, 0, 0);
    this.placement = 'respawn';
    this.deathTime = -1;
    this.stuckTime = -1;
    this.arriveTime = 0;
    this.character.resetAnimation();
    this.character.setVisualScale(0.15);
    this.character.ball.snap(this.ballCash);
    this.syncFromMotion();
    this.syncCharacter();
  }

  beginDeath(): void {
    if (this.deathTime >= 0) return;
    this.deathTime = 0;
    this.arriveTime = -1;
    this.awaitingRespawn = true;
    this.respawnWait = 0;
    this.stuckTime = -1;
    this.pending.length = 0;
    this.outgoing.length = 0;
    this.correction.set(0, 0, 0);
    this.accumulator = 0;
    this.motion.vx = 0;
    this.motion.vy = 0;
    this.motion.vz = 0;
    // The crossing supply and the ball go into the lava with the player; the wallet stays.
    this.params.bridge.cash = 0;
    this.params.bridge.active = false;
    this.params.bridge.cells.clear();
  }

  get isDying(): boolean {
    return this.deathTime >= 0;
  }

  get deathComplete(): boolean {
    return this.deathTime >= DEATH.duration;
  }

  consumeRespawnNudge(): boolean {
    if (this.stuckTime < RESPAWN_NUDGE_INTERVAL) return false;
    this.stuckTime = 0;
    return true;
  }

  acknowledgeRespawn(): void {
    this.awaitingRespawn = false;
    this.respawnWait = 0;
  }

  reconcile(state: AuthoritativeMotion): void {
    if (this.awaitingRespawn) return;

    const predictedX = this.motion.x;
    const predictedY = this.motion.y;
    const predictedZ = this.motion.z;

    this.motion.x = state.x;
    this.motion.y = state.y;
    this.motion.z = state.z;
    this.motion.vx = state.velocityX;
    this.motion.vy = state.velocityY;
    this.motion.vz = state.velocityZ;
    this.motion.yaw = state.rotationY;
    this.motion.grounded = state.grounded;
    this.motion.jumpCount = state.jumpCount;
    this.motion.jumpLatched = state.jumpLatched;
    this.motion.coyote = state.coyote;
    this.motion.crossing = state.crossing;
    // THE MONEY, from the server, before the replay spends the supply again.
    this.params.bridge.wallet = state.cash;
    this.params.bridge.cash = state.crossingCash;
    this.params.bridge.active = state.ballActive;
    decodeBridge(state.bridge, this.params.bridge.cells);
    this.lastServerCash = state.cash;

    let kept = 0;
    for (const entry of this.pending) {
      if (entry.seq <= state.lastInputSeq) continue;
      this.pending[kept] = entry;
      kept += 1;
    }
    this.pending.length = kept;

    for (const entry of this.pending) {
      stepPlayer(this.motion, entry.input, this.params, entry.dt, this.collision, this.replayEvents);
    }

    const dx = predictedX - this.motion.x;
    const dy = predictedY - this.motion.y;
    const dz = predictedZ - this.motion.z;
    const snapped = Math.hypot(dx, dy, dz) > SNAP_DISTANCE;
    this.correction.set(snapped ? 0 : dx, snapped ? 0 : dy, snapped ? 0 : dz);

    if (snapped) {
      this.previous.x = this.motion.x;
      this.previous.y = this.motion.y;
      this.previous.z = this.motion.z;
      if (this.placement === 'none') this.placement = 'correction';
    }

    this.syncFromMotion();
    this.syncCharacter();
  }

  /** The last cash figure the server sent, for HUD deltas. */
  get serverCash(): number {
    return this.lastServerCash;
  }

  update(delta: number, input: Readonly<InputState>, cameraYaw: number): void {
    this.tickRespawnBarrier(delta);
    this.builtThisFrame = 0;
    this.crossedThisFrame = 0;
    this.starvedThisFrame = false;

    if (this.deathTime >= 0) {
      this.deathTime += delta;
      if (this.deathTime >= DEATH.duration) {
        this.stuckTime = this.stuckTime < 0 ? 0 : this.stuckTime + delta;
      }
      this.emitIdleInputs(delta);
      this.updateAnimation(delta, true);
      return;
    }

    this.accumulator += Math.max(0, delta);
    this.turnSignal = input.moveX;

    let steps = 0;
    let jumpStarted = false;
    let landed = false;

    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.accumulator -= FIXED_DT;
      steps += 1;

      const movement: MovementInput = {
        moveX: input.moveX,
        moveZ: input.moveZ,
        jump: input.jump,
        cameraYaw,
      };

      const seq = this.nextSeq;
      this.nextSeq += 1;

      this.previous.x = this.motion.x;
      this.previous.y = this.motion.y;
      this.previous.z = this.motion.z;

      stepPlayer(this.motion, movement, this.params, FIXED_DT, this.collision, this.events);

      jumpStarted = jumpStarted || this.events.jumpStarted;
      landed = landed || this.events.landed;
      this.builtThisFrame += this.events.built;
      if (this.events.crossed > 0) this.crossedThisFrame = this.events.crossed;
      this.starvedThisFrame = this.starvedThisFrame || this.events.starved;

      this.pending.push({ seq, dt: FIXED_DT, input: movement });
      if (this.pending.length > MAX_PENDING_INPUTS) this.pending.shift();

      this.outgoing.push({
        seq,
        dt: FIXED_DT,
        moveX: movement.moveX,
        moveZ: movement.moveZ,
        jump: movement.jump,
        cameraYaw,
      });
    }

    if (this.accumulator > FIXED_DT * MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.events.jumpStarted = jumpStarted;
    this.events.landed = landed;

    this.advanceArrival(delta);
    this.decayCorrection(delta);
    this.syncFromMotion();
    this.syncCharacter();
    this.updateAnimation(delta, false);
  }

  consumePlacement(): PlacementKind {
    const kind = this.placement;
    this.placement = 'none';
    return kind;
  }

  readMotion(into: PlayerMotion): void {
    copyMotion(this.motion, into);
  }

  private advanceArrival(delta: number): void {
    if (this.arriveTime < 0) return;
    this.arriveTime += delta;
    const t = Math.min(this.arriveTime / ARRIVE_DURATION, 1);
    if (t >= 1) {
      this.arriveTime = -1;
      this.character.setVisualScale(1);
      return;
    }
    const scale = 0.15 + 0.85 * t * (2 - t) + 0.08 * Math.sin(t * Math.PI);
    this.character.setVisualScale(scale);
  }

  private emitIdleInputs(delta: number): void {
    this.accumulator += Math.max(0, delta);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.accumulator -= FIXED_DT;
      steps += 1;
      this.outgoing.push({
        seq: this.nextSeq,
        dt: FIXED_DT,
        moveX: 0,
        moveZ: 0,
        jump: false,
        cameraYaw: this.motion.yaw,
      });
      this.nextSeq += 1;
    }
    if (this.accumulator > FIXED_DT * MAX_STEPS_PER_FRAME) this.accumulator = 0;
  }

  private tickRespawnBarrier(delta: number): void {
    if (!this.awaitingRespawn) return;
    this.respawnWait += delta;
    if (this.respawnWait < RESPAWN_ACK_TIMEOUT) return;
    this.awaitingRespawn = false;
    this.respawnWait = 0;
  }

  private decayCorrection(delta: number): void {
    if (this.correction.lengthSq() < 1e-8) {
      this.correction.set(0, 0, 0);
      return;
    }
    this.correction.multiplyScalar(Math.exp(-CORRECTION_RATE * delta));
  }

  private syncFromMotion(): void {
    const alpha = Math.min(Math.max(this.accumulator / FIXED_DT, 0), 1);
    this.position.set(
      lerp(this.previous.x, this.motion.x, alpha) + this.correction.x,
      lerp(this.previous.y, this.motion.y, alpha) + this.correction.y,
      lerp(this.previous.z, this.motion.z, alpha) + this.correction.z,
    );
    this.velocity.set(this.motion.vx, this.motion.vy, this.motion.vz);
  }

  private updateAnimation(delta: number, dying: boolean): void {
    // TRAINING: standing in a zone the player is allowed into, they train -
    // the run plays at pace for as long as they are on the pad and stops the
    // frame they step off. Animation only: the simulation is not moved.
    const training = !dying && this.motion.trainingZone > 0 && this.motion.grounded;
    this.animationInput.grounded = this.motion.grounded;
    this.animationInput.horizontalSpeed = training ? Math.max(this.horizontalSpeed, TRAINING_RUN_SPEED) : this.horizontalSpeed;
    this.animationInput.moveMultiplier = this.params.moveMultiplier;
    this.animationInput.verticalVelocity = this.motion.vy;
    this.animationInput.turn = dying ? 0 : this.turnSignal;
    this.animationInput.jumpStarted = !dying && this.events.jumpStarted;
    this.animationInput.landed = !dying && this.events.landed;
    this.animationInput.dying = dying;
    this.character.update(delta, this.animationInput, dying ? 0 : this.ballCash, this.motion.vx, this.motion.vz, this.ballFraction);
  }

  private syncCharacter(): void {
    this.character.setPosition(this.position.x, this.position.y, this.position.z);
    this.character.setYaw(this.motion.yaw);
  }
}
