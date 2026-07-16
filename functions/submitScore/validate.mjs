// functions/submitScore/validate.mjs
//
// Pure, AWS-free request parsing + validation for the Kiroman POST /scores
// Lambda. Deliberately free of any @aws-sdk imports, network IO, or environment
// access so it can be unit-tested with `node --test` in isolation. The Lambda
// handler (index.mjs) does the DynamoDB IO and delegates parsing/validation to
// `parseSubmission` here.
//
// The server trusts NOTHING from the client (Requirement 5.3): it re-validates
// the alias length and that `level` is a positive integer before any write.
//
// Alias rule mirrors the frontend gate in `src/game/alias.js` (Requirements
// 1.2/1.3): trim surrounding whitespace, then require 1..12 characters. The
// server owns its own copy of the rule rather than importing across the
// frontend/backend boundary, so the two can deploy independently.
//
// Level rule (Requirements 5.3): STRICT. `level` must be an actual JSON number
// that is an integer >= 1. Non-numbers (including numeric strings like "3") are
// rejected rather than coerced, so a malformed/hostile client can never smuggle
// a value through type juggling.
//
// Requirements:
//   5.3 - server re-validates alias length and positive-integer level.

/** Minimum allowed alias length after trimming (mirrors src/game/alias.js). */
export const ALIAS_MIN_LENGTH = 1;

/** Maximum allowed alias length after trimming (mirrors src/game/alias.js). */
export const ALIAS_MAX_LENGTH = 12;

/** Minimum allowed level (Requirement 5.3: positive integer). */
export const MIN_LEVEL = 1;

/** Minimum allowed score (a non-negative integer). */
export const MIN_SCORE = 0;

/** Human-readable validation messages returned in 400 responses. */
export const SUBMISSION_ERRORS = {
  badJson: 'Request body must be valid JSON.',
  notObject: 'Request body must be a JSON object.',
  alias: `Alias must be a string of ${ALIAS_MIN_LENGTH}\u2013${ALIAS_MAX_LENGTH} characters after trimming.`,
  level: `Level must be an integer of at least ${MIN_LEVEL}.`,
  score: `Score must be an integer of at least ${MIN_SCORE}.`,
};

/**
 * @typedef {{ ok: true, alias: string, level: number, score: number }} SubmissionOk
 * @typedef {{ ok: false, error: string }} SubmissionError
 * @typedef {SubmissionOk | SubmissionError} SubmissionResult
 */

/**
 * Parse and validate a raw HTTP API request body into a leaderboard submission.
 *
 * Accepts either the raw JSON string (`event.body`) or an already-parsed object
 * so the handler and tests can call it either way. Returns a discriminated
 * result so callers branch on `ok` without throwing.
 *
 * On success `alias` is the trimmed alias and `level` is the validated integer.
 *
 * @param {unknown} rawBody - the raw request body (string or parsed object).
 * @returns {SubmissionResult}
 */
export function parseSubmission(rawBody) {
  let payload = rawBody;

  // Parse JSON strings; a missing body is treated as an empty (invalid) object.
  if (typeof rawBody === 'string') {
    if (rawBody.trim() === '') {
      return { ok: false, error: SUBMISSION_ERRORS.notObject };
    }
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { ok: false, error: SUBMISSION_ERRORS.badJson };
    }
  }

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: SUBMISSION_ERRORS.notObject };
  }

  const { alias: rawAlias, level: rawLevel, score: rawScore } = payload;

  // Alias: must be a string that trims to 1..12 chars (mirrors src/game/alias.js).
  if (typeof rawAlias !== 'string') {
    return { ok: false, error: SUBMISSION_ERRORS.alias };
  }
  const alias = rawAlias.trim();
  if (alias.length < ALIAS_MIN_LENGTH || alias.length > ALIAS_MAX_LENGTH) {
    return { ok: false, error: SUBMISSION_ERRORS.alias };
  }

  // Level: STRICT positive integer. Reject non-numbers, NaN/Infinity, and
  // non-integers. Numeric strings such as "3" are rejected (no coercion).
  if (
    typeof rawLevel !== 'number' ||
    !Number.isInteger(rawLevel) ||
    rawLevel < MIN_LEVEL
  ) {
    return { ok: false, error: SUBMISSION_ERRORS.level };
  }

  // Score: STRICT non-negative integer (same no-coercion policy as level).
  if (
    typeof rawScore !== 'number' ||
    !Number.isInteger(rawScore) ||
    rawScore < MIN_SCORE
  ) {
    return { ok: false, error: SUBMISSION_ERRORS.score };
  }

  return { ok: true, alias, level: rawLevel, score: rawScore };
}
