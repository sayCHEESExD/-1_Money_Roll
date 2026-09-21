import { canRebirth, maxLevelForRebirth, rebirthMultiplier, rebirthRequiredLevel } from '@money/shared';
import { ICONS } from './hudStyles.js';
import { Panel } from './Panel.js';

/**
 * The rebirth confirmation, laid out as the reference frames it: a cash
 * multiplier row and a max level row, each BEFORE -> AFTER, the red warning
 * that levels and cash reset, the level bar, and ONE Rebirth button.
 *
 * The button only ever ASKS. Eligibility is decided by the server; this
 * panel mirrors the replicated figures.
 */
export class RebirthPanel extends Panel {
  private readonly beforeCash: HTMLSpanElement;
  private readonly afterCash: HTMLSpanElement;
  private readonly beforeLevel: HTMLSpanElement;
  private readonly afterLevel: HTMLSpanElement;
  private readonly barFill: HTMLDivElement;
  private readonly barLabel: HTMLSpanElement;
  private readonly action: HTMLButtonElement;

  private level = 0;
  private rebirths = 0;

  constructor(parent: HTMLElement, onRebirth: () => void) {
    super(parent, 'rebirth', 'Rebirth', ICONS.rebirth);

    const grid = document.createElement('div');
    grid.className = 'aoe-rb';
    const cashRow = this.row(grid, 'cash', ICONS.cash);
    const levelRow = this.row(grid, 'level', ICONS.aura);
    this.beforeCash = cashRow[0];
    this.afterCash = cashRow[1];
    this.beforeLevel = levelRow[0];
    this.afterLevel = levelRow[1];

    const warning = document.createElement('p');
    warning.className = 'aoe-rb__warn aoe-font';
    warning.textContent = 'Rebirth resets your: Levels & Cash!';

    const bar = document.createElement('div');
    bar.className = 'aoe-rb__bar';
    this.barFill = document.createElement('div');
    this.barFill.className = 'aoe-rb__fill';
    const label = document.createElement('div');
    label.className = 'aoe-rb__barlabel aoe-font';
    this.barLabel = document.createElement('span');
    this.barLabel.className = 'aoe-outline';
    label.append(this.barLabel);
    bar.append(this.barFill, label);

    this.action = document.createElement('button');
    this.action.type = 'button';
    this.action.className = 'aoe-action aoe-rb__go aoe-font';
    this.action.textContent = 'Rebirth';
    this.action.addEventListener('click', () => {
      if (this.action.disabled) return;
      onRebirth();
      this.setOpen(false);
    });

    this.body.append(grid, warning, bar, this.action);
    this.render();
  }

  setProgress(level: number, rebirths: number): void {
    if (level === this.level && rebirths === this.rebirths) return;
    this.level = level;
    this.rebirths = rebirths;
    this.render();
  }

  get isEligible(): boolean {
    return canRebirth(this.level, this.rebirths);
  }

  protected override onOpened(): void {
    this.render();
  }

  private row(grid: HTMLDivElement, variant: string, iconHtml: string): [HTMLSpanElement, HTMLSpanElement] {
    const card = (): HTMLSpanElement => {
      const box = document.createElement('div');
      box.className = `aoe-rb__card aoe-rb__card--${variant}`;
      const value = document.createElement('span');
      value.className = 'aoe-font aoe-outline';
      const mark = document.createElement('span');
      mark.innerHTML = iconHtml;
      box.append(value, mark);
      grid.appendChild(box);
      return value;
    };
    const before = card();
    const arrow = document.createElement('span');
    arrow.className = 'aoe-rb__arrow aoe-font aoe-outline';
    arrow.textContent = '▶';
    grid.appendChild(arrow);
    return [before, card()];
  }

  private render(): void {
    const required = rebirthRequiredLevel(this.rebirths);
    const eligible = this.isEligible;
    const cap = maxLevelForRebirth(this.rebirths);

    this.beforeCash.textContent = `x${trim(rebirthMultiplier(this.rebirths))} Cash`;
    this.afterCash.textContent = `x${trim(rebirthMultiplier(this.rebirths + 1))} Cash`;
    this.beforeLevel.textContent = `Max Level: ${cap}`;
    this.afterLevel.textContent = `Max Level: ${maxLevelForRebirth(this.rebirths + 1)}`;

    const shown = Math.min(this.level, required);
    this.barFill.style.width = `${Math.min(Math.max(shown / required, 0), 1) * 100}%`;
    this.barLabel.textContent = `Level ${shown}/${required}`;

    this.action.disabled = !eligible;
    this.action.textContent = eligible ? 'Rebirth' : `Reach Level ${required}`;
  }
}

const trim = (value: number): string => value.toFixed(1).replace(/\.0$/, '');
