import { formatCash } from '@money/shared';
import { ICONS, injectHudStyles } from './hudStyles.js';

/**
 * The bottom-left corner: cash and Wins as two icon-and-figure rows, as the
 * reference frames them. Wins pop when the total RISES.
 */
export class CornerStats {
  private readonly root: HTMLDivElement;
  private readonly cashValue: HTMLDivElement;
  private readonly winsValue: HTMLDivElement;
  private lastCash = -1;
  private lastWins = -1;
  private popTimer = 0;

  constructor(parent: HTMLElement) {
    injectHudStyles();
    injectStyles();

    this.root = document.createElement('div');
    this.root.className = 'me-corner';

    const cash = document.createElement('div');
    cash.className = 'me-corner__row';
    cash.innerHTML = `<span class="me-corner__icon">${ICONS.cash}</span>`;
    this.cashValue = document.createElement('div');
    this.cashValue.className = 'me-corner__value me-corner__value--cash aoe-font aoe-outline';
    this.cashValue.textContent = '0';
    cash.appendChild(this.cashValue);

    const wins = document.createElement('div');
    wins.className = 'me-corner__row';
    wins.innerHTML = `<span class="me-corner__icon">${ICONS.trophy}</span>`;
    this.winsValue = document.createElement('div');
    this.winsValue.className = 'me-corner__value me-corner__value--wins aoe-font aoe-outline';
    this.winsValue.textContent = '0';
    wins.appendChild(this.winsValue);

    this.root.append(cash, wins);
    parent.appendChild(this.root);
  }

  updateCash(cash: number): void {
    const shown = Math.floor(cash);
    if (shown === this.lastCash) return;
    this.lastCash = shown;
    this.cashValue.textContent = formatCash(shown);
  }

  updateWins(wins: number): void {
    if (wins === this.lastWins) return;
    const rose = wins > this.lastWins && this.lastWins >= 0;
    this.lastWins = wins;
    this.winsValue.textContent = formatCash(wins);
    if (!rose) return;
    this.winsValue.classList.remove('me-corner__value--pop');
    void this.winsValue.offsetWidth;
    this.winsValue.classList.add('me-corner__value--pop');
    window.clearTimeout(this.popTimer);
    this.popTimer = window.setTimeout(() => this.winsValue.classList.remove('me-corner__value--pop'), 560);
  }

  dispose(): void {
    window.clearTimeout(this.popTimer);
    this.root.remove();
  }
}

let stylesInjected = false;

const injectStyles = (): void => {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
.me-corner {
  position: fixed;
  left: max(calc(var(--hu) * 1.3), env(safe-area-inset-left, 0px));
  bottom: max(calc(var(--hu) * 1.2), env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: calc(var(--hu) * 0.65);
  pointer-events: none;
  user-select: none;
  z-index: 20;
}
.me-corner__row { display: flex; align-items: center; gap: calc(var(--hu) * 0.8); }
.me-corner__icon { width: max(26px, calc(var(--hu) * 4.2)); height: max(26px, calc(var(--hu) * 4.2)); display: grid; place-items: center; }
.me-corner__icon .aoe-icon { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 5px rgba(0, 0, 0, 0.35)); }
.me-corner__value { font-size: max(16px, calc(var(--hu) * 2.9)); line-height: 1; }
.me-corner__value--cash { color: #b9ffb0; }
.me-corner__value--wins { color: #ffd93d; }
.me-corner__value--pop { animation: aoe-pop 520ms ease-out; }
@keyframes aoe-pop { 0% { transform: scale(1); } 35% { transform: scale(1.25); } 100% { transform: scale(1); } }
body.aoe-touch-mode .me-corner { display: none; }
`;
  document.head.appendChild(style);
};
