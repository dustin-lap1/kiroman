// src/input/useKeyboard.js
//
// Keyboard input adapter for Kiroman (Requirements 4.1, 6.1).
//
// This module is the desktop/web control source. It maps Arrow keys and WASD to
// a movement `direction`, and the spacebar to an edge-triggered `pause` intent.
// Following the design ("Input adapters"), adapters only *emit intents* — they
// never touch game state. The engine consumes one intent per fixed-timestep
// tick via the `getIntent()` contract shared with `useGameLoop`:
//
//     getIntent() → { direction?: 'up'|'down'|'left'|'right', pause?: boolean }
//
//   - `direction` is the currently-desired heading. We track the set of held
//     movement keys (keydown/keyup) and report the MOST-RECENTLY-PRESSED still-
//     held key ("last key wins" — the classic arcade feel). When no movement key
//     is held, `direction` is omitted (undefined).
//   - `pause` is an EDGE trigger. A single physical Space keydown latches
//     `pause:true` exactly once; the next `getIntent()` call returns it and
//     immediately clears the latch, so the engine's rising-edge pause toggle
//     fires exactly once per press (never repeatedly while the key is held, and
//     never on OS auto-repeat — `event.repeat` is ignored for the latch).
//
// The pure key→action mapping is extracted into `keyToAction()` so it can be
// unit-tested without a DOM (see useKeyboard.test.js); the hook itself only
// wires window listeners and the held-key/pause-latch refs.

import { useCallback, useEffect, useRef } from 'react';

/**
 * Mapping from `KeyboardEvent.code` values to game actions. `code` is layout-
 * independent (e.g. the physical W key is always `"KeyW"`), so this covers WASD
 * regardless of Shift/Caps state and both arrow and letter movement keys.
 * @type {Readonly<Record<string, {type: 'direction', value: string} | {type: 'pause'}>>}
 */
const CODE_TO_ACTION = Object.freeze({
  ArrowUp: { type: 'direction', value: 'up' },
  ArrowDown: { type: 'direction', value: 'down' },
  ArrowLeft: { type: 'direction', value: 'left' },
  ArrowRight: { type: 'direction', value: 'right' },
  KeyW: { type: 'direction', value: 'up' },
  KeyS: { type: 'direction', value: 'down' },
  KeyA: { type: 'direction', value: 'left' },
  KeyD: { type: 'direction', value: 'right' },
  Space: { type: 'pause' },
});

/**
 * Mapping from lower-cased `KeyboardEvent.key` values to game actions. This is a
 * fallback so `keyToAction` also accepts `key` strings (e.g. `"w"`, `"W"`,
 * `"ArrowUp"`, `" "`) — useful for testing and for environments that only
 * surface `key`. Letter keys are matched case-insensitively.
 * @type {Readonly<Record<string, {type: 'direction', value: string} | {type: 'pause'}>>}
 */
const KEY_TO_ACTION = Object.freeze({
  arrowup: { type: 'direction', value: 'up' },
  arrowdown: { type: 'direction', value: 'down' },
  arrowleft: { type: 'direction', value: 'left' },
  arrowright: { type: 'direction', value: 'right' },
  w: { type: 'direction', value: 'up' },
  s: { type: 'direction', value: 'down' },
  a: { type: 'direction', value: 'left' },
  d: { type: 'direction', value: 'right' },
  ' ': { type: 'pause' },
  spacebar: { type: 'pause' },
});

/**
 * Pure key→action mapping. Accepts either a `KeyboardEvent.code`
 * (e.g. `"ArrowUp"`, `"KeyW"`, `"Space"`) or a `KeyboardEvent.key`
 * (e.g. `"w"`, `"W"`, `" "`), and returns the corresponding game action or
 * `null` for keys that are not bound.
 *
 * A fresh object is returned on every call so callers may safely treat the
 * result as owned/mutable.
 *
 * @param {string | null | undefined} code a `KeyboardEvent.code` or `.key` value
 * @returns {{type: 'direction', value: 'up'|'down'|'left'|'right'} | {type: 'pause'} | null}
 */
export function keyToAction(code) {
  if (code == null) return null;
  const byCode = CODE_TO_ACTION[code];
  if (byCode) return { ...byCode };
  const byKey = KEY_TO_ACTION[String(code).toLowerCase()];
  if (byKey) return { ...byKey };
  return null;
}

/**
 * React hook that translates keyboard events into the engine intent contract.
 *
 * Mutable input state lives in refs (never React state) so key events never
 * trigger re-renders and the game loop can poll `getIntent()` every tick:
 *   - `heldRef`  — an ordered stack of currently-held direction names; the last
 *                  entry is the most-recently-pressed key ("last key wins").
 *   - `pauseLatchRef` — a one-shot flag set on a Space keydown and cleared when
 *                  the next `getIntent()` consumes it (rising-edge semantics).
 *
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] when false, no window listeners are
 *   attached and held keys / the pause latch are cleared (e.g. on the alias
 *   screen or while a modal is open).
 * @returns {{
 *   getIntent: () => {direction?: 'up'|'down'|'left'|'right', pause?: boolean},
 *   clearHeld: () => void
 * }} `getIntent` for the game loop, and `clearHeld` to force-release held keys.
 */
export function useKeyboard({ enabled = true } = {}) {
  /** @type {import('react').MutableRefObject<string[]>} ordered held-direction stack (last = newest) */
  const heldRef = useRef([]);
  /** @type {import('react').MutableRefObject<boolean>} one-shot pause request */
  const pauseLatchRef = useRef(false);

  /**
   * Build the intent for the current tick. `direction` is the newest still-held
   * movement key; `pause` is returned true at most once per physical press and
   * is cleared here so the engine sees a single rising edge.
   */
  const getIntent = useCallback(() => {
    const held = heldRef.current;
    const intent = {};
    if (held.length > 0) {
      intent.direction = held[held.length - 1];
    }
    if (pauseLatchRef.current) {
      intent.pause = true;
      pauseLatchRef.current = false; // consume the edge
    }
    return intent;
  }, []);

  /** Release all held keys and clear any pending pause (e.g. on blur or disable). */
  const clearHeld = useCallback(() => {
    heldRef.current = [];
    pauseLatchRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Disabled: make sure nothing is "stuck" from a previous enabled period.
      heldRef.current = [];
      pauseLatchRef.current = false;
      return undefined;
    }

    const onKeyDown = (event) => {
      const action = keyToAction(event.code);
      if (!action) return;

      if (action.type === 'direction') {
        // Stop arrow keys from scrolling the page while playing.
        if (typeof event.code === 'string' && event.code.startsWith('Arrow')) {
          event.preventDefault();
        }
        // Last key wins: move this direction to the top of the held stack.
        const held = heldRef.current;
        const existing = held.indexOf(action.value);
        if (existing !== -1) held.splice(existing, 1);
        held.push(action.value);
        return;
      }

      // Pause (Space): always preventDefault to stop the page scrolling, but
      // only latch on the initial press — ignore OS auto-repeat so a held Space
      // toggles pause exactly once.
      event.preventDefault();
      if (!event.repeat) {
        pauseLatchRef.current = true;
      }
    };

    const onKeyUp = (event) => {
      const action = keyToAction(event.code);
      if (!action || action.type !== 'direction') return;
      const held = heldRef.current;
      const idx = held.indexOf(action.value);
      if (idx !== -1) held.splice(idx, 1);
    };

    // If focus leaves the window mid-press we never get the keyup, so clear held
    // keys to avoid Kiroman being stuck moving after the user tabs away.
    const onBlur = () => {
      heldRef.current = [];
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled]);

  return { getIntent, clearHeld };
}
