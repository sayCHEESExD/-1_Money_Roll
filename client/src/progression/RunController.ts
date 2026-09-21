import {
  BILLS,
  EGGS,
  EGG_PROMPT_RADIUS,
  billForSlot,
  billPadAt,
  ownsBill,
  winPadAt,
  type WorldCollision,
} from '@money/shared';
import type { LocalPlayer } from '../player/LocalPlayer.js';

/** Seconds between two requests of the same kind. */
const REQUEST_COOLDOWN = 0.5;

export interface RunActions {
  claimStage(stageIndex: number): void;
  claimBill(slot: number): void;
}

/**
 * Turns the player's position into REQUESTS.
 *
 * The one job: notice that the player has entered a trigger volume and ask
 * the server about it. Every actual decision is made server-side against the
 * transform the server itself simulated. The single exception is DEATH, and
 * it is a prediction: the client starts the fall the moment it can see the
 * player is in the lava, and the server still decides.
 */
export class RunController {
  private readonly collision: WorldCollision;
  private readonly actions: RunActions;

  private stageCooldown = 0;
  private padCooldown = 0;

  private ownedBills = 0;
  private wins = 0;

  /** The egg the player is standing beside, or ''. */
  nearEgg = '';

  constructor(collision: WorldCollision, actions: RunActions) {
    this.collision = collision;
    this.actions = actions;
  }

  /** Mirror the replicated wallet and inventory. Gating only. */
  setInventory(ownedBills: number, wins: number): void {
    this.ownedBills = ownedBills;
    this.wins = wins;
  }

  update(delta: number, player: LocalPlayer): void {
    this.stageCooldown = Math.max(0, this.stageCooldown - delta);
    this.padCooldown = Math.max(0, this.padCooldown - delta);

    if (player.isDying) {
      this.nearEgg = '';
      return;
    }

    const { x, y, z } = player.position;

    if (this.collision.hasFallen(x, y, z)) {
      player.beginDeath();
      return;
    }

    const stage = winPadAt(x, y, z);
    if (stage && this.stageCooldown === 0) {
      this.stageCooldown = REQUEST_COOLDOWN;
      this.actions.claimStage(stage.index);
    }

    const slot = billPadAt(x, y, z);
    if (slot !== null && this.padCooldown === 0) {
      // Asking for a bill already owned, or one the player plainly cannot
      // afford, would be a request the server refuses every frame.
      const bill = billForSlot(slot);
      if (BILLS.length > 0 && !ownsBill(this.ownedBills, slot) && this.wins >= bill.winsRequired) {
        this.padCooldown = REQUEST_COOLDOWN;
        this.actions.claimBill(slot);
      }
    }

    let near = '';
    let best = EGG_PROMPT_RADIUS;
    for (const egg of EGGS) {
      const distance = Math.hypot(x - egg.x, z - egg.z);
      if (distance < best) {
        best = distance;
        near = egg.id;
      }
    }
    this.nearEgg = near;
  }
}
