// src/input/useTouch.js
//
// Touch input adapter for Kiroman (Requirements 4.2, 6.2).
//
// This module is the mobile/touch control source. It exposes the SAME intent
// contract as the keyboard adapter (`src/input/useKeyboard.js`) so the game
// loop can poll either (or both) identically:
//
//     getIntent() → { direction?: 'up'|'down'|'left'|'right', pause?: boolean }
//
// Following the design ("Input adapters"), adapters only *emit intents* — they
// never touch game state. The on-screen d-pad and pause button in
// `TouchControls.jsx` drive this hook via the returned handler callbacks:
//
//   - Directional control is press-and-hold: while a d-pad button is pressed
//     (`pointerdown`), `intent.direction` is that direction; on release
//     (`pointerup` / `pointercancel` / `pointerleave`) it clears. Holding a
//     button keeps Kiroman moving, matching the classic arcade feel and the
//     keyboard adapter's held-key behavior. Handlers: `pressDirection(dir)` and
//     `releaseDirection()`.
//   - Pause is an EDGE trigger identical to the keyboard's spacebar: a single
//     tap latches `pause: true` exactly once; the next `getIntent()` call
//     returns it and immediately clears the latch, so the engine's rising-edge
//     pause toggle fires once per tap. Handler: `pressPause()`.
//
// Mutable intent state lives in refs (never React state) so touches never
// trigger re-renders and the game loop can poll `getIntent()` every tick.
//
// This file also exports two pure helpers that are testable without a DOM:
//   - `mergeIntents(a, b)` — combine two intent objects (keyboard + touch).
//   - `isCoarsePointer(win)` — detect a coarse (touch) pointer via matchMedia.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DIRECTION_NAMES } from '../game/constants.js';

/**
 * Set of valid direction names, for guarding handler input.
 * @type {ReadonlySet<string>}
 */
const VALID_DIRECTIONS = new Set(DIRECTION_NAMES);

/**
 * Pure merge of two input intents into one, so the app can feed BOTH the
 * keyboard and touch adapters into a single `getIntent` for the game loop.
 *
 * Rules:
 *   - `direction`: prefer the first argument's defined direction; fall back to
 *     the second's. (In practice a player uses one control source at a time; if
 *     both are somehow active, the primary/first source — keyboard — wins.)
 *   - `pause`: logical OR — a pause edge from EITHER source pauses the game.
 *     Only included when true, matching the adapters' "omit when absent" shape.
 *
 * Inputs are treated as read-only and a fresh object is always returned. Missing
 * / nullish arguments are treated as the empty intent `{}`.
 *
 * @param {{direction?: string, pause?: boolean} | null | undefined} a primary intent (e.g. keyboard)
 * @param {{direction?: string, pause?: boolean} | null | undefined} b secondary intent (e.g. touch)
 * @returns {{direction?: string, pause?: boolean}} the combined intent
 */
export function mergeIntents(a, b) {
  const first = a || {};
  const second = b || {};
  const merged = {};

  const direction = first.direction ?? second.direction;
  if (direction !== undefined) merged.direction = direction;

  if (first.pause || second.pause) merged.pause = true;

  return merged;
}

/**
 * Pure detection of a coarse (touch-first) pointer using the `(pointer: coarse)`
 * media query. This is the signal used to decide whether to render the
 * on-screen `TouchControls`.
 *
 * Defensive by design: if `matchMedia` is unavailable (older browsers, SSR, or
 * the Node test runner) this returns `false` rather than throwing, so the app
 * never hard-crashes and simply stays keyboard-first.
 *
 * @param {Window | {matchMedia?: (q: string) => {matches: boolean}} | undefined} [win] window-like object (defaults to the global `window` when present)
 * @returns {boolean} true when the primary pointer is coarse (touch)
 */
export function isCoarsePointer(win) {
  const w = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!w || typeof w.matchMedia !== 'function') return false;
  try {
    return w.matchMedia('(pointer: coarse)').matches === true;
  } catch {
    // matchMedia can throw on malformed queries in some environments; stay safe.
    return false;
  }
}

