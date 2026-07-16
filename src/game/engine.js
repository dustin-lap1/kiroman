// src/game/engine.js
//
// Pure game engine for Kiroman: the state shape plus the `step` reducer that
// advances it. No React, canvas, DOM or timers — this module is fully
// unit-testable under Node's test runner and is the single owner of game state
// (input adapters only emit intents; the renderer only reads state).
//
// Units: all entity positions are in **tile units** (floats), consistent with
// speeds expressed in tiles/second and `dt` in seconds (see constants.js). An
// entity at `{ x, y }` is centred on tile `(round(x), round(y))`.
//
// Scope note (task 3.1): this file implements initial-state construction and
// Kiroman's grid-aligned movement with turn buffering + wall blocking
// (Requirement 2.2). Pellet scoring/level-up (3.2), chaser AI/lives/game-over
// (3.3) and difficulty/pause specifics (3.4) are marked with TODOs and slot
// into the same state shape and `step` pipeline. Chasers are already positioned
// at their spawns (they simply are not moved yet).

import {
  KIROMAN_SPEED,
  STARTING_LIVES,
  PELLET_VALUE,
  DIRECTION_NAMES,
} from './constants.js';
import { MAZES, tileIndex } from './maze.js';
import { advanceEntity, advanceChaser, entityTile } from './entities.js';
import { chaserSpeedForLevel } from './difficulty.js';

/**
 * @typedef {Object} Entity
 * @property {number} x tile-unit x (float; entity centre)
 * @property {number} y tile-unit y (float; entity centre)
 * @property {?string} dir current direction of travel ('up'|'down'|'left'|'right'|null)
 * @property {?string} [nextDir] buffered/requested direction (Kiroman only)
 */

/**
 * @typedef {Object} GameState
 * @property {'playing'|'paused'|'gameover'} status current lifecycle status
 * @property {number} level current level number (1-based)
 * @property {number} score accumulated score
 * @property {number} lives remaining lives
 * @property {Entity} kiroman the player entity (carries `nextDir` for buffering)
 * @property {Entity[]} chasers the Kiro chasers
 * @property {Set<number>} pellets remaining pellet tile indices (flat `row*width+col`)
 * @property {import('./maze.js').Maze} maze the parsed maze for the level
 * @property {number} highestLevel running maximum level reached this session
 */

/**
 * The maze layout used for gameplay. Task 3.1 uses the single default layout;
 * multi-layout selection can key off `level` later without changing callers.
 * @type {import('./maze.js').Maze}
 */
const DEFAULT_MAZE = MAZES[0];

/**
 * Build a fresh game state positioned at the maze's spawns.
 *
 * Kiroman starts stopped (`dir: null`, `nextDir: null`) at its spawn; each Kiro
 * chaser starts stopped at its spawn. The pellet set is **copied** from the
 * maze so consuming pellets (task 3.2) never mutates the shared maze model.
 *
 * @param {number} [level=1] starting level number
 * @param {number} [lives=STARTING_LIVES] starting life count
 * @returns {GameState} a new, playable game state
 */
export function createInitialState(level = 1, lives = STARTING_LIVES) {
  const maze = DEFAULT_MAZE;
  const spawn = maze.spawns.kiroman;

  const kiroman = { x: spawn.col, y: spawn.row, dir: null, nextDir: null };
  const chasers = maze.spawns.chasers.map((c) => ({
    x: c.col,
    y: c.row,
    dir: null,
  }));

  return {
    status: 'playing',
    level,
    score: 0,
    lives,
    kiroman,
    chasers,
    pellets: new Set(maze.pellets),
    maze,
    highestLevel: level,
  };
}

