// src/components/AliasGate.jsx
//
// The alias-entry gate shown before gameplay begins (Requirement 1). This is a
// presentational, controlled form: it validates the alias (1–12 chars after
// trimming) and, on a valid submit, calls `onSubmit(alias)` with the trimmed
// value. The parent owns persistence and starting the game (Requirement 1.4);
// this component makes no engine or leaderboard calls.
//
// Behavior:
//   - Controlled text input with an accessible label and a soft `maxLength`
//     guard; validation is still enforced on submit via the shared
//     `validateAlias` rule (Requirements 1.2, 1.3).
//   - The start button is disabled until the input has non-whitespace content
//     (Requirement 1.5), and Enter submits the form.
//   - On an invalid submit, an inline error (role="alert", wired via
//     aria-describedby) is shown and `onSubmit` is NOT called (1.3). The error
//     clears as soon as the input becomes valid again.
//
// Styling follows the Kiro brand used across the app (violet/fuchsia accents on
// a dark background) — see TouchControls.jsx.

import { useId, useState } from 'react';

import { validateAlias, ALIAS_MAX_LENGTH } from '../game/alias.js';

/**
 * Alias-entry gate form.
 *
 * @param {Object} props
 * @param {(alias: string) => void} props.onSubmit called with the trimmed alias
 *   on a valid submit (parent persists it and starts the game — Requirement 1.4)
 * @param {string} [props.initialAlias] optional pre-filled alias (e.g. a
 *   remembered session alias)
 * @param {boolean} [props.busy] when true, disables the input and button (e.g.
 *   while the parent is starting the game)
 * @returns {JSX.Element}
 */
function AliasGate({ onSubmit, initialAlias = '', busy = false }) {
  const [value, setValue] = useState(initialAlias);
  const [error, setError] = useState(null);

  const inputId = useId();
  const errorId = useId();

  // Enable the start control only when there is present (non-whitespace) input
  // (Requirement 1.5). Full length validation still runs on submit.
  const hasContent = value.trim().length > 0;
  const canStart = hasContent && !busy;

  const handleChange = (event) => {
    const next = event.target.value;
    setValue(next);
    // Clear a shown error as soon as the input becomes valid again (1.3).
    if (error) {
      const result = validateAlias(next);
      if (result.ok) setError(null);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (busy) return;

    const result = validateAlias(value);
    if (!result.ok) {
      // Reject without starting the game; surface the inline message (1.3).
      setError(result.error);
      return;
    }

    setError(null);
    onSubmit(result.value); // trimmed alias (1.4)
  };

  return (
    <div className="flex min-h-full w-full items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-sm rounded-3xl border border-violet-300/30 bg-slate-900/70 p-8 shadow-2xl shadow-violet-900/40 backdrop-blur"
      >
        <h1 className="mb-1 text-center text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-300">
          Welcome to Kiroman!
        </h1>
        <p className="mb-6 text-center text-sm text-violet-200/80">
          Enter an alias to run from Kiro and climb the leaderboard.
        </p>

        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-semibold text-violet-100"
        >
          Your alias
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={handleChange}
          disabled={busy}
          maxLength={ALIAS_MAX_LENGTH}
          autoFocus
          autoComplete="off"
          placeholder="e.g. Kiroman"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          className={
            'w-full rounded-2xl border bg-slate-800/80 px-4 py-3 text-lg text-white ' +
            'placeholder:text-slate-400 shadow-inner transition-colors ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 ' +
            (error
              ? 'border-rose-400/70 focus-visible:ring-rose-300'
              : 'border-violet-300/40')
          }
        />

        {/* Inline validation message (Requirement 1.3). */}
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-2 text-sm font-medium text-rose-300"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canStart}
          className={
            'mt-6 w-full rounded-2xl px-4 py-3 text-lg font-bold text-white transition-transform ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 ' +
            (canStart
              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-fuchsia-900/40 hover:-translate-y-0.5 hover:from-violet-500 hover:to-fuchsia-500 active:scale-95'
              : 'cursor-not-allowed bg-slate-700/60 text-slate-400')
          }
        >
          Start game
        </button>
      </form>
    </div>
  );
}

export default AliasGate;
