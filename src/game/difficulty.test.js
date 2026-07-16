// src/game/difficulty.test.js
//
// Unit tests for the pure difficulty-scaling module (src/game/difficulty.js).
//
// Run with Node's built-in test runner: `node --test` (ESM). No React/canvas/
// DOM dependencies. These tests verify the level → chaser-speed mapping used by
// the engine for difficulty scaling.
//
// Requirements: 3.3 (increase chaser speed with level, up to a defined maximum).
// Design Property 4 (difficulty monotonic and capped).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chaserSpeedForLevel, CHASER_SPEED_INCREMENT } from './difficulty.js';
import { BASE_CHASER_SPEED, MAX_CHASER_SPEED } from './constants.js';

test('chaserSpeedForLevel(1) equals the base chaser speed', () => {
  assert.equal(chaserSpeedForLevel(1), BASE_CHASER_SPEED);
});

test('levels at or below 1 clamp to the base speed (total function)', () => {
  assert.equal(chaserSpeedForLevel(0), BASE_CHASER_SPEED);
  assert.equal(chaserSpeedForLevel(-5), BASE_CHASER_SPEED);
});

test('speed rises by CHASER_SPEED_INCREMENT per level below the cap', () => {
  assert.equal(chaserSpeedForLevel(2), BASE_CHASER_SPEED + CHASER_SPEED_INCREMENT);
  assert.equal(chaserSpeedForLevel(3), BASE_CHASER_SPEED + 2 * CHASER_SPEED_INCREMENT);
});

test('chaser speed is non-decreasing across levels 1..100 (Property 4)', () => {
  let prev = -Infinity;
  for (let lvl = 1; lvl <= 100; lvl++) {
    const s = chaserSpeedForLevel(lvl);
    assert.ok(s >= prev, `speed dropped at level ${lvl}: ${s} < ${prev}`);
    prev = s;
  }
});

test('chaser speed never exceeds MAX_CHASER_SPEED (Property 4)', () => {
  for (let lvl = 1; lvl <= 100; lvl++) {
    assert.ok(
      chaserSpeedForLevel(lvl) <= MAX_CHASER_SPEED,
      `speed exceeded cap at level ${lvl}`,
    );
  }
});

test('chaser speed saturates exactly at the cap for high levels', () => {
  // With BASE=4, MAX=8, increment=0.5 the cap is reached at level 9.
  const capLevel =
    1 + Math.ceil((MAX_CHASER_SPEED - BASE_CHASER_SPEED) / CHASER_SPEED_INCREMENT);
  assert.equal(chaserSpeedForLevel(capLevel), MAX_CHASER_SPEED);
  assert.equal(chaserSpeedForLevel(capLevel + 50), MAX_CHASER_SPEED);
});
