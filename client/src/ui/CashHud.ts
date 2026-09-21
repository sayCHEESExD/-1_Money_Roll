import {
  auraBySlot,
  formatCash,
  rebirthMultiplier,
  resolveLevel,
  TRAINING_ZONES,
  type LevelProgress,
} from '@money/shared';
import { ICONS, injectHudStyles } from './hudStyles.js';

/**
 * THE BOTTOM-CENTRE READOUT, as the reference frames it, top to bottom:
 *
 *          3.28K Cash
 *   [ $ Level 25 ................ MAX ]
 *     x1.5 Rebirth · x2 Train · x1.5 Aura · +25% Pets
 *
 * The cash figure is the PREDICTED pile, so it moves the frame the bridge
 * spends it; the level bar and the boosts show SERVER state.
 */
export class CashHud {
  private readonly root: HTMLDivElement;
  private readonly cashValue: HTMLDivElement;
  private readonly levelChip: HTMLDivElement;
  private readonly levelFill: HTMLDivElement;
  private readonly levelLabel: HTMLDivElement;
  private readonly boosts: HTMLDivElement;
  private readonly supply: HTMLDivElement;

  private lastCash = -1;
  private lastLevelCash = -1;
  private lastLevel = -1;
  private lastCap = -1;
  private lastBoosts = '';
  private lastSupply = -2;

  constructor(parent: HTMLElement) {
    injectHudStyles();
    injectStyles();

    this.root = el('div', 'me-hud');

    this.cashValue = el('div', 'me-hud__cash aoe-font aoe-outline aoe-outline--big');
    this.cashValue.textContent = '0 Cash';

    const level = el('div', 'me-hud__level');
    this.levelChip = el('div', 'me-hud__level-chip aoe-font aoe-outline');
    this.levelChip.innerHTML = `${ICONS.cash}<span>Level 0</span>`;
    const track = el('div', 'me-hud__level-track');
    this.levelFill = el('div', 'me-hud__level-fill');
    this.levelLabel = el('div', 'me-hud__level-label aoe-font aoe-outline');
    this.levelLabel.textContent = '0/40';
    track.append(this.levelFill, this.levelLabel);
    level.append(this.levelChip, track);

    this.supply = el('div', 'me-hud__supply aoe-font aoe-outline');
    this.supply.hidden = true;

    this.boosts = el('div', 'me-hud__boosts aoe-font aoe-outline');

    this.root.append(this.cashValue, this.supply, level, this.boosts);
    parent.appendChild(this.root);
  }

  /** The predicted cash pile. Cheap: a compare and a string. */
  updateCash(cash: number): void {
    const shown = Math.floor(cash);
    if (shown === this.lastCash) return;
    this.lastCash = shown;
    this.cashValue.textContent = `${formatCash(shown)} Cash`;
  }

  /**
   * The crossing supply while a crossing is under way, or -1 to hide it. The
   * bills figure above it never moves during a crossing: this is the copy
   * being spent.
   */
  updateSupply(supply: number): void {
    const shown = supply < 0 ? -1 : Math.floor(supply);
    if (shown === this.lastSupply) return;
    this.lastSupply = shown;
    this.supply.hidden = shown < 0;
    if (shown >= 0) this.supply.textContent = `Crossing: ${formatCash(shown)} left`;
  }

  /** The replicated level curve. */
  updateLevel(levelCash: number, maxLevel: number): void {
    if (levelCash === this.lastLevelCash && maxLevel === this.lastCap) return;
    this.lastLevelCash = levelCash;
    this.lastCap = maxLevel;
    const progress = resolveLevel(levelCash, maxLevel);
    this.renderLevel(progress);
    if (progress.level !== this.lastLevel) {
      const levelled = this.lastLevel >= 0;
      this.lastLevel = progress.level;
      const span = this.levelChip.querySelector('span');
      if (span) span.textContent = `Level ${progress.level}`;
      if (levelled) {
        this.root.classList.remove('me-hud--levelled');
        void this.root.offsetWidth;
        this.root.classList.add('me-hud--levelled');
      }
    }
  }

  /** The multipliers that make a stack of cash worth what it is worth. */
  updateBoosts(rebirths: number, trainingZone: number, auraSlot: number, ownedAuras: number, petBoost: number): void {
    const zone = TRAINING_ZONES.find((entry) => entry.index === trainingZone);
    const zoneOpen = zone ? rebirths >= zone.rebirthsRequired : false;
    const aura = auraBySlot(auraSlot);
    const auraOwned = aura ? (ownedAuras & (1 << (aura.slot - 1))) !== 0 : false;
    const parts = [`x${trim(rebirthMultiplier(rebirths))} Rebirth`];
    if (zone && zoneOpen) parts.push(`x${zone.multiplier} Train`);
    if (aura && auraOwned) parts.push(`x${trim(aura.boost)} Aura`);
    if (petBoost > 0) parts.push(`+${Math.round(petBoost * 100)}% Pets`);
    const text = parts.join(' · ');
    if (text === this.lastBoosts) return;
    this.lastBoosts = text;
    this.boosts.textContent = text;
  }

