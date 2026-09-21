/**
 * Network-level constants. Must stay identical on client and server.
 */

/** Colyseus room registered by the server and joined by the client. */
export const ROOM_NAME = 'moneyescape';

/**
 * Default server port. Override with the PORT env var on the server.
 *
 * Deliberately NOT 2567: the earlier games in this series occupy 2567-2575 on
 * the same machine, and sharing a port means whichever server starts first
 * silently serves both clients.
 */
export const DEFAULT_SERVER_PORT = 2576;

/**
 * Most players in ONE room. The matchmaker locks a room at this figure and
 * opens another, so a sixteenth player gets a new room rather than a refusal.
 */
export const MAX_PLAYERS_PER_ROOM = 15;

/**
 * How many OTHER players are drawn at once. A rendering limit only: every
 * player in the room is tracked on every patch, and the nearest few are added
 * to the scene with their ball, bridge, pets and aura.
 */
export const VISIBLE_REMOTE_PLAYERS = 8;

/** Server simulation / state broadcast rate, in Hz. */
export const SERVER_TICK_RATE = 20;

/** Milliseconds between server ticks. */
export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;

/**
 * Client->server and server->client message identifiers.
 *
 * A const object rather than an enum so it survives `verbatimModuleSyntax` and
 * erases cleanly in both build pipelines.
 */
export const MessageType = {
  /** Client -> server: one frame of INPUT. Never a transform. */
  Move: 'move',
  /** Server -> client: authoritative respawn instruction. */
  Respawn: 'respawn',
  /** Client -> server: "I am standing on this stage's win pad." A request. */
  ClaimStage: 'claimStage',
  /** Client -> server: "put me back at the spawn". */
  RequestRespawn: 'requestRespawn',
  /** Server -> client: a stage reward was granted. Drives the celebration. */
  StageAwarded: 'stageAwarded',
  /** Client -> server: "rebirth me". Carries nothing. */
  Rebirth: 'rebirth',
  /** Client -> server: "I am standing on this cash bill's display pad, buy it." */
  ClaimBill: 'claimBill',
  /** Client -> server: buy the aura in this slot. */
  BuyAura: 'buyAura',
  /** Client -> server: wear an OWNED aura, or 0 to take it off. */
  EquipAura: 'equipAura',
  /** Client -> server: buy one level of an upgrade (walkspeed / max pets). */
  BuyUpgrade: 'buyUpgrade',
  /** Client -> server: hatch this egg once, or several times. */
  HatchEgg: 'hatchEgg',
  /** Server -> client: what came out of the egg. Presentation only. */
  EggHatched: 'eggHatched',
  /** Client -> server: equip the pet at this inventory index. */
  EquipPet: 'equipPet',
  /** Client -> server: take the pet at this inventory index off. */
  UnequipPet: 'unequipPet',
  /** Client -> server: equip the best pets owned, up to the slot limit. */
  EquipBestPets: 'equipBestPets',
  /** Client -> server: delete the pet at this inventory index. */
  DeletePet: 'deletePet',
  /** Server -> client: a cash pickup on the lava was collected. */
  PickupCollected: 'pickupCollected',
  /** Client -> server: "this is what my Bloxity avatar looks like". */
  SetAvatar: 'setAvatar',
  /** Client -> server: the player's Bloxity DISPLAY NAME and portrait. */
  SetIdentity: 'setIdentity',
  /** Client -> server: the portal's game TOKEN, or null when signed out. */
  SetAuth: 'setAuth',
  /** Server -> client: whose progress this session is now playing on. */
  AuthState: 'authState',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];
