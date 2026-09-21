import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { LEADERBOARD_SIZE } from '@money/shared';
import { PlayerState } from './PlayerState.js';

/** One row of one board: who, and how much. */
export class LeaderEntry extends Schema {
  /** The row's KEY, derived from the account id. NEVER DRAWN. */
  @type('string') handle = '';
  /** THE NAME THE BOARD SHOWS: the portal's display name, or empty. */
  @type('string') name = '';
  @type('string') avatarUrl = '';
  @type('float64') value = 0;
}

/**
 * The three boards on the back wall: Time, Wins and Cash. FIXED-LENGTH
 * arrays, allocated once and written in place.
 */
export class LeaderboardState extends Schema {
  @type([LeaderEntry]) time = rows();
  @type([LeaderEntry]) wins = rows();
  @type([LeaderEntry]) cash = rows();
}

const rows = (): ArraySchema<LeaderEntry> => {
  const list = new ArraySchema<LeaderEntry>();
  for (let i = 0; i < LEADERBOARD_SIZE; i += 1) list.push(new LeaderEntry());
  return list;
};

/**
 * ONE CASH PICKUP floating over the lava: the "+100 Bills" popups.
 *
 * A FIXED POOL of these, written in place. The server spawns them on an
 * irregular random schedule and collects them against its own positions; the
 * client only draws what is active.
 */
export class PickupState extends Schema {
  @type('boolean') active = false;
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('float64') amount = 0;
  @type('uint8') stage = 0;
  /** Server clock at which it appeared, so the client can bob and time it. */
  @type('float64') bornAt = 0;
}

/** How many pickups can be out at once. */
export const PICKUP_POOL = 12;

const pickups = (): ArraySchema<PickupState> => {
  const list = new ArraySchema<PickupState>();
  for (let i = 0; i < PICKUP_POOL; i += 1) list.push(new PickupState());
  return list;
};

/** Root replicated state for a single world instance. */
export class CourseState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  /** Server uptime in seconds: the clock the pickups and effects run on. */
  @type('float64') elapsed = 0;

  @type(LeaderboardState) leaderboard = new LeaderboardState();

  @type([PickupState]) pickups = pickups();
}