  dispose(): void {
    this.root.remove();
  }

  private renderLevel(progress: LevelProgress): void {
    this.levelFill.style.width = `${progress.fraction * 100}%`;
    this.levelLabel.textContent = progress.capped
      ? 'MAX'
      : `${formatCash(Math.floor(progress.into))}/${formatCash(progress.required)}`;
  }
}

const trim = (value: number): string => value.toFixed(1).replace(/\.0$/, '');

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  return node;
};

let stylesInjected = false;

const injectStyles = (): void => {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
/*
 * Bottom + horizontal centre at every size. The width is a multiple of the
 * HUD unit (see hudStyles) held under a share of the viewport, so it is the
 * same bar at 4K and on a phone, never edge to edge.
 */
.me-hud {
  position: fixed;
  left: 50%;
  bottom: max(calc(var(--hu) * 2), env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: min(calc(var(--hu) * 52), 78vw);
  min-width: min(220px, 90vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--hu) * 0.5);
  pointer-events: none;
  user-select: none;
  z-index: 20;
  font-family: var(--gs-font);
}
.me-hud__cash { font-size: max(18px, calc(var(--hu) * 3.4)); line-height: 1; }
.me-hud__supply { font-size: max(11px, calc(var(--hu) * 1.5)); line-height: 1; color: #ffd93d; margin-top: -2px; }
.me-hud__supply[hidden] { display: none; }
.me-hud__level {
  display: flex;
  width: 100%;
  height: max(30px, calc(var(--hu) * 4.5));
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1);
  overflow: hidden;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.3);
  background: linear-gradient(180deg, #5ee0ff, #1fa8e8);
  box-sizing: border-box;
}
.me-hud__level-chip {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: calc(var(--hu) * 0.65);
  padding: 0 calc(var(--hu) * 1.7);
  font-size: max(13px, calc(var(--hu) * 2.2));
}
.me-hud__level-chip .aoe-icon { height: 60%; width: auto; }
.me-hud__level-track { position: relative; flex: 1 1 auto; }
.me-hud__level-fill { position: absolute; inset: 0; width: 0; background: linear-gradient(180deg, #8df3ff, #46c8f2); transition: width 160ms ease-out; }
.me-hud__level-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: calc(var(--hu) * 1.3);
  font-size: max(13px, calc(var(--hu) * 2.2));
}
.me-hud__boosts { font-size: max(10px, calc(var(--hu) * 1.3)); color: #ffe08a; }
/* The bar answers to ITS OWN width: squeezed between touch controls, the chip keeps its icon and drops the word. */
.me-hud { container-type: inline-size; }
@container (max-width: 230px) {
  .me-hud__level-chip span { display: none; }
  .me-hud__level-chip { padding: 0 calc(var(--hu) * 1); }
  .me-hud__level-chip .aoe-icon { height: 70%; }
}
.me-hud--levelled .me-hud__level { animation: me-levelled 620ms ease-out; }
@keyframes me-levelled {
  0% { box-shadow: 0 0 0 0 rgba(94, 224, 255, 0.9), 0 5px 0 rgba(0,0,0,0.3); }
  60% { box-shadow: 0 0 0 14px rgba(94, 224, 255, 0), 0 5px 0 rgba(0,0,0,0.3); }
  100% { box-shadow: 0 0 0 0 rgba(94, 224, 255, 0), 0 5px 0 rgba(0,0,0,0.3); }
}
/* With touch controls the stick and the jump button own the bottom corners: the bar rides above them. */
body.aoe-touch-mode .me-hud {
  bottom: calc(max(26px, env(safe-area-inset-bottom, 0px)) + var(--aoe-stick-radius, 64px) * 2 + var(--hu) * 1.2);
  width: min(calc(var(--hu) * 52), 86vw);
}
/* On a phone on its side there is room BETWEEN the stick and the jump button, so the bar sits down there. */
@media (orientation: landscape) and (max-height: 500px) {
  body.aoe-touch-mode .me-hud {
    bottom: max(6px, env(safe-area-inset-bottom, 0px));
    /* Centred, so the free width is twice the nearer of the two corner controls. */
    width: min(calc(var(--hu) * 52), calc(2 * min(50vw - var(--aoe-stick-zone, 150px), 50vw - var(--aoe-jump-zone, 240px)) - 24px));
    min-width: 0;
    gap: 3px;
  }
  body.aoe-touch-mode .me-hud__boosts { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .me-hud__level-fill { transition: none; }
  .me-hud--levelled .me-hud__level { animation: none; }
}
`;
  document.head.appendChild(style);
};
