import { EGGS, MAX_PET_STORAGE, MULTI_HATCH_COUNT, RARITY_COLOR, decodePets, eggById, formatWins, petById } from '@money/shared';
import { css } from '../config/worldVisuals.js';
import { ICONS, injectHudStyles } from './hudStyles.js';

/**
 * THE EGG PROMPT: the compact card that appears beside an egg, as the
 * reference frames it - the egg's name and price, six pets with their odds
 * (the rarer ones as silhouettes) and two buttons: HATCH (E) and MULTI (Q).
 *
 * Shown by the run controller's proximity test and hidden when the player
 * walks away. The buttons only ever ASK; the server rolls and pays.
 */
export class EggPrompt {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly hatchButton: HTMLButtonElement;
  private readonly multiButton: HTMLButtonElement;

  private eggId = '';
  private wins = 0;
  private owned = 0;

  constructor(parent: HTMLElement, hatch: (egg: string, count: number) => void) {
    injectHudStyles();

    this.root = document.createElement('div');
    this.root.className = 'me-egg';
    this.root.hidden = true;

    this.title = document.createElement('div');
    this.title.className = 'me-egg__title aoe-font aoe-outline';
    this.grid = document.createElement('div');
    this.grid.className = 'me-egg__grid';

    const buttons = document.createElement('div');
    buttons.className = 'me-egg__buttons';
    this.hatchButton = document.createElement('button');
    this.hatchButton.type = 'button';
    this.hatchButton.className = 'me-egg__button me-egg__button--hatch';
    this.hatchButton.addEventListener('click', () => this.hatch(1));
    this.multiButton = document.createElement('button');
    this.multiButton.type = 'button';
    this.multiButton.className = 'me-egg__button me-egg__button--multi';
    this.multiButton.addEventListener('click', () => this.hatch(MULTI_HATCH_COUNT));
    buttons.append(this.hatchButton, this.multiButton);

    this.root.append(this.title, this.grid, buttons);
    parent.appendChild(this.root);
    this.onHatch = hatch;
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

    this.title.innerHTML = `<span>${egg.name}</span><small>${ICONS.trophy} ${formatWins(egg.cost)}</small>`;
    this.grid.replaceChildren();
    egg.pool.forEach((odds, i) => {
      const pet = petById(odds.petId);
      const cell = document.createElement('div');
      cell.className = 'me-egg__cell aoe-font';
      const face = document.createElement('div');
      // The three commonest pets are shown; the rare half stays a mystery.
      const secret = i >= 3;
      face.className = `me-egg__pet${secret ? ' me-egg__pet--secret' : ''}`;
      if (pet && !secret) {
        face.style.background = `linear-gradient(180deg, ${css(pet.color)}, ${css(pet.accent)})`;
        face.textContent = pet.name.charAt(0);
      } else {
        face.textContent = '?';
      }
      const chance = document.createElement('b');
      chance.textContent = `${odds.chance}%`;
      chance.style.color = pet && !secret ? css(RARITY_COLOR[pet.rarity]) : '#8fa0c8';
      cell.append(face, chance);
      this.grid.appendChild(cell);
    });
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
  }

  private render(): void {
    const egg = eggById(this.eggId);
    if (!egg) return;
    const room = MAX_PET_STORAGE - this.owned;
    this.hatchButton.innerHTML = `<b>E</b><span>HATCH · ${formatWins(egg.cost)}</span>`;
    this.hatchButton.disabled = this.wins < egg.cost || room < 1;
    this.multiButton.innerHTML = `<b>Q</b><span>MULTI x${MULTI_HATCH_COUNT} · ${formatWins(egg.cost * MULTI_HATCH_COUNT)}</span>`;
    this.multiButton.disabled = this.wins < egg.cost * MULTI_HATCH_COUNT || room < MULTI_HATCH_COUNT;
  }
}

export { EGGS };
