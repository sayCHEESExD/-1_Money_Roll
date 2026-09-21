import { RARITY_COLOR, RARITY_LABEL, petById } from '@money/shared';
import { css } from '../config/worldVisuals.js';
import { injectHudStyles } from './hudStyles.js';

/** Seconds a card stays. Must match the CSS animation. */
const LIFETIME = 2.6;

/**
 * "You hatched a Dalmatian!" - a card that pops over the middle of the
 * screen when an egg opens, one per pet, and fades on its own.
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
    for (const id of petIds) {
      const pet = petById(id);
      if (!pet) continue;
      const card = document.createElement('div');
      card.className = 'me-toast__card';
      card.innerHTML = `You hatched a <b style="color:${css(RARITY_COLOR[pet.rarity])}">${pet.name}</b>! <small>(${RARITY_LABEL[pet.rarity]} · +${Math.round(pet.boost * 100)}% Cash)</small>`;
      this.root.appendChild(card);
      window.setTimeout(() => card.remove(), LIFETIME * 1000 + 50);
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
