import { canRebirth, rebirthMultiplier, rebirthRequiredLevel } from '@money/shared';
import type { MovementService } from '../movement/MovementService.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import type { CashService } from './CashService.js';

export type RebirthResult =
  | { readonly ok: true; readonly rebirths: number; readonly multiplier: number }
  | { readonly ok: false; readonly reason: 'not-eligible' };

/**
 * Server authority over rebirths.
 *
 * A rebirth resets LEVELS AND CASH - the level curve and the money ball - and
 * raises the cap and the cash multiplier. What it must NOT touch is anything
 * earned outside that curve: Wins, bills, auras, pets and upgrades survive.
 *
 * The client sends an empty message. Eligibility is decided here from the
 * server's own level and rebirth count.
 */
export class RebirthService {
  isEligible(player: PlayerState): boolean {
    return canRebirth(player.level, player.rebirths);
  }

  requiredLevel(player: PlayerState): number {
    return rebirthRequiredLevel(player.rebirths);
  }

  rebirth(player: PlayerState, cash: CashService, movement: MovementService): RebirthResult {
    if (!this.isEligible(player)) return { ok: false, reason: 'not-eligible' };

    player.rebirths += 1;
    // Level FOLLOWS from the level-cash total, so clearing it is what returns
    // the player to level 0. The bills go with it: THE ONE reset of the wallet.
    player.levelCash = 0;
    movement.setCash(player.sessionId, player, 0);
    cash.syncDerived(player);

    return { ok: true, rebirths: player.rebirths, multiplier: rebirthMultiplier(player.rebirths) };
  }
}
