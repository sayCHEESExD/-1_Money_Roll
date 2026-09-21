import { auraBySlot, auraMask, isAuraOwned, type AuraTier } from '@money/shared';
import type { CashService } from './CashService.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { wallet } from './Wallet.js';

const BUY_COOLDOWN_MS = 350;

export type BuyAuraResult =
  | { readonly ok: true; readonly tier: AuraTier }
  | { readonly ok: false; readonly reason: 'unknown-slot' | 'already-owned' | 'too-few-wins' | 'cooldown' };

export type EquipAuraResult =
  | { readonly ok: true; readonly slot: number }
  | { readonly ok: false; readonly reason: 'unknown-slot' | 'not-owned' };

/**
 * Server authority over auras: a Wins PRICE to buy, ownership checked to
 * equip, one worn at a time. The client sends a slot and nothing else.
 */
export class AuraService {
  private readonly lastBuyAt = new Map<string, number>();

  initialise(player: PlayerState): void {
    this.lastBuyAt.delete(player.sessionId);
    this.sanitise(player);
  }

  forget(sessionId: string): void {
    this.lastBuyAt.delete(sessionId);
  }

  buy(player: PlayerState, slot: unknown, cash: CashService): BuyAuraResult {
    const tier = this.tierOf(slot);
    if (!tier) return { ok: false, reason: 'unknown-slot' };
    if (isAuraOwned(player.ownedAuras, tier.slot)) return { ok: false, reason: 'already-owned' };
    if (!wallet.holds(player, tier.winsRequired)) return { ok: false, reason: 'too-few-wins' };

    const now = Date.now();
    if (now - (this.lastBuyAt.get(player.sessionId) ?? 0) < BUY_COOLDOWN_MS) {
      return { ok: false, reason: 'cooldown' };
    }
    if (!wallet.spend(player, tier.winsRequired)) return { ok: false, reason: 'too-few-wins' };

    this.lastBuyAt.set(player.sessionId, now);
    player.ownedAuras |= auraMask(tier.slot);
    // A fresh purchase equips itself: the player asked for it.
    player.auraSlot = tier.slot;
    cash.syncDerived(player);
    return { ok: true, tier };
  }

  equip(player: PlayerState, slot: unknown, cash: CashService): EquipAuraResult {
    if (typeof slot !== 'number' || !Number.isInteger(slot)) return { ok: false, reason: 'unknown-slot' };
    if (slot === 0) {
      player.auraSlot = 0;
      cash.syncDerived(player);
      return { ok: true, slot: 0 };
    }
    const tier = this.tierOf(slot);
    if (!tier) return { ok: false, reason: 'unknown-slot' };
    if (!isAuraOwned(player.ownedAuras, tier.slot)) return { ok: false, reason: 'not-owned' };
    player.auraSlot = tier.slot;
    cash.syncDerived(player);
    return { ok: true, slot: tier.slot };
  }

  /** Drop an equipped aura the player turns out not to own. */
  sanitise(player: PlayerState): void {
    if (player.auraSlot === 0) return;
    if (!isAuraOwned(player.ownedAuras, player.auraSlot)) player.auraSlot = 0;
  }

  private tierOf(slot: unknown): AuraTier | undefined {
    if (typeof slot !== 'number' || !Number.isInteger(slot)) return undefined;
    return auraBySlot(slot);
  }
}
