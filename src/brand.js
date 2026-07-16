// src/brand.js
//
// Single source of truth for the Kiro brand palette (Requirement 7.1).
//
// This module is intentionally free of React, canvas, DOM and timers so it can
// be imported by the browser build, the canvas renderer, AND Node's test runner
// without side effects. It exports only a frozen object of color tokens.
//
// Why this exists
// ---------------
// Both the DOM (React/Tailwind) and the canvas renderer must draw from ONE set
// of Kiro colors so the game looks consistent everywhere (Requirement 7.1).
// Previously the canvas kept a private copy of these hexes; now the renderer
// imports `BRAND` from here (and re-exports it for its tests).
//
// Keeping DOM + canvas in sync
// ----------------------------
// Tailwind v4 is configured CSS-first (`@theme` in `src/index.css`), and CSS
// cannot import JS values at build time. So the SAME hex values are mirrored
// there as `--color-kiro-*` custom properties, which generate the `bg-kiro-*` /
// `text-kiro-*` / `from-kiro-*` utility classes the DOM uses. When you change a
// token here, update its twin in `src/index.css` (they are documented as a
// matched pair). The values below are also exactly Tailwind's violet/fuchsia
// ramp (e.g. `wall` === violet-500, `accent` === fuchsia-300), so the existing
// `violet-*/fuchsia-*` DOM classes already render the same Kiro colors.

/**
 * The Kiro brand palette. Keys are semantic roles used by both the canvas
 * renderer and (mirrored in CSS) the DOM.
 *
 * @type {Readonly<{
 *   background: string,
 *   wall: string,
 *   wallInner: string,
 *   pellet: string,
 *   kiroman: string,
 *   kiromanEye: string,
 *   chaser: string,
 *   chaserAccent: string,
 * }>}
 */
export const BRAND = Object.freeze({
  background: '#150E29', // deep Kiro night — maze backdrop / page base
  wall: '#8B5CF6', // Kiro violet accent — maze walls (violet-500)
  wallInner: '#6D28D9', // deeper violet — wall inner fill (violet-700)
  pellet: '#F5F3FF', // near-white — pellets pop on the dark board (violet-50)
  kiroman: '#A855F7', // bright Kiro purple — the player (purple-500)
  kiromanEye: '#150E29', // eye punched out of Kiroman in the bg color
  chaser: '#C084FC', // fallback chaser body when the logo image is absent (purple-400)
  chaserAccent: '#F0ABFC', // fallback chaser detail (fuchsia-300)
});
