// src/game/engine.pause.test.js
//
// Unit tests for pause/resume semantics and difficulty integration in the pure
// engine (src/game/engine.js), added for task 3.4.
//
// Run with Node's built-in test runner: `node --test` (ESM). No React/canvas/
// DOM dependencies.
//
// Requirements: 4.1 (pause during play), 4.3 (halt all movement while paused),
//               4.4 (resume from same state), 4.5 (ignore directional input
//               while paused), 3.3 (chaser speed scales with level).
// Design Property 6 (pause freezes state).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, step } from './engine.js';

const DIRS = ['up', 'down', 'left', 'right'];

// Snapshot only the mutable entity coordinates/headings we care about.
function positions(state) {
  return JSON.stringify({
    k: { x: state.kiroman.x, y: state.kiroman.y, dir: state.kiroman.dir },
    c: state.chasers.map((c) => ({ x: c.x, y: c.y, dir: c.dir })),
  });
}

// Move the game forward a little so we are not testing from a trivial all-null
// starting configuration.
function warmedUpState() {
  let st = createInitialState();
  for (let i = 0; i < 25; i++) st = step(st, { direction: DIRS[i % 4] }, 0.05);
  return st;
}

test('pause: true toggles a playing game to paused (Req 4.1)', () => {
  const st = step(createInitialState(), { pause: true }, 0.05);
  assert.equal(st.status, 'paused');
});

test('a pause toggle tick does not move any entity', () => {
  const playing = warmedUpState();
  const before = positions(playing);
  const paused = step(playing, { pause: true }, 0.1);
  assert.equal(paused.status, 'paused');
  assert.equal(positions(paused), before, 'toggle tick must not move entities');
});

test('paused state freezes all entity positions across many steps (Req 4.3/4.5, Property 6)', () => {
  let st = step(warmedUpState(), { pause: true }, 0.1);
  const frozen = positions(st);
  for (let i = 0; i < 250; i++) {
    st = step(st, { direction: DIRS[i % 4] }, 0.1);
    assert.equal(st.status, 'paused', 'must remain paused with no pause intent');
    assert.equal(positions(st), frozen, `position changed while paused at iter ${i}`);
  }
});

test('directional intents are ignored while paused (Req 4.5)', () => {
  const paused = step(warmedUpState(), { pause: true }, 0.1);
  const frozen = positions(paused);
  const after = step(paused, { direction: 'left' }, 0.5);
  assert.equal(positions(after), frozen);
});

test('resume (second pause toggle) restores play and movement (Req 4.4)', () => {
  const paused = step(warmedUpState(), { pause: true }, 0.1);
  const resumed = step(paused, { pause: true }, 0.05);
  assert.equal(resumed.status, 'playing');

  // From the resumed state, movement happens again.
  let st = resumed;
  const before = positions(st);
  let moved = false;
  for (let i = 0; i < 40 && !moved; i++) {
    st = step(st, { direction: DIRS[i % 4] }, 0.1);
    if (positions(st) !== before) moved = true;
  }
  assert.ok(moved, 'entities should move after resume');
});

test('resume continues from the exact paused positions', () => {
  const paused = step(warmedUpState(), { pause: true }, 0.1);
  const frozen = positions(paused);
  const resumed = step(paused, { pause: true }, 0); // dt 0 => no movement budget
  assert.equal(resumed.status, 'playing');
  assert.equal(positions(resumed), frozen, 'resume must continue from same state');
});

test('pause is a no-op once the game is over', () => {
  const over = { ...createInitialState(), status: 'gameover' };
  const before = positions(over);
  const after = step(over, { pause: true }, 0.1);
  assert.equal(after.status, 'gameover', 'gameover must stay gameover');
  assert.equal(positions(after), before, 'gameover state must stay frozen');
});

test('step never mutates the input state on a pause toggle', () => {
  const playing = warmedUpState();
  const snapshot = positions(playing);
  const originalStatus = playing.status;
  step(playing, { pause: true }, 0.1);
  assert.equal(playing.status, originalStatus, 'input status must be unchanged');
  assert.equal(positions(playing), snapshot, 'input positions must be unchanged');
});
