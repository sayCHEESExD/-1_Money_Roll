/**
 * THE TRAINING ZONES, on the RIGHT of the Money Meadow (-X).
 *
 * Three raised, themed pads. Standing in one earns cash while AFK, at the
 * zone's multiplier. Exactly as specified:
 *
 *   Training 1  0 rebirths  x1  (owned by default)
 *   Training 2  2 rebirths  x2
 *   Training 3  5 rebirths  x3
 *
 * The requirement is enforced twice, both server-side: the shared simulation
 * refuses to let a player onto a locked pad (both halves run it, so the client
 * predicts the same wall), and the cash service pays nothing for a zone the
 * player's rebirth count does not unlock even if they somehow stood on it.
 */
export interface TrainingZone {
  /** 1-based. */
  readonly index: number;
  readonly name: string;
  /** Rebirths needed to enter. */
  readonly rebirthsRequired: number;
  /** Multiplier on the zone's cash per second. */
  readonly multiplier: number;
  /** The pad's theme, for the client. */
  readonly theme: 'desert' | 'office' | 'temple';
  readonly color: number;
}

export const TRAINING_ZONES: readonly TrainingZone[] = [
  { index: 1, name: 'Training 1', rebirthsRequired: 0, multiplier: 1, theme: 'desert', color: 0x5ed64f },
  { index: 2, name: 'Training 2', rebirthsRequired: 2, multiplier: 2, theme: 'office', color: 0xa66bff },
  { index: 3, name: 'Training 3', rebirthsRequired: 5, multiplier: 3, theme: 'temple', color: 0xff5252 },
];

/** Where the pads stand. Along the right wall, stepping down the meadow. */
export const TRAINING = {
  /** Centre X of every pad. The player's RIGHT is -X. */
  x: -78,
  firstZ: -128,
  spacingZ: 36,
  /** The pad is square. */
  size: 20,
  /** Top of the pad above the floor. Under `MOVEMENT.stepHeight`, so it is walked onto. */
  padY: 0.9,
} as const;

export const trainingZoneZ = (index: number): number =>
  TRAINING.firstZ + (Math.max(1, Math.floor(index)) - 1) * TRAINING.spacingZ;

export const trainingZoneX = (_index: number): number => TRAINING.x;

/** The rebirth count as an unlock mask: bit N-1 set when zone N is open. */
export const trainingUnlockMask = (rebirths: number): number => {
  let mask = 0;
  for (const zone of TRAINING_ZONES) {
    if (rebirths >= zone.rebirthsRequired) mask |= 1 << (zone.index - 1);
  }
  return mask;
};

export const isZoneUnlocked = (mask: number, index: number): boolean =>
  (mask & (1 << (Math.floor(index) - 1))) !== 0;

/** Multiplier for standing in a zone, or 0 when the zone is locked to this player. */
export const trainingMultiplier = (index: number, rebirths: number): number => {
  const zone = TRAINING_ZONES.find((entry) => entry.index === index);
  if (!zone) return 0;
  return rebirths >= zone.rebirthsRequired ? zone.multiplier : 0;
};

/**
 * Which zone a horizontal position is inside, ignoring height, or 0.
 *
 * The footprint test the simulation's wall uses. `trainingZoneAt` adds the
 * height test for paying: a player under the pad is not on it.
 */
export const trainingZoneFootprintAt = (x: number, z: number): number => {
  if (Math.abs(x - TRAINING.x) > TRAINING.size / 2) return 0;
  for (const zone of TRAINING_ZONES) {
    if (Math.abs(z - trainingZoneZ(zone.index)) <= TRAINING.size / 2) return zone.index;
  }
  return 0;
};

/** Which zone a position is STANDING in, or 0. Derived from position alone, by both sides. */
export const trainingZoneAt = (x: number, y: number, z: number): number => {
  if (y < TRAINING.padY - 1.2 || y > TRAINING.padY + 2.5) return 0;
  return trainingZoneFootprintAt(x, z);
};
