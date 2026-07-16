// src/game/maze.test.js
//
// Unit tests for the pure maze model (src/game/maze.js).
//
// Run with Node's built-in test runner: `node --test` (ESM). These tests have
// no React/canvas/DOM dependencies. They verify that:
//   - parseMaze computes width/height and rejects malformed layouts,
//   - the default maze is bordered by walls and treats OOB as walls,
//   - the pellet set exactly matches the '.' characters in the raw layout and
//     never overlaps walls or spawn tiles,
//   - spawn tiles (Kiroman + chasers) are open, pellet-free tiles,
//   - the pixel<->tile and index<->tile conversions round-trip.
//
// Requirements: 2.1 (maze contains walls, pellets, Kiroman, chaser spawns),
//               2.2 (walls are impassable — isWall true for walls and OOB).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGEND,
  MAZE_LAYOUTS,
  MAZES,
  parseMaze,
  isWall,
  pelletTiles,
  pelletCoords,
  tileIndex,
  indexToTile,
  tileToPixel,
  tileToPixelCenter,
  pixelToTile,
} from './maze.js';
import { TILE_SIZE } from './constants.js';

const RAW = MAZE_LAYOUTS[0];
const MAZE = MAZES[0];

// --- parseMaze: dimensions and validation -----------------------------------

test('parseMaze computes width and height from the layout', () => {
  const rows = ['###', '#.#', '###'];
  const maze = parseMaze(rows);
  assert.equal(maze.width, 3);
  assert.equal(maze.height, 3);
  assert.equal(maze.rows.length, 3);
});

test('parseMaze rejects a ragged layout with unequal row lengths', () => {
  const ragged = ['####', '#.#', '####']; // middle row is shorter
  assert.throws(() => parseMaze(ragged), /equal length/);
});

test('parseMaze rejects unknown tile characters', () => {
  const bad = ['###', '#X#', '###']; // 'X' is not in LEGEND
  assert.throws(() => parseMaze(bad), /unknown tile char/);
});

test('parseMaze rejects an empty or non-array layout', () => {
  assert.throws(() => parseMaze([]), /non-empty array/);
  assert.throws(() => parseMaze('###'), /non-empty array/);
});

test('parseMaze records Kiroman and chaser spawns from the legend', () => {
  const maze = parseMaze(['#####', '#P.K#', '#####']);
  assert.deepEqual(maze.spawns.kiroman, { col: 1, row: 1 });
  assert.deepEqual(maze.spawns.chasers, [{ col: 3, row: 1 }]);
});

// --- Walls: border + out-of-bounds ------------------------------------------

test('the entire border of MAZES[0] consists of walls', () => {
  const { width, height } = MAZE;
  for (let col = 0; col < width; col++) {
    assert.ok(isWall(MAZE, col, 0), `top border (${col},0) should be a wall`);
    assert.ok(
      isWall(MAZE, col, height - 1),
      `bottom border (${col},${height - 1}) should be a wall`,
    );
  }
  for (let row = 0; row < height; row++) {
    assert.ok(isWall(MAZE, 0, row), `left border (0,${row}) should be a wall`);
    assert.ok(
      isWall(MAZE, width - 1, row),
      `right border (${width - 1},${row}) should be a wall`,
    );
  }
});

test('isWall returns true for all out-of-bounds coordinates', () => {
  const { width, height } = MAZE;
  assert.ok(isWall(MAZE, -1, 0), 'negative col is a wall');
  assert.ok(isWall(MAZE, 0, -1), 'negative row is a wall');
  assert.ok(isWall(MAZE, width, 0), 'col == width is a wall');
  assert.ok(isWall(MAZE, 0, height), 'row == height is a wall');
  assert.ok(isWall(MAZE, width, height), 'far corner OOB is a wall');
  assert.ok(isWall(MAZE, -100, -100), 'far negative OOB is a wall');
});

test('isWall agrees with the raw layout for every in-bounds tile', () => {
  for (let row = 0; row < MAZE.height; row++) {
    for (let col = 0; col < MAZE.width; col++) {
      const expected = RAW[row][col] === LEGEND.WALL;
      assert.equal(
        isWall(MAZE, col, row),
        expected,
        `wall mismatch at (${col},${row})`,
      );
    }
  }
});

