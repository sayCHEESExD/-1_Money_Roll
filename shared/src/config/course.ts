import type { Aabb } from '../types/math.js';
import { BILLS } from './bills.js';
import { EGGS } from './pets.js';
import { TRAINING, TRAINING_ZONES, trainingZoneX, trainingZoneZ } from './training.js';

/**
 * The world, as pure data.
 *
 * Everything the player can stand on, bump into or be killed by is defined
 * here, and both the renderer and the authoritative server read the same
 * arrays. There are no world coordinates anywhere else.
 *
 * THE SHAPE: a wide spawn area holding the Money Meadow, the bill stands on
 * the player's LEFT (+X), the training zones on their RIGHT (-X), the two
 * pet eggs ahead and the three scoreboards on the back wall - then a long,
 * straight LAVA RIVER with small islands strung along it:
 *
 *   Spawn -> Lava -> Island -> Lava -> Island -> Lava -> Island -> ...
 *
 * Each stretch of lava is crossed by BUILDING A BRIDGE OF MONEY under the
 * player's feet, cell by cell, out of the cash they carry. The river is a grid
 * of `COURSE.cellSize` cells; crossing straight costs the stage's
 * `crossCost`, which is what the "N RECOMMENDED" under every stage sign says.
 */

/** What a solid is for. Presentation reads this; the simulation does not. */
export type SolidKind =
  /** The spawn area's grass floor. */
  | 'lobby'
  /** The Money Meadow: the part of the floor covered in cash. */
  | 'meadow'
  /** A stage island. */
  | 'island'
  /** A rock wall boxing the world in. */
  | 'wall'
  /** The gold win pad on an island. */
  | 'winPad'
  /** A bill display pad. */
  | 'billPad'
  /** The raised deck the back row of bill pads stands on, and its stairs. */
  | 'deck'
  | 'stair'
  /** A training zone pad. */
  | 'training'
  /** An egg's pedestal. */
  | 'pedestal'
  /** The scoreboards' plinth. */
  | 'plinth';

/** One axis-aligned solid. */
export interface CourseSolid extends Aabb {
  readonly kind: SolidKind;
  /** Stage this belongs to; -1 for the spawn area. */
  readonly stage: number;
}

/** A stretch of lava: the thing that kills, and the thing a bridge crosses. */
export interface LavaSpan {
  readonly stage: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** Where the lava is drawn. */
  readonly surfaceY: number;
  /** Falling to here is death. Barely under the surface, so a fall reads as being swallowed. */
  readonly deathY: number;
}

/** Scenery the client draws and the simulation ignores. */
export type DecorationKind = 'palm' | 'tree' | 'rock' | 'crystal' | 'cactus' | 'mushroom' | 'lamp' | 'chest';

export interface Decoration {
  readonly kind: DecorationKind;
  readonly stage: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly rotationY: number;
}

/** The island themes, so each stage reads apart from the last. */
export type IslandTheme = 'grass' | 'sand' | 'snow' | 'jungle' | 'volcanic' | 'gold';

/** One stage. */
export interface StageDefinition {
  readonly index: number;
  readonly theme: IslandTheme;
  /** Cash a straight crossing of this stage's lava costs: the RECOMMENDED figure. */
  readonly crossCost: number;
  /** Wins awarded on the island's win pad. */
  readonly winReward: number;
  /** The lava the stage begins with. */
  readonly lavaStartZ: number;
  readonly lavaEndZ: number;
  /** The island the lava leads to. */
  readonly islandStartZ: number;
  readonly islandEndZ: number;
  readonly winPadX: number;
  readonly winPadZ: number;
  /** Top of the win pad, so a claim can test the player is ON it. */
  readonly padY: number;
}

