// src/game/maze.js
//
// Pure maze model for Kiroman: static layout(s) plus grid/pixel helpers.
//
// This module has no React, canvas, DOM or timer dependencies so it is
// importable by both the browser build and Node's test runner. A maze is
// authored as a rectangular array of equal-length strings using LEGEND below,
// then parsed once into an efficient representation (walls grid + pellet index
// set + spawn points) via `parseMaze`.

import { TILE_SIZE } from './constants.js';

/**
 * Character legend for authoring maze layouts.
 * @type {Readonly<Record<string, string>>}
 */
export const LEGEND = Object.freeze({
  WALL: '#', // impassable wall
  PELLET: '.', // collectible pellet on an open tile
  EMPTY: ' ', // open tile with no pellet
  KIROMAN: 'P', // Kiroman (player) spawn — open tile, no pellet
  CHASER: 'K', // Kiro chaser spawn — open tile, no pellet
});

/**
 * Raw maze layouts. Each layout is an array of equal-length strings.
 *
 * Layout 0 is a classic, fully connected Pac-Man-style maze: a solid wall
 * border, symmetric corridors, a central chaser (K) pen, and Kiroman (P)
 * spawning lower-centre. Open tiles are mostly pellets so a level has plenty to
 * collect.
 * @type {ReadonlyArray<ReadonlyArray<string>>}
 */
export const MAZE_LAYOUTS = Object.freeze([
  Object.freeze([
    '###################',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.###.#.###.####',
    '#......#...#......#',
    '#.####.#.#.#.####.#',
    '#......#.#.#......#',
    '##.###.#.#.#.###.##',
    '#......#.K.#......#',
    '#.####.#.#.#.####.#',
    '#......#...#......#',
    '####.###.#.###.####',
    '#....#...#...#....#',
    '#.##.#.#####.#.##.#',
    '#..#.....P.....#..#',
    '#.##.###.#.###.##.#',
    '#.................#',
    '###################',
  ]),
]);

/**
 * Convert (col, row) to a flat tile index for a maze of the given width.
 * @param {{width: number}} maze parsed maze (or any object with `width`)
 * @param {number} col column (x tile)
 * @param {number} row row (y tile)
 * @returns {number} flat index `row * width + col`
 */
export function tileIndex(maze, col, row) {
  return row * maze.width + col;
}

/**
 * Convert a flat tile index back to `{ col, row }` for a maze of given width.
 * @param {{width: number}} maze parsed maze (or any object with `width`)
 * @param {number} index flat tile index
 * @returns {{col: number, row: number}}
 */
export function indexToTile(maze, index) {
  return { col: index % maze.width, row: Math.floor(index / maze.width) };
}

/**
 * Parse a raw maze layout (array of strings) into an efficient representation.
 *
 * @param {ReadonlyArray<string>} rows rectangular layout using LEGEND chars
 * @returns {{
 *   rows: string[],
 *   width: number,
 *   height: number,
 *   walls: boolean[][],
 *   pellets: Set<number>,
 *   spawns: { kiroman: {col: number, row: number}|null, chasers: {col: number, row: number}[] },
 * }}
 */
export function parseMaze(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('parseMaze: layout must be a non-empty array of strings');
  }
  const height = rows.length;
  const width = rows[0].length;
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error('parseMaze: all rows must have equal length');
    }
  }

  const walls = [];
  const pellets = new Set();
  const spawns = { kiroman: null, chasers: [] };

  for (let row = 0; row < height; row++) {
    const wallRow = new Array(width).fill(false);
    for (let col = 0; col < width; col++) {
      const ch = rows[row][col];
      switch (ch) {
        case LEGEND.WALL:
          wallRow[col] = true;
          break;
        case LEGEND.PELLET:
          pellets.add(row * width + col);
          break;
        case LEGEND.KIROMAN:
          spawns.kiroman = { col, row };
          break;
        case LEGEND.CHASER:
          spawns.chasers.push({ col, row });
          break;
        case LEGEND.EMPTY:
          break;
        default:
          throw new Error(`parseMaze: unknown tile char '${ch}' at (${col},${row})`);
      }
    }
    walls.push(wallRow);
  }

  return {
    rows: rows.slice(),
    width,
    height,
    walls,
    pellets,
    spawns,
  };
}

/**
 * Parsed maze layouts, ready to use. `MAZES[0]` is the default level layout.
 * @type {ReturnType<typeof parseMaze>[]}
 */
export const MAZES = MAZE_LAYOUTS.map((layout) => parseMaze(layout));

/**
 * Is the tile at (col, row) a wall? Out-of-bounds tiles are treated as walls so
 * callers never need a separate bounds check before movement.
 * @param {{walls: boolean[][], width: number, height: number}} maze parsed maze
 * @param {number} col column (x tile)
 * @param {number} row row (y tile)
 * @returns {boolean}
 */
export function isWall(maze, col, row) {
  if (col < 0 || row < 0 || col >= maze.width || row >= maze.height) {
    return true;
  }
  return maze.walls[row][col] === true;
}

/**
 * The set of pellet tile indices for the given maze. Pellets are represented as
 * flat indices (`row * width + col`) so the engine can remove them in O(1).
 * @param {{pellets: Set<number>}} maze parsed maze
 * @returns {Set<number>} the pellet index set (the maze's own set)
 */
export function pelletTiles(maze) {
  return maze.pellets;
}

/**
 * The pellet tiles as `{ col, row }` coordinates (a fresh array each call).
 * @param {{pellets: Set<number>, width: number}} maze parsed maze
 * @returns {{col: number, row: number}[]}
 */
export function pelletCoords(maze) {
  return [...maze.pellets].map((index) => indexToTile(maze, index));
}

/**
 * Convert a tile (col, row) to the pixel position of its **top-left corner**,
 * using TILE_SIZE. Use `tileToPixelCenter` when a centre point is needed.
 * @param {number} col column (x tile)
 * @param {number} row row (y tile)
 * @returns {{x: number, y: number}}
 */
export function tileToPixel(col, row) {
  return { x: col * TILE_SIZE, y: row * TILE_SIZE };
}

/**
 * Convert a tile (col, row) to the pixel position of its **centre**.
 * @param {number} col column (x tile)
 * @param {number} row row (y tile)
 * @returns {{x: number, y: number}}
 */
export function tileToPixelCenter(col, row) {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/**
 * Convert a pixel position to the tile (col, row) that contains it.
 * @param {number} x pixel x
 * @param {number} y pixel y
 * @returns {{col: number, row: number}}
 */
export function pixelToTile(x, y) {
  return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
}
