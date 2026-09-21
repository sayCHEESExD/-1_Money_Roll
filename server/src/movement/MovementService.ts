import {
  MAX_CASH,
  MAX_SIM_DELTA,
  WorldCollision,
  copyMotion,
  createBridgeState,
  createMotion,
  createSimEvents,
  encodeBridge,
  horizontalSpeed,
  resetMotion,
  sanitiseInput,
  stepPlayer,
  trainingUnlockMask,
  type BridgeState,
  type MoveMessage,
  type PlayerMotion,
  type SimEvents,
} from '@money/shared';
import type { PlayerState } from '../rooms/state/PlayerState.js';

/** Simulated seconds a client may bank per real second. */
const MAX_TIME_BUDGET_RATIO = 1.5;

/** Seconds of simulated time a fresh client starts with, to absorb bursts. */
const INITIAL_BUDGET = 0.5;

/** Largest jump in sequence number the server will follow. */
const MAX_SEQ_JUMP = 600;

export type RejectReason = 'malformed' | 'stale-seq' | 'seq-jump' | 'budget';

interface Sim {
  motion: PlayerMotion;
  events: SimEvents;
  /** THE CASH AND THE BRIDGE. The step spends them; the services add to them. */
  bridge: BridgeState;
  lastSeq: number;
  budget: number;
  lastRefill: number;
}

/**
 * Server-authoritative movement, and the authoritative MONEY BALL.
 *
 * The client sends INPUT and nothing else; this runs the shared simulation and
 * the result becomes the player's position, velocity, rotation, grounded and
 * jump state - and their cash and bridge, because crossing the lava spends
 * cash. Because the very same `stepPlayer` runs on the client for prediction,
 * the two agree by construction rather than by trust.
 *
 * Cash lives HERE, on the simulation, and is published to the replicated
 * state after every change: the cash service adds to it, the room clears it
 * on a death, and the step spends it. One owner, one number.
 */
export class MovementService {
  private readonly sims = new Map<string, Sim>();
  readonly collision = new WorldCollision();

  private lastReject: RejectReason | null = null;
  private lastStepSeconds = 0;
  private lastFromX = 0;
  private lastFromZ = 0;
  private lastWasGrounded = true;

  /** The events the last accepted step produced, for the room. */
  private lastEvents: SimEvents = createSimEvents();

  initialise(player: PlayerState): void {
    const sim: Sim = {
      motion: createMotion(),
      events: createSimEvents(),
      bridge: createBridgeState(),
      lastSeq: 0,
      budget: INITIAL_BUDGET,
      lastRefill: Date.now(),
    };
    // The restored bills are the wallet the ball shows; no crossing is under way.
    sim.bridge.wallet = Number.isFinite(player.cash) ? Math.max(0, player.cash) : 0;
    sim.bridge.cash = 0;
    this.sims.set(player.sessionId, sim);
    this.publish(player, sim);
  }

  has(sessionId: string): boolean {
    return this.sims.has(sessionId);
  }

  forget(sessionId: string): void {
    this.sims.delete(sessionId);
  }

  motionOf(sessionId: string): PlayerMotion | undefined {
    return this.sims.get(sessionId)?.motion;
  }

  get rejectReason(): RejectReason | null {
    return this.lastReject;
  }

  /** Seconds the last accepted input advanced the simulation. */
  get lastStep(): number {
    return this.lastStepSeconds;
  }

  /** What the last accepted step did: cells built, cash spent, a crossing. */
  get events(): SimEvents {
    return this.lastEvents;
  }

  /** Horizontal distance the last accepted step actually covered. */
  lastDistance(player: PlayerState): number {
    return Math.hypot(player.x - this.lastFromX, player.z - this.lastFromZ);
  }

  /** True when the last step began AND ended on the ground: a real stride. */
  lastStepOnGround(player: PlayerState): boolean {
    return this.lastWasGrounded && player.grounded;
  }

  /**
   * Add bills to the PERMANENT wallet. The one door every income uses.
   * A pickup taken mid-crossing also tops up the supply, so it helps the
   * crossing it was found on.
   */
  addCash(sessionId: string, player: PlayerState, amount: number): void {
    const sim = this.sims.get(sessionId);
    if (!sim || !Number.isFinite(amount) || amount <= 0) return;
    player.cash = Math.min(MAX_CASH, player.cash + amount);
    if (sim.motion.crossing > 0) sim.bridge.cash = Math.min(MAX_CASH, sim.bridge.cash + amount);
    this.publish(player, sim);
  }

  /**
   * Set the PERMANENT wallet outright: a rebirth resets it, a profile switch
   * restores it. Any crossing supply is dropped with it. This is the only
   * way the wallet ever goes DOWN, and a death never calls it.
   */
  setCash(sessionId: string, player: PlayerState, amount: number): void {
    const sim = this.sims.get(sessionId);
    if (!sim) return;
    player.cash = Number.isFinite(amount) ? Math.max(0, Math.min(MAX_CASH, amount)) : 0;
    sim.bridge.cash = 0;
    this.publish(player, sim);
  }

