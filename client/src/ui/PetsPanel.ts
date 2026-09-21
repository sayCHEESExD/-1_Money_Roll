import {
  MAX_PET_STORAGE,
  RARITY_COLOR,
  RARITY_LABEL,
  bestPetIndices,
  decodeIndices,
  decodePets,
  maxPetSlots,
  petById,
} from '@money/shared';
import { css } from '../config/worldVisuals.js';
import { ICONS } from './hudStyles.js';
import { Panel } from './Panel.js';

export interface PetActions {
  equip(index: number): void;
  unequip(index: number): void;
  equipBest(): void;
  remove(index: number): void;
  openUpgrades(): void;
}

/**
 * THE PETS MENU: every pet owned as a card, the worn ones lit, with Equip
 * Best, the two counters ("worn / slots" and "owned / storage", each with a
 * plus that opens the Upgrades menu) and a Delete Mode toggle, exactly as the
 * reference frames it. Empty, it says so.
 *
 * Every card only ever ASKS. The server owns the inventory and the slot
 * limit; this renders whatever comes back.
 */
export class PetsPanel extends Panel {
  private readonly grid: HTMLDivElement;
  private readonly empty: HTMLDivElement;
  private readonly wornCount: HTMLSpanElement;
  private readonly ownedCount: HTMLSpanElement;
  private readonly bestButton: HTMLButtonElement;
  private readonly deleteButton: HTMLButtonElement;

  private pets = '';
  private equipped = '';
  private slotUpgrades = 0;
  private deleteMode = false;

  constructor(parent: HTMLElement, private readonly actions: PetActions) {
    super(parent, 'pets', 'Pets', ICONS.paw);

    this.empty = document.createElement('div');
    this.empty.className = 'aoe-panel__empty aoe-font aoe-outline';
    this.empty.textContent = 'There is nothing... 😴';

    this.grid = document.createElement('div');
    this.grid.className = 'me-pets__grid';

    const foot = document.createElement('div');
    foot.className = 'me-pets__foot';

    this.bestButton = this.button('Equip Best', 'aoe-row__buy--equip', () => this.actions.equipBest());

    const counts = document.createElement('div');
    counts.style.display = 'flex';
    counts.style.gap = '8px';
    const worn = document.createElement('div');
    worn.className = 'me-pets__count aoe-font';
    this.wornCount = document.createElement('span');
    worn.innerHTML = ICONS.paw;
    worn.append(this.wornCount, this.plus());
    const owned = document.createElement('div');
    owned.className = 'me-pets__count aoe-font';
    this.ownedCount = document.createElement('span');
    owned.innerHTML = ICONS.bag;
    owned.append(this.ownedCount, this.plus());
    counts.append(worn, owned);

    this.deleteButton = this.button('Delete Mode', 'aoe-row__buy--danger', () => {
      this.deleteMode = !this.deleteMode;
      this.render();
    });

    foot.append(this.bestButton, counts, this.deleteButton);
    this.body.append(this.empty, this.grid, foot);
    this.render();
  }

  setInventory(pets: string, equipped: string, slotUpgrades: number): void {
    if (pets === this.pets && equipped === this.equipped && slotUpgrades === this.slotUpgrades) return;
    this.pets = pets;
    this.equipped = equipped;
    this.slotUpgrades = slotUpgrades;
    this.render();
  }

  /** True when a better set could be worn than is worn now. Drives the rail badge. */
  get hasBetter(): boolean {
    const owned = decodePets(this.pets);
    const worn = decodeIndices(this.equipped);
    const best = bestPetIndices(owned, maxPetSlots(this.slotUpgrades));
    if (best.length === worn.length && best.every((index) => worn.includes(index))) return false;
    return best.length > 0;
  }

  protected override onOpened(): void {
    this.deleteMode = false;
    this.render();
  }

  private plus(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'me-pets__plus aoe-font';
    button.textContent = '+';
    button.title = 'Upgrades';
    button.addEventListener('click', () => this.actions.openUpgrades());
    return button;
  }

  private button(label: string, variant: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `aoe-row__buy ${variant} aoe-font`;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private render(): void {
    const owned = decodePets(this.pets);
    const worn = decodeIndices(this.equipped);
    const slots = maxPetSlots(this.slotUpgrades);

    this.empty.hidden = owned.length > 0;
    this.grid.hidden = owned.length === 0;
    this.wornCount.textContent = `${worn.length}/${slots}`;
    this.ownedCount.textContent = `${owned.length}/${MAX_PET_STORAGE}`;
    this.bestButton.disabled = !this.hasBetter;
    this.deleteButton.classList.toggle('aoe-row__buy--equipped', this.deleteMode);
    this.deleteButton.textContent = this.deleteMode ? 'Done' : 'Delete Mode';

    this.grid.replaceChildren();
    owned.forEach((id, index) => {
      const pet = petById(id);
      if (!pet) return;
      const isWorn = worn.includes(index);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `me-pet aoe-font${isWorn ? ' me-pet--equipped' : ''}${this.deleteMode ? ' me-pet--delete' : ''}`;
      const icon = document.createElement('div');
      icon.className = 'me-pet__icon';
      icon.style.background = `linear-gradient(180deg, ${css(pet.color)}, ${css(pet.accent)})`;
      icon.textContent = pet.name.charAt(0);
      const name = document.createElement('div');
      name.className = 'me-pet__name';
      name.textContent = pet.name;
      const rarity = document.createElement('div');
      rarity.className = 'me-pet__rarity';
      rarity.style.color = css(RARITY_COLOR[pet.rarity]);
      rarity.textContent = RARITY_LABEL[pet.rarity];
      const boost = document.createElement('div');
      boost.className = 'me-pet__boost';
      boost.textContent = `+${Math.round(pet.boost * 100)}% Cash`;
      const state = document.createElement('div');
      state.className = 'me-pet__state';
      state.textContent = this.deleteMode ? 'DELETE' : isWorn ? 'EQUIPPED' : worn.length >= slots ? 'SLOTS FULL' : 'EQUIP';
      card.append(icon, name, rarity, boost, state);
      card.addEventListener('click', () => {
        if (this.deleteMode) this.actions.remove(index);
        else if (isWorn) this.actions.unequip(index);
        else this.actions.equip(index);
      });
      this.grid.appendChild(card);
    });
  }
}