// --- Pellets: size + membership match the raw layout ------------------------

function countChar(layout, ch) {
  let n = 0;
  for (const row of layout) {
    for (const c of row) {
      if (c === ch) n++;
    }
  }
  return n;
}

test('pelletTiles size matches the count of "." characters in the raw layout', () => {
  const expected = countChar(RAW, LEGEND.PELLET);
  assert.equal(pelletTiles(MAZE).size, expected);
  assert.ok(expected > 0, 'the default maze should have pellets');
});

test('every "." in the raw layout has a matching pellet index, and vice versa', () => {
  const pellets = pelletTiles(MAZE);
  const expectedIndices = new Set();
  for (let row = 0; row < MAZE.height; row++) {
    for (let col = 0; col < MAZE.width; col++) {
      if (RAW[row][col] === LEGEND.PELLET) {
        expectedIndices.add(tileIndex(MAZE, col, row));
      }
    }
  }
  // Same size and same membership => the two sets are equal.
  assert.equal(pellets.size, expectedIndices.size);
  for (const idx of expectedIndices) {
    assert.ok(pellets.has(idx), `expected pellet at index ${idx}`);
  }
  for (const idx of pellets) {
    assert.ok(expectedIndices.has(idx), `unexpected pellet at index ${idx}`);
  }
});

test('no pellet index coincides with a wall tile', () => {
  for (const { col, row } of pelletCoords(MAZE)) {
    assert.ok(!isWall(MAZE, col, row), `pellet on a wall at (${col},${row})`);
  }
});

test('no pellet index coincides with a spawn tile', () => {
  const pellets = pelletTiles(MAZE);
  const spawnTiles = [MAZE.spawns.kiroman, ...MAZE.spawns.chasers];
  for (const { col, row } of spawnTiles) {
    const idx = tileIndex(MAZE, col, row);
    assert.ok(!pellets.has(idx), `pellet on a spawn tile at (${col},${row})`);
  }
});

// --- Spawns: open, pellet-free tiles ----------------------------------------

test('the Kiroman spawn is present and is not a wall', () => {
  const p = MAZE.spawns.kiroman;
  assert.ok(p, 'Kiroman spawn should be defined');
  assert.ok(!isWall(MAZE, p.col, p.row), 'Kiroman spawn must not be a wall');
});

test('at least one chaser spawn exists and none is a wall', () => {
  assert.ok(MAZE.spawns.chasers.length >= 1, 'need at least one chaser spawn');
  for (const c of MAZE.spawns.chasers) {
    assert.ok(!isWall(MAZE, c.col, c.row), `chaser spawn (${c.col},${c.row}) is a wall`);
  }
});

test('spawn tiles are not pellets', () => {
  const pellets = pelletTiles(MAZE);
  for (const { col, row } of [MAZE.spawns.kiroman, ...MAZE.spawns.chasers]) {
    assert.ok(!pellets.has(tileIndex(MAZE, col, row)), `spawn (${col},${row}) is a pellet`);
  }
});

// --- Coordinate conversions round-trip --------------------------------------

test('pixelToTile(tileToPixelCenter(col,row)) round-trips to the same tile', () => {
  for (let row = 0; row < MAZE.height; row++) {
    for (let col = 0; col < MAZE.width; col++) {
      const center = tileToPixelCenter(col, row);
      assert.deepEqual(pixelToTile(center.x, center.y), { col, row });
    }
  }
});

test('tileToPixel returns the top-left corner of the tile', () => {
  assert.deepEqual(tileToPixel(0, 0), { x: 0, y: 0 });
  assert.deepEqual(tileToPixel(2, 3), { x: 2 * TILE_SIZE, y: 3 * TILE_SIZE });
  // The top-left corner maps back to its own tile.
  const p = tileToPixel(4, 5);
  assert.deepEqual(pixelToTile(p.x, p.y), { col: 4, row: 5 });
});

test('indexToTile(tileIndex(col,row)) round-trips to the same tile', () => {
  for (let row = 0; row < MAZE.height; row++) {
    for (let col = 0; col < MAZE.width; col++) {
      const idx = tileIndex(MAZE, col, row);
      assert.deepEqual(indexToTile(MAZE, idx), { col, row });
    }
  }
});
