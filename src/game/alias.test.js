// src/game/alias.test.js
//
// Unit tests for the pure alias validation module (src/game/alias.js).
//
// Run with Node's built-in test runner: `node --test` (ESM). No React/DOM
// dependencies. These verify the alias-entry gate's core rule.
//
// Requirements: 1.2 (1–12 chars after trimming), 1.3 (reject empty / >12 with a
// validation message, without starting the game).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateAlias,
  ALIAS_ERRORS,
  ALIAS_MAX_LENGTH,
} from './alias.js';

test('rejects an empty string with the empty-alias message (1.3)', () => {
  const result = validateAlias('');
  assert.deepEqual(result, { ok: false, error: ALIAS_ERRORS.empty });
});

test('rejects whitespace-only input as empty after trimming (1.2, 1.3)', () => {
  const result = validateAlias('    ');
  assert.deepEqual(result, { ok: false, error: ALIAS_ERRORS.empty });
});

test('accepts exactly 1 character (lower boundary of 1.2)', () => {
  assert.deepEqual(validateAlias('a'), { ok: true, value: 'a' });
});

test('accepts exactly 12 characters (upper boundary of 1.2)', () => {
  const twelve = 'abcdefghijkl';
  assert.equal(twelve.length, ALIAS_MAX_LENGTH);
  assert.deepEqual(validateAlias(twelve), { ok: true, value: twelve });
});

test('rejects 13 characters with the too-long message (1.3)', () => {
  const thirteen = 'abcdefghijklm';
  assert.equal(thirteen.length, ALIAS_MAX_LENGTH + 1);
  assert.deepEqual(validateAlias(thirteen), {
    ok: false,
    error: ALIAS_ERRORS.tooLong,
  });
});

test('trims surrounding whitespace before measuring length (1.2)', () => {
  assert.deepEqual(validateAlias('  Kiro  '), { ok: true, value: 'Kiro' });
});

test('counts length AFTER trimming: padded 12-char alias is valid', () => {
  // 12 non-space chars wrapped in whitespace still passes (trimmed length = 12).
  assert.deepEqual(validateAlias('   abcdefghijkl   '), {
    ok: true,
    value: 'abcdefghijkl',
  });
});

test('counts length AFTER trimming: interior spaces still count', () => {
  // "a b c" trims to itself (5 chars) — interior whitespace is preserved.
  assert.deepEqual(validateAlias('  a b c  '), { ok: true, value: 'a b c' });
});

test('accepts a typical valid alias', () => {
  assert.deepEqual(validateAlias('Kiroman'), { ok: true, value: 'Kiroman' });
});

test('non-string input is treated as empty (total function)', () => {
  assert.deepEqual(validateAlias(undefined), { ok: false, error: ALIAS_ERRORS.empty });
  assert.deepEqual(validateAlias(null), { ok: false, error: ALIAS_ERRORS.empty });
  assert.deepEqual(validateAlias(42), { ok: false, error: ALIAS_ERRORS.empty });
});
