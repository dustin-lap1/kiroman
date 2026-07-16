// src/render/canvasRenderer.js
//
// Canvas rendering layer for Kiroman. This module owns *drawing only*: it reads
// a game state produced by the pure engine and paints it onto a 2D canvas
// context. It never mutates the state and never calls engine logic — the
// separation the design's "Rendering layer" calls for (engine steps, renderer
// draws).
//
// Import-safety: this module performs NO work at import time and touches no DOM
// or canvas API at the top level. Everything that needs a context happens
// inside `draw()`, so the module can be imported for a smoke check in a
// DOM-less environment (Node's test runner) without throwing.
//
// Units: entity/tile positions from the engine are in **tile units** (floats).
// The renderer multiplies by a tile size (pixels/tile) to get pixel positions.
// `opts.tileSize` overrides the default TILE_SIZE so the board can be scaled.

import { TILE_SIZE } from '../game/constants.js';
import { BRAND } from '../brand.js';

// Re-export the shared Kiro palette so the canvas draw code (below) and this
// module's tests keep a stable `BRAND` import while the tokens live in ONE
// place (`src/brand.js`, mirrored to CSS `@theme` in `src/index.css`).
// Requirement 7.1: DOM and canvas draw from a single source of truth.
export { BRAND };

/**
 * Two-thirds of PI, the widest the chomp mouth opens (in radians, half-angle).
 * @type {number}
 */
const MAX_MOUTH = Math.PI / 4;

/**
 * Map a direction name to the angle (radians) its mouth/facing points toward,
 * in canvas coordinates (y grows downward, 0 = +x / right).
 * @type {Readonly<Record<string, number>>}
 */
const DIR_ANGLE = Object.freeze({
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: (3 * Math.PI) / 2,
});

/**
 * Draw a full game state onto a canvas 2D context.
 *
 * Pure with respect to `state`: this function only READS `state` and never
 * mutates it or calls engine logic. All drawing is scoped to `ctx`.
 *
 * @param {CanvasRenderingContext2D} ctx the 2D context to paint onto
 * @param {import('../game/engine.js').GameState} state the engine game state to render
 * @param {{
 *   time?: number,
 *   tileSize?: number,
 *   images?: { kiro?: CanvasImageSource },
 * }} [opts] rendering options:
 *   - `time`: a monotonically increasing time (ms) used to drive the chomp
 *     animation and chaser bob. Defaults to 0 (mouth fully closed / no bob).
 *   - `tileSize`: pixels per tile (defaults to TILE_SIZE) so the canvas can scale.
 *   - `images.kiro`: the Kiro logo/character image used as the chaser sprite
 *     (Requirement 7.3). When absent, a fallback colored shape is drawn.
 * @returns {void}
 */
export function draw(ctx, state, opts = {}) {
  if (!ctx || !state) return;

  const tileSize = opts.tileSize ?? TILE_SIZE;
  const time = opts.time ?? 0;
  const images = opts.images ?? {};
  const maze = state.maze;

  const width = maze.width * tileSize;
  const height = maze.height * tileSize;

  // Background (Requirement 7.1: consistent Kiro styling — dark board).
  ctx.fillStyle = BRAND.background;
  ctx.fillRect(0, 0, width, height);

  drawWalls(ctx, maze, tileSize);
  drawPellets(ctx, state, tileSize);
  drawKiroman(ctx, state.kiroman, tileSize, time);
  drawChasers(ctx, state.chasers, tileSize, time, images.kiro);
}

/**
 * Draw the maze walls from `maze.walls` (a boolean grid). Each wall tile is a
 * rounded-ish filled cell in the Kiro accent color with a slightly inset inner
 * fill so corridors read clearly.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../game/maze.js').Maze} maze
 * @param {number} tileSize pixels per tile
 * @returns {void}
 */
function drawWalls(ctx, maze, tileSize) {
  const inset = Math.max(1, Math.floor(tileSize * 0.08));
  for (let row = 0; row < maze.height; row++) {
    for (let col = 0; col < maze.width; col++) {
      if (!maze.walls[row][col]) continue;
      const px = col * tileSize;
      const py = row * tileSize;
      ctx.fillStyle = BRAND.wall;
      ctx.fillRect(px, py, tileSize, tileSize);
      ctx.fillStyle = BRAND.wallInner;
      ctx.fillRect(px + inset, py + inset, tileSize - inset * 2, tileSize - inset * 2);
    }
  }
}

/**
 * Draw the remaining pellets. `state.pellets` is a Set of flat tile indices
 * (`row * width + col`); we convert each to tile coords and draw a small light
 * dot at the tile centre.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../game/engine.js').GameState} state
 * @param {number} tileSize pixels per tile
 * @returns {void}
 */
