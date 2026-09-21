import {
  MessageType,
  ROOM_NAME,
  type AuthStateMessage,
  type BuyUpgradeMessage,
  type ClaimBillMessage,
  type ClaimStageMessage,
  type EggHatchedMessage,
  type HatchEggMessage,
  type MoveMessage,
  type PetIndexMessage,
  type PickupCollectedMessage,
  type RespawnMessage,
  type SetAuthMessage,
  type SetAvatarMessage,
  type SetIdentityMessage,
  type SlotMessage,
  type StageAwardedMessage,
} from '@money/shared';
import { Client, getStateCallbacks, type Room } from 'colyseus.js';
import { clientConfig } from '../config/clientConfig.js';
import { logger } from '../util/logger.js';
import type {
  ConnectionStatus,
  LeaderboardSnapshot,
  NetCourseState,
  NetLeaderEntry,
  NetPickupState,
  NetPlayerState,
} from './netTypes.js';

const SCOPE = 'NetworkClient';

/** Key under which this browser's stable player id is kept. */
const PLAYER_ID_KEY = 'money.playerId';

/** Backoff between join attempts, in milliseconds. A cold host takes a while. */
const JOIN_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000] as const;

/** The server's "storage unavailable" refusal: keep asking at the longest backoff. */
const STORAGE_UNAVAILABLE = 4105;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const resolvePlayerId = (): string => {
  const fresh = `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    window.localStorage.setItem(PLAYER_ID_KEY, fresh);
  } catch {
    return fresh;
  }
  return fresh;
};

export interface NetworkHandlers {
  onStatusChange?(status: ConnectionStatus, detail?: string): void;
  onSelfJoined?(sessionId: string): void;
  onPlayerAdded?(sessionId: string, player: NetPlayerState): void;
  onPlayerChanged?(sessionId: string, player: NetPlayerState): void;
  onPlayerRemoved?(sessionId: string): void;
  onRespawn?(message: RespawnMessage): void;
  onStageAwarded?(message: StageAwardedMessage): void;
  onEggHatched?(message: EggHatchedMessage): void;
  onPickupCollected?(message: PickupCollectedMessage): void;
  onAuthState?(message: AuthStateMessage): void;
}

/**
 * Thin wrapper over colyseus.js. The rest of the client never imports
 * colyseus.js directly.
 */
export class NetworkClient {
  private readonly handlers: NetworkHandlers;
  private client: Client | null = null;
  private room: Room<NetCourseState> | null = null;
  private status: ConnectionStatus = 'idle';
  private token: (() => string | null) | null = null;
  private sentToken: string | null | undefined = undefined;
  private look: (() => SetAvatarMessage | null) | null = null;
  private identityOf: (() => SetIdentityMessage) | null = null;

  constructor(handlers: NetworkHandlers = {}) {
    this.handlers = handlers;
  }

  setLookProvider(provider: () => SetAvatarMessage | null): void {
    this.look = provider;
  }

  sendAvatar(message: SetAvatarMessage): void {
    this.room?.send(MessageType.SetAvatar, message);
  }

  sendIdentity(message: SetIdentityMessage): void {
    this.room?.send(MessageType.SetIdentity, message);
  }

  /** Where the portal's TOKEN comes from. Only the token is ever sent. */
  setTokenProvider(provider: () => string | null): void {
    this.token = provider;
  }

  /** Tell the server the login changed. Deduped: an unchanged token is not resent. */
  sendAuth(token: string | null): void {
    if (!this.room) return;
    if (token === this.sentToken) return;
    this.sentToken = token;
    const message: SetAuthMessage = { token };
    this.room.send(MessageType.SetAuth, message);
  }

  setDisplayProvider(provider: () => SetIdentityMessage): void {
    this.identityOf = provider;
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get roomId(): string {
    return this.room?.roomId ?? '';
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  /** The server's clock, in seconds. */
  get elapsed(): number {
    return this.room?.state?.elapsed ?? 0;
  }

  async connect(): Promise<void> {
    if (!clientConfig.serverUrl) {
      this.setStatus('error');
      throw new Error(
        'No game server is configured. Set VITE_SERVER_URL to the Colyseus ' +
          'endpoint (for example wss://your-server-host) and rebuild.',
      );
    }

    this.setStatus('connecting');
    logger.info(SCOPE, `joining "${ROOM_NAME}" at ${clientConfig.serverUrl}`);

    this.client ??= new Client(clientConfig.serverUrl);
    const playerId = resolvePlayerId();
    const attempts = JOIN_BACKOFF_MS.length + 1;
    let joinedWith: string | null = null;

    for (let attempt = 1; ; attempt += 1) {
      const token = this.token?.() ?? null;
      try {
        this.room = await this.client.joinOrCreate<NetCourseState>(ROOM_NAME, {
          playerId,
          token,
          avatar: this.look?.() ?? undefined,
          identity: this.identityOf?.() ?? undefined,
        });
        joinedWith = token;
        break;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const code = (error as { code?: unknown }).code;
        const storageDown = code === STORAGE_UNAVAILABLE;
        logger.warn(SCOPE, `join attempt ${attempt}${storageDown ? '' : `/${attempts}`} failed: ${detail}`);
        if (!storageDown && attempt >= attempts) {
          this.setStatus('error', detail);
          throw error;
        }
        const wait = JOIN_BACKOFF_MS[Math.min(attempt, JOIN_BACKOFF_MS.length) - 1] ?? 0;
        this.setStatus('connecting', storageDown ? 'the server is waiting for its database' : `attempt ${attempt + 1}/${attempts}`);
        await sleep(wait);
      }
    }

    if (!this.room) throw new Error('join produced no room');

    this.sentToken = joinedWith;
    this.bindRoom(this.room);
    this.setStatus('connected');
    logger.info(SCOPE, `joined roomId=${this.room.roomId} sessionId=${this.room.sessionId}`);
    this.handlers.onSelfJoined?.(this.room.sessionId);
    this.sendAuth(this.token?.() ?? null);
  }

  /** Report one simulated input. Deliberately NOT rate limited. */
  sendInput(message: MoveMessage): void {
    this.room?.send(MessageType.Move, message);
  }

  claimStage(stageIndex: number): void {
    const message: ClaimStageMessage = { stageIndex };
    this.room?.send(MessageType.ClaimStage, message);
  }

  claimBill(slot: number): void {
    const message: ClaimBillMessage = { slot };
    this.room?.send(MessageType.ClaimBill, message);
  }

  requestRebirth(): void {
    this.room?.send(MessageType.Rebirth, {});
  }

  buyAura(slot: number): void {
    const message: SlotMessage = { slot };
    this.room?.send(MessageType.BuyAura, message);
  }

  equipAura(slot: number): void {
    const message: SlotMessage = { slot };
    this.room?.send(MessageType.EquipAura, message);
  }

  buyUpgrade(kind: string): void {
    const message: BuyUpgradeMessage = { kind };
    this.room?.send(MessageType.BuyUpgrade, message);
  }

  hatchEgg(egg: string, count: number): void {
    const message: HatchEggMessage = { egg, count };
    this.room?.send(MessageType.HatchEgg, message);
  }

  equipPet(index: number): void {
    const message: PetIndexMessage = { index };
    this.room?.send(MessageType.EquipPet, message);
  }

  unequipPet(index: number): void {
    const message: PetIndexMessage = { index };
    this.room?.send(MessageType.UnequipPet, message);
  }

  equipBestPets(): void {
    this.room?.send(MessageType.EquipBestPets, {});
  }

  deletePet(index: number): void {
    const message: PetIndexMessage = { index };
    this.room?.send(MessageType.DeletePet, message);
  }

  requestRespawn(): void {
    this.room?.send(MessageType.RequestRespawn, {});
  }

  /** The three leaderboards, COPIED out of the schema as plain arrays. */
  get leaderboard(): LeaderboardSnapshot | null {
    const board = this.room?.state?.leaderboard;
    if (!board) return null;
    const copy = (rows: ArrayLike<NetLeaderEntry>): NetLeaderEntry[] => {
      const out: NetLeaderEntry[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (row) out.push({ handle: row.handle, name: row.name, avatarUrl: row.avatarUrl, value: row.value });
      }
      return out;
    };
    return { time: copy(board.time), wins: copy(board.wins), cash: copy(board.cash) };
  }

  /** The pickup pool, LIVE: read once a frame and drawn at once. */
  get pickups(): ArrayLike<NetPickupState> | null {
    return this.room?.state?.pickups ?? null;
  }

  async disconnect(): Promise<void> {
    await this.room?.leave(true);
    this.room = null;
    this.sentToken = undefined;
    this.setStatus('disconnected');
  }

  private bindRoom(room: Room<NetCourseState>): void {
    const $ = getStateCallbacks(room);

    $(room.state).players.onAdd((player, sessionId) => {
      this.handlers.onPlayerAdded?.(sessionId, player);
      $(player).onChange(() => {
        this.handlers.onPlayerChanged?.(sessionId, player);
      });
      // A NESTED schema's changes do not bubble to its parent.
      $(player.avatar).onChange(() => {
        this.handlers.onPlayerChanged?.(sessionId, player);
      });
    });

    $(room.state).players.onRemove((_player, sessionId) => {
      this.handlers.onPlayerRemoved?.(sessionId);
    });

    room.onMessage<RespawnMessage>(MessageType.Respawn, (message) => this.handlers.onRespawn?.(message));
    room.onMessage<StageAwardedMessage>(MessageType.StageAwarded, (message) => this.handlers.onStageAwarded?.(message));
    room.onMessage<EggHatchedMessage>(MessageType.EggHatched, (message) => this.handlers.onEggHatched?.(message));
    room.onMessage<PickupCollectedMessage>(MessageType.PickupCollected, (message) =>
      this.handlers.onPickupCollected?.(message),
    );
    room.onMessage<AuthStateMessage>(MessageType.AuthState, (message) => {
      logger.info(SCOPE, `playing as ${message.status}${message.note ? ` (${message.note})` : ''}`);
      this.handlers.onAuthState?.(message);
    });

    room.onError((code, message) => {
      logger.error(SCOPE, `room error ${code}: ${message ?? ''}`);
      this.setStatus('error', message);
    });

    room.onLeave((code) => {
      logger.warn(SCOPE, `left room (code ${code})`);
      this.setStatus('disconnected', `code ${code}`);
    });
  }

  private setStatus(status: ConnectionStatus, detail?: string): void {
    this.status = status;
    this.handlers.onStatusChange?.(status, detail);
  }
}
