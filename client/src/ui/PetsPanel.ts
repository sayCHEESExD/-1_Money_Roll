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
import { petPortraits } from '../player/PetPortraits.js';
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
 * THE PETS MENU: a header strip with the two counters (worn of slots,
 * owned of storage) and Equip Best, then every pet owned as a portrait card
 * in its rarity's colour - name, rarity, cash boost, an EQUIPPED ribbon on
 * the worn ones and one button on each card that equips or unequips it.
 * Delete Mode turns the buttons red. Empty, it says so.
 *
 * Every card only ever ASKS. The server owns the inventory and the slot
 * limit; this renders whatever comes back.
 */
export class PetsPanel extends Panel {
  private readonly grid: HTMLDivElement;
  private readonly empty: HTMLDivElement;
  private readonly wornCount: HTMLSpanElement;
  private readonly ownedCount: HTMLSpanElement;
  private readonly wornFill: HTMLDivElement;
  private readonly boostTotal: HTMLSpanElement;
  private readonly bestButton: HTMLButtonElement;
  private readonly deleteButton: HTMLButtonElement;

  private pets = '';
  private equipped = '';
  private slotUpgrades = 0;
  private deleteMode = false;

  constructor(parent: HTMLElement, private readonly actions: PetActions) {
    super(parent, 'pets', 'Pets', ICONS.paw);

    // The header strip: counters, the total boost, and Equip Best.
    const strip = document.createElement('div');
    strip.className = 'me-pets__strip';

    const worn = document.createElement('div');
    worn.className = 'me-pets__stat';
    worn.innerHTML = `<span class="me-pets__stat-icon">${ICONS.paw}</span>`;
    const wornText = document.createElement('div');
    wornText.className = 'me-pets__stat-text';
    const wornLabel = document.createElement('small');
    wornLabel.textContent = 'Equipped';
    this.wornCount = document.createElement('span');
    const wornBar = document.createElement('div');
    wornBar.className = 'me-pets__bar';
    this.wornFill = document.createElement('div');
    this.wornFill.className = 'me-pets__bar-fill';
    wornBar.appendChild(this.wornFill);
    wornText.append(wornLabel, this.wornCount, wornBar);
    worn.append(wornText, this.plus('More slots: Upgrades'));

    const owned = document.createElement('div');
    owned.className = 'me-pets__stat';
    owned.innerHTML = `<span class="me-pets__stat-icon">${ICONS.bag}</span>`;
    const ownedText = document.createElement('div');
    ownedText.className = 'me-pets__stat-text';
    const ownedLabel = document.createElement('small');
    ownedLabel.textContent = 'Storage';
    this.ownedCount = document.createElement('span');
    ownedText.append(ownedLabel, this.ownedCount);
    owned.append(ownedText);

    const boost = document.createElement('div');
    boost.className = 'me-pets__stat me-pets__stat--boost';
    boost.innerHTML = `<span class="me-pets__stat-icon">${ICONS.cash}</span>`;
    const boostText = document.createElement('div');
    boostText.className = 'me-pets__stat-text';
    const boostLabel = document.createElement('small');
    boostLabel.textContent = 'Pet boost';
    this.boostTotal = document.createElement('span');
    boostText.append(boostLabel, this.boostTotal);
    boost.append(boostText);

    strip.append(worn, owned, boost);

    this.empty = document.createElement('div');
    this.empty.className = 'me-pets__empty';
    this.empty.innerHTML = `${ICONS.paw}<div class="aoe-font aoe-outline">No pets yet</div><small class="aoe-font">Walk up to an egg by the meadow and press E to hatch one.</small>`;

    this.grid = document.createElement('div');
    this.grid.className = 'me-pets__grid';

    const foot = document.createElement('div');
    foot.className = 'me-pets__foot';
    this.bestButton = this.button('Equip Best', 'aoe-row__buy--equip', () => this.actions.equipBest());
    this.bestButton.innerHTML = `${ICONS.paw}<span>Equip Best</span>`;
    this.deleteButton = this.button('Delete Mode', 'aoe-row__buy--danger', () => {
      this.deleteMode = !this.deleteMode;
      this.render();
    });
    foot.append(this.bestButton, this.deleteButton);

    this.body.append(strip, this.empty, this.grid, foot);
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

  private plus(title: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'me-pets__plus aoe-font';
    button.textContent = '+';
    button.title = title;
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
    this.wornCount.textContent = `${worn.length} / ${slots}`;
    this.wornFill.style.width = `${Math.min(1, worn.length / Math.max(1, slots)) * 100}%`;
    this.ownedCount.textContent = `${owned.length} / ${MAX_PET_STORAGE}`;
    let total = 0;
    for (const index of worn) {
      const pet = owned[index] ? petById(owned[index] as string) : undefined;
      if (pet) total += pet.boost;
    }
    this.boostTotal.textContent = `+${Math.round(total * 100)}% Cash`;
    this.bestButton.disabled = !this.hasBetter;
    this.deleteButton.classList.toggle('aoe-row__buy--equipped', this.deleteMode);
    this.deleteButton.textContent = this.deleteMode ? 'Done' : 'Delete Mode';
    this.grid.classList.toggle('me-pets__grid--delete', this.deleteMode);

    this.grid.replaceChildren();
    owned.forEach((id, index) => {
      const pet = petById(id);
      if (!pet) return;
      const isWorn = worn.includes(index);
      const full = !isWorn && worn.length >= slots;

      const card = document.createElement('div');
      card.className = `me-pet${isWorn ? ' me-pet--equipped' : ''}`;
      card.style.setProperty('--rarity', css(RARITY_COLOR[pet.rarity]));
      card.style.animationDelay = `${Math.min(index, 12) * 30}ms`;

      if (isWorn) {
        const ribbon = document.createElement('div');
        ribbon.className = 'me-pet__ribbon aoe-font';
        ribbon.textContent = 'EQUIPPED';
        card.appendChild(ribbon);
      }

      const portrait = document.createElement('div');
      portrait.className = 'me-pet__portrait';
      const src = petPortraits.get(pet);
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = pet.name;
        img.draggable = false;
        portrait.appendChild(img);
      } else {
        portrait.textContent = pet.name.charAt(0);
      }

      const name = document.createElement('div');
      name.className = 'me-pet__name aoe-font';
      name.textContent = pet.name;
      const rarity = document.createElement('div');
      rarity.className = 'me-pet__rarity aoe-font';
      rarity.textContent = RARITY_LABEL[pet.rarity];
      const boost = document.createElement('div');
      boost.className = 'me-pet__boost aoe-font';
      boost.innerHTML = `${ICONS.cash}<span>+${Math.round(pet.boost * 100)}% Cash</span>`;

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'me-pet__action aoe-font';
      if (this.deleteMode) {
        action.textContent = 'Delete';
        action.classList.add('me-pet__action--delete');
      } else if (isWorn) {
        action.textContent = 'Unequip';
        action.classList.add('me-pet__action--unequip');
      } else {
        action.textContent = full ? 'Slots full' : 'Equip';
        action.classList.add('me-pet__action--equip');
        action.disabled = full;
      }
      action.addEventListener('click', () => {
        if (this.deleteMode) this.actions.remove(index);
        else if (isWorn) this.actions.unequip(index);
        else this.actions.equip(index);
      });

      card.append(portrait, name, rarity, boost, action);
      this.grid.appendChild(card);
    });
  }
}
