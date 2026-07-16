// functions/submitScore/validate.test.mjs
//
// Unit tests for the pure request parsing/validation logic (validate.mjs).
// Run with Node's built-in test runner: `node --test` (the repo's `npm test`).
// No AWS/network dependencies.
//
// Requirements:
//   5.3 - server re-validates alias length and positive-integer level.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSubmission,
  SUBMISSION_ERRORS,
  ALIAS_MAX_LENGTH,
  MIN_LEVEL,
} from './validate.mjs';

// --- Body parsing -----------------------------------------------------------

test('rejects a non-JSON string body', () => {
  const result = parseSubmission('not json {');
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.badJson });
});

test('rejects an empty string body', () => {
  const result = parseSubmission('');
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.notObject });
});

test('rejects a JSON array body', () => {
  const result = parseSubmission('[1,2,3]');
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.notObject });
});

test('rejects a JSON null body', () => {
  const result = parseSubmission('null');
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.notObject });
});

test('rejects a non-string, non-object body (number)', () => {
  const result = parseSubmission(42);
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.notObject });
});

test('accepts an already-parsed object (not just a JSON string)', () => {
  const result = parseSubmission({ alias: 'neo', level: 5 });
  assert.deepEqual(result, { ok: true, alias: 'neo', level: 5 });
});

test('accepts a valid JSON string body', () => {
  const result = parseSubmission(JSON.stringify({ alias: 'neo', level: 5 }));
  assert.deepEqual(result, { ok: true, alias: 'neo', level: 5 });
});

// --- Missing fields ---------------------------------------------------------

test('rejects a body missing both fields', () => {
  const result = parseSubmission({});
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.alias });
});

test('rejects a body missing the level field', () => {
  const result = parseSubmission({ alias: 'neo' });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.level });
});

test('rejects a body missing the alias field', () => {
  const result = parseSubmission({ level: 3 });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.alias });
});

// --- Alias validation (mirrors src/game/alias.js: trim, 1..12) --------------

test('rejects an empty alias', () => {
  const result = parseSubmission({ alias: '', level: 3 });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.alias });
});

test('rejects a whitespace-only alias', () => {
  const result = parseSubmission({ alias: '   ', level: 3 });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.alias });
});

test('rejects a non-string alias (number)', () => {
  const result = parseSubmission({ alias: 123, level: 3 });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.alias });
});

test('rejects an alias longer than 12 characters after trimming', () => {
  const result = parseSubmission({ alias: 'a'.repeat(ALIAS_MAX_LENGTH + 1), level: 3 });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.alias });
});

test('accepts a 1-character alias (lower boundary)', () => {
  const result = parseSubmission({ alias: 'a', level: 1 });
  assert.deepEqual(result, { ok: true, alias: 'a', level: 1 });
});

test('accepts a 12-character alias (upper boundary)', () => {
  const alias = 'a'.repeat(ALIAS_MAX_LENGTH);
  const result = parseSubmission({ alias, level: 1 });
  assert.deepEqual(result, { ok: true, alias, level: 1 });
});

test('trims surrounding whitespace and returns the trimmed alias', () => {
  const result = parseSubmission({ alias: '  neo  ', level: 3 });
  assert.deepEqual(result, { ok: true, alias: 'neo', level: 3 });
});

test('accepts an alias that is 12 chars only after trimming', () => {
  const result = parseSubmission({ alias: `  ${'x'.repeat(ALIAS_MAX_LENGTH)}  `, level: 3 });
  assert.deepEqual(result, { ok: true, alias: 'x'.repeat(ALIAS_MAX_LENGTH), level: 3 });
});

// --- Level validation (strict positive integer) -----------------------------

test('rejects level 0', () => {
  const result = parseSubmission({ alias: 'neo', level: 0 });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.level });
});

test('rejects a negative level', () => {
  const result = parseSubmission({ alias: 'neo', level: -5 });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.level });
});

test('rejects a non-integer level (1.5)', () => {
  const result = parseSubmission({ alias: 'neo', level: 1.5 });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.level });
});

test('rejects a numeric-string level "3" (strict: no coercion)', () => {
  const result = parseSubmission({ alias: 'neo', level: '3' });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.level });
});

test('rejects NaN level', () => {
  const result = parseSubmission({ alias: 'neo', level: NaN });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.level });
});

test('rejects Infinity level', () => {
  const result = parseSubmission({ alias: 'neo', level: Infinity });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.level });
});

test('rejects a boolean level', () => {
  const result = parseSubmission({ alias: 'neo', level: true });
  assert.deepEqual(result, { ok: false, error: SUBMISSION_ERRORS.level });
});

test('accepts the minimum valid level', () => {
  const result = parseSubmission({ alias: 'neo', level: MIN_LEVEL });
  assert.deepEqual(result, { ok: true, alias: 'neo', level: MIN_LEVEL });
});

test('accepts a large integer level', () => {
  const result = parseSubmission({ alias: 'neo', level: 999999 });
  assert.deepEqual(result, { ok: true, alias: 'neo', level: 999999 });
});

test('ignores extra fields in the body', () => {
  const result = parseSubmission({ alias: 'neo', level: 4, hacker: 'drop table' });
  assert.deepEqual(result, { ok: true, alias: 'neo', level: 4 });
});