/**
 * Advance the game by one tick. Pure: returns a NEW state and never mutates the
 * input `state` (or any nested object/collection it holds).
 *
 * Behaviour:
 *   - **Pause (Requirements 4.1, 4.4):** `input.pause === true` is a *toggle
 *     request* on a rising edge — one intent per keypress/tap. It flips status
 *     `playing` <-> `paused`. The input adapters (keyboard `Space`, touch pause
 *     button) emit exactly one `pause: true` intent per discrete press, so
 *     treating each `pause: true` as a single toggle request is the contract:
 *     the engine does NOT debounce across ticks — a caller that holds `pause`
 *     true every tick would flip-flop, which the adapters are responsible for
 *     not doing. A pause toggle tick only changes status; no entity moves and no
 *     directional intent on that same tick is applied (Requirement 4.3).
 *   - **Pause is a no-op on game over:** once `status === 'gameover'` the world
 *     is terminal, so a `pause` intent is ignored and the state stays frozen.
 *   - **Frozen while paused (Requirements 4.3, 4.5; design Property 6):** while
 *     `status !== 'playing'`, ALL movement of Kiroman and the chasers is halted
 *     and directional intents are ignored — applying any number of `step` calls
 *     with any `direction` leaves every entity position unchanged. Resuming
 *     (another pause toggle) continues from exactly that state.
 *   - **Movement while playing:** `input.direction` is stored as Kiroman's
 *     `nextDir` (turn buffering) and applied by `advanceEntity` as soon as the
 *     path that way is open at a tile boundary; Kiroman moves in its current
 *     direction unless a wall blocks it (Requirement 2.2).
 *   - **Difficulty (Requirement 3.3, design Property 4):** chaser speed for the
 *     tick is `chaserSpeedForLevel(state.level)` — non-decreasing with level and
 *     capped at MAX_CHASER_SPEED.
 *
 * @param {GameState} state current state (not mutated)
 * @param {{direction?: string, pause?: boolean}} [input={}] player intent for this tick
 * @param {number} [dt=0] elapsed time in seconds since the last tick
 * @returns {GameState} the next state
 */
