// src/api/leaderboard.test.js
//
// Unit tests for the leaderboard API client (src/api/leaderboard.js).
//
// Run with Node's built-in test runner: `node --test` (ESM). `global.fetch` is
// mocked per-test so no network is touched. These tests focus on the client's
// FAILURE-TOLERANCE contract (design Property 10 / Requirement 5.7): reads
// resolve to `[]` and writes resolve to `{ ok: false }` on any failure, and the
// happy paths return the parsed API shapes.
//
// In test env `import.meta.env` is undefined, so `API_BASE` is '' and requests
// target the relative paths `/leaderboard` and `/scores`.
//
// Requirements: 5.1 (fetch leaderboard), 5.3 (submit score), 5.7 (never crash).

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { getLeaderboard, submitScore } from './leaderboard.js';

// Preserve any real fetch so we can restore it after the suite. Guard for
// environments where fetch may be undefined (older Node) by defining it.
const REAL_FETCH = globalThis.fetch;

/** Install a mock fetch implementation for the duration of a test. */
function mockFetch(impl) {
  globalThis.fetch = impl;
}

/** Build a minimal Response-like object with a JSON body. */
function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

afterEach(() => {
  // Restore the original fetch (or remove the mock if there was none).
  if (REAL_FETCH === undefined) {
    delete globalThis.fetch;
  } else {
    globalThis.fetch = REAL_FETCH;
  }
});

// ---------------------------------------------------------------------------
// getLeaderboard
// ---------------------------------------------------------------------------

test('getLeaderboard returns entries on 200 with { entries: [...] } (R5.1)', async () => {
  const entries = [
    { alias: 'ADA', level: 7, achievedAt: 1000 },
    { alias: 'GRACE', level: 5, achievedAt: 2000 },
  ];
  let calledUrl;
  let calledInit;
  mockFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return jsonResponse({ entries });
  });

  const result = await getLeaderboard();

  assert.equal(calledUrl, '/leaderboard');
  assert.equal(calledInit.method, 'GET');
  assert.deepEqual(result, entries);
});

test('getLeaderboard drops malformed entries but keeps valid ones', async () => {
  mockFetch(async () =>
    jsonResponse({
      entries: [
        { alias: 'ADA', level: 7, achievedAt: 1000 },
        { alias: '', level: 3, achievedAt: 500 }, // empty alias -> dropped
        { alias: 'BAD', level: 'x' }, // non-numeric level -> dropped
        { alias: 'EVE', level: 2 }, // missing achievedAt -> defaulted to 0
        null,
      ],
    }),
  );

  const result = await getLeaderboard();

  assert.deepEqual(result, [
    { alias: 'ADA', level: 7, achievedAt: 1000 },
    { alias: 'EVE', level: 2, achievedAt: 0 },
  ]);
});

test('getLeaderboard returns [] on network rejection (Property 10 / R5.7)', async () => {
  mockFetch(async () => {
    throw new Error('network down');
  });

  const result = await getLeaderboard();
  assert.deepEqual(result, []);
});

test('getLeaderboard returns [] on non-ok status (500) (Property 10 / R5.7)', async () => {
  mockFetch(async () => jsonResponse({ error: 'boom' }, { ok: false, status: 500 }));

  const result = await getLeaderboard();
  assert.deepEqual(result, []);
});

test('getLeaderboard returns [] on malformed JSON (Property 10 / R5.7)', async () => {
  mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  }));

  const result = await getLeaderboard();
  assert.deepEqual(result, []);
});

test('getLeaderboard returns [] when entries is missing or not an array', async () => {
  mockFetch(async () => jsonResponse({ notEntries: true }));
  assert.deepEqual(await getLeaderboard(), []);
});

// ---------------------------------------------------------------------------
// submitScore
// ---------------------------------------------------------------------------

test('submitScore posts correct URL/method/headers/body and returns { ok, updated } (R5.3)', async () => {
  let calledUrl;
  let calledInit;
  mockFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return jsonResponse({ ok: true, updated: true });
  });

  const result = await submitScore('ADA', 9);

  assert.equal(calledUrl, '/scores');
  assert.equal(calledInit.method, 'POST');
  assert.equal(calledInit.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calledInit.body), { alias: 'ADA', level: 9 });
  assert.deepEqual(result, { ok: true, updated: true });
});

test('submitScore returns { ok:true, updated:false } when server reports no improvement (R5.5)', async () => {
  mockFetch(async () => jsonResponse({ ok: true, updated: false }));

  const result = await submitScore('ADA', 2);
  assert.deepEqual(result, { ok: true, updated: false });
});

test('submitScore returns { ok:false } on network rejection without throwing (R5.7)', async () => {
  mockFetch(async () => {
    throw new Error('network down');
  });

  const result = await submitScore('ADA', 9);
  assert.deepEqual(result, { ok: false });
});

test('submitScore returns { ok:false } on non-ok status (400/500) without throwing (R5.7)', async () => {
  mockFetch(async () => jsonResponse({ error: 'bad input' }, { ok: false, status: 400 }));

  const result = await submitScore('', 9);
  assert.deepEqual(result, { ok: false });
});

test('submitScore returns { ok:false } on malformed JSON (R5.7)', async () => {
  mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('bad json');
    },
  }));

  const result = await submitScore('ADA', 9);
  assert.deepEqual(result, { ok: false });
});
