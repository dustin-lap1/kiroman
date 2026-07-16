// src/config.js
//
// Outward-facing configuration for the Kiroman frontend.
//
// `API_BASE` is the base URL of the leaderboard HTTP API (API Gateway). It is
// read from the Vite env var `VITE_API_BASE` at build time and falls back to an
// empty string when unset (e.g. local dev before infra is provisioned, or in
// the Node test runner where `import.meta.env` is undefined). The leaderboard
// API client is failure-tolerant, so an empty base simply makes requests fail
// fast and the UI degrades gracefully (Requirement 5.7).
//
// The real value is injected into frontend config after Task 10 provisions the
// API and captures its invoke URL.

/**
 * Safely read a Vite env var without throwing in non-Vite runtimes (e.g. the
 * Node test runner, where `import.meta.env` does not exist).
 *
 * @param {string} key
 * @returns {string | undefined}
 */
function readEnv(key) {
  try {
    return import.meta.env?.[key];
  } catch {
    return undefined;
  }
}

/** Base URL for the leaderboard API. Trailing slash is trimmed if present. */
export const API_BASE = (readEnv('VITE_API_BASE') ?? '').replace(/\/+$/, '');
