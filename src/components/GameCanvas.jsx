// src/components/GameCanvas.jsx
//
// React wrapper around the canvas + game loop. It renders a <canvas> sized to
// the maze dimensions * tileSize, wires it to `useGameLoop`, and loads the Kiro
// logo image (public/kiro.png) so the chasers render as the Kiro sprite
// (Requirement 7.3). The component itself holds no game state — that lives in
// refs inside the hook, keeping the engine pure and avoiding per-frame React
// re-renders.
//
// Input adapters (task 5) are intentionally NOT implemented here. This
// component only accepts an intent *source* via `getIntent`; the default
// returns `{}` (no input), so the board renders and animates on its own until
// keyboard/touch adapters are wired in.

import { useEffect, useRef, useState } from 'react';
import { useGameLoop } from '../render/useGameLoop.js';
import { TILE_SIZE } from '../game/constants.js';
import { MAZES } from '../game/maze.js';

/**
 * The maze used for sizing the canvas. Task 3/4 use the single default layout;
 * every level currently shares these dimensions, so the canvas size is stable.
 * @type {import('../game/maze.js').Maze}
 */
const MAZE = MAZES[0];

/**
 * Fraction of the viewport HEIGHT the board is allowed to occupy, as a `vh`
 * value. The maze is taller than it is wide (19x21), so on desktop the height
 * is the binding constraint; capping it here guarantees the whole board fits on
 * screen with room left for the header, leaderboard, HUD and touch controls.
 * @type {number}
 */
const BOARD_MAX_VH = 68;

/**
 * Canvas host for the Kiroman game.
 *
 * @param {Object} props
 * @param {() => {direction?: string, pause?: boolean}} [props.getIntent] current input intent source (defaults to no input)
 * @param {(summary: {status: string, score: number, level: number, lives: number, highestLevel: number}, state: import('../game/engine.js').GameState) => void} [props.onStateChange] throttled HUD update callback
 * @param {boolean} [props.running=true] whether the loop should run
 * @param {*} [props.gameKey] bump to reset to a fresh game
 * @param {number} [props.tileSize=TILE_SIZE] pixels per tile
 * @param {number} [props.initialLevel=1] starting level
 * @param {number} [props.initialLives] starting lives (defaults to engine default)
 * @param {string} [props.className] optional extra classes for the canvas
 * @returns {JSX.Element}
 */
function GameCanvas({
  getIntent,
  onStateChange,
  running = true,
  gameKey,
  tileSize = TILE_SIZE,
  initialLevel = 1,
  initialLives,
  className = '',
}) {
  const canvasRef = useRef(null);
  const [images, setImages] = useState({});

  // Load the Kiro logo once; pass it to the renderer as images.kiro when ready.
  // Until it loads, the renderer draws its branded fallback chaser shape.
  useEffect(() => {
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setImages({ kiro: img });
    };
    img.src = '/kiro.png';
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, []);

  useGameLoop({
    canvasRef,
    getIntent,
    onStateChange,
    images,
    running,
    tileSize,
    gameKey,
    initialLevel,
    initialLives,
  });

  const width = MAZE.width * tileSize;
  const height = MAZE.height * tileSize;

  // Responsive sizing (Requirements 6.3, 6.4): the canvas keeps its fixed
  // internal resolution (crisp rendering, `useGameLoop` tileSize untouched) and
  // is CSS-scaled to fit the viewport while preserving aspect ratio.
  //   - `width: 100%` lets the board grow to its container on wide screens.
  //   - `maxWidth` is capped to the width that corresponds to BOARD_MAX_VH of
  //     viewport height (maxWidth = maxHeight * aspectRatio), so the board can
  //     never be taller than the viewport allows — it fits vertically AND never
  //     forces horizontal scroll on narrow screens.
  //   - `height: auto` + the max-width cap keep the aspect ratio exact.
  const boardStyle = {
    width: '100%',
    height: 'auto',
    maxWidth: `calc(${BOARD_MAX_VH}vh * ${MAZE.width} / ${MAZE.height})`,
    maxHeight: `${BOARD_MAX_VH}vh`,
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      aria-label="Kiroman maze"
      style={boardStyle}
      className={`block mx-auto rounded-lg shadow-2xl shadow-violet-950/50 ${className}`}
    />
  );
}

export default GameCanvas;
