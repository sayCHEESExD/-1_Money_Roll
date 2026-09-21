import { LEADERBOARD_SIZE, handleFor } from '@money/shared';
import type { LeaderEntry, LeaderboardState } from '../rooms/state/CourseState.js';
import type { PlayerState } from '../rooms/state/PlayerState.js';
import { profileStore } from './ProfileStore.js';

/** Seconds between rebuilds. A board is not a thing that needs 20 Hz. */
const REFRESH_SECONDS = 2;

interface Candidate {
  readonly handle: string;
  readonly name: string;
  readonly avatarUrl: string;
  readonly time: number;
  readonly wins: number;
  readonly cash: number;
}

/**
 * The three boards on the back wall of the spawn area: Time, Wins and Cash
 * (lifetime cash earned). Every figure is the SERVER's, merged from stored
 * profiles and live state, the live figure winning wherever both exist.
 */
export class LeaderboardService {
  private timer = 0;

  update(
    delta: number,
    board: LeaderboardState,
    live: Iterable<[string, PlayerState]>,
    playerIds: ReadonlyMap<string, string>,
  ): boolean {
    this.timer -= delta;
    if (this.timer > 0) return false;
    this.timer = REFRESH_SECONDS;
    this.rebuild(board, live, playerIds);
    return true;
  }

  rebuild(
    board: LeaderboardState,
    live: Iterable<[string, PlayerState]>,
    playerIds: ReadonlyMap<string, string>,
  ): void {
    const byHandle = new Map<string, Candidate>();

    for (const [id, profile] of profileStore.entries()) {
      if (profile.migratedTo) continue;
      const handle = handleFor(id);
      byHandle.set(handle, {
        handle,
        name: profile.displayName ?? '',
        avatarUrl: profile.avatarUrl ?? '',
        time: profile.playSeconds ?? 0,
        wins: profile.wins,
        cash: profile.lifetimeCash ?? 0,
      });
    }

    for (const [sessionId, player] of live) {
      const id = playerIds.get(sessionId);
      if (!id) continue;
      const handle = handleFor(id);
      byHandle.set(handle, {
        handle,
        name: player.displayName,
        avatarUrl: player.avatarUrl,
        time: player.playSeconds,
        wins: player.wins,
        cash: player.lifetimeCash,
      });
    }

    const all = [...byHandle.values()];
    fill(board.time, all, (c) => c.time);
    fill(board.wins, all, (c) => c.wins);
    fill(board.cash, all, (c) => c.cash);
  }
}

/** Rank by one field and write the top N into a replicated array, in place. */
const fill = (
  into: LeaderEntry[] & { push(entry: LeaderEntry): unknown },
  all: readonly Candidate[],
  pick: (candidate: Candidate) => number,
): void => {
  const ranked = all
    .filter((candidate) => pick(candidate) > 0)
    .sort((a, b) => pick(b) - pick(a))
    .slice(0, LEADERBOARD_SIZE);

  for (let i = 0; i < LEADERBOARD_SIZE; i += 1) {
    const entry = into[i];
    if (!entry) continue;
    const candidate = ranked[i];
    const handle = candidate ? candidate.handle : '';
    const name = candidate ? candidate.name : '';
    const avatarUrl = candidate ? candidate.avatarUrl : '';
    const value = candidate ? Math.floor(pick(candidate)) : 0;
    if (entry.handle !== handle) entry.handle = handle;
    if (entry.name !== name) entry.name = name;
    if (entry.avatarUrl !== avatarUrl) entry.avatarUrl = avatarUrl;
    if (entry.value !== value) entry.value = value;
  }
};

export const leaderboardService = new LeaderboardService();
