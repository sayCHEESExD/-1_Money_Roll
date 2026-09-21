import {
  EGGS,
  MAX_PET_STORAGE,
  MULTI_HATCH_COUNT,
  RARITY_COLOR,
  RARITY_LABEL,
  decodePets,
  eggById,
  formatWins,
  petById,
  type EggDefinition,
} from '@money/shared';
import { css } from '../config/worldVisuals.js';
import { petPortraits } from '../player/PetPortraits.js';
import { ICONS, injectHudStyles } from './hudStyles.js';

/**
 * THE EGG CARD: what appears beside an egg, as a polished gacha front.
 *
 * A wobbling egg drawn in the egg's own colours, its name and its price in
 * Wins, the six pets it can hatch as portrait cards in rarity colours with
 * their exact chances (the three commonest shown, the rare half kept as
 * silhouettes), and two big buttons: HATCH (E) and the multi-hatch (Q).
 *
 * Shown by the run controller's proximity test and hidden when the player
 * walks away. The buttons only ever ASK; the server rolls and pays, and the
 * odds printed here are the server's own table.
 */
export class EggPrompt {
  private readonly root: HTMLDivElement;
  private readonly eggArt: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly price: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly hatchButton: HTMLButtonElement;
  private readonly multiButton: HTMLButtonElement;
  private readonly hint: HTMLDivElement;

  private eggId = '';
  private wins = 0;
  private owned = 0;

  constructor(parent: HTMLElement, hatch: (egg: string, count: number) => void) {
    injectHudStyles();
    this.onHatch = hatch;

    this.root = document.createElement('div');
    this.root.className = 'me-egg';
    this.root.hidden = true;

    const head = document.createElement('div');
    head.className = 'me-egg__head';
    this.eggArt = document.createElement('div');
    this.eggArt.className = 'me-egg__egg';
    this.eggArt.innerHTML = '<span class="me-egg__spot me-egg__spot--a"></span><span class="me-egg__spot me-egg__spot--b"></span><span class="me-egg__spot me-egg__spot--c"></span><span class="me-egg__shine"></span>';
    const text = document.createElement('div');
    text.className = 'me-egg__text';
    this.title = document.createElement('div');
    this.title.className = 'me-egg__title aoe-font aoe-outline';
    this.price = document.createElement('div');
    this.price.className = 'me-egg__price aoe-font';
    text.append(this.title, this.price);
    head.append(this.eggArt, text);

    const label = document.createElement('div');
    label.className = 'me-egg__label aoe-font';
    label.innerHTML = `${ICONS.paw}<span>What can hatch</span>`;

    this.grid = document.createElement('div');
    this.grid.className = 'me-egg__grid';

    const buttons = document.createElement('div');
    buttons.className = 'me-egg__buttons';
    this.hatchButton = document.createElement('button');
    this.hatchButton.type = 'button';
    this.hatchButton.className = 'me-egg__button me-egg__button--hatch aoe-font';
    this.hatchButton.addEventListener('click', () => this.hatch(1));
    this.multiButton = document.createElement('button');
    this.multiButton.type = 'button';
    this.multiButton.className = 'me-egg__button me-egg__button--multi aoe-font';
    this.multiButton.addEventListener('click', () => this.hatch(MULTI_HATCH_COUNT));
    buttons.append(this.hatchButton, this.multiButton);

    this.hint = document.createElement('div');
    this.hint.className = 'me-egg__hint aoe-font';

    this.root.append(head, label, this.grid, buttons, this.hint);
    parent.appendChild(this.root);
  }

  private readonly onHatch: (egg: string, count: number) => void;

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** The egg to show, or '' to hide. */
  show(eggId: string): void {
    if (eggId === this.eggId) return;
    this.eggId = eggId;
    const egg = eggById(eggId);
    this.root.hidden = !egg;
    if (!egg) return;

    this.root.classList.remove('me-egg--in');
    void this.root.offsetWidth;
    this.root.classList.add('me-egg--in');

    this.eggArt.style.setProperty('--egg', css(egg.color));
    this.eggArt.style.setProperty('--spot', css(egg.spots));
    this.title.textContent = egg.name;
    this.price.innerHTML = `${ICONS.trophy}<span>${formatWins(egg.cost)} Wins</span>`;
    this.renderPool(egg);
    this.render();
  }

