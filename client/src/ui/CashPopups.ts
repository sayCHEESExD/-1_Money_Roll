import { formatCash } from '@money/shared';
import { ICONS, injectHudStyles } from './hudStyles.js';

/** Most popups on screen at once. A hard ceiling: the pool is reused for ever. */
const POOL_SIZE = 14;

/** Seconds one popup stays on screen. Must match the CSS animation. */
const LIFETIME = 1.15;

/**
 * The floating "+N" a player sees when they earn cash.
 *
 * Fed by an ACCUMULATOR rather than by raw patches: cash arrives on every
 * patch while walking the meadow, so the gain is banked and released on a
 * fixed cadence - a slow trickle reads as "+4" and a training zone at x3 as
 * "+120" without either being special-cased. `burst` shows one figure at
 * once, for a pickup.
 */
export class CashPopups {
  private readonly root: HTMLDivElement;
  private readonly pool: HTMLDivElement[] = [];
  private readonly free: number[] = [];
  private readonly live: { index: number; timer: number }[] = [];
  private pending = 0;
  private cooldown = 0;
  private lastTotal = -1;
  private readonly recent: { x: number; y: number }[] = [];

  constructor(parent: HTMLElement) {
    injectHudStyles();

    this.root = document.createElement('div');
    this.root.className = 'aoe-pops';
    parent.appendChild(this.root);

    for (let i = 0; i < POOL_SIZE; i += 1) {
      const node = document.createElement('div');
      node.className = 'aoe-pop aoe-font';
      node.innerHTML = `${ICONS.cash}<span class="aoe-pop__value"></span>`;
      const image = node.querySelector('.aoe-icon');
      image?.classList.add('aoe-pop__icon');
      node.hidden = true;
      this.root.appendChild(node);
      this.pool.push(node);
      this.free.push(i);
    }
  }

  /**
   * Note the player's replicated lifetime cash. Only an INCREASE spawns
   * anything; the first reading only establishes the baseline.
   */
  observe(lifetimeCash: number): void {
    if (!Number.isFinite(lifetimeCash)) return;
    if (this.lastTotal < 0) {
      this.lastTotal = lifetimeCash;
      return;
    }
    if (lifetimeCash > this.lastTotal) this.pending += lifetimeCash - this.lastTotal;
    this.lastTotal = lifetimeCash;
  }

  /** One figure, now: a pickup collected. */
  burst(amount: number, suffix = ' Bills'): void {
    this.spawn(Math.floor(amount), suffix);
  }

  update(delta: number): void {
    this.cooldown -= Math.max(0, delta);
    if (this.cooldown > 0) return;
    this.cooldown = 0.3;
    if (this.pending < 1) return;
    const amount = Math.floor(this.pending);
    this.pending -= amount;
    this.spawn(amount, '');
  }

  dispose(): void {
    for (const entry of this.live) window.clearTimeout(entry.timer);
    this.live.length = 0;
    this.root.remove();
  }

  private spawn(amount: number, suffix: string): void {
    if (this.free.length === 0) {
      const oldest = this.live.shift();
      if (!oldest) return;
      window.clearTimeout(oldest.timer);
      this.release(oldest.index);
    }

    const index = this.free.pop();
    if (index === undefined) return;
    const node = this.pool[index];
    if (!node) return;

    const value = node.querySelector('.aoe-pop__value');
    if (value) value.textContent = `+${formatCash(amount)}${suffix}`;

    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      x = 30 + Math.random() * 44;
      y = 30 + Math.random() * 28;
      const clash = this.recent.some((at) => Math.abs(at.x - x) < 11 && Math.abs(at.y - y) < 9);
      if (!clash) break;
    }
    this.recent.push({ x, y });
    if (this.recent.length > 5) this.recent.shift();

    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.style.setProperty('--aoe-pop-tilt', `${(Math.random() * 2 - 1) * 7}deg`);
    node.style.setProperty('--aoe-pop-scale', `${(suffix ? 1.15 : 0.88) + Math.random() * 0.28}`);

    node.hidden = false;
    node.classList.remove('aoe-pop--run');
    void node.offsetWidth;
    node.classList.add('aoe-pop--run');

    const timer = window.setTimeout(() => {
      const at = this.live.findIndex((entry) => entry.index === index);
      if (at >= 0) this.live.splice(at, 1);
      this.release(index);
    }, LIFETIME * 1000);

    this.live.push({ index, timer });
  }

  private release(index: number): void {
    const node = this.pool[index];
    if (!node) return;
    node.hidden = true;
    node.classList.remove('aoe-pop--run');
    this.free.push(index);
  }
}
