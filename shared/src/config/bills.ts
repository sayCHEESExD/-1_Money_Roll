/**
 * THE CASH BILLS: the ten cash upgrades on the LEFT of the Money Meadow.
 *
 * Each one sets how much a stack of cash in the meadow is worth. They are
 * BOUGHT with Wins by walking onto the bill's display pad while holding the
 * Wins it asks for, exactly as specified, and the best one owned is always the
 * one equipped. The equipped bill also decides the COLOUR of the meadow, the
 * money ball, the bridge notes and every cash effect.
 *
 * The values are EXACTLY as specified. `verify:progression` asserts them.
 */
export interface BillDefinition {
  /** 1-based slot, matching the pad order in the spawn area. */
  readonly slot: number;
  readonly name: string;
  /** Cash granted per stack while this is the equipped bill. */
  readonly gain: number;
  /** Wins the upgrade COSTS. 0 for the free starter. */
  readonly winsRequired: number;
  /** The bill's colour: meadow, ball, bridge and pickups all wear it. */
  readonly color: number;
  /** A darker shade of it, for the note's ink and the ball's seams. */
  readonly ink: number;
}

export const BILLS: readonly BillDefinition[] = [
  { slot: 1, name: 'Green Bill', gain: 1, winsRequired: 0, color: 0x46d66a, ink: 0x1d7a36 },
  { slot: 2, name: 'Blue Bill', gain: 2, winsRequired: 5, color: 0x4a9bff, ink: 0x1f52b8 },
  { slot: 3, name: 'Purple Bill', gain: 5, winsRequired: 25, color: 0xa66bff, ink: 0x5a2fb0 },
  { slot: 4, name: 'Pink Bill', gain: 10, winsRequired: 150, color: 0xff6ec7, ink: 0xb8307f },
  { slot: 5, name: 'Orange Bill', gain: 30, winsRequired: 1_000, color: 0xffa33b, ink: 0xb85e0e },
  { slot: 6, name: 'Red Bill', gain: 100, winsRequired: 3_000, color: 0xff5252, ink: 0xa81f1f },
  { slot: 7, name: 'Cyan Bill', gain: 350, winsRequired: 12_000, color: 0x3ee6e6, ink: 0x14848a },
  { slot: 8, name: 'Gold Bill', gain: 1_000, winsRequired: 40_000, color: 0xffd23f, ink: 0xa87a0a },
  { slot: 9, name: 'Platinum Bill', gain: 4_000, winsRequired: 100_000, color: 0xe9eef8, ink: 0x7a869c },
  { slot: 10, name: 'Diamond Bill', gain: 15_000, winsRequired: 250_000, color: 0x7ff6ff, ink: 0x1b5a8a },
];

/** Slots must fit `PlayerState.ownedBills`, a uint16 bitmask. */
export const MAX_BILL_SLOTS = 16;

/** The bill every player starts with. Free, and owned at join. */
export const STARTER_BILL_SLOT = 1;

const BY_SLOT: ReadonlyMap<number, BillDefinition> = new Map(BILLS.map((bill) => [bill.slot, bill]));

/** The bill in a slot, or the starter when the slot is unknown. Never throws. */
export const billForSlot = (slot: number): BillDefinition => {
  const found = BY_SLOT.get(Math.floor(slot));
  if (found) return found;
  return BY_SLOT.get(STARTER_BILL_SLOT) as BillDefinition;
};

/** Bit for one slot in the owned mask. Slot 1 is bit 0. */
export const billBit = (slot: number): number => 1 << (Math.floor(slot) - 1);

export const ownsBill = (ownedMask: number, slot: number): boolean =>
  (ownedMask & billBit(slot)) !== 0;

/** The owned mask a brand new profile starts with. */
export const INITIAL_OWNED_BILLS = billBit(STARTER_BILL_SLOT);

/** The best bill a mask owns, by gain. Equipping it can never be a downgrade. */
export const bestOwnedBill = (ownedMask: number): BillDefinition => {
  let best = billForSlot(STARTER_BILL_SLOT);
  for (const bill of BILLS) {
    if (!ownsBill(ownedMask, bill.slot)) continue;
    if (bill.gain > best.gain) best = bill;
  }
  return best;
};

/** Compact display form for a bill's gain: +1, +30, +1K, +15K. */
export const formatGain = (value: number): string => {
  const amount = Math.max(0, Math.floor(value));
  if (amount >= 1_000_000) return `${Math.round(amount / 100_000) / 10}M`;
  if (amount >= 1_000) return `${Math.round(amount / 100) / 10}K`;
  return amount.toString();
};
