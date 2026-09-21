import type { AvatarAppearance, AvatarProportions } from '@money/shared';
import type { PlayerAnimationState, PlayerMotionState } from '@money/shared';
import type { MapSchema } from '@colyseus/schema';

/**
 * Client-side TYPE mirror of the server's Colyseus schema.
 *
 * Types only - colyseus.js builds the concrete schema instances at runtime
 * from the handshake reflection.
 */
export interface NetPlayerState extends PlayerMotionState {
  sessionId: string;
  displayName: string;
  avatarUrl: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  animation: PlayerAnimationState;

  level: number;
  maxLevel: number;
  rebirths: number;
  wins: number;
  cash: number;
  /** The temporary lava-crossing supply. The ball shows it while `crossing` is set. */
  crossingCash: number;
  /** Whether the money ball exists: made in the meadow, lost on death or respawn. */
  ballActive: boolean;
  levelCash: number;
  lifetimeCash: number;
  billSlot: number;
  ownedBills: number;
  ownedAuras: number;
  auraSlot: number;
  speedUpgrades: number;
  petSlotUpgrades: number;
  pets: string;
  equippedPets: string;
  petBoost: number;
  moveMultiplier: number;
  jumpVelocity: number;
  bestStage: number;
  playSeconds: number;
  bridge: string;

  velocityX: number;
  velocityY: number;
  velocityZ: number;
  lastInputSeq: number;
  jumpLatched: boolean;
  coyote: number;
  crossing: number;
  ready: boolean;

  avatar: AvatarAppearance & AvatarProportions;
}

export interface NetLeaderEntry {
  handle: string;
  name: string;
  avatarUrl: string;
  value: number;
}

export interface NetLeaderboardState {
  time: ArrayLike<NetLeaderEntry>;
  wins: ArrayLike<NetLeaderEntry>;
  cash: ArrayLike<NetLeaderEntry>;
}

export interface NetPickupState {
  active: boolean;
  x: number;
  z: number;
  amount: number;
  stage: number;
  bornAt: number;
}

export interface NetCourseState {
  players: MapSchema<NetPlayerState>;
  elapsed: number;
  leaderboard: NetLeaderboardState;
  pickups: ArrayLike<NetPickupState>;
}

/** A leaderboard flattened into plain data, ready to draw. */
export interface LeaderboardSnapshot {
  time: readonly NetLeaderEntry[];
  wins: readonly NetLeaderEntry[];
  cash: readonly NetLeaderEntry[];
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';
