// src/render/canvasRenderer.test.js
//
// Lightweight smoke tests for the canvas renderer (src/render/canvasRenderer.js).
//
// jsdom/canvas is not available under Node's test runner, so instead of a real
// CanvasRenderingContext2D we use a hand-rolled mock that records every method
// call and property set. That lets us assert, without a DOM, that:
//   - importing the module does not throw (no top-level DOM/canvas access),
//   - `draw()` runs without throwing on a fresh engine state,
//   - `draw()` issues the expected primitive calls (fillRect for the
//     background/walls, arc for pellets/Kiroman/chasers),
//   - `draw()` does NOT mutate the state (deep snapshot compare),
//   - the Kiro image path (opts.images.kiro) issues a drawImage call,
//   - `opts.tileSize` scales the drawn geometry.
//
// Run with Node's built-in test runner: `node --test` (ESM).
//
// Requirements: 2.1 (render walls, pellets, Kiroman, chasers),
//               7.1 (Kiro brand styling), 7.3 (Kiro logo as chaser sprite).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { draw, BRAND } from './canvasRenderer.js';
import { createInitialState } from '../game/engine.js';
import { TILE_SIZE } from '../game/constants.js';

/**
 * Build a mock 2D context that records calls and property assignments.
 * @returns {any} a recording mock with a `calls` log and `sets` log
 */
function makeMockCtx() {
  const calls = [];
  const sets = [];
  const noop = (name) => (...args) => calls.push({ name, args });
  const ctx = {
    calls,
    sets,
    _fillStyle: undefined,
    beginPath: noop('beginPath'),
    closePath: noop('closePath'),
    moveTo: noop('moveTo'),
    lineTo: noop('lineTo'),
    arc: noop('arc'),
    fill: noop('fill'),
    stroke: noop('stroke'),
    fillRect: noop('fillRect'),
    drawImage: noop('drawImage'),
    save: noop('save'),
    restore: noop('restore'),
    translate: noop('translate'),
  };
  // Track fillStyle assignments (used to confirm brand colors are applied).
  Object.defineProperty(ctx, 'fillStyle', {
    get() {
      return ctx._fillStyle;
    },
    set(v) {
      ctx._fillStyle = v;
      sets.push({ prop: 'fillStyle', value: v });
    },
  });
  return ctx;
}

/** Count recorded calls by method name. */
function countCalls(ctx, name) {
  return ctx.calls.filter((c) => c.name === name).length;
}

test('draw() runs without throwing on a fresh state and paints the board', () => {
  const ctx = makeMockCtx();
  const state = createInitialState();

  assert.doesNotThrow(() => draw(ctx, state, { time: 0 }));

  // Background + walls come through as fillRect calls (at least the bg + walls).
  assert.ok(countCalls(ctx, 'fillRect') > 1, 'expected multiple fillRect calls (bg + walls)');
  // Pellets, Kiroman and chasers are drawn with arc().
  assert.ok(countCalls(ctx, 'arc') > 0, 'expected arc calls for pellets/entities');
  // The background is painted in the brand background color.
  assert.ok(
    ctx.sets.some((s) => s.value === BRAND.background),
    'expected the brand background color to be applied'
  );
});

test('draw() does not mutate the game state', () => {
  const ctx = makeMockCtx();
  const state = createInitialState();

  // Snapshot via a replacer that serializes the pellet Set deterministically.
  const snapshot = (s) =>
    JSON.stringify(s, (key, value) =>
      value instanceof Set ? { __set: [...value].sort((a, b) => a - b) } : value
    );

  const before = snapshot(state);
  draw(ctx, state, { time: 123.4, images: {} });
  const after = snapshot(state);

  assert.equal(after, before, 'draw() must not mutate the state');
  // Sanity: the pellet set is still a Set with the original size preserved.
  assert.ok(state.pellets instanceof Set);
});

test('draw() with a Kiro image draws the sprite for each chaser', () => {
  const ctx = makeMockCtx();
  const state = createInitialState();
  const fakeImage = { width: 32, height: 32 }; // stand-in CanvasImageSource

  draw(ctx, state, { time: 50, images: { kiro: fakeImage } });

  assert.equal(
    countCalls(ctx, 'drawImage'),
    state.chasers.length,
    'expected one drawImage per chaser when a Kiro image is provided'
  );
});

test('draw() falls back to a drawn chaser shape when no image is provided', () => {
  const ctx = makeMockCtx();
  const state = createInitialState();

  draw(ctx, state, { time: 50 });

  assert.equal(countCalls(ctx, 'drawImage'), 0, 'no image => no drawImage calls');
  // Fallback chasers add arc() calls (body + eyes) beyond pellets/Kiroman.
  assert.ok(countCalls(ctx, 'arc') > 0);
});

test('draw() honors opts.tileSize to scale geometry', () => {
  const small = makeMockCtx();
  const large = makeMockCtx();
  const state = createInitialState();

  draw(small, state, { time: 0, tileSize: TILE_SIZE });
  draw(large, state, { time: 0, tileSize: TILE_SIZE * 2 });

  // The very first fillRect is the full-board background; doubling tileSize
  // doubles its width/height.
  const firstRect = (ctx) => ctx.calls.find((c) => c.name === 'fillRect');
  const s = firstRect(small).args;
  const l = firstRect(large).args;
  assert.equal(l[2], s[2] * 2, 'background width should scale with tileSize');
  assert.equal(l[3], s[3] * 2, 'background height should scale with tileSize');
});

test('draw() is a no-op when ctx or state is missing', () => {
  const ctx = makeMockCtx();
  assert.doesNotThrow(() => draw(null, createInitialState()));
  assert.doesNotThrow(() => draw(ctx, null));
  assert.equal(ctx.calls.length, 0);
});
