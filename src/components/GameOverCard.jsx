// src/components/GameOverCard.jsx
//
// The game-over result card (Requirements 2.6, 3.5). Shown when the engine
// reaches `status === 'gameover'`. This is a purely presentational card: it
// renders the session result — emphasizing the HIGHEST LEVEL REACHED
// (Requirement 3.5) plus the final score — and offers "Play again" and "Change
// alias" actions. The parent (App) owns the state machine and passes handlers.
//
// Leaderboard slot (task 8): this card supports — but does not require —
// leaderboard submission status. When `isSubmitting`, `submitError`, and/or a
// `leaderboardSlot` node are provided they render in a dedicated status area;
// when omitted the area is skipped entirely, so App can adopt this component now
// (task 6.3) and wire leaderboard props later (task 8) without changes here.
//
// Layout: absolutely positioned to cover its nearest positioned ancestor (App
// renders it inside the `relative` board `<section>`).
//
// Accessibility: role="dialog" + aria-modal, labelled by its heading via
// aria-labelledby, and it focuses the primary action ("Play again") on mount so
// keyboard users land on the main action. The submission status region is a
// polite live region so screen readers hear progress/errors.
//
// Styling follows the Kiro brand (violet/fuchsia accents on a dark scrim) — see
// AliasGate.jsx / TouchControls.jsx.

import { useEffect, useId, useRef } from 'react';

/**
 * Presentational game-over card (Requirements 2.6, 3.5).
 *
 * @param {Object} props
 * @param {string} [props.alias] the player's alias (shown in the result)
 * @param {number} [props.score] final score for the session
 * @param {number} [props.highestLevel] highest level reached — the headline
 *   result (Requirement 3.5). Falls back to `level` when absent.
 * @param {number} [props.level] final level number (fallback for the headline)
 * @param {() => void} props.onPlayAgain restart with the same alias
 * @param {() => void} props.onChangeAlias return to the alias gate
 * @param {boolean} [props.isSubmitting] true while a leaderboard submit is in
 *   flight (task 8) — renders a "submitting…" notice
 * @param {string} [props.submitError] non-blocking leaderboard error message
 *   (task 8, Requirement 5.7) — rendered as a gentle notice, never blocks play
 * @param {React.ReactNode} [props.leaderboardSlot] optional node (e.g. a compact
 *   leaderboard or "new best!" badge) rendered in the status area (task 8)
 * @param {string} [props.className] extra classes for the outer overlay
 * @returns {JSX.Element}
 */
function GameOverCard({
  alias,
  score = 0,
  highestLevel,
  level = 1,
  onPlayAgain,
  onChangeAlias,
  isSubmitting = false,
  submitError,
  leaderboardSlot,
  className = '',
}) {
  const titleId = useId();
  const playAgainRef = useRef(null);

  // Focus the primary action on mount so keyboard players can immediately
  // restart (and screen-reader focus lands inside the dialog).
  useEffect(() => {
    playAgainRef.current?.focus();
  }, []);

  // Headline metric is the highest level reached (Requirement 3.5); fall back to
  // the final level if highestLevel wasn't provided.
  const resultLevel = highestLevel ?? level;

  // Only render the status area when there's something to show (task 8).
  const hasStatus = isSubmitting || Boolean(submitError) || Boolean(leaderboardSlot);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={
        'absolute inset-0 z-10 flex items-center justify-center rounded-lg ' +
        'bg-slate-950/80 backdrop-blur-sm ' +
        className
      }
    >
      <div className="w-full max-w-xs rounded-3xl border border-fuchsia-300/40 bg-slate-900/90 px-6 py-7 text-center shadow-2xl shadow-fuchsia-900/40">
        <p aria-hidden="true" className="mb-1 text-3xl">
          👻
        </p>
        <h2
          id={titleId}
          className="text-2xl font-extrabold text-fuchsia-300"
        >
          Game over
        </h2>

        {alias ? (
          <p className="mt-1 text-sm text-violet-200/80">
            Nice run, <span className="font-semibold text-white">{alias}</span>!
          </p>
        ) : null}

        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-violet-200/90">
          Highest level reached
        </p>
        <p className="text-5xl font-black tabular-nums text-white">
          {resultLevel}
        </p>
        <p className="mt-1 text-sm text-violet-200/70 tabular-nums">
          Score {score}
        </p>

        {/* Leaderboard submission status (task 8) — omitted when unused. */}
        {hasStatus ? (
          <div
            aria-live="polite"
            className="mt-4 text-sm text-violet-200/80"
          >
            {isSubmitting ? <p>Submitting your score…</p> : null}
            {submitError ? (
              <p className="text-amber-300">{submitError}</p>
            ) : null}
            {leaderboardSlot ? <div className="mt-2">{leaderboardSlot}</div> : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <button
            ref={playAgainRef}
            type="button"
            onClick={onPlayAgain}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-lg font-bold text-white shadow-lg shadow-fuchsia-900/40 transition-transform hover:-translate-y-0.5 hover:from-violet-500 hover:to-fuchsia-500 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onChangeAlias}
            className="w-full rounded-2xl border border-violet-300/40 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            Change alias
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameOverCard;