  setInventory(wins: number, pets: string): void {
    this.wins = wins;
    this.owned = decodePets(pets).length;
    if (this.eggId) this.render();
  }

  /** Hatch once. Bound to E. */
  hatchOne(): void {
    if (!this.hatchButton.disabled) this.hatch(1);
  }

  /** Hatch the multi count. Bound to Q. */
  hatchMulti(): void {
    if (!this.multiButton.disabled) this.hatch(MULTI_HATCH_COUNT);
  }

  dispose(): void {
    this.root.remove();
  }

  private hatch(count: number): void {
    if (!this.eggId) return;
    this.onHatch(this.eggId, count);
    this.root.classList.remove('me-egg--crack');
    void this.root.offsetWidth;
    this.root.classList.add('me-egg--crack');
  }

  private renderPool(egg: EggDefinition): void {
    this.grid.replaceChildren();
    egg.pool.forEach((odds, i) => {
      const pet = petById(odds.petId);
      if (!pet) return;
      // The three commonest pets are shown; the rare half stays a mystery.
      const secret = i >= 3;
      const card = document.createElement('div');
      card.className = `me-egg__card${secret ? ' me-egg__card--secret' : ''}`;
      card.style.setProperty('--rarity', css(RARITY_COLOR[pet.rarity]));
      card.style.animationDelay = `${i * 45}ms`;
      const portrait = document.createElement('div');
      portrait.className = 'me-egg__portrait';
      const src = petPortraits.get(pet);
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = secret ? 'Unknown pet' : pet.name;
        img.draggable = false;
        portrait.appendChild(img);
      } else {
        portrait.textContent = secret ? '?' : pet.name.charAt(0);
      }
      if (secret) {
        const mark = document.createElement('span');
        mark.className = 'me-egg__secret aoe-font';
        mark.textContent = '?';
        portrait.appendChild(mark);
      }
      const name = document.createElement('div');
      name.className = 'me-egg__name aoe-font';
      name.textContent = secret ? '???' : pet.name;
      const rarity = document.createElement('div');
      rarity.className = 'me-egg__rarity aoe-font';
      rarity.textContent = RARITY_LABEL[pet.rarity];
      const chance = document.createElement('div');
      chance.className = 'me-egg__chance aoe-font';
      chance.textContent = `${odds.chance}%`;
      card.append(portrait, name, rarity, chance);
      this.grid.appendChild(card);
    });
  }

  private render(): void {
    const egg = eggById(this.eggId);
    if (!egg) return;
    const room = MAX_PET_STORAGE - this.owned;
    const one = this.wins >= egg.cost && room >= 1;
    const many = this.wins >= egg.cost * MULTI_HATCH_COUNT && room >= MULTI_HATCH_COUNT;
    this.hatchButton.innerHTML = `<kbd>E</kbd><b>HATCH</b><small>${ICONS.trophy}${formatWins(egg.cost)}</small>`;
    this.hatchButton.disabled = !one;
    this.multiButton.innerHTML = `<kbd>Q</kbd><b>HATCH x${MULTI_HATCH_COUNT}</b><small>${ICONS.trophy}${formatWins(egg.cost * MULTI_HATCH_COUNT)}</small>`;
    this.multiButton.disabled = !many;
    this.hint.textContent =
      room < 1
        ? `Storage full (${MAX_PET_STORAGE}/${MAX_PET_STORAGE}). Delete a pet to hatch.`
        : this.wins < egg.cost
          ? `Need ${formatWins(egg.cost - this.wins)} more Wins`
          : `${formatWins(this.wins)} Wins · ${room} storage slot${room === 1 ? '' : 's'} free`;
    this.hint.classList.toggle('me-egg__hint--warn', room < 1 || this.wins < egg.cost);
  }
}

export { EGGS };
