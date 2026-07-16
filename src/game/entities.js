// src/game/entities.js
//
// Pure entity-movement helpers for the Kiroman engine.
//
// No React, canvas, DOM or timers — importable by both the browser build and
// Node's test runner. These helpers implement classic Pac-Man-style,
// grid-aligned movement with turn buffering:
//
//   * Positions are expressed in **tile units** (floats): an entity at
//     `{ x, y }` is centred on tile `(Math.round(x), Math.round(y))`. When
//     `x`/`y` are integers the entity is "aligned" (sitting exactly on a tile
//     centre); between centres exactly one axis is fractional.
//   * Entities only make decisions (turn / stop / continue) at tile centres.
//     Between centres they glide in a straight line toward the next centre, so
//     they never head into a tile that was not already verified open.
//   * `nextDir` is the buffered/requested direction; it is applied as soon as
//     the path in that direction is open at a tile boundary (turn buffering).
//
// Because movement segments always target an already-open neighbouring tile,
// the tile an entity occupies is never a wall — this is what upholds design
// Property 1 (no wall clipping).

import { DIRECTIONS, DIRECTION_NAMES } from './constants.js';
import { isWall } from './maze.js';

/**
 * Floating-point tolerance for treating a coordinate as "on a tile centre".
 * @type {number}
 */
const EPS = 1e-9;

/**
 * Is the entity aligned to a tile centre (both coordinates ~integers)?
 * @param {number} x tile-unit x
 * @param {number} y tile-unit y
 * @returns {boolean}
 */
export function isAligned(x, y) {
  return Math.abs(x - Math.round(x)) < EPS && Math.abs(y - Math.round(y)) < EPS;
}

/**
 * Can an entity currently on tile (col, row) move one tile in `dir` without
 * entering a wall? Out-of-bounds tiles count as walls (see maze.isWall).
 * @param {{walls: boolean[][], width: number, height: number}} maze parsed maze
 * @param {number} col column (x tile) the entity is on
 * @param {number} row row (y tile) the entity is on
 * @param {('up'|'down'|'left'|'right'|null|undefined)} dir direction to test
 * @returns {boolean} true when the neighbouring tile in `dir` is open
 */
export function canMove(maze, col, row, dir) {
  const d = dir ? DIRECTIONS[dir] : null;
  if (!d) return false;
  return !isWall(maze, col + d.dx, row + d.dy);
}

/**
 * Distance (in tiles) from the current position to the next tile centre when
 * travelling in `dir`. For an aligned entity this is exactly 1; mid-tile it is
 * the fractional remainder to the upcoming centre.
 * @param {number} x tile-unit x
 * @param {number} y tile-unit y
 * @param {('up'|'down'|'left'|'right')} dir direction of travel
 * @returns {number} distance to the next centre along `dir` (0 for no dir)
 */
export function distanceToNextCenter(x, y, dir) {
  const d = dir ? DIRECTIONS[dir] : null;
  if (!d) return 0;
  if (d.dx === 1) return Math.floor(x) + 1 - x;
  if (d.dx === -1) return x - (Math.ceil(x) - 1);
  if (d.dy === 1) return Math.floor(y) + 1 - y;
  if (d.dy === -1) return y - (Math.ceil(y) - 1);
  return 0;
}

/**
 * Advance an entity by `speed * dt` tiles, honouring grid alignment, wall
 * blocking, and turn buffering. Pure: does not mutate `entity`; returns a fresh
 * `{ x, y, dir, nextDir }`.
 *
 * Algorithm (classic Pac-Man turn buffering):
 *   1. While there is travel budget left and the entity is aligned to a centre:
 *      - apply the buffered `nextDir` if the path that way is open;
 *      - if the (possibly updated) `dir` is blocked, snap to the centre and
 *        stop — the entity cannot enter a wall.
 *   2. Glide toward the next centre by up to the remaining budget, snapping to
 *      the centre when reached to eliminate floating-point drift.
 *
 * @param {{walls: boolean[][], width: number, height: number}} maze parsed maze
 * @param {{x: number, y: number, dir: ?string, nextDir: ?string}} entity entity state (tile units)
 * @param {number} speed speed in tiles per second
 * @param {number} dt elapsed time in seconds
 * @returns {{x: number, y: number, dir: ?string, nextDir: ?string}} new entity state
 */
export function advanceEntity(maze, entity, speed, dt) {
  let x = entity.x;
  let y = entity.y;
  let dir = entity.dir ?? null;
  const nextDir = entity.nextDir ?? null;

  let remaining = speed * dt;
  if (!(remaining > 0)) {
    // No time budget: positions unchanged. (Turns are only committed while
    // there is movement to perform, matching the classic behaviour.)
    return { x, y, dir, nextDir };
  }

  // Guard against pathologically large dt values causing a runaway loop.
  let guard = 0;
  while (remaining > EPS && guard++ < 100000) {
    if (isAligned(x, y)) {
      const col = Math.round(x);
      const row = Math.round(y);
      x = col;
      y = row;
      // Turn buffering: adopt the requested direction the moment it opens up.
      if (nextDir && canMove(maze, col, row, nextDir)) {
        dir = nextDir;
      }
      // If we have no open direction to travel, stop at the centre. This is the
      // wall-blocking guarantee: we never begin a segment into a wall tile.
      if (!canMove(maze, col, row, dir)) {
        break;
      }
    }

    const dist = distanceToNextCenter(x, y, dir);
    const stepLen = Math.min(remaining, dist);
    const d = DIRECTIONS[dir];
    x += d.dx * stepLen;
    y += d.dy * stepLen;
    remaining -= stepLen;

    if (stepLen >= dist - EPS) {
      // Reached the target centre — snap away any accumulated float drift.
      x = Math.round(x);
      y = Math.round(y);
    }
  }

  return { x, y, dir, nextDir };
}

