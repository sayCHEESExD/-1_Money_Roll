/**
 * Transform-only view of a player, used for both the local prediction and the
 * replicated remote players.
 */
export interface PlayerTransform {
  x: number;
  y: number;
  z: number;
  /** Yaw in radians. Pitch and roll are presentation, so they are not sent. */
  rotationY: number;
}

/**
 * Visual states the animator can be in. PRESENTATION only.
 */
export const PlayerAnimationState = {
  Idle: 'idle',
  /** The walk cycle, pushing the ball when there is one. */
  Walk: 'walk',
  Jumping: 'jumping',
  Falling: 'falling',
  Landing: 'landing',
  Dying: 'dying',
} as const;

export type PlayerAnimationState =
  (typeof PlayerAnimationState)[keyof typeof PlayerAnimationState];

/**
 * The compact per-player signals a client needs to reconstruct another
 * player's animation locally. Bone transforms are NEVER sent.
 */
export interface PlayerMotionState {
  /** Horizontal speed in world units per second. */
  speed: number;
  /** Vertical velocity in world units per second. Rise versus fall. */
  verticalVelocity: number;
  grounded: boolean;
  /** Monotonic count of jumps, so a remote can trigger the leap. */
  jumpCount: number;
  /** Monotonic count of deaths, so a remote can play the fall. */
  deathCount: number;
  /** Training zone the player is standing in, or 0. */
  trainingZone: number;
}

/** Server-authoritative progression snapshot. */
export interface PlayerProgression {
  level: number;
  maxLevel: number;
  rebirths: number;
  wins: number;
  /** The money ball: cash carried right now. */
  cash: number;
  /** Cash earned since the last rebirth. Drives level. */
  levelCash: number;
  /** Cash earned over the whole profile. The Cash board. */
  lifetimeCash: number;
  billSlot: number;
  ownedBills: number;
  ownedAuras: number;
  auraSlot: number;
  speedUpgrades: number;
  petSlotUpgrades: number;
  /** Inventory and equipped set, encoded. See `config/pets.ts`. */
  pets: string;
  equippedPets: string;
  /** Sum of the equipped pets' boosts, replicated so the HUD need not resolve it. */
  petBoost: number;
  moveMultiplier: number;
  jumpVelocity: number;
  bestStage: number;
  /** Seconds played, lifetime. The Time board. */
  playSeconds: number;
}

/** Everything the client knows about a replicated player. */
export interface PlayerSnapshot
  extends PlayerTransform,
    PlayerMotionState,
    PlayerProgression {
  sessionId: string;
  animation: PlayerAnimationState;
  /** The bridge this player has built, encoded. */
  bridge: string;
}