/**
 * React hook that reports whether the current device is a coarse-pointer (touch)
 * device, updating live if the pointer capability changes (e.g. a 2-in-1 that
 * switches between touch and mouse, or a devtools device emulation toggle).
 *
 * Uses `matchMedia` change events when available and falls back gracefully when
 * not — it never throws if `matchMedia` is missing.
 *
 * @returns {boolean} true when the device should show touch controls
 */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => isCoarsePointer());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    let mql;
    try {
      mql = window.matchMedia('(pointer: coarse)');
    } catch {
      return undefined;
    }
    const onChange = () => setCoarse(mql.matches === true);
    onChange(); // sync in case it changed between initial render and effect

    // Prefer the modern addEventListener; fall back to the deprecated API for
    // older Safari that only supports addListener/removeListener.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    if (typeof mql.addListener === 'function') {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
    return undefined;
  }, []);

  return coarse;
}

/**
 * React hook that translates on-screen touch controls into the engine intent
 * contract. Mutable input state lives in refs (never React state) so touch
 * events never trigger re-renders and the game loop can poll `getIntent()`
 * every tick:
 *   - `directionRef` — the currently held d-pad direction, or `null` when no
 *     button is pressed (press-and-hold to keep moving).
 *   - `pauseLatchRef` — a one-shot flag set on a pause tap and cleared when the
 *     next `getIntent()` consumes it (rising-edge semantics).
 *
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] when false, `getIntent` reports no
 *   input and held state is cleared (e.g. on the alias screen or while a modal
 *   is open). Handlers become no-ops so a lingering touch can't get "stuck".
 * @returns {{
 *   getIntent: () => {direction?: 'up'|'down'|'left'|'right', pause?: boolean},
 *   pressDirection: (dir: 'up'|'down'|'left'|'right') => void,
 *   releaseDirection: (dir?: 'up'|'down'|'left'|'right') => void,
 *   pressPause: () => void,
 *   clearHeld: () => void
 * }} `getIntent` for the game loop plus the button handlers and a force-clear.
 */
export function useTouch({ enabled = true } = {}) {
  /** @type {import('react').MutableRefObject<('up'|'down'|'left'|'right')|null>} currently held d-pad direction */
  const directionRef = useRef(null);
  /** @type {import('react').MutableRefObject<boolean>} one-shot pause request */
  const pauseLatchRef = useRef(false);
  /** @type {import('react').MutableRefObject<boolean>} live copy of `enabled` for the callbacks */
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      // Disabled: drop any held direction / pending pause so nothing is stuck.
      directionRef.current = null;
      pauseLatchRef.current = false;
    }
  }, [enabled]);

  /**
   * Build the intent for the current tick. `direction` is the held d-pad
   * direction (if any); `pause` is returned true at most once per tap and is
   * cleared here so the engine sees a single rising edge.
   */
  const getIntent = useCallback(() => {
    const intent = {};
    if (directionRef.current) {
      intent.direction = directionRef.current;
    }
    if (pauseLatchRef.current) {
      intent.pause = true;
      pauseLatchRef.current = false; // consume the edge
    }
    return intent;
  }, []);

  /**
   * Begin holding a direction (call on a d-pad button's `pointerdown`). Ignores
   * unknown directions and no-ops while disabled. "Last press wins" — pressing a
   * new button replaces the held direction.
   * @param {'up'|'down'|'left'|'right'} dir
   */
  const pressDirection = useCallback((dir) => {
    if (!enabledRef.current) return;
    if (!VALID_DIRECTIONS.has(dir)) return;
    directionRef.current = dir;
  }, []);

  /**
   * Release the d-pad (call on `pointerup` / `pointercancel` / `pointerleave`).
   * If `dir` is provided, only clears when it matches the currently held
   * direction, so releasing a stale button (after another was pressed) doesn't
   * cancel the newer press. Called with no argument, it always clears.
   * @param {('up'|'down'|'left'|'right')} [dir]
   */
  const releaseDirection = useCallback((dir) => {
    if (dir === undefined || directionRef.current === dir) {
      directionRef.current = null;
    }
  }, []);

  /**
   * Latch a one-shot pause (call on the pause button's `pointerdown`/tap).
   * No-ops while disabled.
   */
  const pressPause = useCallback(() => {
    if (!enabledRef.current) return;
    pauseLatchRef.current = true;
  }, []);

  /** Release any held direction and clear a pending pause (e.g. on disable). */
  const clearHeld = useCallback(() => {
    directionRef.current = null;
    pauseLatchRef.current = false;
  }, []);

  return { getIntent, pressDirection, releaseDirection, pressPause, clearHeld };
}
