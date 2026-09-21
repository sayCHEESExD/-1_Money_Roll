import { bestOwnedBill, billBit, billForSlot, billPadAt, ownsBill, type BillDefinition } from '@money/shared';
import type { CashService } from './CashService.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { wallet } from './Wallet.js';

export interface BillClaim {
  readonly granted: boolean;
  readonly bill: BillDefinition | null;
  readonly reason?: 'unknown-slot' | 'not-on-pad' | 'already-owned' | 'too-few-wins' | 'cooldown';
}

/** Milliseconds between two accepted purchases from one player. Spam only. */
const CLAIM_COOLDOWN_MS = 250;

/**
 * Server authority over the cash bills.
 *
 * Buying is a DELIBERATE ACT: the player walks onto the bill's pad in the
 * spawn area. The position is checked against the transform the server
 * itself simulated, the Wins are SPENT, and the best bill owned is always the
 * one equipped - so a purchase can never be a downgrade and there is no
 * separate "equip bill" request.
 */
export class BillService {
  private readonly lastClaimAt = new Map<string, number>();

  initialise(player: PlayerState): void {
    this.lastClaimAt.set(player.sessionId, 0);
    this.equipBest(player);
  }

  forget(sessionId: string): void {
    this.lastClaimAt.delete(sessionId);
  }

  claim(player: PlayerState, slot: number, cash: CashService): BillClaim {
    const requested = Math.floor(slot);
    const bill = billForSlot(requested);
    if (bill.slot !== requested) return { granted: false, bill: null, reason: 'unknown-slot' };

    if (billPadAt(player.x, player.y, player.z) !== bill.slot) {
      return { granted: false, bill, reason: 'not-on-pad' };
    }
    if (ownsBill(player.ownedBills, bill.slot)) return { granted: false, bill, reason: 'already-owned' };
    if (!wallet.holds(player, bill.winsRequired)) return { granted: false, bill, reason: 'too-few-wins' };

    const now = Date.now();
    if (now - (this.lastClaimAt.get(player.sessionId) ?? 0) < CLAIM_COOLDOWN_MS) {
      return { granted: false, bill, reason: 'cooldown' };
    }
    // BOUGHT: the Wins leave the wallet. Last, so a refusal above costs nothing.
    if (!wallet.spend(player, bill.winsRequired)) return { granted: false, bill, reason: 'too-few-wins' };

    player.ownedBills |= billBit(bill.slot);
    this.lastClaimAt.set(player.sessionId, now);
    this.equipBest(player);
    cash.syncDerived(player);
    return { granted: true, bill };
  }

  /** Equip the best bill owned. Never a downgrade. */
  equipBest(player: PlayerState): void {
    player.billSlot = bestOwnedBill(player.ownedBills).slot;
  }
}