/** Global world metrics. Every other coordinate is derived from these. */
export const COURSE = {
  /** Top of the spawn floor and of every island. Everything is measured from here. */
  floorY: 0,
  /** Thickness of a floor slab, so a slab has an underside. */
  floorThickness: 4,

  /** The spawn area footprint. */
  hubMinX: -112,
  hubMaxX: 112,
  hubMinZ: -172,
  hubMaxZ: 0,
  /** Height of the rock walls around the world. Visual, plus a solid at the mouth. */
  wallHeight: 14,

  /** The Money Meadow inside it: walking here earns cash. */
  meadowMinX: -40,
  meadowMaxX: 40,
  meadowMinZ: -128,
  meadowMaxZ: -36,

  /** A short apron between the spawn floor and the first lava, corridor-wide. */
  apronLength: 8,
  /** Half-width of the lava river and of every island. */
  halfWidth: 24,
  /** Where the corridor clamp holds the player, just inside the walls. */
  corridorHalfWidth: 23.4,
  lavaLength: 48,
  islandLength: 44,
  lavaSurfaceY: -2.6,
  lavaDeathY: -2.2,

  /** A bridge cell: this many units square. The river is a grid of them. */
  cellSize: 3,
  /** Top of a bridge cell: level with the islands. */
  bridgeTopY: 0,
  bridgeThickness: 0.7,
} as const;

/** The stages, in one table. Add a row to add a stage. */
interface StageTuning {
  readonly theme: IslandTheme;
  readonly crossCost: number;
  readonly winReward: number;
}

const STAGE_TUNING: readonly StageTuning[] = [
  { theme: 'grass', crossCost: 500, winReward: 5 },
  { theme: 'sand', crossCost: 2_500, winReward: 15 },
  { theme: 'snow', crossCost: 15_000, winReward: 40 },
  { theme: 'jungle', crossCost: 60_000, winReward: 100 },
  { theme: 'volcanic', crossCost: 250_000, winReward: 300 },
  { theme: 'gold', crossCost: 1_000_000, winReward: 1_000 },
];

/** Where the first lava begins: the end of the apron. */
export const COURSE_START_Z: number = COURSE.hubMaxZ + COURSE.apronLength;

/** The win pad: on the player's LEFT (+X) in the middle of each island. */
export const WIN_PAD = {
  size: 9,
  height: 0.5,
  /** X of the pad centre. Left is +X. */
  x: 12,
} as const;

/** Cells across the river, and along one stretch of lava. */
export const CELLS_ACROSS: number = Math.round((COURSE.halfWidth * 2) / COURSE.cellSize);
export const CELLS_ALONG: number = Math.round(COURSE.lavaLength / COURSE.cellSize);

// -------------------------------------------------------------- building

const solids: CourseSolid[] = [];
const lavas: LavaSpan[] = [];
const decorations: Decoration[] = [];
const stages: StageDefinition[] = [];

const pushBox = (
  stage: number,
  kind: SolidKind,
  centreX: number,
  bottomY: number,
  centreZ: number,
  width: number,
  height: number,
  depth: number,
): void => {
  solids.push({
    minX: centreX - width / 2,
    maxX: centreX + width / 2,
    minY: bottomY,
    maxY: bottomY + height,
    minZ: centreZ - depth / 2,
    maxZ: centreZ + depth / 2,
    kind,
    stage,
  });
};

const decorate = (
  kind: DecorationKind,
  stage: number,
  x: number,
  y: number,
  z: number,
  scale = 1,
  rotationY = 0,
): void => {
  decorations.push({ kind, stage, x, y, z, scale, rotationY });
};

/** Deterministic scatter, so every client and the verifier see one world. */
const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---- The spawn area ---------------------------------------------------------

// The floor, in two pieces: the meadow (drawn covered in cash) and the rest.
solids.push({
  minX: COURSE.hubMinX,
  maxX: COURSE.hubMaxX,
  minY: COURSE.floorY - COURSE.floorThickness,
  maxY: COURSE.floorY,
  minZ: COURSE.hubMinZ,
  maxZ: COURSE.hubMaxZ,
  kind: 'lobby',
  stage: -1,
});
solids.push({
  minX: COURSE.meadowMinX,
  maxX: COURSE.meadowMaxX,
  minY: COURSE.floorY - COURSE.floorThickness + 0.02,
  maxY: COURSE.floorY + 0.02,
  minZ: COURSE.meadowMinZ,
  maxZ: COURSE.meadowMaxZ,
  kind: 'meadow',
  stage: -1,
});

