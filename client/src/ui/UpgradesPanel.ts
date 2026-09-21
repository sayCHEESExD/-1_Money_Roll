import { UPGRADES, formatWins, maxPetSlots, type UpgradeKind } from '@money/shared';
import { ICONS } from './hudStyles.js';
import { Panel } from './Panel.js';

interface Row {
  readonly kind: UpgradeKind;
  readonly owned: HTMLDivElement;
  readonly button: HTMLButtonElement;
}

/**
 * THE UPGRADES MENU: Walkspeed and Max Pets, each a row with its icon, its
 * effect, how many are owned, and a Wins price button - as the reference
 * frames it. Every button only ever ASKS; the server takes the payment.
 */
export class UpgradesPanel extends Panel {
  private readonly rows: Row[] = [];
  private wins = 0;
  private speedUpgrades = 0;
  private petSlotUpgrades = 0;

  constructor(parent: HTMLElement, buy: (kind: UpgradeKind) => void) {
    super(parent, 'upgrades', 'Upgrades', ICONS.arrow);

    for (const upgrade of UPGRADES) {
      const element = document.createElement('div');
      element.className = 'aoe-row';

      const swatch = document.createElement('div');
      swatch.className = 'aoe-row__swatch';
      swatch.innerHTML = upgrade.kind === 'walkspeed' ? ICONS.shoe : ICONS.paw;

      const text = document.createElement('div');
      text.className = 'aoe-row__text';
      const name = document.createElement('div');
      name.className = 'aoe-row__name';
      name.textContent = upgrade.name;
      const meta = document.createElement('div');
      meta.className = 'aoe-row__meta';
      meta.textContent = upgrade.effect;
      const owned = document.createElement('div');
      owned.className = 'aoe-row__meta aoe-row__meta--owned';
      text.append(name, meta, owned);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'aoe-row__buy aoe-font';
      button.innerHTML = `${ICONS.trophy}<span>${formatWins(upgrade.cost)}</span>`;
      button.addEventListener('click', () => buy(upgrade.kind));

      element.append(swatch, text, button);
      this.body.appendChild(element);
      this.rows.push({ kind: upgrade.kind, owned, button });
    }
    this.render();
  }

  setInventory(wins: number, speedUpgrades: number, petSlotUpgrades: number): void {
    if (wins === this.wins && speedUpgrades === this.speedUpgrades && petSlotUpgrades === this.petSlotUpgrades) return;
    this.wins = wins;
    this.speedUpgrades = speedUpgrades;
    this.petSlotUpgrades = petSlotUpgrades;
    this.render();
  }

  /** True when something can be bought right now. Drives the rail badge. */
  get hasAffordable(): boolean {
    return UPGRADES.some((upgrade) => this.wins >= upgrade.cost);
  }

  protected override onOpened(): void {
    this.render();
  }

  private render(): void {
    for (const row of this.rows) {
      const upgrade = UPGRADES.find((entry) => entry.kind === row.kind);
      if (!upgrade) continue;
      row.owned.textContent =
        row.kind === 'walkspeed'
          ? `Owned: ${this.speedUpgrades}`
          : `Owned: ${this.petSlotUpgrades} (${maxPetSlots(this.petSlotUpgrades)} slots)`;
      row.button.disabled = this.wins < upgrade.cost;
    }
  }
}