  /** Drop the crossing supply: a death on the lava loses the run, never the wallet. */
  dropSupply(sessionId: string, player: PlayerState): void {
    const sim = this.sims.get(sessionId);
    if (!sim) return;
    sim.bridge.cash = 0;
    this.publish(player, sim);
  }

  /** Drop every cell laid. A placement ends the run the bridge belonged to. */
  clearBridge(sessionId: string, player: PlayerState): void {
    const sim = this.sims.get(sessionId);
    if (!sim) return;
    sim.bridge.cells.clear();
    this.publish(player, sim);
  }

  /** Teleport authoritatively, e.g. on respawn. Only the server calls this. */
  teleport(sessionId: string, player: PlayerState, x: number, y: number, z: number, yaw: number): void {
    const sim = this.sims.get(sessionId);
    if (!sim) return;
    resetMotion(sim.motion, x, y, z, yaw);
    // A placement ends any crossing: the bridge and its supply go, the wallet stays.
    sim.bridge.cells.clear();
    sim.bridge.cash = 0;
    this.publish(player, sim);
  }

  /**
   * Consume one input and advance the authoritative simulation.
   *
   * @returns true when the input was simulated
   */
  applyInput(sessionId: string, player: PlayerState, message: MoveMessage, time: number): boolean {
    this.lastReject = null;
    const sim = this.sims.get(sessionId);
    if (!sim) return false;

    const seq = message?.seq;
    const dt = message?.dt;
    if (typeof seq !== 'number' || !Number.isFinite(seq)) {
      this.lastReject = 'malformed';
      return false;
    }
    if (typeof dt !== 'number' || !Number.isFinite(dt) || dt < 0) {
      this.lastReject = 'malformed';
      return false;
    }
    if (seq <= sim.lastSeq) {
      this.lastReject = 'stale-seq';
      return false;
    }
    if (seq > sim.lastSeq + MAX_SEQ_JUMP) {
      this.lastReject = 'seq-jump';
      return false;
    }

    const step = Math.min(dt, MAX_SIM_DELTA);
    this.refill(sim);
    if (step > sim.budget) {
      this.lastReject = 'budget';
      return false;
    }
    sim.budget -= step;
    sim.lastSeq = seq;
    this.lastStepSeconds = step;
    this.lastFromX = sim.motion.x;
    this.lastFromZ = sim.motion.z;
    this.lastWasGrounded = sim.motion.grounded;

    // The wallet a crossing may draw on is the replicated, service-owned figure.
    sim.bridge.wallet = Number.isFinite(player.cash) ? Math.max(0, player.cash) : 0;
    stepPlayer(
      sim.motion,
      sanitiseInput(message),
      {
        moveMultiplier: player.moveMultiplier,
        jumpVelocity: player.jumpVelocity,
        time,
        trainingUnlocked: trainingUnlockMask(player.rebirths),
        bridge: sim.bridge,
      },
      step,
      this.collision,
      sim.events,
    );
    this.lastEvents = sim.events;

    this.publish(player, sim);
    return true;
  }

  /** Copy the simulation onto the replicated state. */
  private publish(player: PlayerState, sim: Sim): void {
    const m = sim.motion;
    player.x = m.x;
    player.y = m.y;
    player.z = m.z;
    player.rotationY = m.yaw;
    player.velocityX = m.vx;
    player.velocityY = m.vy;
    player.velocityZ = m.vz;
    player.verticalVelocity = m.vy;
    player.speed = horizontalSpeed(m);
    player.grounded = m.grounded;
    player.jumpCount = m.jumpCount;
    player.jumpLatched = m.jumpLatched;
    player.coyote = m.coyote;
    player.crossing = m.crossing;
    player.trainingZone = m.trainingZone;
    player.lastInputSeq = sim.lastSeq;
    // The wallet is NEVER written from the simulation: only the supply is.
    if (player.crossingCash !== sim.bridge.cash) player.crossingCash = sim.bridge.cash;
    // Re-encoded only when the set could have changed: a step that laid
    // nothing, crossed nothing and was not a placement leaves it alone.
    if (sim.events.built > 0 || sim.events.crossed > 0 || sim.bridge.cells.size === 0) {
      const encoded = encodeBridge(sim.bridge.cells);
      if (player.bridge !== encoded) player.bridge = encoded;
    }
    player.ready = true;
  }

  private refill(sim: Sim): void {
    const now = Date.now();
    const elapsed = Math.max(0, (now - sim.lastRefill) / 1000);
    sim.lastRefill = now;
    sim.budget = Math.min(sim.budget + elapsed * MAX_TIME_BUDGET_RATIO, MAX_SIM_DELTA * 20);
  }

  snapshot(sessionId: string, into: PlayerMotion): boolean {
    const sim = this.sims.get(sessionId);
    if (!sim) return false;
    copyMotion(sim.motion, into);
    return true;
  }
}
