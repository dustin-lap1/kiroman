// src/game/difficulty.js
//
// Pure difficulty-scaling helpers for the Kiroman engine.
//
// No React, canvas, DOM or timers — importable by both the browser build and
// Node's test runner. This module owns the single rule that maps a level number
// to a chaser speed, so the engine and any tuning/tests share one source of
// truth for how difficulty ramps.
//
// Design Property 4 (difficulty monotonic and capped): chaser speed is
// non-decreasing as `level` grows and never exceeds MAX_CHASER_SPEED
// (Requirement 3.3).

import { BASE_CHASER_SPEED, MAX_CHASER_SPEED } from './constants.js';

/**
 * Per-level increase in chaser speed, in tiles/second. Chaser speed starts at
 * BASE_CHASER_SPEED at level 1 and gains this much per level thereafter, until
 * it reaches the MAX_CHASER_SPEED ceiling.
 *
 * With the current tuning (BASE = 4, MAX = 8, increment = 0.5) the speed ramps
 * linearly from level 1 and saturates at the cap on level 9:
 *   level 1 → 4.0, level 2 → 4.5, … level 9 → 8.0, level 10+ → 8.0 (capped).
 * @type {number}
 */
export const CHASER_SPEED_INCREMENT = 0.5; // tiles/sec added per level

/**
 * Chaser speed (tiles/second) for a given level.
 *
 * Formula: `BASE_CHASER_SPEED + (level - 1) * CHASER_SPEED_INCREMENT`, clamped
 * to `MAX_CHASER_SPEED`. Levels below 1 are treated as level 1 so the function
 * is total and never returns less than the base speed.
 *
 * Guarantees (design Property 4 / Requirement 3.3):
 *   - **Non-decreasing:** `chaserSpeedForLevel(n) <= chaserSpeedForLevel(n+1)`
 *     for all n (a linear ramp clamped from above is monotonic).
 *   - **Capped:** the result never exceeds `MAX_CHASER_SPEED`.
 *   - **Base at level 1:** `chaserSpeedForLevel(1) === BASE_CHASER_SPEED`.
 *
 * @param {number} level 1-based level number
 * @returns {number} chaser speed in tiles/second for that level
 */
export function chaserSpeedForLevel(level) {
  const lvl = level > 1 ? level : 1;
  const raw = BASE_CHASER_SPEED + (lvl - 1) * CHASER_SPEED_INCREMENT;
  return Math.min(raw, MAX_CHASER_SPEED);
}
