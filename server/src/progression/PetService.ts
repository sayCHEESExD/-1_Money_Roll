import {
  COURSE,
  EGG_HATCH_RADIUS,
  MAX_PET_STORAGE,
  MULTI_HATCH_COUNT,
  bestPetIndices,
  decodeIndices,
  decodePets,
  eggById,
  encodeIndices,
  encodePets,
  maxPetSlots,
  rollPet,
  type EggDefinition,
} from '@money/shared';
import type { CashService } from './CashService.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { wallet } from './Wallet.js';

const HATCH_COOLDOWN_MS = 300;

export type HatchResult =
  | { readonly ok: true; readonly egg: EggDefinition; readonly pets: string[] }
  | {
      readonly ok: false;
      readonly reason: 'unknown-egg' | 'bad-count' | 'not-at-egg' | 'storage-full' | 'too-few-wins' | 'cooldown';
    };

export type PetResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'bad-index' | 'already' | 'slots-full' | 'not-equipped' };

/**
 * Server authority over pets: hatching, equipping and the slot limit.
 *
 * The inventory is a list of pet IDS and the equipped set is a list of
 * INDICES into it, both replicated as strings. Every rule is enforced here
 * against server state: an egg is hatched only beside it, only for Wins the
 * player holds, only into storage that has room; a pet is equipped only if
 * it is owned and only while the slot limit - three plus the Max Pets
 * upgrades - has room.
 */
export class PetService {
  private readonly lastHatchAt = new Map<string, number>();

  constructor(private readonly random: () => number = Math.random) {}

  initialise(player: PlayerState): void {
    this.lastHatchAt.delete(player.sessionId);
    this.sanitise(player);
  }

  forget(sessionId: string): void {
    this.lastHatchAt.delete(sessionId);
  }

  hatch(player: PlayerState, eggId: unknown, count: unknown, cash: CashService): HatchResult {
    const egg = typeof eggId === 'string' ? eggById(eggId) : undefined;
    if (!egg) return { ok: false, reason: 'unknown-egg' };
    const times = Number(count);
    if (times !== 1 && times !== MULTI_HATCH_COUNT) return { ok: false, reason: 'bad-count' };

    // THE position check, against the transform the server itself simulated.
    const dx = player.x - egg.x;
    const dz = player.z - egg.z;
    if (Math.hypot(dx, dz) > EGG_HATCH_RADIUS || player.y < COURSE.floorY - 1.5 || player.y > COURSE.floorY + 4) {
      return { ok: false, reason: 'not-at-egg' };
    }

    const owned = decodePets(player.pets);
    if (owned.length + times > MAX_PET_STORAGE) return { ok: false, reason: 'storage-full' };
    const price = egg.cost * times;
    if (!wallet.holds(player, price)) return { ok: false, reason: 'too-few-wins' };

    const now = Date.now();
    if (now - (this.lastHatchAt.get(player.sessionId) ?? 0) < HATCH_COOLDOWN_MS) {
      return { ok: false, reason: 'cooldown' };
    }
    if (!wallet.spend(player, price)) return { ok: false, reason: 'too-few-wins' };
    this.lastHatchAt.set(player.sessionId, now);

    const hatched: string[] = [];
    for (let i = 0; i < times; i += 1) hatched.push(rollPet(egg, this.random).id);
    player.pets = encodePets([...owned, ...hatched]);
    // A new pet follows at once while a slot is free; a full team is left as
    // the player arranged it, and the Pets menu says a better set exists.
    const worn = decodeIndices(player.equippedPets);
    const slots = maxPetSlots(player.petSlotUpgrades);
    for (let i = 0; i < hatched.length && worn.length < slots; i += 1) worn.push(owned.length + i);
    player.equippedPets = encodeIndices(worn);
    cash.syncDerived(player);
    return { ok: true, egg, pets: hatched };
  }

  equip(player: PlayerState, index: unknown, cash: CashService): PetResult {
    const owned = decodePets(player.pets);
    const at = Number(index);
    if (!Number.isInteger(at) || at < 0 || at >= owned.length) return { ok: false, reason: 'bad-index' };
    const equipped = decodeIndices(player.equippedPets);
    if (equipped.includes(at)) return { ok: false, reason: 'already' };
    if (equipped.length >= maxPetSlots(player.petSlotUpgrades)) return { ok: false, reason: 'slots-full' };
    equipped.push(at);
    player.equippedPets = encodeIndices(equipped);
    cash.syncDerived(player);
    return { ok: true };
  }

  unequip(player: PlayerState, index: unknown, cash: CashService): PetResult {
    const at = Number(index);
    const equipped = decodeIndices(player.equippedPets);
    const where = equipped.indexOf(at);
    if (where < 0) return { ok: false, reason: 'not-equipped' };
    equipped.splice(where, 1);
    player.equippedPets = encodeIndices(equipped);
    cash.syncDerived(player);
    return { ok: true };
  }

  /** Wear the best pets owned, up to the slot limit. */
  equipBest(player: PlayerState, cash: CashService): void {
    const owned = decodePets(player.pets);
    player.equippedPets = encodeIndices(bestPetIndices(owned, maxPetSlots(player.petSlotUpgrades)));
    cash.syncDerived(player);
  }

  /** Remove a pet for good, keeping the equipped indices pointing at the right pets. */
  delete(player: PlayerState, index: unknown, cash: CashService): PetResult {
    const owned = decodePets(player.pets);
    const at = Number(index);
    if (!Number.isInteger(at) || at < 0 || at >= owned.length) return { ok: false, reason: 'bad-index' };
    owned.splice(at, 1);
    const equipped = decodeIndices(player.equippedPets)
      .filter((i) => i !== at)
      .map((i) => (i > at ? i - 1 : i));
    player.pets = encodePets(owned);
    player.equippedPets = encodeIndices(equipped);
    cash.syncDerived(player);
    return { ok: true };
  }

  /** Drop equipped indices that point nowhere, duplicates, and anything past the slot limit. */
  sanitise(player: PlayerState): void {
    const owned = decodePets(player.pets);
    const seen = new Set<number>();
    const equipped = decodeIndices(player.equippedPets).filter((i) => {
      if (i >= owned.length || seen.has(i)) return false;
      seen.add(i);
      return true;
    });
    const kept = equipped.slice(0, maxPetSlots(player.petSlotUpgrades));
    const encodedPets = encodePets(owned);
    const encodedEquipped = encodeIndices(kept);
    if (player.pets !== encodedPets) player.pets = encodedPets;
    if (player.equippedPets !== encodedEquipped) player.equippedPets = encodedEquipped;
  }
}
