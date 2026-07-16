// src/input/useKeyboard.test.js
//
// Unit tests for the pure key→action mapping (src/input/useKeyboard.js).
//
// Run with Node's built-in test runner: `node --test` (ESM). Only the pure
// `keyToAction` mapping is exercised here — it has no React/DOM dependencies.
// The hook wiring (window listeners, held-key stack, pause latch) relies on the
// browser and is covered by the build/lint check rather than a DOM test, since
// jsdom is not configured in this project.
//
// Requirements: 4.1 (Space → pause), 6.1 (arrows/WASD → directional movement).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { keyToAction } from './useKeyboard.js';

test('arrow key codes map to directions (Requirement 6.1)', () => {
  assert.deepEqual(keyToAction('ArrowUp'), { type: 'direction', value: 'up' });
  assert.deepEqual(keyToAction('ArrowDown'), { type: 'direction', value: 'down' });
  assert.deepEqual(keyToAction('ArrowLeft'), { type: 'direction', value: 'left' });
  assert.deepEqual(keyToAction('ArrowRight'), { type: 'direction', value: 'right' });
});

test('WASD key codes map to directions (Requirement 6.1)', () => {
  assert.deepEqual(keyToAction('KeyW'), { type: 'direction', value: 'up' });
  assert.deepEqual(keyToAction('KeyS'), { type: 'direction', value: 'down' });
  assert.deepEqual(keyToAction('KeyA'), { type: 'direction', value: 'left' });
  assert.deepEqual(keyToAction('KeyD'), { type: 'direction', value: 'right' });
});

test('WASD as lower-case key values map to directions (Requirement 6.1)', () => {
  assert.deepEqual(keyToAction('w'), { type: 'direction', value: 'up' });
  assert.deepEqual(keyToAction('s'), { type: 'direction', value: 'down' });
  assert.deepEqual(keyToAction('a'), { type: 'direction', value: 'left' });
  assert.deepEqual(keyToAction('d'), { type: 'direction', value: 'right' });
});

test('WASD as upper-case key values map to directions (case-insensitive)', () => {
  assert.deepEqual(keyToAction('W'), { type: 'direction', value: 'up' });
  assert.deepEqual(keyToAction('S'), { type: 'direction', value: 'down' });
  assert.deepEqual(keyToAction('A'), { type: 'direction', value: 'left' });
  assert.deepEqual(keyToAction('D'), { type: 'direction', value: 'right' });
});

test('lower-case arrow key values also map to directions', () => {
  assert.deepEqual(keyToAction('arrowup'), { type: 'direction', value: 'up' });
  assert.deepEqual(keyToAction('ArrowRight'.toLowerCase()), { type: 'direction', value: 'right' });
});

test('Space maps to a pause action (Requirement 4.1)', () => {
  assert.deepEqual(keyToAction('Space'), { type: 'pause' });
  assert.deepEqual(keyToAction(' '), { type: 'pause' });
  assert.deepEqual(keyToAction('Spacebar'), { type: 'pause' });
});

test('unknown keys map to null', () => {
  assert.equal(keyToAction('Enter'), null);
  assert.equal(keyToAction('KeyQ'), null);
  assert.equal(keyToAction('Escape'), null);
  assert.equal(keyToAction('x'), null);
});

test('nullish / empty input maps to null (total function)', () => {
  assert.equal(keyToAction(null), null);
  assert.equal(keyToAction(undefined), null);
  assert.equal(keyToAction(''), null);
});

test('returns a fresh object each call so results are safe to mutate', () => {
  const a = keyToAction('ArrowUp');
  const b = keyToAction('ArrowUp');
  assert.notEqual(a, b, 'expected distinct object instances');
  assert.deepEqual(a, b);
});
