/**
 * THE PALETTE: a bright Roblox-style money obby.
 *
 * COLOUR ONLY. Every world coordinate lives in `@money/shared`'s course config,
 * so this file re-themes the entire game without moving a collider.
 *
 * The spawn area is green grass with square studs; the Money Meadow inside it
 * is paved with bills in the equipped bill's colour; the walls are orange
 * brick; the islands are blue-grey stud plates; the lava is the one glowing
 * thing in the world. Every texture is drawn on a canvas at runtime, so the
 * whole style costs nothing against the 12 MB budget.
 */
export const PALETTE = {
  /** The spawn area's grass, and the darker stud edge on it. */
  grass: '#57cf4f',
  grassEdge: '#3fa838',
  /** The apron and the course-side grass: a shade deeper. */
  grassDeep: '#4bbd44',
  grassDeepEdge: '#37962f',

  /** The rock walls: warm orange brick with studs, as the reference has them. */
  brick: '#d07c34',
  brickEdge: '#9c5320',
  brickTop: '#bd6f2c',

  /** Islands: blue-grey stud plates. */
  island: '#7079c8',
  islandEdge: '#4d55a3',

  /** Lava. Orange with hot squares; the one emissive surface. */
  lava: '#ff7a1c',
  lavaHot: '#ffc04a',
  lavaGlow: 0xff8c2a,

  /** The win pad: gold plate with pale studs. */
  winPad: '#ffcf3d',
  winPadEdge: '#c99a12',
  winPadGlow: 0xffb01a,

  /** Bill pads and the raised deck. */
  pad: '#f2f4f8',
  padEdge: '#b9c0cc',
  deck: '#8b93a6',
  deckEdge: '#5e6576',
  padLocked: 0x9aa1b0,
  padReady: 0x5ed64f,

  /** Egg pedestals: blue stud blocks. */
  pedestal: '#4a6ee0',
  pedestalEdge: '#2c48a8',

  /** The scoreboards' plinth and frame. */
  plinth: '#5a6273',
  plinthEdge: '#3c4352',
  boardFrame: 0x2b3554,
  boardFrameDark: 0x1a2138,
  boardPanel: '#152036',
  boardPanelEdge: '#2b3b5c',
  boardStripe: 'rgba(255, 224, 138, 0.06)',
  boardInk: '#050912',
  boardHeading: '#ffe08a',
  boardName: '#ffffff',
  boardValue: '#7fe6ff',

  /** Scenery. */
  trunk: 0x8a5a2b,
  leaf: 0x3fae3a,
  leafDark: 0x2f8a2c,
  rock: 0x8d8f99,
  rockDark: 0x5f616b,
  crystal: 0x7ff6ff,
  cactus: 0x3fa838,
  mushroomCap: 0xff5252,
  mushroomStem: 0xfff2d6,
  lamp: 0x3c4352,
  lampGlow: 0xffe08a,
  chest: 0x8a5a2b,
  chestGold: 0xffd23f,
  sand: '#f0d48a',
  sandEdge: '#c9ab5c',
  snow: '#f4f8ff',
  snowEdge: '#c8d6ee',
  jungle: '#3f9a3a',
  jungleEdge: '#2b7028',
  volcanic: '#4a4550',
  volcanicEdge: '#2b2730',
  goldFloor: '#ffd23f',
  goldFloorEdge: '#c99a12',

  /** Sky and fog. Bright blue, hazy at the horizon. */
  skyTop: 0x2f8be6,
  sky: 0x79c2ff,
  fog: 0xc5e6ff,
  skyCloud: 0xffffff,
  skyCloudShade: 0xd6e6f7,
  /** The blocky green hills on the horizon. */
  hill: 0x4fbf47,
  hillDark: 0x3a9a34,
} as const;

/** Fog band. Held back so the fog is depth rather than a curtain. */
export const WORLD_FOG = {
  near: 300,
  far: 1000,
} as const;

/** Yaw correction for the supplied player FBX. It already faces +Z. */
export const PLAYER_MODEL_YAW_OFFSET = 0;

/** A hex colour as the CSS string the canvas textures want. */
/**
 * A darker (factor < 1) or lighter (factor > 1) shade of a colour, as CSS.
 * Every prop's stud outline is its own colour shaded, so the whole world
 * reads as one material system without a hand-picked edge for each thing.
 */
export const shade = (hex: number, factor: number): string => {
  const channel = (shift: number): number => Math.max(0, Math.min(255, Math.round(((hex >> shift) & 0xff) * factor)));
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
};

export const css = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;