// The apron: the corridor's width of floor between the spawn and the lava.
solids.push({
  minX: -COURSE.halfWidth,
  maxX: COURSE.halfWidth,
  minY: COURSE.floorY - COURSE.floorThickness,
  maxY: COURSE.floorY,
  minZ: COURSE.hubMaxZ,
  maxZ: COURSE_START_Z,
  kind: 'lobby',
  stage: -1,
});

// The wall at the mouth of the course, either side of the corridor. A real
// solid, so nothing but the corridor leads out of the spawn area.
for (const side of [-1, 1] as const) {
  const inner = side * COURSE.halfWidth;
  const outer = side * COURSE.hubMaxX;
  solids.push({
    minX: Math.min(inner, outer),
    maxX: Math.max(inner, outer),
    minY: COURSE.floorY,
    maxY: COURSE.floorY + COURSE.wallHeight,
    minZ: COURSE.hubMaxZ - 3,
    maxZ: COURSE.hubMaxZ,
    kind: 'wall',
    stage: -1,
  });
}

/**
 * THE BILL STANDS: two rows of five pads on the player's LEFT. The front row
 * stands on the floor; the back row on a deck 3.2 up, reached by a stairway
 * at each end - "a two-stage elevated platform layout", as specified.
 */
export const BILL_ROW = {
  frontX: 66,
  backX: 84,
  padSize: 9,
  padHeight: 0.6,
  deckY: 3.2,
  deckMinX: 75,
  deckMaxX: 96,
  deckMinZ: -142,
  deckMaxZ: -42,
  firstZ: -128,
  spacingZ: 17,
  perRow: 5,
  stairZ: [-137, -47] as const,
  stairWidth: 8,
  /** How close a player must be to a pad centre to buy from it. */
  claimRadius: 4.6,
} as const;

export const billRow = (slot: number): number =>
  Math.floor((Math.max(1, Math.floor(slot)) - 1) / BILL_ROW.perRow);

export const billPadX = (slot: number): number =>
  billRow(slot) === 0 ? BILL_ROW.frontX : BILL_ROW.backX;

export const billPadZ = (slot: number): number =>
  BILL_ROW.firstZ + ((Math.max(1, Math.floor(slot)) - 1) % BILL_ROW.perRow) * BILL_ROW.spacingZ;

/** Top of the pad a bill stands on. */
export const billPadY = (slot: number): number =>
  (billRow(slot) === 0 ? COURSE.floorY : BILL_ROW.deckY) + BILL_ROW.padHeight;

/** The bill pad a position is standing on, or null. The ONE footprint test. */
export const billPadAt = (x: number, y: number, z: number): number | null => {
  for (const bill of BILLS) {
    if (Math.abs(x - billPadX(bill.slot)) > BILL_ROW.claimRadius) continue;
    if (Math.abs(z - billPadZ(bill.slot)) > BILL_ROW.claimRadius) continue;
    const top = billPadY(bill.slot);
    if (y < top - 1.2 || y > top + 3) continue;
    return bill.slot;
  }
  return null;
};

