import { INITIAL_OWNED_BILLS } from '@money/shared';

/**
 * The DERIVING facts of a player's progression: everything a session is
 * rebuilt from. Level, the movement profile, the equipped bill and the pet
 * boost are recomputed from these by the same formulas a live session uses.
 */
export interface ProgressFields {
  /** Cash carried: the money ball. */
  cash: number;
  /** Cash earned since the last rebirth. Level follows from it. */
  levelCash: number;
  /** Cash earned over the whole profile. */
  lifetimeCash: number;
  /** Stage wins held. */
  wins: number;
  /** Bitmask of cash bills bought. The equipped one is the best of these. */
  ownedBills: number;
  rebirths: number;
  ownedAuras: number;
  auraSlot: number;
  speedUpgrades: number;
  petSlotUpgrades: number;
  /** Highest stage ever finished. */
  bestStage: number;
  /** Seconds played, lifetime. */
  playSeconds: number;
  /** Pet ids, comma-joined, and the equipped indices, comma-joined. */
  pets: string;
  equippedPets: string;
}

/** What one save writes. */
export interface ProfileFields extends ProgressFields {
  /** The portal's display name and portrait as last seen. Cleared when empty. */
  displayName: string;
  avatarUrl: string;
  /** Wall clock of the save. */
  updatedAt: number;
}

/**
 * The first-login migration's bookkeeping.
 *
 *   - An ACCOUNT profile created from a browser's guest progress carries
 *     `migratedFrom`, the guest key it came from.
 *   - That GUEST profile is then RETIRED: its progress is reset, it carries
 *     `migratedTo` (the account key), `migratedAt`, and `migratedSnapshot` -
 *     the progress it held at that moment, kept as a recovery copy. A retired
 *     guest is never migrated again and never appears on a leaderboard.
 */
export interface MigrationFields {
  migratedFrom?: string;
  migratedTo?: string;
  migratedAt?: number;
  migratedSnapshot?: ProgressFields;
}

/**
 * A profile as READ from storage. Beyond the fields this build knows, it may
 * carry any field a newer or older build wrote: those are kept and written
 * back untouched, never dropped.
 */
export type StoredProfile = ProfileFields & MigrationFields & { [field: string]: unknown };

/** The numeric progress fields. */
export const PROGRESS_KEYS = [
  'cash',
  'levelCash',
  'lifetimeCash',
  'wins',
  'ownedBills',
  'rebirths',
  'ownedAuras',
  'auraSlot',
  'speedUpgrades',
  'petSlotUpgrades',
  'bestStage',
  'playSeconds',
] as const satisfies readonly (keyof ProgressFields)[];

/** The text progress fields. */
export const PROGRESS_TEXT_KEYS = ['pets', 'equippedPets'] as const satisfies readonly (keyof ProgressFields)[];

/** Optional string fields a save may CLEAR. The only fields ever $unset. */
export const CLEARABLE_FIELDS = ['displayName', 'avatarUrl'] as const;

const numeric = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export const emptyProgress = (): ProgressFields => ({
  cash: 0,
  levelCash: 0,
  lifetimeCash: 0,
  wins: 0,
  ownedBills: 0,
  rebirths: 0,
  ownedAuras: 0,
  auraSlot: 0,
  speedUpgrades: 0,
  petSlotUpgrades: 0,
  bestStage: 0,
  playSeconds: 0,
  pets: '',
  equippedPets: '',
});

/** Just the progression of a profile, coerced. */
export const progressOf = (source: Partial<ProgressFields>): ProgressFields => {
  const out = emptyProgress();
  for (const key of PROGRESS_KEYS) out[key] = numeric(source[key]);
  for (const key of PROGRESS_TEXT_KEYS) out[key] = text(source[key]);
  return out;
};

/**
 * Coerce whatever storage held into a profile, KEEPING every unknown field.
 */
export const coerceProfile = (raw: unknown): StoredProfile | null => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const profile: StoredProfile = {
    ...source,
    ...progressOf(source as Partial<ProgressFields>),
    displayName: text(source['displayName']),
    avatarUrl: text(source['avatarUrl']),
    updatedAt: numeric(source['updatedAt']),
  };
  if (typeof source['migratedFrom'] !== 'string') delete profile.migratedFrom;
  if (typeof source['migratedTo'] !== 'string') delete profile.migratedTo;
  if (typeof source['migratedAt'] !== 'number') delete profile.migratedAt;
  if (source['migratedSnapshot'] && typeof source['migratedSnapshot'] === 'object') {
    profile.migratedSnapshot = progressOf(source['migratedSnapshot'] as Partial<ProgressFields>);
  } else {
    delete profile.migratedSnapshot;
  }
  return profile;
};

/**
 * Whether a profile holds anything worth carrying into an account. The free
 * starter bill does not count, and neither does time played on its own.
 */
export const hasProgress = (p: ProgressFields): boolean =>
  p.cash > 0 ||
  p.levelCash > 0 ||
  p.lifetimeCash > 0 ||
  p.wins > 0 ||
  p.bestStage > 0 ||
  p.rebirths > 0 ||
  (p.ownedBills & ~INITIAL_OWNED_BILLS) !== 0 ||
  p.ownedAuras !== 0 ||
  p.speedUpgrades > 0 ||
  p.petSlotUpgrades > 0 ||
  p.pets.length > 0;