function drawPellets(ctx, state, tileSize) {
  const width = state.maze.width;
  const radius = Math.max(1, tileSize * 0.12);
  ctx.fillStyle = BRAND.pellet;
  for (const index of state.pellets) {
    const col = index % width;
    const row = Math.floor(index / width);
    const cx = col * tileSize + tileSize / 2;
    const cy = row * tileSize + tileSize / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw Kiroman as a cute chomping circle. The mouth opens and closes over time
 * (driven by `time`) and points in Kiroman's current direction of travel. When
 * stopped (`dir` null) the mouth faces right by default.
 *
 * The chomp is a triangular "wedge" cut out of a filled circle: we sweep the
 * arc from `angle + mouth` around to `angle - mouth` (i.e. everything EXCEPT
 * the mouth wedge) and close back through the centre, so the missing wedge is
 * the open mouth. `mouth` oscillates between 0 (closed) and MAX_MOUTH via a
 * sine of `time`, giving the classic open/close chomp.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../game/engine.js').Entity} kiroman
 * @param {number} tileSize pixels per tile
 * @param {number} time animation time in ms
 * @returns {void}
 */
function drawKiroman(ctx, kiroman, tileSize, time) {
  const cx = kiroman.x * tileSize + tileSize / 2;
  const cy = kiroman.y * tileSize + tileSize / 2;
  const radius = tileSize * 0.45;

  // Chomp phase: 0..1..0 via |sin|, ~5 chomps/sec. When time is 0 the mouth is
  // closed (a plain disc), which keeps the DOM-less smoke test deterministic.
  const mouth = Math.abs(Math.sin(time * 0.01)) * MAX_MOUTH;
  const facing = DIR_ANGLE[kiroman.dir] ?? 0;

  ctx.fillStyle = BRAND.kiroman;
  ctx.beginPath();
  if (mouth < 1e-3) {
    // Mouth closed — a full disc.
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  } else {
    // Draw the body arc, leaving a wedge (the mouth) open in the facing dir.
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, facing + mouth, facing - mouth + Math.PI * 2);
    ctx.closePath();
  }
  ctx.fill();

  // A little eye, offset perpendicular to the facing direction, punched out in
  // the background color for a cute look.
  const eyeAngle = facing - Math.PI / 2;
  const eyeDist = radius * 0.4;
  const eyeR = Math.max(1, radius * 0.16);
  const ex = cx + Math.cos(eyeAngle) * eyeDist;
  const ey = cy + Math.sin(eyeAngle) * eyeDist;
  ctx.fillStyle = BRAND.kiromanEye;
  ctx.beginPath();
  ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw each Kiro chaser. When a Kiro logo image is provided it is drawn as the
 * chaser sprite (Requirement 7.3), centred on the chaser tile with a gentle
 * vertical bob. When no image is available a fallback colored shape (a rounded
 * body with two eyes) is drawn so the game is still playable/branded.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../game/engine.js').Entity[]} chasers
 * @param {number} tileSize pixels per tile
 * @param {number} time animation time in ms
 * @param {CanvasImageSource=} kiroImage the Kiro logo image (optional)
 * @returns {void}
 */
function drawChasers(ctx, chasers, tileSize, time, kiroImage) {
  const size = tileSize * 0.9;
  for (let i = 0; i < chasers.length; i++) {
    const c = chasers[i];
    // Gentle bob, phase-shifted per chaser so they don't move in lockstep.
    const bob = Math.sin(time * 0.005 + i) * tileSize * 0.06;
    const cx = c.x * tileSize + tileSize / 2;
    const cy = c.y * tileSize + tileSize / 2 + bob;

    if (kiroImage) {
      // Clip to a circle so the Kiro logo reads as a cute round chaser sprite
      // (Requirement 7.3). Guarded so the DOM-less smoke test (whose mock ctx
      // has no `clip`) still exercises the exact-one-drawImage-per-chaser path.
      const canClip = typeof ctx.clip === 'function' && typeof ctx.save === 'function';
      if (canClip) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.clip();
      }
      ctx.drawImage(kiroImage, cx - size / 2, cy - size / 2, size, size);
      if (canClip) ctx.restore();
    } else {
      drawFallbackChaser(ctx, cx, cy, size);
    }
  }
}

/**
 * Fallback chaser: a rounded body in a Kiro accent with two eyes, used when no
 * Kiro logo image is supplied.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx body centre x (pixels)
 * @param {number} cy body centre y (pixels)
 * @param {number} size body diameter (pixels)
 * @returns {void}
 */
function drawFallbackChaser(ctx, cx, cy, size) {
  const r = size / 2;
  ctx.fillStyle = BRAND.chaser;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Two eyes.
  const eyeR = Math.max(1, r * 0.22);
  const eyeDx = r * 0.4;
  const eyeY = cy - r * 0.1;
  ctx.fillStyle = BRAND.pellet;
  ctx.beginPath();
  ctx.arc(cx - eyeDx, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(cx + eyeDx, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = BRAND.chaserAccent;
  ctx.beginPath();
  ctx.arc(cx - eyeDx, eyeY, eyeR * 0.5, 0, Math.PI * 2);
  ctx.arc(cx + eyeDx, eyeY, eyeR * 0.5, 0, Math.PI * 2);
  ctx.fill();
}