// The back deck and its two stairways (up +X), then the ten pads.
solids.push({
  minX: BILL_ROW.deckMinX,
  maxX: BILL_ROW.deckMaxX,
  minY: COURSE.floorY - COURSE.floorThickness,
  maxY: BILL_ROW.deckY,
  minZ: BILL_ROW.deckMinZ,
  maxZ: BILL_ROW.deckMaxZ,
  kind: 'deck',
  stage: -1,
});
for (const centreZ of BILL_ROW.stairZ) {
  const fromX = BILL_ROW.deckMinX - 8;
  const steps = Math.ceil(BILL_ROW.deckY / 0.8);
  const tread = 8 / steps;
  for (let i = 0; i < steps; i += 1) {
    solids.push({
      minX: fromX + i * tread,
      maxX: fromX + (i + 1) * tread,
      minY: COURSE.floorY - COURSE.floorThickness,
      maxY: ((i + 1) / steps) * BILL_ROW.deckY,
      minZ: centreZ - BILL_ROW.stairWidth / 2,
      maxZ: centreZ + BILL_ROW.stairWidth / 2,
      kind: 'stair',
      stage: -1,
    });
  }
}
for (const bill of BILLS) {
  pushBox(
    -1,
    'billPad',
    billPadX(bill.slot),
    billPadY(bill.slot) - BILL_ROW.padHeight,
    billPadZ(bill.slot),
    BILL_ROW.padSize,
    BILL_ROW.padHeight,
    BILL_ROW.padSize,
  );
}

// The three training pads on the player's RIGHT.
for (const zone of TRAINING_ZONES) {
  pushBox(-1, 'training', trainingZoneX(zone.index), COURSE.floorY, trainingZoneZ(zone.index), TRAINING.size, TRAINING.padY, TRAINING.size);
}

// The two egg pedestals.
export const EGG_PEDESTAL = { size: 6, height: 2.2, floatY: 5.2 } as const;
for (const egg of EGGS) {
  pushBox(-1, 'pedestal', egg.x, COURSE.floorY, egg.z, EGG_PEDESTAL.size, EGG_PEDESTAL.height, EGG_PEDESTAL.size);
}

/** THE THREE BOARDS, on the BACK WALL of the spawn area, facing the course. */
export const BOARDS = {
  x: [-42, 0, 42] as const,
  y: COURSE.floorY,
  z: COURSE.hubMinZ + 5,
  width: 24,
  height: 15,
} as const;
pushBox(-1, 'plinth', 0, COURSE.floorY, BOARDS.z, 118, 0.5, 8);

// Palms and lamps around the spawn area's edges.
{
  const random = seeded(0x51ee);
  for (let z = COURSE.hubMinZ + 12; z < COURSE.hubMaxZ - 8; z += 22) {
    decorate('palm', -1, COURSE.hubMinX + 8 + random() * 6, COURSE.floorY, z + random() * 6, 1 + random() * 0.4, random() * 6.28);
    decorate('palm', -1, COURSE.hubMaxX - 8 - random() * 6, COURSE.floorY, z + random() * 6, 1 + random() * 0.4, random() * 6.28);
  }
  for (let x = -100; x <= 100; x += 25) {
    if (Math.abs(x) < 20) continue;
    decorate('tree', -1, x + random() * 8, COURSE.floorY, COURSE.hubMinZ + 20 + random() * 5, 0.9 + random() * 0.5, random() * 6.28);
  }
  // Lamps flanking the meadow and the course mouth.
  for (const side of [-1, 1] as const) {
    for (let z = COURSE.meadowMinZ; z <= COURSE.meadowMaxZ; z += 23) {
      decorate('lamp', -1, side * (COURSE.meadowMaxX + 5), COURSE.floorY, z);
    }
    decorate('lamp', -1, side * (COURSE.halfWidth + 3), COURSE.floorY, COURSE.hubMaxZ - 6);
  }
}

// ---- The lava river and its islands ----------------------------------------

