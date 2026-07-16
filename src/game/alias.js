// src/game/alias.js
//
// Pure, testable alias validation for the Kiroman alias-entry gate (Requirement
// 1). No React, no DOM — just the rule that turns raw user input into either a
// normalized (trimmed) alias or a validation error. The UI (AliasGate.jsx) and
// any server-side check can share this single source of truth.
//
// Rule (Requirements 1.2, 1.3):
//   - Trim surrounding whitespace first.
//   - The trimmed alias must be between 1 and 12 characters (inclusive).
//   - Empty (or whitespace-only) input is rejected.
//   - Input whose trimmed length exceeds 12 characters is rejected.
//
// On success the caller should use the returned (trimmed) `value` for session
// persistence and leaderboard submission (Requirement 1.4).

/** Minimum allowed alias length after trimming (Requirement 1.2). */
export const ALIAS_MIN_LENGTH = 1;

/** Maximum allowed alias length after trimming (Requirement 1.2). */
export const ALIAS_MAX_LENGTH = 12;

/** Human-readable validation messages surfaced inline by the alias gate (1.3). */
export const ALIAS_ERRORS = {
  empty: 'Please enter an alias to start.',
  tooLong: `Alias must be ${ALIAS_MAX_LENGTH} characters or fewer.`,
};

/**
 * @typedef {{ ok: true, value: string }} AliasOk
 * @typedef {{ ok: false, error: string }} AliasError
 * @typedef {AliasOk | AliasError} AliasResult
 */

/**
 * Validate a raw alias string.
 *
 * Trims surrounding whitespace, then enforces the 1–12 character rule. Returns a
 * discriminated result so callers can branch on `ok` without throwing.
 *
 * @param {unknown} raw the raw input value (typically the text input's value)
 * @returns {AliasResult} `{ ok: true, value }` with the trimmed alias, or
 *   `{ ok: false, error }` with an inline validation message.
 */
export function validateAlias(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';

  if (trimmed.length < ALIAS_MIN_LENGTH) {
    return { ok: false, error: ALIAS_ERRORS.empty };
  }

  if (trimmed.length > ALIAS_MAX_LENGTH) {
    return { ok: false, error: ALIAS_ERRORS.tooLong };
  }

  return { ok: true, value: trimmed };
}
