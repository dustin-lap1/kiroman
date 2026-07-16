// src/game/engine.pbt.test.js
//
// Property-based tests for the pure Kiroman engine (src/game/engine.js),
// covering design correctness Properties 1–7. Written for task 3.5.
//
// Framework: fast-check (property-based) on top of Node's built-in test runner
// (`node --test`, ESM). No React/canvas/DOM dependencies. Runs are deterministic
// — every property is pinned to a fixed `seed` so failures reproduce exactly.
//
// Strategy: most properties are exercised by generating random sequences of
// player intents (directions + occasional pause) and random `dt` values, then
// driving the engine from `createInitialState` and asserting the invariant holds
// after EVERY step. A few properties (level-up trigger, difficulty curve) are
// tested with targeted generators so the relevant scenario is actually reached
// quickly — for level-up we inject a near-empty pellet set into an otherwise
// real state (engine source is left unchanged; we only construct inputs).
//
// Requirements: 2.2, 2.3, 3.1, 3.2, 3.3, 3.5, 4.3, 4.5.
// Design Properties: 1 (no wall clipping), 2 (pellet conservation), 3 (level-up
// trigger), 4 (difficulty monotonic + capped), 5 (score/lives preserved across
// level-up), 6 (pause freezes state), 7 (highestLevel running max).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { createInitialState, step } from './engine.js';
import { entityTile } from './entities.js';
import { isWall, tileIndex } from './maze.js';
import { chaserSpeedForLevel } from './difficulty.js';
import { PELLET_VALUE, MAX_CHASER_SPEED, DIRECTION_NAMES } from './constants.js';

// ---------------------------------------------------------------------------
// Shared generators
// ---------------------------------------------------------------------------

// A single tick's player intent. Directions dominate; pause and no-op appear
// occasionally so pause/resume interleaving is exercised without dominating.
const intentArb = fc.oneof(
  { weight: 8, arbitrary: fc.record({ direction: fc.constantFrom(...DIRECTION_NAMES) }) },
  { weight: 1, arbitrary: fc.constant({ pause: true }) },
  { weight: 1, arbitrary: fc.constant({}) },
);

// Elapsed time per tick, in seconds. Bounded to realistic frame deltas so the
// engine advances meaningfully without hitting the runaway-dt guard.
const dtArb = fc.double({ min: 0.001, max: 0.25, noNaN: true, noDefaultInfinity: true });

// A sequence of (intent, dt) ticks to drive the engine with.
const scriptArb = fc.array(fc.record({ input: intentArb, dt: dtArb }), {
  minLength: 1,
  maxLength: 200,
});

// Snapshot of just the mutable entity coordinates/headings (Property 6).
function positions(state) {
  return JSON.stringify({
    k: { x: state.kiroman.x, y: state.kiroman.y, dir: state.kiroman.dir },
    c: state.chasers.map((c) => ({ x: c.x, y: c.y, dir: c.dir })),
  });
}

