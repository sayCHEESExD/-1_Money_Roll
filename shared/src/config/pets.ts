/**
 * PETS AND EGGS.
 *
 * Two floating eggs stand just past the spawn area, before the lava. Walking
 * up to one shows what it can hatch and the odds; hatching COSTS Wins, rolls
 * on the server, and adds a pet to the player's inventory. Equipped pets add
 * their boosts together into one cash multiplier.
 *
 * A pet is an ID in a string list - the inventory is `pets`, the worn ones
 * are indices into it - so the whole system is two replicated strings.
 */
export type PetRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

/** How the client draws a pet: a small blocky creature of this shape. */
export type PetShape =
  | 'dog'
  | 'cat'
  | 'bunny'
  | 'fox'
  | 'panda'
  | 'dragon'
  | 'wolf'
  | 'tiger'
  | 'unicorn'
  | 'phoenix'
  | 'golem'
  | 'king';

export interface PetDefinition {
  readonly id: string;
  readonly name: string;
  readonly rarity: PetRarity;
  /** Cash boost as a fraction: 0.25 is +25%. Equipped boosts ADD. */
  readonly boost: number;
  readonly color: number;
  readonly accent: number;
  readonly shape: PetShape;
}

export const PETS: readonly PetDefinition[] = [
  // The Basic Egg's pool.
  { id: 'dog', name: 'Dalmatian', rarity: 'common', boost: 0.1, color: 0xf4f4f4, accent: 0x222222, shape: 'dog' },
  { id: 'cat', name: 'Tabby Cat', rarity: 'common', boost: 0.15, color: 0xf0a552, accent: 0x9c5b1c, shape: 'cat' },
  { id: 'bunny', name: 'Bunny', rarity: 'uncommon', boost: 0.25, color: 0xffd6e8, accent: 0xff7fb5, shape: 'bunny' },
  { id: 'fox', name: 'Fox', rarity: 'rare', boost: 0.4, color: 0xff7d2e, accent: 0xffffff, shape: 'fox' },
  { id: 'panda', name: 'Panda', rarity: 'epic', boost: 0.6, color: 0xffffff, accent: 0x1c1c1c, shape: 'panda' },
  { id: 'dragon', name: 'Baby Dragon', rarity: 'legendary', boost: 1.0, color: 0x5ed64f, accent: 0xffd23f, shape: 'dragon' },
  // The Rare Egg's pool.
  { id: 'wolf', name: 'Wolf', rarity: 'common', boost: 0.8, color: 0x8e9aab, accent: 0x2b3240, shape: 'wolf' },
  { id: 'tiger', name: 'Tiger', rarity: 'common', boost: 1.0, color: 0xff9a2e, accent: 0x1c1c1c, shape: 'tiger' },
  { id: 'unicorn', name: 'Unicorn', rarity: 'uncommon', boost: 1.3, color: 0xffffff, accent: 0xff7fd6, shape: 'unicorn' },
  { id: 'phoenix', name: 'Phoenix', rarity: 'rare', boost: 1.8, color: 0xff4d2e, accent: 0xffd23f, shape: 'phoenix' },
  { id: 'golem', name: 'Gold Golem', rarity: 'epic', boost: 2.5, color: 0xffcf3d, accent: 0x8a5a0a, shape: 'golem' },
  { id: 'king', name: 'Money King', rarity: 'legendary', boost: 4.0, color: 0x46d66a, accent: 0xffd23f, shape: 'king' },
];

const PET_BY_ID: ReadonlyMap<string, PetDefinition> = new Map(PETS.map((pet) => [pet.id, pet]));

export const petById = (id: string): PetDefinition | undefined => PET_BY_ID.get(id);

/** One entry in an egg's pool: which pet, and the percentage chance. */
export interface EggOdds {
  readonly petId: string;
  /** Whole percent. Every egg's odds add up to exactly 100. */
  readonly chance: number;
}

export interface EggDefinition {
  readonly id: 'basic' | 'rare';
  readonly name: string;
  /** Wins one hatch COSTS. */
  readonly cost: number;
  /** Where the egg floats, in the spawn area. */
  readonly x: number;
  readonly z: number;
  readonly color: number;
  readonly spots: number;
  readonly pool: readonly EggOdds[];
}