/**
 * The tile (col, row) an entity currently occupies, i.e. the nearest tile
 * centre. Always an open tile for entities moved via `advanceEntity`.
 * @param {{x: number, y: number}} entity entity state (tile units)
 * @returns {{col: number, row: number}}
 */
export function entityTile(entity) {
  return { col: Math.round(entity.x), row: Math.round(entity.y) };
}

/**
 * The opposite of a direction (the "reverse"). Used to apply the classic
 * Pac-Man rule that a pursuer does not double back on itself unless it has no
 * other option (a dead end).
 * @param {('up'|'down'|'left'|'right'|null|undefined)} dir
 * @returns {('up'|'down'|'left'|'right'|null)}
 */
export function reverseDir(dir) {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return null;
  }
}

/**
 * Choose a chaser's next direction from tile (col, row) using a simple,
 * deterministic greedy-pursuit rule (Requirement 2.4):
 *
 *   1. Consider only directions whose neighbouring tile is open (not a wall) —
 *      this is what keeps chasers off wall tiles (design Property 1).
 *   2. Exclude the immediate reverse of `currentDir` when at least one other
 *      open direction exists (classic Pac-Man "no U-turn" rule); at a dead end
 *      the reverse is allowed so the chaser can escape.
 *   3. Among the remaining candidates pick the one whose neighbouring tile has
 *      the smallest Manhattan distance to `target`. Ties are broken by the
 *      fixed DIRECTION_NAMES order (up, down, left, right), so the choice is
 *      fully deterministic — no `Math.random`, keeping the engine pure/testable.
 *
 * @param {{walls: boolean[][], width: number, height: number}} maze parsed maze
 * @param {number} col chaser's current tile column
 * @param {number} row chaser's current tile row
 * @param {('up'|'down'|'left'|'right'|null|undefined)} currentDir current heading
 * @param {{col: number, row: number}} target tile to pursue (Kiroman's tile)
 * @returns {('up'|'down'|'left'|'right'|null)} chosen direction, or null if boxed in
 */
export function chooseChaserDir(maze, col, row, currentDir, target) {
  const open = DIRECTION_NAMES.filter((d) => canMove(maze, col, row, d));
  if (open.length === 0) return null;

  // Prefer not to reverse unless it is the only way out.
  const rev = reverseDir(currentDir);
  let candidates = open;
  if (open.length > 1 && rev) {
    const forward = open.filter((d) => d !== rev);
    if (forward.length > 0) candidates = forward;
  }

  // Greedy: minimise Manhattan distance from the neighbouring tile to target.
  // Strict `<` with DIRECTION_NAMES iteration order gives a deterministic
  // tie-break.
  let best = null;
  let bestDist = Infinity;
  for (const d of candidates) {
    const v = DIRECTIONS[d];
    const nc = col + v.dx;
    const nr = row + v.dy;
    const dist = Math.abs(nc - target.col) + Math.abs(nr - target.row);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

/**
 * Advance a chaser by `speed * dt` tiles while greedily pursuing `target`.
 * Pure: does not mutate `chaser`; returns a fresh `{ x, y, dir }`.
 *
 * Mirrors `advanceEntity`'s grid-aligned gliding, but re-decides the heading at
 * every tile centre via `chooseChaserDir` instead of consuming a buffered
 * `nextDir`. Because a new segment is only ever started toward an already-open
 * neighbouring tile, a chaser never begins moving into a wall — upholding design
 * Property 1 (no wall clipping) for chasers just as `advanceEntity` does for
 * Kiroman.
 *
 * @param {{walls: boolean[][], width: number, height: number}} maze parsed maze
 * @param {{x: number, y: number, dir: ?string}} chaser chaser state (tile units)
 * @param {{col: number, row: number}} target tile to pursue (Kiroman's tile)
 * @param {number} speed speed in tiles per second
 * @param {number} dt elapsed time in seconds
 * @returns {{x: number, y: number, dir: ?string}} new chaser state
 */
export function advanceChaser(maze, chaser, target, speed, dt) {
  let x = chaser.x;
  let y = chaser.y;
  let dir = chaser.dir ?? null;

  let remaining = speed * dt;
  if (!(remaining > 0)) {
    // No time budget: position unchanged (heading preserved).
    return { x, y, dir };
  }

  // Guard against pathologically large dt values causing a runaway loop.
  let guard = 0;
  while (remaining > EPS && guard++ < 100000) {
    if (isAligned(x, y)) {
      const col = Math.round(x);
      const row = Math.round(y);
      x = col;
      y = row;
      // Re-decide the pursuit heading at each tile centre.
      const chosen = chooseChaserDir(maze, col, row, dir, target);
      if (!chosen) break; // fully boxed in (should not happen in a valid maze)
      dir = chosen;
    }

    const dist = distanceToNextCenter(x, y, dir);
    const stepLen = Math.min(remaining, dist);
    const d = DIRECTIONS[dir];
    x += d.dx * stepLen;
    y += d.dy * stepLen;
    remaining -= stepLen;

    if (stepLen >= dist - EPS) {
      // Reached the target centre — snap away any accumulated float drift.
      x = Math.round(x);
      y = Math.round(y);
    }
  }

  return { x, y, dir };
}
