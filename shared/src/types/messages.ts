import type { AvatarAppearance, AvatarProportions } from './avatar.js';

/**
 * Client -> server input (MessageType.Move).
 *
 * INPUT ONLY. There is deliberately no position, velocity, cash or bridge
 * here: the server simulates movement from intent and owns the result, so a
 * client has no channel through which to assert where it is or what it has.
 */
export interface MoveMessage {
  /** Monotonically increasing input sequence number. */
  seq: number;
  /** Seconds this input covers. Clamped and rate-limited server-side. */
  dt: number;
  /** -1..1, camera-relative. */
  moveX: number;
  /** -1..1, camera-relative. */
  moveZ: number;
  /** The jump key, held. Only a fresh PRESS produces a leap. */
  jump: boolean;
  /** Yaw the camera faced, so movement is camera-relative. */
  cameraYaw: number;
}

/** Why a run ended. */
export type RespawnReason =
  /** Fell into the lava, or out of the world. */
  | 'fell'
  /** Asked to be put back. */
  | 'manual'
  /** Just joined. */
  | 'join'
  /** Banked a stage and was returned to the spawn. */
  | 'stage'
  /** Rebirthed. */
  | 'rebirth';

/** Server -> client authoritative respawn (MessageType.Respawn). */
export interface RespawnMessage {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  reason: RespawnReason;
}

/** Client -> server: "I am standing on this stage's win pad." A request. */
export interface ClaimStageMessage {
  stageIndex: number;
}

/** Server -> client: a stage reward landed. Presentation only. */
export interface StageAwardedMessage {
  stageIndex: number;
  wins: number;
  /** Wins the player now holds, so the HUD can pop without waiting a patch. */
  total: number;
}

/** Client -> server: "rebirth me". Deliberately empty. */
export type RebirthMessage = Record<string, never>;

/** Client -> server: "I am on this bill's pad, buy it." */
export interface ClaimBillMessage {
  slot: number;
}

/** Client -> server: buy or wear an aura by slot. */
export interface SlotMessage {
  slot: number;
}

/** Client -> server: buy one level of an upgrade. */
export interface BuyUpgradeMessage {
  kind: string;
}

/** Client -> server: hatch an egg `count` times (1, or the multi count). */
export interface HatchEggMessage {
  egg: string;
  count: number;
}

/** Server -> client: what hatched. Presentation only; the inventory is replicated. */
export interface EggHatchedMessage {
  egg: string;
  /** Pet ids, in the order they hatched. */
  pets: string[];
}

/** Client -> server: equip, unequip or delete the pet at an inventory index. */
export interface PetIndexMessage {
  index: number;
}

/** Server -> client: a cash pickup on the lava was collected. */
export interface PickupCollectedMessage {
  amount: number;
}

/** Client -> server: the player's Bloxity appearance. */
export interface SetAvatarMessage {
  appearance: AvatarAppearance;
  proportions: AvatarProportions;
}

/** Client -> server: who the player IS, as the portal knows them. */
export interface SetIdentityMessage {
  displayName: string;
  avatarUrl: string;
}

/**
 * Client -> server: the portal's game TOKEN, or null when signed out. The
 * server verifies it with Bloxity; nothing in it is trusted until then.
 */
export interface SetAuthMessage {
  token: string | null;
}

/** Whose progress a session is playing on. */
export type AuthStatus = 'account' | 'guest' | 'unavailable';

/** Server -> client (MessageType.AuthState): the outcome of a SetAuth. */
export interface AuthStateMessage {
  status: AuthStatus;
  note?: string;
}