/**
 * The two eggs, with the rarity chances EXACTLY as specified:
 * 30% / 30% / 25% / 10% / 4% / 1%.
 */
export const EGGS: readonly EggDefinition[] = [
  {
    id: 'basic',
    name: 'Basic Egg',
    cost: 5,
    x: -18,
    z: -22,
    color: 0xf2f6ff,
    spots: 0x4a9bff,
    pool: [
      { petId: 'dog', chance: 30 },
      { petId: 'cat', chance: 30 },
      { petId: 'bunny', chance: 25 },
      { petId: 'fox', chance: 10 },
      { petId: 'panda', chance: 4 },
      { petId: 'dragon', chance: 1 },
    ],
  },
  {
    id: 'rare',
    name: 'Rare Egg',
    cost: 3_000,
    x: 18,
    z: -22,
    color: 0x6fd6ff,
    spots: 0x1f52b8,
    pool: [
      { petId: 'wolf', chance: 30 },
      { petId: 'tiger', chance: 30 },
      { petId: 'unicorn', chance: 25 },
      { petId: 'phoenix', chance: 10 },
      { petId: 'golem', chance: 4 },
      { petId: 'king', chance: 1 },
    ],
  },
];

export const eggById = (id: string): EggDefinition | undefined => EGGS.find((egg) => egg.id === id);

/** How close a player must be to an egg to see its odds, and to hatch it. */
export const EGG_PROMPT_RADIUS = 9;
export const EGG_HATCH_RADIUS = 11;

/** Pets a player may hold. The Pets menu shows "N/30". */
export const MAX_PET_STORAGE = 30;

/** Pets equipped at once before any Max Pets upgrade. */
export const BASE_PET_SLOTS = 3;

/** How many a MULTI hatch opens at once. */
export const MULTI_HATCH_COUNT = 3;

/** Roll one pet from an egg's pool. `random` is 0..1, injected so tests can seed it. */
export const rollPet = (egg: EggDefinition, random: () => number): PetDefinition => {
  let roll = Math.min(Math.max(random(), 0), 0.999999) * 100;
  for (const odds of egg.pool) {
    if (roll < odds.chance) return petById(odds.petId) ?? (PETS[0] as PetDefinition);
    roll -= odds.chance;
  }
  const last = egg.pool[egg.pool.length - 1] as EggOdds;
  return petById(last.petId) ?? (PETS[0] as PetDefinition);
};

/** The inventory, as replicated: pet ids joined by commas. */
export const encodePets = (ids: readonly string[]): string => ids.join(',');
export const decodePets = (encoded: string): string[] =>
  encoded ? encoded.split(',').filter((id) => PET_BY_ID.has(id)) : [];

/** The equipped set, as replicated: inventory indices joined by commas. */
export const encodeIndices = (indices: readonly number[]): string => indices.join(',');
export const decodeIndices = (encoded: string): number[] =>
  encoded
    ? encoded
        .split(',')
        .map((text) => Number.parseInt(text, 10))
        .filter((index) => Number.isInteger(index) && index >= 0)
    : [];

/** Sum of the equipped pets' boosts, as a fraction. Unknown ids count for nothing. */
export const petBoostOf = (pets: readonly string[], equipped: readonly number[]): number => {
  let total = 0;
  for (const index of equipped) {
    const id = pets[index];
    if (!id) continue;
    total += petById(id)?.boost ?? 0;
  }
  return total;
};

/** Indices of the best pets owned, highest boost first, up to `slots`. */
export const bestPetIndices = (pets: readonly string[], slots: number): number[] =>
  pets
    .map((id, index) => ({ index, boost: petById(id)?.boost ?? 0 }))
    .sort((a, b) => b.boost - a.boost || a.index - b.index)
    .slice(0, Math.max(0, Math.floor(slots)))
    .map((entry) => entry.index);

export const RARITY_LABEL: Readonly<Record<PetRarity, string>> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

export const RARITY_COLOR: Readonly<Record<PetRarity, number>> = {
  common: 0x8fd66a,
  uncommon: 0x4a9bff,
  rare: 0xa66bff,
  epic: 0xff6ec7,
  legendary: 0xffcf3d,
  mythic: 0xff4d4d,
};