// Every entity currently sits on a non-wall tile (Property 1).
function assertNoWallClipping(state, label) {
  const k = entityTile(state.kiroman);
  assert.ok(
    !isWall(state.maze, k.col, k.row),
    `${label}: Kiroman clipped into a wall at (${k.col},${k.row})`,
  );
  for (let i = 0; i < state.chasers.length; i++) {
    const c = entityTile(state.chasers[i]);
    assert.ok(
      !isWall(state.maze, c.col, c.row),
      `${label}: chaser ${i} clipped into a wall at (${c.col},${c.row})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Property 1 (no wall clipping), Property 2 (pellet conservation),
// Property 5 (score/lives preserved across level-up) and Property 7
// (highestLevel running max) are all step-wise invariants over arbitrary play,
// so we assert them together while driving one random script.
// Validates: Requirements 2.2, 2.3, 3.2, 3.5
// ---------------------------------------------------------------------------

test('Properties 1,2,5,7 hold at every step of arbitrary play', () => {
  fc.assert(
    fc.property(scriptArb, (script) => {
      let state = createInitialState();
      assertNoWallClipping(state, 'initial');
      // Property 7 bookkeeping: the max level observed so far this session.
      let maxLevelSeen = state.level;
      assert.equal(state.highestLevel, maxLevelSeen);

      for (let i = 0; i < script.length; i++) {
        const { input, dt } = script[i];
        const prev = state;
        const next = step(prev, input, dt);

        // --- Property 1: no wall clipping ---
        assertNoWallClipping(next, `step ${i}`);

        // --- level sanity: never decreases, advances by at most 1 per tick ---
        assert.ok(
          next.level >= prev.level && next.level <= prev.level + 1,
          `step ${i}: level jumped from ${prev.level} to ${next.level}`,
        );

        if (next.level === prev.level) {
          // --- Property 2: within a level, pellets never increase and score
          // rises by exactly PELLET_VALUE per pellet removed. ---
          const drop = prev.pellets.size - next.pellets.size;
          assert.ok(drop >= 0, `step ${i}: pellet count increased within a level`);
          assert.equal(
            next.score - prev.score,
            PELLET_VALUE * drop,
            `step ${i}: score delta != PELLET_VALUE * pellets removed`,
          );
        } else {
          // --- Property 5: advancing a level preserves lives and never resets
          // score (the only score change on a level-up tick is the final
          // pellet's value, so score must not drop). ---
          assert.equal(
            next.lives,
            prev.lives,
            `step ${i}: lives changed across level-up`,
          );
          assert.ok(
            next.score >= prev.score,
            `step ${i}: score reset/decreased across level-up`,
          );
        }

        // --- Property 7: highestLevel is the running max of level. ---
        maxLevelSeen = Math.max(maxLevelSeen, next.level);
        assert.ok(
          next.highestLevel >= prev.highestLevel,
          `step ${i}: highestLevel decreased`,
        );
        assert.equal(
          next.highestLevel,
          maxLevelSeen,
          `step ${i}: highestLevel != max level observed`,
        );

        state = next;
      }
    }),
    { seed: 0x5eed1, numRuns: 150 },
  );
});

// ---------------------------------------------------------------------------
// Property 3: Level-up trigger.
// The game advances iff the pellet set becomes empty, and `level` strictly
// increases (by exactly 1) on advance.
// Validates: Requirements 3.1, 3.2
//
// To reach the boundary quickly we inject a controlled pellet set into a real
// state (engine unchanged): a single pellet sitting on Kiroman's own tile is
// consumed on the next tick, emptying the set and forcing an advance; two
// pellets (one on Kiroman's tile, one elsewhere) leave the set non-empty, so no
// advance. `dt` is generated but kept small so chasers cannot reach Kiroman's
// spawn tile and pre-empt the pellet logic with a life loss.
// ---------------------------------------------------------------------------

test('Property 3: emptying the pellet set advances the level by exactly 1', () => {
  fc.assert(
    fc.property(fc.double({ min: 0.001, max: 0.05, noNaN: true }), (dt) => {
      const base = createInitialState();
      const kt = entityTile(base.kiroman);
      const kIdx = tileIndex(base.maze, kt.col, kt.row);

      // Exactly one pellet, right where Kiroman stands → consumed this tick.
      const state = { ...base, pellets: new Set([kIdx]) };
      const next = step(state, {}, dt);

      assert.equal(next.level, state.level + 1, 'level must advance by exactly 1');
      assert.ok(next.pellets.size > 0, 'new level must repopulate pellets');
      assert.equal(next.score, state.score + PELLET_VALUE, 'final pellet must score');
    }),
    { seed: 0x5eed2, numRuns: 50 },
  );
});

test('Property 3: a non-empty pellet set never advances the level', () => {
  fc.assert(
    fc.property(fc.double({ min: 0.001, max: 0.05, noNaN: true }), (dt) => {
      const base = createInitialState();
      const kt = entityTile(base.kiroman);
      const kIdx = tileIndex(base.maze, kt.col, kt.row);
      // Pick any other pellet index from the real layout to keep the set > 0
      // after Kiroman eats the one on its tile.
      const other = [...base.maze.pellets].find((idx) => idx !== kIdx);
      assert.ok(other !== undefined, 'fixture needs a second pellet');

      const state = { ...base, pellets: new Set([kIdx, other]) };
      const next = step(state, {}, dt);

      assert.equal(next.level, state.level, 'level must not advance while pellets remain');
      assert.ok(next.pellets.size >= 1, 'a pellet should remain');
    }),
    { seed: 0x5eed3, numRuns: 50 },
  );
});

// ---------------------------------------------------------------------------
// Property 4: Difficulty monotonic and capped.
// Chaser speed is non-decreasing as level increases and never exceeds the cap.
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------

test('Property 4: chaser speed is non-decreasing and capped across levels', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 500 }),
      fc.integer({ min: 0, max: 500 }),
      (level, delta) => {
        const higher = level + delta; // higher >= level
        const sLow = chaserSpeedForLevel(level);
        const sHigh = chaserSpeedForLevel(higher);
        assert.ok(sHigh >= sLow, `speed decreased: L${level}=${sLow} > L${higher}=${sHigh}`);
        assert.ok(sLow <= MAX_CHASER_SPEED, `speed exceeded cap at level ${level}`);
        assert.ok(sHigh <= MAX_CHASER_SPEED, `speed exceeded cap at level ${higher}`);
      },
    ),
    { seed: 0x5eed4, numRuns: 200 },
  );
});

// ---------------------------------------------------------------------------
// Property 5 (targeted): a level-up preserves an arbitrary score and lives.
// Complements the step-wise check above with explicit non-default score/lives.
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

test('Property 5: advancing a level preserves score and lives (targeted)', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0.001, max: 0.05, noNaN: true }),
      fc.integer({ min: 0, max: 100000 }),
      fc.integer({ min: 1, max: 9 }),
      (dt, startScore, startLives) => {
        const base = createInitialState();
        const kt = entityTile(base.kiroman);
        const kIdx = tileIndex(base.maze, kt.col, kt.row);
        const state = {
          ...base,
          score: startScore,
          lives: startLives,
          pellets: new Set([kIdx]),
        };
        const next = step(state, {}, dt);

        assert.equal(next.level, state.level + 1, 'level should have advanced');
        assert.equal(next.lives, startLives, 'lives must be preserved across level-up');
        assert.equal(
          next.score,
          startScore + PELLET_VALUE,
          'score must carry across level-up (only the final pellet adds)',
        );
      },
    ),
    { seed: 0x5eed5, numRuns: 100 },
  );
});

// ---------------------------------------------------------------------------
// Property 6: Pause freezes state.
// While paused, applying any number of steps with directional intents leaves
// every entity position unchanged.
// Validates: Requirements 4.3, 4.5
// ---------------------------------------------------------------------------

test('Property 6: paused state is frozen under arbitrary directional input', () => {
  fc.assert(
    fc.property(
      // Warm-up script so we do not start from the trivial all-null config.
      fc.array(fc.record({ dir: fc.constantFrom(...DIRECTION_NAMES), dt: dtArb }), {
        minLength: 1,
        maxLength: 40,
      }),
      // Directional intents to apply WHILE paused (must be ignored).
      fc.array(fc.record({ dir: fc.constantFrom(...DIRECTION_NAMES), dt: dtArb }), {
        minLength: 1,
        maxLength: 60,
      }),
      (warmup, whilePaused) => {
        let state = createInitialState();
        for (const s of warmup) state = step(state, { direction: s.dir }, s.dt);

        // Toggle into pause; this tick must not move anything either.
        const before = positions(state);
        const paused = step(state, { pause: true }, 0.1);
        assert.equal(paused.status, 'paused');
        assert.equal(positions(paused), before, 'pause toggle tick moved an entity');

        // Any number of directional steps leave positions unchanged.
        let cur = paused;
        const frozen = positions(paused);
        for (let i = 0; i < whilePaused.length; i++) {
          cur = step(cur, { direction: whilePaused[i].dir }, whilePaused[i].dt);
          assert.equal(cur.status, 'paused', `unpaused unexpectedly at ${i}`);
          assert.equal(positions(cur), frozen, `position changed while paused at ${i}`);
        }
      },
    ),
    { seed: 0x5eed6, numRuns: 100 },
  );
});
