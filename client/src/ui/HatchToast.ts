import { RARITY_COLOR, RARITY_LABEL, petById } from '@money/shared';
import { css } from '../config/worldVisuals.js';
import { petPortraits } from '../player/PetPortraits.js';
import { injectHudStyles } from './hudStyles.js';

/** Seconds a card stays. Must match the CSS animation. */
const LIFETIME = 3.6;

/**
 * "You hatched a Tabby Cat!" - a card with the pet's portrait that pops over
 * the middle of the screen when an egg opens, one per pet, in the rarity's
 * colour, and fades on its own.
 */
export class HatchToast {
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    injectHudStyles();
    this.root = document.createElement('div');
    this.root.className = 'me-toast';
    parent.appendChild(this.root);
  }

  show(petIds: readonly string[]): void {
    petIds.forEach((id, i) => {
      const pet = petById(id);
      if (!pet) return;
      const card = document.createElement('div');
      card.className = 'me-toast__card';
      card.style.setProperty('--rarity', css(RARITY_COLOR[pet.rarity]));
      card.style.animationDelay = `${i * 120}ms`;
      const src = petPortraits.get(pet);
      card.innerHTML =
        `<div class="me-toast__portrait">${src ? `<img src="${src}" alt="" draggable="false">` : ''}</div>` +
        `<div class="me-toast__text"><small class="aoe-font">You hatched</small><b class="aoe-font">${pet.name}</b>` +
        `<span class="aoe-font me-toast__rarity">${RARITY_LABEL[pet.rarity]} · +${Math.round(pet.boost * 100)}% Cash</span></div>`;
      this.root.appendChild(card);
      window.setTimeout(() => card.remove(), LIFETIME * 1000 + i * 120 + 50);
    });
  }

  dispose(): void {
    this.root.remove();
  }
}
