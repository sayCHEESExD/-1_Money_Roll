import { BASE_PET_SLOTS } from './pets.js';

/**
 * THE UPGRADES MENU, exactly as specified:
 *
 *   Walkspeed  +2 walk speed  5K wins each, repeatable
 *   Max Pets   +1 pet equip   1M wins each, repeatable
 *
 * Both are bought with Wins and both are counted on the profile. The server
 * enforces every purchase and every limit that follows from one.
 */
export type UpgradeKind = 'walkspeed' | 'maxPets';

export interface UpgradeDefinition {
  readonly kind: UpgradeKind;
  readonly name: string;
  readonly effect: string;
  /** Wins one level COSTS. */
  readonly cost: number;
}

export const UPGRADES: readonly UpgradeDefinition[] = [
  { kind: 'walkspeed', name: 'Walkspeed', effect: '+2 Speed', cost: 5_000 },
  { kind: 'maxPets', name: 'Max Pets', effect: '+1 Pet Equip', cost: 1_000_000 },
];

export const upgradeByKind = (kind: string): UpgradeDefinition | undefined =>
  UPGRADES.find((upgrade) => upgrade.kind === kind);

/**
 * Most levels of either upgrade that can be replicated: the counts are uint8
 * fields. The spec puts no ceiling on either, and 255 walkspeed upgrades is
 * a 526-unit-per-second walk that nobody will buy before the field wraps.
 */
export const MAX_UPGRADE_LEVELS = 255;

/** Equipped-pet capacity: the base three plus one per Max Pets upgrade. */
export const maxPetSlots = (petSlotUpgrades: number): number =>
  BASE_PET_SLOTS + Math.max(0, Math.floor(Number.isFinite(petSlotUpgrades) ? petSlotUpgrades : 0));
