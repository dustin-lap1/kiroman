// src/input/useTouch.test.js
//
// Unit tests for the pure helpers in the touch input adapter
// (src/input/useTouch.js): `mergeIntents` and `isCoarsePointer`.
//
// Run with Node's built-in test runner: `node --test` (ESM). Only the pure,
// DOM-free logic is exercised here. The hooks themselves (`useTouch`,
// `useCoarsePointer`) wire refs/effects to the browser and are covered by the
// build/lint check rather than a DOM test, since jsdom is not configured in
// this project.
//
// Requirements: 4.2 (tap → pause), 6.2 (on-screen directional control).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeIntents, isCoarsePointer } from './useTouch.js';

// --- mergeIntents: combining keyboard + touch intents -----------------------

test('mergeIntents prefers the first argument\'s direction (Requirement 6.2)', () => {
  assert.deepEqual(
    mergeIntents({ direction: 'left' }, { direction: 'right' }),
    { direction: 'left' },
  );
});

test('mergeIntents falls back to the second direction when the first is absent', () => {
  assert.deepEqual(mergeIntents({}, { direction: 'up' }), { direction: 'up' });
  assert.deepEqual(mergeIntents({ pause: false }, { direction: 'down' }), {
    direction: 'down',
  });
});

test('mergeIntents ORs the pause edge from either source (Requirement 4.2)', () => {
  assert.equal(mergeIntents({ pause: true }, {}).pause, true);
  assert.equal(mergeIntents({}, { pause: true }).pause, true);
  assert.equal(mergeIntents({ pause: true }, { pause: true }).pause, true);
});

test('mergeIntents omits pause when neither source requests it', () => {
  assert.equal('pause' in mergeIntents({}, {}), false);
  assert.equal('pause' in mergeIntents({ pause: false }, { pause: false }), false);
});

test('mergeIntents combines direction and pause from different sources', () => {
  assert.deepEqual(
    mergeIntents({ direction: 'right' }, { pause: true }),
    { direction: 'right', pause: true },
  );
});

test('mergeIntents treats nullish arguments as the empty intent', () => {
  assert.deepEqual(mergeIntents(null, undefined), {});
  assert.deepEqual(mergeIntents(undefined, { direction: 'up' }), { direction: 'up' });
  assert.deepEqual(mergeIntents({ direction: 'down' }, null), { direction: 'down' });
});

test('mergeIntents returns a fresh object and does not mutate its inputs', () => {
  const a = { direction: 'left' };
  const b = { pause: true };
  const result = mergeIntents(a, b);
  assert.notEqual(result, a);
  assert.notEqual(result, b);
  assert.deepEqual(a, { direction: 'left' }, 'first input unchanged');
  assert.deepEqual(b, { pause: true }, 'second input unchanged');
});

// --- isCoarsePointer: touch-device detection --------------------------------

test('isCoarsePointer returns true when the coarse-pointer query matches', () => {
  const win = { matchMedia: (q) => ({ matches: q === '(pointer: coarse)' }) };
  assert.equal(isCoarsePointer(win), true);
});

test('isCoarsePointer returns false when the query does not match', () => {
  const win = { matchMedia: () => ({ matches: false }) };
  assert.equal(isCoarsePointer(win), false);
});

test('isCoarsePointer does not crash when matchMedia is unavailable', () => {
  assert.equal(isCoarsePointer({}), false);
  assert.equal(isCoarsePointer(undefined), false);
  assert.equal(isCoarsePointer({ matchMedia: 'not a function' }), false);
});

test('isCoarsePointer stays safe when matchMedia throws', () => {
  const win = {
    matchMedia: () => {
      throw new Error('bad query');
    },
  };
  assert.equal(isCoarsePointer(win), false);
});
