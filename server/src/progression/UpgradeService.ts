import { MAX_UPGRADE_LEVELS, upgradeByKind, type UpgradeDefinition } from '@money/shared';
import type { CashService } from './CashService.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { wallet } from './Wallet.js';

const BUY_COOLDOWN_MS = 250;

export type BuyUpgradeResult =
  | { readonly ok: true; readonly upgrade: UpgradeDefinition; readonly level: number }
  | { readonly ok: false; readonly reason: 'unknown-upgrade' | 'too-few-wins' | 'maxed' | 'cooldown' };

/**
 * Server authority over the Upgrades menu: Walkspeed (+2 speed, 5K Wins) and
 * Max Pets (+1 pet equip, 1M Wins). Each purchase is one level, paid in Wins,
 * counted on the profile; the movement profile and the pet slot limit are
 * derived from the counts by the shared formulas.
 */
export class UpgradeService {
  private readonly lastBuyAt = new Map<string, number>();

  initialise(player: PlayerState): void {
    this.lastBuyAt.delete(player.sessionId);
  }

  forget(sessionId: string): void {
    this.lastBuyAt.delete(sessionId);
  }

  buy(player: PlayerState, kind: unknown, cash: CashService): BuyUpgradeResult {
    const upgrade = typeof kind === 'string' ? upgradeByKind(kind) : undefined;
    if (!upgrade) return { ok: false, reason: 'unknown-upgrade' };

    const current = upgrade.kind === 'walkspeed' ? player.speedUpgrades : player.petSlotUpgrades;
    if (current >= MAX_UPGRADE_LEVELS) return { ok: false, reason: 'maxed' };
    if (!wallet.holds(player, upgrade.cost)) return { ok: false, reason: 'too-few-wins' };

    const now = Date.now();
    if (now - (this.lastBuyAt.get(player.sessionId) ?? 0) < BUY_COOLDOWN_MS) {
      return { ok: false, reason: 'cooldown' };
    }
    if (!wallet.spend(player, upgrade.cost)) return { ok: false, reason: 'too-few-wins' };

    this.lastBuyAt.set(player.sessionId, now);
    if (upgrade.kind === 'walkspeed') player.speedUpgrades = current + 1;
    else player.petSlotUpgrades = current + 1;
    cash.syncDerived(player);
    return { ok: true, upgrade, level: current + 1 };
  }
}
