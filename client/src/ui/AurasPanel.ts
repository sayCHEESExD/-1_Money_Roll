import { AURA_TIERS, formatWins, isAuraOwned } from '@money/shared';
import { css } from '../config/worldVisuals.js';
import { ICONS } from './hudStyles.js';
import { Panel } from './Panel.js';

interface Row {
  readonly slot: number;
  readonly element: HTMLDivElement;
  readonly button: HTMLButtonElement;
}

/**
 * THE AURA MENU: the four auras as rows - a swatch, the name, the cash boost
 * and a Wins price button that becomes Equip once owned - exactly as the
 * reference frames it. Every button only ever ASKS.
 */
export class AurasPanel extends Panel {
  private readonly rows: Row[] = [];
  private wins = 0;
  private owned = 0;
  private equipped = 0;

  constructor(parent: HTMLElement, actions: { buy: (slot: number) => void; equip: (slot: number) => void }) {
    super(parent, 'auras', 'Auras', ICONS.aura);

    for (const tier of AURA_TIERS) {
      const element = document.createElement('div');
      element.className = 'aoe-row';

      const swatch = document.createElement('div');
      swatch.className = 'aoe-row__swatch';
      swatch.style.background = `radial-gradient(circle at 50% 40%, #ffffff 0%, ${css(tier.color)} 55%, ${css(tier.color)}88 100%)`;
      swatch.innerHTML = ICONS.aura;

      const text = document.createElement('div');
      text.className = 'aoe-row__text';
      const name = document.createElement('div');
      name.className = 'aoe-row__name';
      name.textContent = tier.name;
      const meta = document.createElement('div');
      meta.className = 'aoe-row__meta';
      meta.innerHTML = `${ICONS.cash} x${tier.boost} Cash Boost`;
      text.append(name, meta);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'aoe-row__buy aoe-font';
      button.addEventListener('click', () => {
        if (isAuraOwned(this.owned, tier.slot)) actions.equip(this.equipped === tier.slot ? 0 : tier.slot);
        else actions.buy(tier.slot);
      });

      element.append(swatch, text, button);
      this.body.appendChild(element);
      this.rows.push({ slot: tier.slot, element, button });
    }
    this.render();
  }

  setInventory(wins: number, owned: number, equipped: number): void {
    if (wins === this.wins && owned === this.owned && equipped === this.equipped) return;
    this.wins = wins;
    this.owned = owned;
    this.equipped = equipped;
    this.render();
  }

  /** True when an aura can be bought right now. Drives the rail badge. */
  get hasAffordable(): boolean {
    return AURA_TIERS.some((tier) => !isAuraOwned(this.owned, tier.slot) && this.wins >= tier.winsRequired);
  }

  protected override onOpened(): void {
    this.render();
  }

  private render(): void {
    for (const row of this.rows) {
      const tier = AURA_TIERS.find((entry) => entry.slot === row.slot);
      if (!tier) continue;
      const owned = isAuraOwned(this.owned, tier.slot);
      const equipped = this.equipped === tier.slot;
      row.element.classList.toggle('aoe-row--owned', owned && !equipped);
      row.element.classList.toggle('aoe-row--equipped', equipped);
      row.button.classList.toggle('aoe-row__buy--equipped', equipped);
      row.button.classList.toggle('aoe-row__buy--equip', owned && !equipped);
      if (equipped) {
        row.button.textContent = 'Equipped';
        row.button.disabled = false;
      } else if (owned) {
        row.button.textContent = 'Equip';
        row.button.disabled = false;
      } else {
        row.button.innerHTML = `${ICONS.trophy}<span>${formatWins(tier.winsRequired)}</span>`;
        row.button.disabled = this.wins < tier.winsRequired;
      }
    }
  }
}
