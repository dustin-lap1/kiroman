// src/render/useGameLoop.js
//
// React hook that runs the Kiroman game loop. It is the *only* place mutable
// game state lives on the render side: the pure engine (`step`) stays pure, and
// all per-frame mutation is confined to refs inside this hook. React never
// re-renders on a per-frame basis — the canvas is painted imperatively and the
// HUD is updated via a throttled `onStateChange` callback that fires only when
// a player-visible scalar (status/score/level/lives) actually changes.
//
// Fixed-timestep design (design "Rendering layer"): a `requestAnimationFrame`
// loop measures real elapsed time and feeds it into an accumulator, then calls
// the engine `step(state, intent, FIXED_DT)` in fixed FIXED_DT increments until
// the accumulator is drained. This decouples the simulation rate from the
// display refresh rate, so physics/movement are deterministic regardless of
// whether the browser paints at 30, 60, or 144 Hz. After stepping, the latest
// state is drawn once for the frame.

import { useEffect, useRef } from 'react';
import { createInitialState, step } from '../game/engine.js';
import { draw } from './canvasRenderer.js';
import { TILE_SIZE } from '../game/constants.js';

/**
 * The fixed simulation timestep, in seconds. The engine is advanced in exact
 * increments of this value so movement is frame-rate independent (1/60 s).
 * @type {number}
 */
export const FIXED_DT = 1 / 60;

/**
 * Clamp for a single frame's elapsed time, in seconds. If the tab is
 * backgrounded (or a breakpoint pauses execution) the next frame can report a
 * huge delta; clamping avoids a "spiral of death" where the accumulator demands
 * thousands of catch-up steps at once.
 * @type {number}
 */
const MAX_FRAME_SECONDS = 0.25;

/**
 * Default intent source: no keys/touches held. Input adapters (task 5) replace
 * this by passing their own `getIntent` returning `{ direction?, pause? }`.
 * @returns {{}}
 */
const NO_INTENT = () => ({});

/**
 * Extract the small set of player-visible scalars we surface to React. Used to
 * decide whether `onStateChange` should fire (so the HUD/leaderboard update on
 * meaningful change, not every frame).
 * @param {import('../game/engine.js').GameState} state
 * @returns {{status: string, score: number, level: number, lives: number, highestLevel: number}}
 */
function summarize(state) {
  return {
    status: state.status,
    score: state.score,
    level: state.level,
    lives: state.lives,
    highestLevel: state.highestLevel,
  };
}

/**
 * Run the fixed-timestep game loop against a canvas.
 *
 * The hook owns the current game state in a ref (`stateRef`), advancing it
 * inside the rAF loop without triggering React re-renders. All options are
 * mirrored into refs on every render so the long-lived loop always reads the
 * latest callbacks/props without needing to restart.
 *
 * @param {Object} options
 * @param {import('react').RefObject<HTMLCanvasElement>} options.canvasRef ref to the target canvas
 * @param {() => {direction?: string, pause?: boolean}} [options.getIntent] source of the current input intent (defaults to `{}`)
 * @param {(summary: {status: string, score: number, level: number, lives: number, highestLevel: number}, state: import('../game/engine.js').GameState) => void} [options.onStateChange] called (throttled) when status/score/level/lives/highestLevel changes
 * @param {{kiro?: CanvasImageSource}} [options.images] sprite images passed through to the renderer
 * @param {boolean} [options.running=true] when false the loop is stopped (a single static frame is still drawn so the canvas reflects current state)
 * @param {number} [options.tileSize=TILE_SIZE] pixels per tile passed to the renderer
 * @param {*} [options.gameKey] change this value to reset to a fresh initial state (new game)
 * @param {number} [options.initialLevel=1] starting level for a fresh state
 * @param {number} [options.initialLives] starting lives for a fresh state (defaults to engine's STARTING_LIVES)
 * @returns {{ getState: () => (import('../game/engine.js').GameState | null) }} accessor for the current state
 */
export function useGameLoop({
  canvasRef,
  getIntent = NO_INTENT,
  onStateChange,
  images,
  running = true,
  tileSize = TILE_SIZE,
  gameKey,
  initialLevel = 1,
  initialLives,
} = {}) {
  // The single source of mutable game state on the render side.
  const stateRef = useRef(null);
  const rafRef = useRef(0);
  const keyRef = useRef(undefined);
  const lastSummaryRef = useRef(null);

  // Mirror options into refs each render so the persistent loop reads current
  // values without being torn down/recreated (avoids restarting the rAF loop
  // whenever a parent re-renders with a new callback identity).
  const getIntentRef = useRef(getIntent);
  const onStateChangeRef = useRef(onStateChange);
  const imagesRef = useRef(images);
  const tileSizeRef = useRef(tileSize);
  const initialLevelRef = useRef(initialLevel);
  const initialLivesRef = useRef(initialLives);

  // Sync options into refs after each render (never during render). The
  // long-lived rAF loop reads `.current` so it always sees the latest
  // callbacks/props without being torn down and recreated.
  useEffect(() => {
    getIntentRef.current = getIntent;
    onStateChangeRef.current = onStateChange;
    imagesRef.current = images;
    tileSizeRef.current = tileSize;
    initialLevelRef.current = initialLevel;
    initialLivesRef.current = initialLives;
  });

  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    // (Re)initialize state on first run or whenever `gameKey` changes so the
    // parent can start a brand-new game by bumping the key.
    if (stateRef.current === null || keyRef.current !== gameKey) {
      stateRef.current =
        initialLivesRef.current === undefined
          ? createInitialState(initialLevelRef.current)
          : createInitialState(initialLevelRef.current, initialLivesRef.current);
      keyRef.current = gameKey;
      lastSummaryRef.current = null;
    }

    /**
     * Fire `onStateChange` only when a player-visible scalar changes, so React
     * updates the HUD/leaderboard on meaningful transitions rather than 60x/s.
     * @param {import('../game/engine.js').GameState} state
     */
    const notifyIfChanged = (state) => {
      const cb = onStateChangeRef.current;
      if (!cb) return;
      const next = summarize(state);
      const prev = lastSummaryRef.current;
      if (
        !prev ||
        prev.status !== next.status ||
        prev.score !== next.score ||
        prev.level !== next.level ||
        prev.lives !== next.lives ||
        prev.highestLevel !== next.highestLevel
      ) {
        lastSummaryRef.current = next;
        cb(next, state);
      }
    };

    const render = (timeMs) => {
      draw(ctx, stateRef.current, {
        time: timeMs,
        tileSize: tileSizeRef.current,
        images: imagesRef.current,
      });
    };

    if (!running) {
      // Stopped: paint the current state once so the canvas stays correct, then
      // do not schedule further frames. Surface the current summary too.
      render(typeof performance !== 'undefined' ? performance.now() : 0);
      notifyIfChanged(stateRef.current);
      return undefined;
    }

    let lastTime = performance.now();
    let accumulator = 0;

    const frame = (now) => {
      // Real elapsed time since the previous frame, clamped for safety.
      const elapsed = Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
      lastTime = now;

      // Fixed-timestep integration: drain the accumulator in exact FIXED_DT
      // steps so the simulation is deterministic and frame-rate independent.
      accumulator += elapsed;
      while (accumulator >= FIXED_DT) {
        const intent = getIntentRef.current ? getIntentRef.current() ?? {} : {};
        stateRef.current = step(stateRef.current, intent, FIXED_DT);
        accumulator -= FIXED_DT;
      }

      render(now);
      notifyIfChanged(stateRef.current);

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [canvasRef, running, gameKey]);

  return {
    getState: () => stateRef.current,
  };
}