let cursor = COURSE_START_Z;
STAGE_TUNING.forEach((tuning, i) => {
  const index = i + 1;
  const lavaStartZ = cursor;
  const lavaEndZ = lavaStartZ + COURSE.lavaLength;
  const islandStartZ = lavaEndZ;
  const islandEndZ = islandStartZ + COURSE.islandLength;
  cursor = islandEndZ;

  lavas.push({
    stage: index,
    minX: -COURSE.halfWidth,
    maxX: COURSE.halfWidth,
    minZ: lavaStartZ,
    maxZ: lavaEndZ,
    surfaceY: COURSE.lavaSurfaceY,
    deathY: COURSE.lavaDeathY,
  });

  // The island.
  solids.push({
    minX: -COURSE.halfWidth,
    maxX: COURSE.halfWidth,
    minY: COURSE.floorY - COURSE.floorThickness,
    maxY: COURSE.floorY,
    minZ: islandStartZ,
    maxZ: islandEndZ,
    kind: 'island',
    stage: index,
  });

  // The win pad, on the player's LEFT in the middle of the island.
  const winPadZ = islandStartZ + COURSE.islandLength / 2;
  pushBox(index, 'winPad', WIN_PAD.x, COURSE.floorY, winPadZ, WIN_PAD.size, WIN_PAD.height, WIN_PAD.size);

  stages.push({
    index,
    theme: tuning.theme,
    crossCost: tuning.crossCost,
    winReward: tuning.winReward,
    lavaStartZ,
    lavaEndZ,
    islandStartZ,
    islandEndZ,
    winPadX: WIN_PAD.x,
    winPadZ,
    padY: COURSE.floorY + WIN_PAD.height,
  });

  // Island scenery, on the RIGHT half so the win pad and the route stay clear.
  const random = seeded(0x1a5a + index * 977);
  const scatter: Record<IslandTheme, readonly DecorationKind[]> = {
    grass: ['tree', 'tree', 'rock', 'mushroom'],
    sand: ['palm', 'palm', 'cactus', 'rock'],
    snow: ['tree', 'crystal', 'crystal', 'rock'],
    jungle: ['palm', 'tree', 'mushroom', 'rock'],
    volcanic: ['rock', 'rock', 'crystal', 'lamp'],
    gold: ['chest', 'chest', 'crystal', 'lamp'],
  };
  const kinds = scatter[tuning.theme];
  kinds.forEach((kind, k) => {
    const x = -COURSE.halfWidth + 5 + random() * 12;
    const z = islandStartZ + 6 + ((k + random() * 0.6) / kinds.length) * (COURSE.islandLength - 12);
    decorate(kind, index, x, COURSE.floorY, z, 0.8 + random() * 0.5, random() * 6.28);
  });
  // And a pair by the far edge either side of the route out.
  decorate(kinds[0] as DecorationKind, index, COURSE.halfWidth - 5, COURSE.floorY, islandEndZ - 5, 0.9, 0);
  decorate(kinds[1] as DecorationKind, index, -COURSE.halfWidth + 5, COURSE.floorY, islandEndZ - 5, 0.9, 1.2);
});

/** Where the world ends: the far edge of the last island. */
export const COURSE_END_Z: number = cursor;

// The rock walls either side of the course, and the end wall.
for (const side of [-1, 1] as const) {
  const inner = side * COURSE.halfWidth;
  const outer = side * (COURSE.halfWidth + 10);
  solids.push({
    minX: Math.min(inner, outer),
    maxX: Math.max(inner, outer),
    minY: COURSE.floorY - COURSE.floorThickness,
    maxY: COURSE.floorY + COURSE.wallHeight,
    minZ: COURSE.hubMaxZ,
    maxZ: COURSE_END_Z + 6,
    kind: 'wall',
    stage: -1,
  });
}
solids.push({
  minX: -COURSE.halfWidth - 10,
  maxX: COURSE.halfWidth + 10,
  minY: COURSE.floorY - COURSE.floorThickness,
  maxY: COURSE.floorY + COURSE.wallHeight,
  minZ: COURSE_END_Z,
  maxZ: COURSE_END_Z + 6,
  kind: 'wall',
  stage: -1,
});

export const COURSE_SOLIDS: readonly CourseSolid[] = solids;
export const LAVA_SPANS: readonly LavaSpan[] = lavas;
export const DECORATIONS: readonly Decoration[] = decorations;
export const STAGES: readonly StageDefinition[] = stages;

// -------------------------------------------------------------- queries

/** Half-width of the walkable world at a given Z. */
export const corridorHalfWidthAt = (z: number): number =>
  z < COURSE.hubMaxZ ? COURSE.hubMaxX - 1.5 : COURSE.corridorHalfWidth;

