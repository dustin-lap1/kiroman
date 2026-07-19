// functions/getLeaderboard/leaderboard.test.mjs
//
// Unit tests for the pure leaderboard sort/top-N logic (leaderboard.mjs).
// Run with Node's built-in test runner: `node --test` (the repo's `npm test`).
// No AWS/network dependencies.
//
// Requirements:
//   5.1 - return the top three entries by highest level reached.
//   5.2 - each entry exposes alias and highest level reached.
//   5.6 - equal levels ordered by higher score first, then earliest-achieved.
// Design Property 9: sorted by level desc, then score desc, then achievedAt asc,
// at most three.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { topEntries, DEFAULT_TOP_N } from './leaderboard.mjs';

const mk = (alias, level, achievedAt, score = 0) => ({ alias, level, achievedAt, score });

test('sorts by level descending (Requirement 5.1)', () => {
  const items = [mk('a', 3, 100), mk('b', 7, 100), mk('c', 5, 100)];
  const result = topEntries(items);
  assert.deepEqual(
    result.map((e) => e.alias),
    ['b', 'c', 'a'],
  );
});

test('breaks ties on equal level by higher score first (Requirement 5.6)', () => {
  // Same level, different scores: the higher score ranks first regardless of
  // when it was achieved. This is the reported Victor-vs-Kiro case.
  const items = [mk('kiro', 4, 100, 6860), mk('victor', 4, 200, 6880)];
  const result = topEntries(items);
  assert.deepEqual(
    result.map((e) => e.alias),
    ['victor', 'kiro'],
  );
});

test('breaks ties on equal level and equal score by earliest achievedAt (Requirement 5.6)', () => {
  const items = [
    mk('late', 5, 300, 1000),
    mk('early', 5, 100, 1000),
    mk('mid', 5, 200, 1000),
  ];
  const result = topEntries(items);
  assert.deepEqual(
    result.map((e) => e.alias),
    ['early', 'mid', 'late'],
  );
});

test('level dominates score (a higher level with a lower score still wins)', () => {
  const items = [mk('grinder', 3, 100, 99999), mk('climber', 5, 100, 100)];
  const result = topEntries(items);
  assert.deepEqual(
    result.map((e) => e.alias),
    ['climber', 'grinder'],
  );
});

test('level ordering dominates achievedAt (a higher level with a later time still wins)', () => {
  const items = [mk('older-lower', 4, 100), mk('newer-higher', 9, 999)];
  const result = topEntries(items);
  assert.deepEqual(
    result.map((e) => e.alias),
    ['newer-higher', 'older-lower'],
  );
});

test('returns all entries when fewer than the limit', () => {
  const items = [mk('a', 2, 100), mk('b', 1, 100)];
  const result = topEntries(items);
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((e) => e.alias),
    ['a', 'b'],
  );
});

test('returns exactly three when three are present', () => {
  const items = [mk('a', 3, 100), mk('b', 2, 100), mk('c', 1, 100)];
  const result = topEntries(items);
  assert.equal(result.length, 3);
});

test('returns only the top three when more than three are present (Requirement 5.1)', () => {
  const items = [
    mk('a', 1, 100),
    mk('b', 2, 100),
    mk('c', 3, 100),
    mk('d', 4, 100),
    mk('e', 5, 100),
  ];
  const result = topEntries(items);
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((e) => e.alias),
    ['e', 'd', 'c'],
  );
});

test('default top-N is three', () => {
  assert.equal(DEFAULT_TOP_N, 3);
});

test('empty input returns an empty array', () => {
  assert.deepEqual(topEntries([]), []);
});

test('non-array input returns an empty array (defensive, never throws)', () => {
  assert.deepEqual(topEntries(undefined), []);
  assert.deepEqual(topEntries(null), []);
});

test('ordering is deterministic regardless of input order (stable)', () => {
  const base = [
    mk('a', 5, 100),
    mk('b', 5, 200),
    mk('c', 7, 150),
    mk('d', 3, 50),
  ];
  const reversed = [...base].reverse();
  const shuffled = [base[2], base[0], base[3], base[1]];

  const expected = topEntries(base);
  assert.deepEqual(topEntries(reversed), expected);
  assert.deepEqual(topEntries(shuffled), expected);
  // Sanity: the deterministic order for this set.
  assert.deepEqual(
    expected.map((e) => e.alias),
    ['c', 'a', 'b'],
  );
});

test('maps each result to exactly { alias, level, score, achievedAt } (Requirement 5.2)', () => {
  const items = [{ pk: 'LEADERBOARD', alias: 'z', level: 4, score: 1450, achievedAt: 42, extra: 'drop-me' }];
  const [entry] = topEntries(items);
  assert.deepEqual(Object.keys(entry).sort(), ['achievedAt', 'alias', 'level', 'score']);
  assert.deepEqual(entry, { alias: 'z', level: 4, score: 1450, achievedAt: 42 });
});

test('defaults a missing score to 0 (entries written before scores were tracked)', () => {
  const items = [{ alias: 'legacy', level: 3, achievedAt: 10 }];
  const [entry] = topEntries(items);
  assert.deepEqual(entry, { alias: 'legacy', level: 3, score: 0, achievedAt: 10 });
});

test('does not mutate the input array', () => {
  const items = [mk('a', 1, 100), mk('b', 9, 100)];
  const snapshot = JSON.parse(JSON.stringify(items));
  topEntries(items);
  assert.deepEqual(items, snapshot);
});

test('respects a custom n', () => {
  const items = [mk('a', 5, 100), mk('b', 4, 100), mk('c', 3, 100)];
  assert.equal(topEntries(items, 1).length, 1);
  assert.equal(topEntries(items, 2).length, 2);
  assert.deepEqual(topEntries(items, 1)[0].alias, 'a');
});

test('coerces malformed numeric fields to safe defaults without throwing', () => {
  const items = [mk('good', 5, 100), { alias: 'bad' }, mk('mid', 2, 100)];
  const result = topEntries(items);
  assert.equal(result.length, 3);
  assert.equal(result[0].alias, 'good');
  // The item missing level/achievedAt sorts last with zeroed numeric fields.
  const bad = result.find((e) => e.alias === 'bad');
  assert.deepEqual(bad, { alias: 'bad', level: 0, score: 0, achievedAt: 0 });
});
