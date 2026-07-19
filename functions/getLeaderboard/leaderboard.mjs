// functions/getLeaderboard/leaderboard.mjs
//
// Pure, AWS-free leaderboard logic for the Kiroman GET /leaderboard Lambda.
//
// This module is deliberately free of any @aws-sdk imports, network IO, or
// environment access so it can be unit-tested with `node --test` in isolation.
// The Lambda handler (index.mjs) does the DynamoDB IO and delegates the
// sort/top-N/shaping to `topEntries` here.
//
// Requirements:
//   5.1 - return the top three entries by highest level reached.
//   5.2 - each entry exposes the player alias and highest level reached.
//   5.6 - equal levels are ordered by higher score first, then earliest-achieved.
// Design Property 9: entries sorted by level desc, then score desc, then
// achievedAt asc, at most 3.

/**
 * Default number of leaderboard entries to return.
 */
export const DEFAULT_TOP_N = 3;

/**
 * Compare two raw leaderboard items for ranking order.
 *
 * Ordering (Requirements 5.1, 5.6 / Design Property 9):
 *   1. higher `level` first (descending)
 *   2. higher `score` first (descending) as the tiebreaker within a level, so
 *      two players who reached the same level are ranked by how many points
 *      they earned getting there.
 *   3. earlier `achievedAt` first (ascending) when level and score both tie.
 *   4. `alias` ascending as a final, deterministic tiebreaker so the result
 *      is stable regardless of the order items arrive from DynamoDB.
 *
 * Missing/invalid numeric fields are coerced to safe defaults (level 0,
 * score 0, achievedAt 0) so a malformed item can never throw or reorder
 * unpredictably.
 */
function compareEntries(a, b) {
  const levelA = Number(a?.level) || 0;
  const levelB = Number(b?.level) || 0;
  if (levelA !== levelB) return levelB - levelA; // level desc

  const scoreA = Number(a?.score) || 0;
  const scoreB = Number(b?.score) || 0;
  if (scoreA !== scoreB) return scoreB - scoreA; // score desc

  const atA = Number(a?.achievedAt) || 0;
  const atB = Number(b?.achievedAt) || 0;
  if (atA !== atB) return atA - atB; // achievedAt asc

  const aliasA = String(a?.alias ?? '');
  const aliasB = String(b?.alias ?? '');
  if (aliasA < aliasB) return -1;
  if (aliasA > aliasB) return 1;
  return 0;
}

/**
 * Project a raw DynamoDB item onto the public leaderboard entry shape.
 * Exposes alias, level, score, and achievedAt (Requirement 5.2). A missing
 * `score` (e.g. an entry written before scores were tracked) defaults to 0.
 */
function toEntry(item) {
  return {
    alias: String(item?.alias ?? ''),
    level: Number(item?.level) || 0,
    score: Number(item?.score) || 0,
    achievedAt: Number(item?.achievedAt) || 0,
  };
}

/**
 * Sort raw leaderboard items and return the top `n` as public entries.
 *
 * Pure and deterministic: does not mutate the input array, produces the same
 * output for any input ordering, and returns at most `n` items (fewer when the
 * input is smaller).
 *
 * @param {Array<object>} items - raw items (e.g. DynamoDB Query results).
 * @param {number} [n=DEFAULT_TOP_N] - maximum number of entries to return.
 * @returns {Array<{alias: string, level: number, achievedAt: number}>}
 */
export function topEntries(items, n = DEFAULT_TOP_N) {
  if (!Array.isArray(items)) return [];
  const limit = Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_TOP_N;
  return [...items]
    .sort(compareEntries)
    .slice(0, limit)
    .map(toEntry);
}
