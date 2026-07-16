// src/game/constants.js
//
// Pure tuning constants for the Kiroman game engine.
//
// This module is intentionally free of React, canvas, DOM and timers so it can
// be imported both by the browser build and by Node's test runner. It only
// exports plain values and frozen objects.

/**
 * Size of a single maze tile, in CSS pixels. The maze is a grid of TILE_SIZE
 * squares; the renderer scales the whole board with CSS, so this is the
 * internal (logical) tile size used by pixel<->tile conversions.
 * @type {number}
 */
export const TILE_SIZE = 24;

/**
 * Chaser (Kiro) movement speeds, expressed in **tiles per second**.
 *
 * The engine advances entities by `speed * dt` tiles each step, so these are
 * unit-consistent with `dt` measured in seconds. `BASE_CHASER_SPEED` applies at
 * level 1; difficulty scaling raises the speed as the level climbs but never
 * past `MAX_CHASER_SPEED` (see design Property 4: difficulty monotonic + capped).
 * @type {number}
 */
export const BASE_CHASER_SPEED = 4; // tiles/sec at level 1

/**
 * Upper bound for chaser speed, in tiles per second. Difficulty scaling is
 * capped here so the game stays playable at high levels.
 * @type {number}
 */
export const MAX_CHASER_SPEED = 8; // tiles/sec ceiling

/**
 * Reference speed for Kiroman (the player), in tiles per second. Kept slightly
 * above the base chaser speed so early levels are winnable.
 * @type {number}
 */
export const KIROMAN_SPEED = 5; // tiles/sec

/**
 * Number of lives the player starts a game with.
 * @type {number}
 */
export const STARTING_LIVES = 3;

/**
 * Score awarded for collecting a single pellet.
 * @type {number}
 */
export const PELLET_VALUE = 10;

/**
 * Directional unit vectors keyed by intent name. `dx`/`dy` are tile deltas in
 * screen coordinates (y grows downward), so `up` decreases the row index.
 *
 * @type {Readonly<{
 *   up:    Readonly<{dx: 0,  dy: -1}>,
 *   down:  Readonly<{dx: 0,  dy: 1}>,
 *   left:  Readonly<{dx: -1, dy: 0}>,
 *   right: Readonly<{dx: 1,  dy: 0}>,
 * }>}
 */
export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ dx: 0, dy: -1 }),
  down: Object.freeze({ dx: 0, dy: 1 }),
  left: Object.freeze({ dx: -1, dy: 0 }),
  right: Object.freeze({ dx: 1, dy: 0 }),
});

/**
 * The valid direction names, for validation and iteration.
 * @type {ReadonlyArray<'up'|'down'|'left'|'right'>}
 */
export const DIRECTION_NAMES = Object.freeze(['up', 'down', 'left', 'right']);
