// src/api/leaderboard.js
//
// Leaderboard API client for the Kiroman frontend. Wraps the two HTTP API
// routes (`GET /leaderboard`, `POST /scores`) exposed by API Gateway and
// documented in the design's "HTTP API contract" section.
//
// FAILURE TOLERANCE (Requirement 5.7 / design Property 10): neither function
// ever throws or rejects. A network error, non-2xx status, or malformed JSON
// resolves to a safe default (`[]` for reads, `{ ok: false }` for writes) so a
// leaderboard outage can never crash the render path or transition the game out
// of a valid play state. The game stays fully playable; the UI shows a
// non-blocking notice instead.
//
// Dependency-free: uses the global `fetch` (available in browsers and Node 18+).
//
// Requirements:
//   5.1 - fetch the current global leaderboard (top three entries).
//   5.3 - submit the player's alias and highest level on game over.
//   5.7 - tolerate fetch/submit failure without crashing; keep gameplay going.

import { API_BASE } from '../config.js';

/**
 * @typedef {Object} Entry
 * @property {string} alias      Player alias.
 * @property {number} level      Highest level reached.
 * @property {number} score      Score from the run that reached that level.
 * @property {number} achievedAt Epoch ms when this best level was set.
 */

/**
 * Normalize a raw entry from the API into the `Entry` shape the UI expects.
 * Returns `null` for anything that is not a usable entry so malformed items are
 * dropped rather than crashing the leaderboard render.
 *
 * @param {unknown} raw
 * @returns {Entry | null}
 */
function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { alias, level, score, achievedAt } = /** @type {Record<string, unknown>} */ (raw);
  if (typeof alias !== 'string' || alias.length === 0) return null;
  if (typeof level !== 'number' || !Number.isFinite(level)) return null;
  const sc = typeof score === 'number' && Number.isFinite(score) ? score : 0;
  const at = typeof achievedAt === 'number' && Number.isFinite(achievedAt) ? achievedAt : 0;
  return { alias, level, score: sc, achievedAt: at };
}

/**
 * Fetch the current global leaderboard.
 *
 * Never throws: on network error, non-ok status, or malformed JSON it resolves
 * to an empty array (Requirement 5.7, design Property 10). Malformed individual
 * entries are dropped via {@link normalizeEntry}.
 *
 * @param {{ signal?: AbortSignal }} [options] - optional fetch options (e.g. an
 *   abort signal for timeout/cancellation).
 * @returns {Promise<Entry[]>} the leaderboard entries, or `[]` on any failure.
 */
export async function getLeaderboard(options = {}) {
  try {
    const res = await fetch(`${API_BASE}/leaderboard`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    return entries.map(normalizeEntry).filter((e) => e !== null);
  } catch {
    return [];
  }
}

/**
 * Submit a player's alias and highest level reached to the leaderboard.
 *
 * Never throws: on network error or non-ok status it resolves to
 * `{ ok: false }` so the game-over UI can show a non-blocking notice and let the
 * player continue / play again (Requirement 5.7). On success it returns the
 * parsed `{ ok, updated }` body, where `updated` is false when the player's
 * existing entry was already at an equal-or-higher level.
 *
 * @param {string} alias - the player's alias (validated client-side; the server
 *   re-validates).
 * @param {number} level - the highest level reached this session.
 * @param {number} score - the score for that run.
 * @param {{ signal?: AbortSignal }} [options] - optional fetch options.
 * @returns {Promise<{ ok: boolean, updated?: boolean }>}
 */
export async function submitScore(alias, level, score, options = {}) {
  try {
    const res = await fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias, level, score }),
      signal: options.signal,
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: data?.ok === true, updated: data?.updated };
  } catch {
    return { ok: false };
  }
}