export function step(state, input = {}, dt = 0) {
  // Pause toggle (rising-edge, single intent per keypress — see contract above).
  // No effect once the game is over: a terminal state stays terminal. On a
  // toggle tick we ONLY change status; entities do not move and any directional
  // intent on this tick is intentionally not applied (Requirement 4.3/4.4).
  if (input.pause && state.status !== 'gameover') {
    const status = state.status === 'paused' ? 'playing' : 'paused';
    return {
      ...state,
      status,
      kiroman: { ...state.kiroman },
      chasers: state.chasers.map((c) => ({ ...c })),
    };
  }

  // While paused or gamed-over, the world is frozen and inputs are ignored:
  // entity positions are preserved byte-for-byte (design Property 6). We return
  // fresh copies to keep `step` pure without ever changing coordinates/dirs.
  if (state.status !== 'playing') {
    return {
      ...state,
      kiroman: { ...state.kiroman },
      chasers: state.chasers.map((c) => ({ ...c })),
    };
  }

  // Buffer the requested direction (turn buffering). It is committed inside
  // advanceEntity the instant the path in that direction opens at a boundary.
  let kiroman = { ...state.kiroman };
  if (input.direction && DIRECTION_NAMES.includes(input.direction)) {
    kiroman.nextDir = input.direction;
  }

  // Move Kiroman: grid-aligned, wall-blocked, turn-buffered.
  kiroman = advanceEntity(state.maze, kiroman, KIROMAN_SPEED, dt);

  // --- Chaser pursuit AI (Requirement 2.4, design Property 1) -----------------
  // Each chaser re-evaluates its heading at every tile centre and greedily
  // steps toward Kiroman's current tile, minimising Manhattan distance while
  // avoiding an immediate reverse when another option exists (classic Pac-Man
  // rule). `advanceChaser` only ever begins a segment into an already-open
  // tile, so chasers never clip into walls. The pursuit is fully deterministic
  // (no `Math.random`) so the engine stays testable/pure.
  //
  // Difficulty scaling (Requirement 3.3, design Property 4): the chaser speed
  // for this tick is derived from the current level via `chaserSpeedForLevel`,
  // which is non-decreasing in `level` and capped at MAX_CHASER_SPEED.
  const chaserSpeed = chaserSpeedForLevel(state.level);
  const target = entityTile(kiroman);
  let chasers = state.chasers.map((c) =>
    advanceChaser(state.maze, c, target, chaserSpeed, dt)
  );

  // Working copies of the mutable scalars for this tick.
  let pellets = state.pellets;
  let score = state.score;
  let level = state.level;
  let lives = state.lives;
  let maze = state.maze;
  let highestLevel = state.highestLevel;

  // --- Life loss on contact & game over (Requirements 2.5, 2.6) ---------------
  // Collision rule: contact means a chaser shares Kiroman's tile (entityTile
  // equality) *after* both Kiroman and the chasers have moved this tick. For a
  // grid game advanced at a small fixed dt, this same-tile post-move check also
  // covers the practical "crossed on the same tile" case, so we do not model a
  // mid-segment position swap separately (documented simplification). Collision
  // takes precedence over pellet collection for this tick.
  //   - On contact the player loses exactly one life.
  //   - If that empties their lives, the game ends: status becomes 'gameover'
  //     and the world freezes on subsequent ticks (the status guard above stops
  //     all movement) — Requirement 2.6.
  //   - Otherwise Kiroman and the chasers reset to their spawns for another
  //     attempt while score, level and the pellet layout are preserved
  //     (Requirement 2.5).
  const kTile = entityTile(kiroman);
  const contact = chasers.some((c) => {
    const ct = entityTile(c);
    return ct.col === kTile.col && ct.row === kTile.row;
  });

  if (contact) {
    lives -= 1;
    if (lives <= 0) {
      return {
        ...state,
        status: 'gameover',
        level,
        score,
        lives: 0,
        kiroman,
        chasers,
        pellets,
        maze,
        highestLevel: Math.max(highestLevel, level),
      };
    }

    // Reset positions to spawns; keep score, level, pellets, highestLevel.
    const respawn = maze.spawns.kiroman;
    const resetKiroman = { x: respawn.col, y: respawn.row, dir: null, nextDir: null };
    const resetChasers = maze.spawns.chasers.map((c) => ({
      x: c.col,
      y: c.row,
      dir: null,
    }));
    return {
      ...state,
      status: state.status,
      level,
      score,
      lives,
      kiroman: resetKiroman,
      chasers: resetChasers,
      pellets,
      maze,
      highestLevel: Math.max(highestLevel, level),
    };
  }

  // --- Pellet collection & scoring (Requirement 2.3, design Property 2) -------
  // Kiroman collects the pellet on its occupied tile. We only ever remove from
  // the pellet set (never add), and score rises by exactly PELLET_VALUE per
  // pellet consumed. The set is treated as immutable: on a hit we build a NEW
  // Set so the input `state.pellets` is never mutated (step stays pure).
  const { col, row } = entityTile(kiroman);
  const idx = tileIndex(state.maze, col, row);
  if (state.pellets.has(idx)) {
    pellets = new Set(state.pellets);
    pellets.delete(idx);
    score += PELLET_VALUE;
  }

  // --- Level-up (Requirements 3.1, 3.2; design Properties 3 & 5) --------------
  // Level-up rule: within the SAME tick that Kiroman consumes the final pellet,
  // once `pellets` is empty we advance to the next level. This makes the
  // transition deterministic (no dependence on a later tick) and idempotent
  // between ticks — the pellet set for the new level is never empty, so a fresh
  // tick won't re-trigger. On advance we:
  //   - increment `level` (strictly increases),
  //   - repopulate the pellet layout for the new level from the maze,
  //   - reset Kiroman and the chasers to their spawns,
  //   - PRESERVE `score` and `lives` (they carry across levels),
  //   - update `highestLevel` to max(highestLevel, level).
  if (pellets.size === 0) {
    level += 1;
    maze = mazeForLevel(level);
    pellets = new Set(maze.pellets);

    const spawn = maze.spawns.kiroman;
    kiroman = { x: spawn.col, y: spawn.row, dir: null, nextDir: null };
    chasers = maze.spawns.chasers.map((c) => ({ x: c.col, y: c.row, dir: null }));

    highestLevel = Math.max(highestLevel, level);
  }

  // --- Highest level is a running max (Requirement 3.5, design Property 7) -----
  // `highestLevel` never decreases and always equals the maximum `level` seen.
  // `level` itself never decreases, so this max is monotonic across ticks.
  highestLevel = Math.max(highestLevel, level);

  return {
    ...state,
    status: state.status,
    level,
    score,
    lives,
    kiroman,
    chasers,
    pellets,
    maze,
    highestLevel,
  };
}

/**
 * Select the parsed maze layout for a given level. Task 3.2 uses the single
 * default layout for every level (repopulating its pellets on level-up);
 * multi-layout selection can key off `level` here later without touching
 * callers.
 * @param {number} _level 1-based level number
 * @returns {import('./maze.js').Maze} the maze to play for that level
 */
function mazeForLevel(_level) {
  return DEFAULT_MAZE;
}
