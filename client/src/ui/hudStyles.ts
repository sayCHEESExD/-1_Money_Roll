/**
 * One stylesheet for the whole HUD, injected on first use.
 *
 * THE LOOK IS THE REFERENCE ART'S: heavy rounded display type in white with a
 * thick dark rim, chunky rounded tiles in saturated gradients with a dark
 * border and a drop, pale panels with a coloured header and a red close
 * square, and a red badge when something is waiting. Bright, toy-like, and
 * readable over a bright sky.
 *
 * NO BACKTICKS ANYWHERE IN THIS FILE: the stylesheet is a template literal.
 */
let injected = false;

export const injectHudStyles = (): void => {
  if (injected) return;
  injected = true;

  const style = document.createElement('style');
  style.textContent = `
/*
 * THE HUD UNIT. Every HUD size - tiles, gaps, borders, type, the cash bar, the
 * egg card - is a multiple of --hu, and --hu follows the viewport: the smaller
 * of a slice of its width and a slice of its height, held between a floor
 * that keeps touch targets and type usable on a phone and a ceiling that
 * keeps them from growing with a 4K monitor. On a desktop at 1280x720 it is
 * about 11px, so a 6.5-unit tile is the 72px tile the design was drawn at; on
 * a phone it is the floor, and the same tile is 42px. There is no per-device
 * multiplier anywhere: a resized browser window simply lands somewhere else
 * on the same curve.
 */
:root {
  --hu: clamp(6.5px, min(0.92vw, 1.55vh), 12.5px);
  --gs-rail: calc(var(--hu) * 6.5);
  --gs-border: max(2px, calc(var(--hu) * 0.34));
  --gs-ink: #1c2233;
  --gs-font: "Fredoka", "Baloo 2", "Nunito", "Segoe UI", system-ui, sans-serif;
  --gs-blue: #3fa9ff;
  --gs-blue-dark: #1f6fd6;
  --gs-cyan: #5ee0ff;
  --gs-cyan-dark: #1fa8e8;
  --gs-green: #5ed64f;
  --gs-green-dark: #2f9e2b;
  --gs-orange: #ffa62b;
  --gs-orange-dark: #e2721a;
  --gs-pink: #ff5fb3;
  --gs-pink-dark: #d8347f;
  --gs-purple: #9b6bff;
  --gs-purple-dark: #6d3fd6;
  --gs-yellow: #ffd93d;
  --gs-gold: #f0c040;
  --gs-red: #ff4d4d;
  --gs-red-dark: #c92a2a;
  --gs-panel: #eef1f6;
  --gs-panel-dark: #dcdcdc;
}
/* The dynamic viewport, where the browser has one: a phone's toolbar changes it. */
@supports (height: 1dvh) {
  :root { --hu: clamp(6.5px, min(0.92vw, 1.55dvh), 12.5px); }
}

.aoe-font {
  font-family: var(--gs-font);
  font-weight: 700;
  letter-spacing: 0.01em;
}

/* THE OUTLINED TYPE: white glyphs with a thick dark rim, the reference's look. */
.aoe-outline {
  color: #fff;
  text-shadow:
    2px 0 0 var(--gs-ink), -2px 0 0 var(--gs-ink), 0 2px 0 var(--gs-ink), 0 -2px 0 var(--gs-ink),
    2px 2px 0 var(--gs-ink), -2px 2px 0 var(--gs-ink), 2px -2px 0 var(--gs-ink), -2px -2px 0 var(--gs-ink),
    0 4px 6px rgba(0, 0, 0, 0.35);
  paint-order: stroke fill;
}
.aoe-outline--big {
  text-shadow:
    3px 0 0 var(--gs-ink), -3px 0 0 var(--gs-ink), 0 3px 0 var(--gs-ink), 0 -3px 0 var(--gs-ink),
    3px 3px 0 var(--gs-ink), -3px 3px 0 var(--gs-ink), 3px -3px 0 var(--gs-ink), -3px -3px 0 var(--gs-ink),
    0 5px 8px rgba(0, 0, 0, 0.35);
}

/* ---- The left rail: a 2 x 3 grid of tiles, as the reference has it ---- */
.aoe-rail {
  position: fixed;
  left: max(calc(var(--hu) * 1.3), env(safe-area-inset-left, 0px));
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  grid-template-columns: repeat(2, var(--gs-rail));
  gap: calc(var(--hu) * 2.5) calc(var(--hu) * 1.3);
  z-index: 21;
  user-select: none;
}
/* A RAIL TILE: a rounded gradient plate with a dark rim and a drop. */
.aoe-tile {
  position: relative;
  width: var(--gs-rail);
  height: var(--gs-rail);
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1.5);
  background: linear-gradient(180deg, var(--tile-a, #9b6bff), var(--tile-b, #6d3fd6));
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.28), inset 0 3px 0 rgba(255, 255, 255, 0.35);
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;
  transition: transform 110ms ease;
}
.aoe-tile:hover { transform: scale(1.06); }
.aoe-tile:active { transform: translateY(3px); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.28); }
@media (hover: none) { .aoe-tile:hover { transform: none; } }
.aoe-tile .aoe-icon {
  width: 70%;
  height: 70%;
  object-fit: contain;
  filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.35));
  pointer-events: none;
}
.aoe-tile__label {
  position: absolute;
  left: 50%;
  bottom: calc(var(--hu) * -1.35);
  transform: translateX(-50%);
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(10px, calc(var(--hu) * 1.25));
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}
.aoe-tile__key {
  position: absolute;
  right: calc(var(--hu) * -0.5);
  top: calc(var(--hu) * -0.5);
  min-width: max(14px, calc(var(--hu) * 1.65));
  height: max(14px, calc(var(--hu) * 1.65));
  padding: 0 calc(var(--hu) * 0.4);
  box-sizing: border-box;
  border: max(1.5px, calc(var(--hu) * 0.17)) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 0.6);
  background: #ffffff;
  color: var(--gs-ink);
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(9px, calc(var(--hu) * 0.92));
  line-height: max(11px, calc(var(--hu) * 1.3));
  text-align: center;
  pointer-events: none;
}
body.aoe-touch-mode .aoe-tile__key { display: none; }
.aoe-tile__badge {
  position: absolute;
  left: calc(var(--hu) * -0.75);
  top: calc(var(--hu) * -0.75);
  width: max(14px, calc(var(--hu) * 1.8));
  height: max(14px, calc(var(--hu) * 1.8));
  border: max(2px, calc(var(--hu) * 0.25)) solid var(--gs-ink);
  border-radius: 50%;
  background: var(--gs-red);
  display: none;
  animation: aoe-pip 1.4s ease-in-out infinite;
}
@keyframes aoe-pip {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.18); }
}
.aoe-tile--ready .aoe-tile__badge { display: block; }
.aoe-tile--locked { filter: saturate(0.6) brightness(0.9); }
.aoe-tile--rebirth { --tile-a: #ff6b6b; --tile-b: #c92a2a; }
.aoe-tile--pets { --tile-a: #5ee0ff; --tile-b: #1fa8e8; }
.aoe-tile--upgrades { --tile-a: #7ee36a; --tile-b: #2f9e2b; }
.aoe-tile--auras { --tile-a: #b98cff; --tile-b: #6d3fd6; }
.aoe-tile--audio { --tile-a: #ffb347; --tile-b: #d9741a; }
.aoe-tile--off { filter: saturate(0.3) brightness(0.75); }
.aoe-tile--off .aoe-icon { opacity: 0.55; }

/* ---- Bloxity account chip, top right ----------------------------------- */
.aoe-account {
  position: fixed;
  top: max(calc(var(--hu) * 1), env(safe-area-inset-top, 0px));
  right: max(calc(var(--hu) * 1), env(safe-area-inset-right, 0px));
  z-index: 23;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: calc(var(--hu) * 0.5);
}
.aoe-account__row {
  display: flex;
  align-items: center;
  gap: calc(var(--hu) * 0.7);
  padding: calc(var(--hu) * 0.35) calc(var(--hu) * 1) calc(var(--hu) * 0.35) calc(var(--hu) * 0.35);
  border: max(2px, calc(var(--hu) * 0.25)) solid var(--gs-ink);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
}
.aoe-account__pfp { width: max(22px, calc(var(--hu) * 2.5)); height: max(22px, calc(var(--hu) * 2.5)); border-radius: 50%; border: 2px solid var(--gs-ink); object-fit: cover; }
.aoe-account__name { font-size: max(11px, calc(var(--hu) * 1.2)); color: var(--gs-ink); max-width: 22vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aoe-account__note { font-size: max(10px, calc(var(--hu) * 1.05)); color: #ffffff; }
.aoe-account__actions { display: flex; gap: calc(var(--hu) * 0.5); }
.aoe-account__btn,
.aoe-account__login {
  cursor: pointer;
  border: max(2px, calc(var(--hu) * 0.25)) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1);
  padding: calc(var(--hu) * 0.5) calc(var(--hu) * 1);
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(10px, calc(var(--hu) * 1.05));
  color: #ffffff;
  background: linear-gradient(180deg, var(--gs-blue), var(--gs-blue-dark));
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
}
.aoe-account__login { background: linear-gradient(180deg, var(--gs-green), var(--gs-green-dark)); padding: calc(var(--hu) * 0.65) calc(var(--hu) * 1.3); }
.aoe-account__btn:hover, .aoe-account__login:hover { filter: brightness(1.08); }
body.aoe-touch-mode .aoe-account__name { max-width: 30vw; }

/* ---- Friends and Bux rows ----------------------------------------------- */
.aoe-friend { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 2px solid rgba(0, 0, 0, 0.08); }
.aoe-friend:last-of-type { border-bottom: none; }
.aoe-friend__pfp { width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--gs-ink); object-fit: cover; flex: none; }
.aoe-friend__name { display: flex; flex-direction: column; line-height: 1.2; flex: 1 1 auto; min-width: 0; }
.aoe-friend__name b, .aoe-friend__name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aoe-friend__status { font-size: 12px; opacity: 0.7; flex: none; }
.aoe-friend__invite, .aoe-bux__buy {
  cursor: pointer;
  flex: none;
  border: 3px solid var(--gs-ink);
  border-radius: 12px;
  padding: 6px 12px;
  color: #fff;
  font: inherit;
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: 12px;
  background: linear-gradient(180deg, var(--gs-green), var(--gs-green-dark));
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.25);
}
.aoe-friend__invite:disabled, .aoe-bux__buy:disabled { filter: saturate(0.3) brightness(0.85); cursor: default; }
.aoe-bux { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 2px solid rgba(0, 0, 0, 0.08); }
.aoe-bux:last-of-type { border-bottom: none; }
.aoe-bux__text { display: flex; flex-direction: column; line-height: 1.25; flex: 1 1 auto; }
.aoe-bux__text small { opacity: 0.65; }
.aoe-bux__buy { background: linear-gradient(180deg, var(--gs-orange), var(--gs-orange-dark)); }
.aoe-panel--friends .aoe-panel__head, .aoe-panel--bux .aoe-panel__head { background: linear-gradient(180deg, var(--gs-blue), var(--gs-blue-dark)); }

/* ---- The FPS readout ---------------------------------------------------- */
.aoe-fps {
  position: fixed;
  left: max(calc(var(--hu) * 1), env(safe-area-inset-left, 0px));
  top: max(calc(var(--hu) * 1), env(safe-area-inset-top, 0px));
  z-index: 23;
  font-family: var(--gs-font);
  font-size: max(11px, calc(var(--hu) * 1.1));
  color: #ffffff;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.95);
  pointer-events: none;
}
.aoe-fps[hidden] { display: none; }

/* ---- Panels ------------------------------------------------------------- */
.aoe-panel {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(20, 30, 60, 0.35);
  z-index: 40;
}
.aoe-panel[hidden] { display: none; }
/* A PANEL is a pale card with a thick dark rim and a coloured header. */
.aoe-panel__box {
  position: relative;
  width: min(calc(var(--hu) * 54), 94vw);
  max-height: min(86vh, calc(100vh - var(--hu) * 4));
  display: flex;
  flex-direction: column;
  border: max(3px, calc(var(--hu) * 0.42)) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1.8);
  background: var(--gs-panel);
  box-shadow: 0 14px 0 rgba(0, 0, 0, 0.25), 0 22px 60px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.aoe-panel__head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: calc(var(--hu) * 1);
  padding: calc(var(--hu) * 1) calc(var(--hu) * 5) calc(var(--hu) * 1) calc(var(--hu) * 1.5);
  color: #fff;
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(18px, calc(var(--hu) * 2.9));
  background: linear-gradient(180deg, var(--gs-blue), var(--gs-blue-dark));
  border-bottom: max(3px, calc(var(--hu) * 0.42)) solid var(--gs-ink);
}
.aoe-panel__title { flex: 1; text-align: left; }
.aoe-panel__mark { display: grid; place-items: center; flex: 0 0 auto; }
.aoe-panel__mark .aoe-icon { height: max(28px, calc(var(--hu) * 4.2)); width: auto; filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4)); }
.aoe-panel--rebirth .aoe-panel__head { background: linear-gradient(180deg, #ff6b6b, #c92a2a); }
.aoe-panel--pets .aoe-panel__head { background: linear-gradient(180deg, var(--gs-cyan), var(--gs-cyan-dark)); }
.aoe-panel--upgrades .aoe-panel__head { background: linear-gradient(90deg, #5ed64f, #ffd93d 60%, #ff9a2e); }
.aoe-panel--auras .aoe-panel__head { background: linear-gradient(180deg, #b98cff, #6d3fd6); }
.aoe-panel__close {
  position: absolute;
  right: calc(var(--hu) * 0.8);
  top: 50%;
  transform: translateY(-50%);
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1);
  background: linear-gradient(180deg, #ff5a5a, #c92a2a);
  color: #fff;
  width: max(34px, calc(var(--hu) * 3.5));
  height: max(34px, calc(var(--hu) * 3.5));
  font-size: max(18px, calc(var(--hu) * 1.8));
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
}
.aoe-panel__close:hover { filter: brightness(1.1); }
.aoe-panel__body {
  padding: calc(var(--hu) * 1.3) calc(var(--hu) * 1.5) calc(var(--hu) * 1.6);
  overflow-y: auto;
  color: var(--gs-ink);
  font-family: var(--gs-font);
  font-weight: 600;
  font-size: max(12px, calc(var(--hu) * 1.15));
  background: repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 12px, transparent 12px 24px);
}
.aoe-panel__note { margin-bottom: 12px; line-height: 1.45; text-align: center; }
.aoe-panel__note b { font-size: 16px; }
.aoe-panel__empty {
  text-align: center;
  padding: calc(var(--hu) * 3.6) calc(var(--hu) * 0.8);
  font-size: max(18px, calc(var(--hu) * 2.4));
  color: #ffffff;
}

/* THE COMMIT CONTROL: a green rounded button with a drop. */
.aoe-action {
  width: 100%;
  padding: calc(var(--hu) * 1.1);
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1.3);
  background: linear-gradient(180deg, var(--gs-green), var(--gs-green-dark));
  color: #fff;
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(16px, calc(var(--hu) * 1.7));
  cursor: pointer;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.3);
  transition: filter 120ms ease;
}
.aoe-action:hover:not(:disabled) { filter: brightness(1.08); }
.aoe-action:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3); }
.aoe-action:disabled { background: linear-gradient(180deg, #b9b9b9, #8d8d8d); color: #f2f2f2; cursor: not-allowed; }

/* ---- The Rebirth panel: before/after cards, a warning, the level bar ---- */
.aoe-rb { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: calc(var(--hu) * 1) calc(var(--hu) * 1); margin-bottom: calc(var(--hu) * 1); }
.aoe-rb__card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--hu) * 0.65);
  padding: calc(var(--hu) * 1.1) calc(var(--hu) * 0.8);
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1);
  font-family: var(--gs-font);
  font-size: max(14px, calc(var(--hu) * 2.1));
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.25);
}
.aoe-rb__card--cash { background: linear-gradient(180deg, #5ee0ff, #1fa8e8); }
.aoe-rb__card--level { background: linear-gradient(180deg, #c97dff, #8c2fd6); }
.aoe-rb__card .aoe-icon { height: 1.3em; width: auto; }
.aoe-rb__arrow { font-size: max(18px, calc(var(--hu) * 2.7)); justify-self: center; }
.aoe-rb__bar {
  position: relative;
  height: max(34px, calc(var(--hu) * 3.8));
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1);
  background: #ffffff;
  overflow: hidden;
  margin-bottom: calc(var(--hu) * 1.1);
}
.aoe-rb__fill { height: 100%; background: linear-gradient(180deg, #7ee36a, #2f9e2b); transition: width 220ms ease-out; }
.aoe-rb__barlabel {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: max(14px, calc(var(--hu) * 1.9));
}
.aoe-rb__go { font-size: max(17px, calc(var(--hu) * 2.2)); }
.aoe-rb__go:disabled { background: linear-gradient(180deg, #b9b9b9, #8d8d8d); }
.aoe-rb__warn { text-align: center; margin: 0 0 calc(var(--hu) * 1); color: #e52d2d; font-size: max(13px, calc(var(--hu) * 1.6)); }

/* ---- Shop rows (upgrades, auras) ---------------------------------------- */
.aoe-row {
  display: flex;
  align-items: center;
  gap: calc(var(--hu) * 1);
  padding: calc(var(--hu) * 0.8) calc(var(--hu) * 1);
  margin-bottom: calc(var(--hu) * 0.8);
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1.3);
  background: linear-gradient(180deg, #ffffff, #e6e6e6);
  color: var(--gs-ink);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
}
.aoe-row--owned { background: linear-gradient(180deg, #fff6d6, #ffe08a); }
.aoe-row--equipped { background: linear-gradient(180deg, #ffe9a6, #ffc94a); }
.aoe-row--locked { opacity: 0.85; }
.aoe-row__swatch {
  width: max(44px, calc(var(--hu) * 4.8));
  height: max(44px, calc(var(--hu) * 4.8));
  border: max(2px, calc(var(--hu) * 0.25)) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1);
  box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.5);
  flex: none;
  display: grid;
  place-items: center;
  background: #ffffff;
}
.aoe-row__swatch .aoe-icon, .aoe-row__swatch svg { width: 74%; height: 74%; object-fit: contain; }
.aoe-row__text { flex: 1; min-width: 0; }
.aoe-row__name { font-weight: 700; font-size: max(14px, calc(var(--hu) * 1.9)); }
.aoe-row__meta { font-size: max(11px, calc(var(--hu) * 1.35)); color: #1f8f2b; }
.aoe-row__meta--owned { color: #d9741a; }
.aoe-row__meta .aoe-icon { height: 1.15em; width: auto; vertical-align: middle; }
.aoe-row__buttons { display: flex; flex-direction: column; gap: 6px; }
.aoe-row__buy {
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1);
  padding: calc(var(--hu) * 0.65) calc(var(--hu) * 1.1);
  min-width: max(80px, calc(var(--hu) * 9));
  background: linear-gradient(180deg, #ffe066, #ffa62b);
  color: #ffffff;
  font: inherit;
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(12px, calc(var(--hu) * 1.5));
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-shadow: 1px 1px 0 var(--gs-ink), -1px 1px 0 var(--gs-ink), 1px -1px 0 var(--gs-ink), -1px -1px 0 var(--gs-ink);
}
.aoe-row__buy .aoe-icon { height: max(14px, calc(var(--hu) * 1.65)); width: auto; }
.aoe-row__buy--equipped { background: linear-gradient(180deg, #56d4ff, #1fa8e8); }
.aoe-row__buy--equip { background: linear-gradient(180deg, var(--gs-green), var(--gs-green-dark)); }
.aoe-row__buy--danger { background: linear-gradient(180deg, #ff6b6b, #c92a2a); }
.aoe-row__buy:hover:not(:disabled) { filter: brightness(1.08); }
.aoe-row__buy:disabled { background: linear-gradient(180deg, #c4c4c4, #9a9a9a); color: #fff; cursor: not-allowed; }

/* ---- The Pets panel ------------------------------------------------------ */
.me-pets__strip {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: calc(var(--hu) * 0.65);
  margin-bottom: calc(var(--hu) * 1);
}
.me-pets__stat {
  display: flex;
  align-items: center;
  gap: calc(var(--hu) * 0.6);
  padding: calc(var(--hu) * 0.55) calc(var(--hu) * 0.8);
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1);
  background: linear-gradient(180deg, #ffffff, #dfe6f2);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
  min-width: 0;
}
.me-pets__stat--boost { background: linear-gradient(180deg, #e9ffdf, #b9f0a8); }
.me-pets__stat-icon { flex: none; width: max(22px, calc(var(--hu) * 2.6)); height: max(22px, calc(var(--hu) * 2.6)); display: grid; place-items: center; }
.me-pets__stat-icon .aoe-icon { width: 100%; height: 100%; object-fit: contain; }
.me-pets__stat-text { display: flex; flex-direction: column; line-height: 1.1; min-width: 0; flex: 1; }
.me-pets__stat-text small { font-size: max(9px, calc(var(--hu) * 0.95)); color: #5a6478; font-weight: 700; }
.me-pets__stat-text span { font-size: max(13px, calc(var(--hu) * 1.6)); font-weight: 700; color: var(--gs-ink); }
.me-pets__bar { height: max(5px, calc(var(--hu) * 0.5)); border-radius: 999px; background: rgba(0, 0, 0, 0.12); overflow: hidden; margin-top: 3px; }
.me-pets__bar-fill { height: 100%; background: linear-gradient(90deg, #5ee0ff, #1fa8e8); border-radius: 999px; transition: width 200ms ease-out; }
.me-pets__plus {
  flex: none;
  width: max(22px, calc(var(--hu) * 2.2)); height: max(22px, calc(var(--hu) * 2.2));
  border: max(2px, calc(var(--hu) * 0.25)) solid var(--gs-ink); border-radius: calc(var(--hu) * 0.6);
  background: linear-gradient(180deg, #7ee36a, #2f9e2b); color: #fff; font: inherit; font-weight: 700; cursor: pointer; line-height: 1;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25);
}
.me-pets__empty {
  text-align: center;
  padding: calc(var(--hu) * 2.4) calc(var(--hu) * 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--hu) * 0.5);
}
.me-pets__empty[hidden], .me-pets__grid[hidden] { display: none !important; }
.me-pets__empty .aoe-icon { width: max(56px, calc(var(--hu) * 7)); height: auto; opacity: 0.9; }
.me-pets__empty div { font-size: max(18px, calc(var(--hu) * 2.2)); }
.me-pets__empty small { font-size: max(11px, calc(var(--hu) * 1.2)); color: #5a6478; }
.me-pets__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(max(104px, calc(var(--hu) * 11)), 1fr));
  gap: calc(var(--hu) * 0.8);
}
/* A PET CARD: a portrait on the rarity's colour, the name, the rarity, the boost, one button. */
.me-pet {
  --rarity: #8fd66a;
  position: relative;
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1.2);
  background: linear-gradient(180deg, #ffffff 0%, #eef1f6 100%);
  padding: calc(var(--hu) * 0.55);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--hu) * 0.3);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
  text-align: center;
  overflow: hidden;
  animation: me-card-in 260ms ease both;
}
.me-pet--equipped { box-shadow: 0 0 0 3px var(--rarity), 0 4px 0 rgba(0, 0, 0, 0.18); background: linear-gradient(180deg, #fffbe6, #ffe9a6); }
.me-pet__ribbon {
  position: absolute;
  top: calc(var(--hu) * 0.9);
  right: calc(var(--hu) * -2.6);
  transform: rotate(38deg);
  width: calc(var(--hu) * 9);
  padding: 2px 0;
  background: linear-gradient(180deg, #5ed64f, #2f9e2b);
  color: #fff;
  font-size: max(8px, calc(var(--hu) * 0.8));
  letter-spacing: 0.06em;
  border-top: 2px solid var(--gs-ink);
  border-bottom: 2px solid var(--gs-ink);
  pointer-events: none;
}
.me-pet__portrait, .me-egg__portrait {
  position: relative;
  width: max(56px, calc(var(--hu) * 6.4));
  height: max(56px, calc(var(--hu) * 6.4));
  border-radius: calc(var(--hu) * 0.9);
  border: max(2px, calc(var(--hu) * 0.25)) solid var(--gs-ink);
  background: radial-gradient(circle at 50% 35%, #ffffff 0%, var(--rarity) 70%, var(--rarity) 100%);
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: max(18px, calc(var(--hu) * 2.2));
  color: #fff;
}
.me-pet__portrait img, .me-egg__portrait img { width: 100%; height: 100%; object-fit: contain; display: block; filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.35)); }
.me-pet__name { font-size: max(11px, calc(var(--hu) * 1.2)); line-height: 1.1; color: var(--gs-ink); }
.me-pet__rarity, .me-egg__rarity {
  font-size: max(9px, calc(var(--hu) * 0.9));
  padding: 1px calc(var(--hu) * 0.6);
  border-radius: 999px;
  background: var(--rarity);
  color: #fff;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.45);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.me-pet__boost { display: inline-flex; align-items: center; gap: 4px; font-size: max(10px, calc(var(--hu) * 1)); color: #1f8f2b; }
.me-pet__boost .aoe-icon { height: 1.1em; width: auto; }
.me-pet__action {
  width: 100%;
  margin-top: calc(var(--hu) * 0.2);
  border: max(2px, calc(var(--hu) * 0.25)) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 0.8);
  padding: calc(var(--hu) * 0.45) 0;
  color: #fff;
  font: inherit;
  font-family: var(--gs-font);
  font-weight: 700;
  font-size: max(11px, calc(var(--hu) * 1.1));
  cursor: pointer;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3);
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.35);
}
.me-pet__action:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3); }
.me-pet__action--equip { background: linear-gradient(180deg, #7ee36a, #2f9e2b); }
.me-pet__action--unequip { background: linear-gradient(180deg, #56d4ff, #1fa8e8); }
.me-pet__action--delete { background: linear-gradient(180deg, #ff6b6b, #c92a2a); }
.me-pet__action:disabled { background: linear-gradient(180deg, #c4c4c4, #9a9a9a); cursor: not-allowed; }
.me-pets__grid--delete .me-pet { background: linear-gradient(180deg, #fff0f0, #ffd6d6); }
.me-pets__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--hu) * 0.65);
  margin-top: calc(var(--hu) * 1);
  flex-wrap: wrap;
}
.me-pets__foot .aoe-row__buy { display: inline-flex; align-items: center; gap: 6px; }
.me-pets__foot .aoe-row__buy .aoe-icon { height: 1.3em; width: auto; }
@keyframes me-card-in {
  0% { opacity: 0; transform: translateY(8px) scale(0.94); }
  100% { opacity: 1; transform: none; }
}

/* ---- The Egg card: a gacha front beside an egg ------------------------- */
.me-egg {
  position: fixed;
  right: max(calc(var(--hu) * 1.4), env(safe-area-inset-right, 0px));
  top: 50%;
  transform: translateY(-45%);
  width: min(calc(var(--hu) * 27), 46vw);
  padding: calc(var(--hu) * 0.9);
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1.5);
  background: linear-gradient(180deg, rgba(38, 44, 70, 0.94), rgba(20, 24, 40, 0.94));
  color: #ffffff;
  font-family: var(--gs-font);
  z-index: 24;
  box-shadow: 0 8px 0 rgba(0, 0, 0, 0.3), 0 16px 40px rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
}
.me-egg[hidden] { display: none; }
.me-egg--in { animation: me-egg-in 280ms cubic-bezier(0.2, 1.4, 0.4, 1) both; }
@keyframes me-egg-in { 0% { opacity: 0; transform: translateY(-45%) translateX(20px) scale(0.92); } 100% { opacity: 1; transform: translateY(-45%); } }
.me-egg__head { display: flex; align-items: center; gap: calc(var(--hu) * 0.9); margin-bottom: calc(var(--hu) * 0.7); }
/* THE EGG, drawn: the egg's colour with three spots and a shine, wobbling. */
.me-egg__egg {
  --egg: #ffffff; --spot: #4a9bff;
  position: relative;
  flex: none;
  width: max(46px, calc(var(--hu) * 5.4));
  height: max(58px, calc(var(--hu) * 6.8));
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: radial-gradient(circle at 35% 30%, #ffffff 0%, var(--egg) 45%, color-mix(in srgb, var(--egg) 70%, #000) 100%);
  border: max(2px, calc(var(--hu) * 0.25)) solid var(--gs-ink);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: me-egg-wobble 2.2s ease-in-out infinite;
  transform-origin: 50% 90%;
}
.me-egg__spot { position: absolute; border-radius: 50%; background: var(--spot); opacity: 0.85; }
.me-egg__spot--a { width: 32%; height: 22%; left: 18%; top: 28%; }
.me-egg__spot--b { width: 24%; height: 18%; left: 58%; top: 50%; }
.me-egg__spot--c { width: 20%; height: 14%; left: 30%; top: 68%; }
.me-egg__shine { position: absolute; left: 22%; top: 12%; width: 22%; height: 14%; border-radius: 50%; background: rgba(255, 255, 255, 0.7); transform: rotate(-30deg); }
@keyframes me-egg-wobble { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
.me-egg--crack .me-egg__egg { animation: me-egg-crack 520ms ease; }
@keyframes me-egg-crack { 0% { transform: scale(1); } 30% { transform: scale(1.15) rotate(-8deg); } 60% { transform: scale(0.92) rotate(8deg); } 100% { transform: scale(1); } }
.me-egg__text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.me-egg__title { font-size: max(16px, calc(var(--hu) * 2.1)); line-height: 1; }
.me-egg__price {
  display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
  padding: 3px calc(var(--hu) * 0.8); border-radius: 999px;
  background: linear-gradient(180deg, #ffe066, #ffa62b); color: #fff; border: 2px solid var(--gs-ink);
  font-size: max(11px, calc(var(--hu) * 1.2)); text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.4);
}
.me-egg__price .aoe-icon { height: 1.2em; width: auto; }
.me-egg__label { display: flex; align-items: center; gap: 6px; font-size: max(10px, calc(var(--hu) * 1.05)); color: #b9c4e0; margin-bottom: calc(var(--hu) * 0.4); text-transform: uppercase; letter-spacing: 0.06em; }
.me-egg__label .aoe-icon { height: 1.4em; width: auto; }
.me-egg__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: calc(var(--hu) * 0.5); margin-bottom: calc(var(--hu) * 0.8); }
.me-egg__card {
  --rarity: #8fd66a;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: calc(var(--hu) * 0.4) calc(var(--hu) * 0.2);
  border-radius: calc(var(--hu) * 0.9);
  background: rgba(255, 255, 255, 0.07);
  border: 2px solid color-mix(in srgb, var(--rarity) 70%, transparent);
  animation: me-card-in 260ms ease both;
}
.me-egg__card .me-egg__portrait { width: max(40px, calc(var(--hu) * 4.6)); height: max(40px, calc(var(--hu) * 4.6)); }
.me-egg__card--secret .me-egg__portrait img { filter: brightness(0) opacity(0.75); }
.me-egg__secret { position: absolute; font-size: max(18px, calc(var(--hu) * 2.2)); color: #ffffff; text-shadow: 0 0 6px rgba(0, 0, 0, 0.8); }
.me-egg__name { font-size: max(9px, calc(var(--hu) * 0.95)); line-height: 1.1; text-align: center; }
.me-egg__chance { font-size: max(11px, calc(var(--hu) * 1.25)); color: #ffffff; font-weight: 700; }
.me-egg__buttons { display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--hu) * 0.65); }
.me-egg__button {
  position: relative;
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1);
  padding: calc(var(--hu) * 0.55) calc(var(--hu) * 0.35) calc(var(--hu) * 0.5);
  color: #fff;
  font-family: var(--gs-font);
  font-weight: 700;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  line-height: 1.1;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.3);
  min-height: 44px;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.4);
  transition: transform 100ms ease, filter 100ms ease;
}
.me-egg__button:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.me-egg__button:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3); }
.me-egg__button b { font-size: max(13px, calc(var(--hu) * 1.5)); }
.me-egg__button small { display: inline-flex; align-items: center; gap: 4px; font-size: max(10px, calc(var(--hu) * 1.05)); }
.me-egg__button small .aoe-icon { height: 1.2em; width: auto; }
.me-egg__button kbd {
  position: absolute; left: 6px; top: 6px;
  min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box;
  border: 2px solid var(--gs-ink); border-radius: 5px; background: #fff; color: var(--gs-ink);
  font-family: var(--gs-font); font-size: 10px; line-height: 12px; text-align: center; text-shadow: none;
}
body.aoe-touch-mode .me-egg__button kbd { display: none; }
.me-egg__button--hatch { background: linear-gradient(180deg, #ffe066, #ffa62b); }
.me-egg__button--multi { background: linear-gradient(180deg, #ff8fd0, #d8347f); }
.me-egg__button:disabled { filter: saturate(0.3) brightness(0.7); cursor: not-allowed; }
.me-egg__hint { margin-top: calc(var(--hu) * 0.5); text-align: center; font-size: max(10px, calc(var(--hu) * 1)); color: #b9ffb0; }
.me-egg__hint--warn { color: #ffb3b3; }

/* ---- The hatch toast ---------------------------------------------------- */
.me-toast {
  position: fixed;
  left: 50%;
  top: 18%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: calc(var(--hu) * 0.65);
  align-items: center;
  pointer-events: none;
  z-index: 26;
  max-width: 90vw;
}
.me-toast__card {
  --rarity: #8fd66a;
  display: flex;
  align-items: center;
  gap: calc(var(--hu) * 0.9);
  padding: calc(var(--hu) * 0.7) calc(var(--hu) * 1.4) calc(var(--hu) * 0.7) calc(var(--hu) * 0.7);
  border: var(--gs-border) solid var(--gs-ink);
  border-radius: calc(var(--hu) * 1.3);
  background: linear-gradient(180deg, #ffffff, #e6e6e6);
  color: var(--gs-ink);
  font-family: var(--gs-font);
  box-shadow: 0 0 0 3px var(--rarity), 0 6px 0 rgba(0, 0, 0, 0.25);
  animation: me-toast 3.6s ease forwards;
}
.me-toast__portrait {
  width: max(52px, calc(var(--hu) * 6)); height: max(52px, calc(var(--hu) * 6));
  border-radius: calc(var(--hu) * 0.9); border: 2px solid var(--gs-ink);
  background: radial-gradient(circle at 50% 35%, #ffffff 0%, var(--rarity) 75%);
  overflow: hidden; flex: none;
}
.me-toast__portrait img { width: 100%; height: 100%; object-fit: contain; display: block; }
.me-toast__text { display: flex; flex-direction: column; line-height: 1.15; text-align: left; }
.me-toast__text small { font-size: max(10px, calc(var(--hu) * 1.05)); color: #5a6478; }
.me-toast__text b { font-size: max(16px, calc(var(--hu) * 2)); }
.me-toast__rarity { font-size: max(10px, calc(var(--hu) * 1.1)); color: color-mix(in srgb, var(--rarity) 70%, #000); }
@keyframes me-toast {
  0% { opacity: 0; transform: scale(0.6); }
  12% { opacity: 1; transform: scale(1.08); }
  20% { transform: scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-18px); }
}

/* ---- Cash-gain popups --------------------------------------------------- */
.aoe-pops { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 19; }
.aoe-pop {
  --aoe-pop-tilt: 0deg;
  --aoe-pop-scale: 1;
  position: absolute;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  opacity: 0;
  will-change: transform, opacity;
}
.aoe-pop[hidden] { display: none; }
.aoe-pop__icon { height: max(20px, calc(var(--hu) * 3.1)); width: auto; filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.45)); }
.aoe-pop__value { font-family: var(--gs-font); font-weight: 700; font-size: max(14px, calc(var(--hu) * 2.3)); line-height: 1; color: #b9ffb0;
  text-shadow: 2px 0 0 var(--gs-ink), -2px 0 0 var(--gs-ink), 0 2px 0 var(--gs-ink), 0 -2px 0 var(--gs-ink), 2px 2px 0 var(--gs-ink), -2px 2px 0 var(--gs-ink), 2px -2px 0 var(--gs-ink), -2px -2px 0 var(--gs-ink); }
.aoe-pop--run { animation: aoe-pop-float 1150ms ease-out forwards; }
@keyframes aoe-pop-float {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--aoe-pop-tilt)) scale(calc(var(--aoe-pop-scale) * 0.6)); }
  16% { opacity: 1; transform: translate(-50%, -54%) rotate(var(--aoe-pop-tilt)) scale(calc(var(--aoe-pop-scale) * 1.1)); }
  30% { opacity: 1; transform: translate(-50%, -62%) rotate(var(--aoe-pop-tilt)) scale(var(--aoe-pop-scale)); }
  100% { opacity: 0; transform: translate(-50%, -125%) rotate(var(--aoe-pop-tilt)) scale(var(--aoe-pop-scale)); }
}

@media (prefers-reduced-motion: reduce) {
  .aoe-tile { transition: none; animation: none; }
  .aoe-pop--run { animation: aoe-pop-fade 1150ms ease-out forwards; }
  @keyframes aoe-pop-fade {
    0% { opacity: 0; transform: translate(-50%, -50%); }
    15%, 65% { opacity: 1; transform: translate(-50%, -50%); }
    100% { opacity: 0; transform: translate(-50%, -50%); }
  }
}

/*
 * The rail's lane: how far the touch stick moves right so it clears the
 * rail on a phone on its side, where the rail (still left-middle, still two
 * columns, still sized by the unit) and the stick share the left edge.
 */
:root {
  --aoe-rail-lane: calc(var(--gs-rail) * 2 + var(--hu) * 2.6 + max(calc(var(--hu) * 1.3), env(safe-area-inset-left, 0px)));
}
@media (orientation: landscape) and (max-height: 500px) {
  body.aoe-touch-mode {
    --aoe-stick-zone: calc(26px + var(--aoe-rail-lane) + var(--aoe-stick-radius, 64px) * 2);
    --aoe-jump-zone: calc(24px + env(safe-area-inset-right, 0px) + var(--aoe-jump-size, 88px) + 16px);
  }
  body.aoe-touch-mode .aoe-fps { top: auto; bottom: 6px; left: 50%; transform: translateX(-50%); }
  /* The egg card stands on top of the jump button rather than across it. */
  body.aoe-touch-mode .me-egg {
    top: auto;
    transform: none;
    bottom: calc(max(30px, env(safe-area-inset-bottom, 0px)) + var(--aoe-jump-size, 88px) + var(--hu) * 0.8);
  }
}

body.aoe-portal-embedded { --aoe-portal-top: 58px; --aoe-portal-left: 248px; }
`;
  document.head.appendChild(style);
};