/** The stage whose LAVA a Z lies in, or null. */
export const lavaStageAt = (z: number): StageDefinition | null => {
  for (const stage of STAGES) {
    if (z >= stage.lavaStartZ && z < stage.lavaEndZ) return stage;
  }
  return null;
};

/** The stage whose island or lava a Z lies in, or null. */
export const stageAt = (z: number): StageDefinition | null => {
  for (const stage of STAGES) {
    if (z >= stage.lavaStartZ && z < stage.islandEndZ) return stage;
  }
  return null;
};

export const stageByIndex = (index: number): StageDefinition | undefined =>
  STAGES[Math.floor(index) - 1];

/** The lava under a horizontal position, or null. */
export const lavaAt = (x: number, z: number): LavaSpan | null => {
  for (const lava of LAVA_SPANS) {
    if (z < lava.minZ || z >= lava.maxZ) continue;
    if (x < lava.minX || x > lava.maxX) continue;
    return lava;
  }
  return null;
};

/** The stage whose win pad a position is standing on, or null. */
export const winPadAt = (x: number, y: number, z: number): StageDefinition | null => {
  const stage = stageAt(z);
  if (!stage) return null;
  if (Math.abs(x - stage.winPadX) > WIN_PAD.size / 2) return null;
  if (Math.abs(z - stage.winPadZ) > WIN_PAD.size / 2) return null;
  if (y < stage.padY - 1.2 || y > stage.padY + 3) return null;
  return stage;
};

/** True inside the Money Meadow's footprint. */
export const inMeadow = (x: number, z: number): boolean =>
  x >= COURSE.meadowMinX && x <= COURSE.meadowMaxX && z >= COURSE.meadowMinZ && z <= COURSE.meadowMaxZ;

// -------------------------------------------------------------- bridge cells

/**
 * A bridge cell is identified by ONE integer: stage, row along the river and
 * column across it, packed so a set of them replicates as a short string.
 */
export const cellId = (stage: number, row: number, column: number): number =>
  stage * 10_000 + row * 100 + column;

export const cellStage = (id: number): number => Math.floor(id / 10_000);
export const cellRow = (id: number): number => Math.floor((id % 10_000) / 100);
export const cellColumn = (id: number): number => id % 100;

/** The cell under a horizontal position, or -1 when it is not over lava. */
export const cellIdAt = (x: number, z: number): number => {
  const stage = lavaStageAt(z);
  if (!stage) return -1;
  if (x < -COURSE.halfWidth || x >= COURSE.halfWidth) return -1;
  const row = Math.floor((z - stage.lavaStartZ) / COURSE.cellSize);
  const column = Math.floor((x + COURSE.halfWidth) / COURSE.cellSize);
  if (row < 0 || row >= CELLS_ALONG || column < 0 || column >= CELLS_ACROSS) return -1;
  return cellId(stage.index, row, column);
};

/** Centre of a cell, for drawing it. */
export const cellCentre = (id: number): { x: number; z: number } | null => {
  const stage = stageByIndex(cellStage(id));
  if (!stage) return null;
  return {
    x: -COURSE.halfWidth + (cellColumn(id) + 0.5) * COURSE.cellSize,
    z: stage.lavaStartZ + (cellRow(id) + 0.5) * COURSE.cellSize,
  };
};

/** Cash one cell of a stage's bridge costs: the crossing cost spread over the straight route. */
export const cellCost = (stage: number): number => {
  const definition = stageByIndex(stage);
  if (!definition) return Number.POSITIVE_INFINITY;
  return definition.crossCost / CELLS_ALONG;
};

/** The replicated form of a bridge: cell ids joined by commas. */
export const encodeBridge = (cells: ReadonlySet<number>): string => [...cells].join(',');
export const decodeBridge = (encoded: string, into: Set<number>): void => {
  into.clear();
  if (!encoded) return;
  for (const part of encoded.split(',')) {
    const id = Number.parseInt(part, 10);
    if (Number.isInteger(id) && id > 0) into.add(id);
  }
};
