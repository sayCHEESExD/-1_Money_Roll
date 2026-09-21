/**
 * AURAS: the four cash boosts in the Aura menu, EXACTLY as specified.
 *
 *   Dust    5K wins  x1.5
 *   Nature  50K wins x2
 *   Fire    1M wins  x3
 *   Troll   250M wins x4
 *
 * An aura is bought with Wins, worn one at a time, and VISIBLY surrounds the
 * player - dust, leaves, flames or the rainbow troll swirl.
 */
export type AuraStyle = 'dust' | 'nature' | 'fire' | 'troll';

export interface AuraTier {
  readonly slot: number;
  readonly name: string;
  /** Multiplier on cash while worn. */
  readonly boost: number;
  /** Wins the aura COSTS. Spent from the wallet when bought. */
  readonly winsRequired: number;
  readonly color: number;
  readonly style: AuraStyle;
}

export const AURA_TIERS: readonly AuraTier[] = [
  { slot: 1, name: 'Dust Aura', boost: 1.5, winsRequired: 5_000, color: 0x9be9f0, style: 'dust' },
  { slot: 2, name: 'Nature Aura', boost: 2, winsRequired: 50_000, color: 0x5ed64f, style: 'nature' },
  { slot: 3, name: 'Fire Aura', boost: 3, winsRequired: 1_000_000, color: 0xff7a1f, style: 'fire' },
  { slot: 4, name: 'Troll Aura', boost: 4, winsRequired: 250_000_000, color: 0xff5fe0, style: 'troll' },
];

/** Slots must fit `PlayerState.ownedAuras`, a uint8 bitmask. */
export const MAX_AURA_SLOTS = 8;

export const NO_AURA = 0;

export const auraBySlot = (slot: number): AuraTier | undefined =>
  AURA_TIERS.find((tier) => tier.slot === slot);

export const auraMask = (slot: number): number => 1 << (Math.floor(slot) - 1);

export const isAuraOwned = (owned: number, slot: number): boolean =>
  (owned & auraMask(slot)) !== 0;

/** Multiplier from the worn aura. 1 for none, and 1 for any slot not owned. */
export const auraMultiplier = (slot: number, owned: number): number => {
  const tier = auraBySlot(slot);
  if (!tier) return 1;
  return isAuraOwned(owned, tier.slot) ? tier.boost : 1;
};