/** The HUD icons, as supplied in `assets/ui/`. Never regenerated. */
const icon = (file: string): string =>
  `<img class="aoe-icon" src="/ui/${file}" alt="" draggable="false">`;

/** A backpack, drawn: the pet storage counter. */
const BAG =
  '<svg class="aoe-icon" viewBox="0 0 24 24" aria-hidden="true">' +
  '<rect x="4" y="6" width="16" height="15" rx="3" fill="#d9944a" stroke="#1c2233" stroke-width="1.6"/>' +
  '<rect x="8" y="2.5" width="8" height="5" rx="2" fill="none" stroke="#1c2233" stroke-width="1.6"/>' +
  '<rect x="7" y="12" width="10" height="5" rx="1" fill="#8a5a2b" stroke="#1c2233" stroke-width="1.4"/>' +
  '</svg>';

/**
 * The supplied art comes first: Bills, Pets, Sound and Upgrades are the
 * images in `assets/ui/`, used as given. The only drawn icon left is the
 * storage bag, for which nothing was supplied.
 */
export const ICONS = {
  trophy: icon('trophy.png'),
  rebirth: icon('rebirth.png'),
  shop: icon('shop.png'),
  aura: icon('aura.png'),
  shoe: icon('shoe.png'),
  cash: icon('Bills.png'),
  paw: icon('Pets.png'),
  arrow: icon('Upgrades.png'),
  audio: icon('Sound.png'),
  bag: BAG,
} as const;
