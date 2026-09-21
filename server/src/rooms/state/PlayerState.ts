import { Schema, type } from '@colyseus/schema';
import { AvatarState } from './AvatarState.js';
import {
  PlayerAnimationState,
  INITIAL_OWNED_BILLS,
  MOVEMENT,
  SPAWN_POSITION,
  SPAWN_ROTATION_Y,
  STARTER_BILL_SLOT,
  type PlayerAnimationState as AnimationState,
} from '@money/shared';

/**
 * Replicated per-player state.
 *
 * Every field here is written by the SERVER. Transform and motion come out of
 * the authoritative simulation; cash, Wins and every inventory are written
 * only by their own service. Nothing is ever copied from a client message.
 */
export class PlayerState extends Schema {
  @type('string') sessionId = '';

  @type('float32') x: number = SPAWN_POSITION.x;
  @type('float32') y: number = SPAWN_POSITION.y;
  @type('float32') z: number = SPAWN_POSITION.z;
  @type('float32') rotationY: number = SPAWN_ROTATION_Y;

  /** Horizontal speed, drives the remote gait blend. */
  @type('float32') speed = 0;
  @type('float32') verticalVelocity = 0;
  @type('boolean') grounded = true;

  /** Authoritative velocity, needed by the client to reconcile prediction. */
  @type('float32') velocityX = 0;
  @type('float32') velocityY = 0;
  @type('float32') velocityZ = 0;
  /** Highest input sequence the server has simulated for this player. */
  @type('uint32') lastInputSeq = 0;

  /** LATCHED simulation state, replicated so a replay resumes from the server's edge. */
  @type('boolean') jumpLatched = false;
  @type('float32') coyote = 0;
  /** The stage whose lava the player is crossing, or 0. Replicated for the replay. */
  @type('uint8') crossing = 0;

  @type('uint32') jumpCount = 0;
  @type('uint32') deathCount = 0;

  /** Training zone the player is standing in, or 0. Derived by the simulation. */
  @type('uint8') trainingZone = 0;

  @type('string') animation: AnimationState = PlayerAnimationState.Idle;

  /** How this player looks in the Bloxity portal. Cosmetic; sanitised. */
  @type(AvatarState) avatar = new AvatarState();

  /** THE NAME EVERYONE SEES, and the portrait beside it. */
  @type('string') displayName = '';
  @type('string') avatarUrl = '';

  /** Server-authoritative progression. */
  @type('uint32') level = 0;
  @type('uint32') maxLevel = 25;
  @type('uint32') rebirths = 0;
  /** Wins. `float64`: the ladders run far past what a uint32 holds. Written through `Wallet` only. */
  @type('float64') wins = 0;

  /** THE MONEY BALL: cash carried. Written by the movement service (spent) and the cash service (earned). */
  /** The PERMANENT bills. Only earning raises it; only a rebirth resets it. Persisted. */
  @type('float64') cash = 0;
  /** The temporary lava-crossing supply: what the ball holds mid-crossing. Never persisted. */
  @type('float64') crossingCash = 0;
  /** Cash earned since the last rebirth. Drives level. */
  @type('float64') levelCash = 0;
  /** Cash earned over the whole profile. The Cash board. */
  @type('float64') lifetimeCash = 0;

  /** Equipped cash bill - the best one owned. Written by BillService. */
  @type('uint8') billSlot = STARTER_BILL_SLOT;
  @type('uint16') ownedBills = INITIAL_OWNED_BILLS;

  /** Auras. Written ONLY by AuraService. */
  @type('uint8') ownedAuras = 0;
  @type('uint8') auraSlot = 0;

  /** Upgrades bought. Written ONLY by UpgradeService. */
  @type('uint8') speedUpgrades = 0;
  @type('uint8') petSlotUpgrades = 0;

  /** Pets: the inventory and the equipped indices, encoded. Written ONLY by PetService. */
  @type('string') pets = '';
  @type('string') equippedPets = '';
  /** Sum of the equipped pets' boosts, so the HUD need not resolve it. */
  @type('float32') petBoost = 0;

  /** Authoritative movement multiplier and jump velocity. */
  @type('float32') moveMultiplier = 1;
  @type('float32') jumpVelocity = MOVEMENT.jumpVelocity;

  /** Highest stage (1-based) ever banked. */
  @type('uint32') bestStage = 0;

  /** Seconds played, lifetime. The Time board. */
  @type('float64') playSeconds = 0;

  /** The bridge this player has built across the lava, encoded. */
  @type('string') bridge = '';

  /** True once the server has simulated at least one input for this player. */
  @type('boolean') ready = false;
}
