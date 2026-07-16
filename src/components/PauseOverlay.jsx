// src/components/PauseOverlay.jsx
//
// The visible "paused" indicator shown while the game is paused (Requirement
// 4.3). This is a purely presentational overlay: the engine owns the paused
// status and App decides when to render this component. It draws no game state
// and calls no engine/leaderboard code.
//
// Layout: absolutely positioned to cover its nearest positioned ancestor — App
// renders it inside the `relative` board `<section>` so it blankets the maze
// while paused. The parent is responsible for providing that relative container.
//
// Accessibility: announced as a status region (role="status" + aria-live so
// assistive tech hears that the game paused) and given an accessible label. The
// decorative pause glyph is aria-hidden.
//
// Styling follows the Kiro brand used across the app (violet/fuchsia accents on
// a dark, blurred scrim) — see AliasGate.jsx / TouchControls.jsx.

/**
 * Presentational paused overlay (Requirement 4.3).
 *
 * @param {Object} props
 * @param {() => void} [props.onResume] optional resume handler; when provided a
 *   "Resume" button is shown (the engine also resumes on space/tap-pause, so
 *   this is a convenience, not required for pause/resume to work)
 * @param {string} [props.className] extra classes for the outer overlay
 * @returns {JSX.Element}
 */
function PauseOverlay({ onResume, className = '' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Game paused"
      className={
        'absolute inset-0 z-10 flex items-center justify-center rounded-lg ' +
        'bg-slate-950/70 backdrop-blur-sm ' +
        className
      }
    >
      <div className="rounded-2xl border border-violet-300/40 bg-slate-900/80 px-8 py-6 text-center shadow-2xl shadow-violet-900/40">
        <p
          aria-hidden="true"
          className="mb-2 text-3xl font-black text-fuchsia-300"
        >
          ❚❚
        </p>
        <p className="text-2xl font-extrabold text-fuchsia-300">Paused</p>
        <p className="mt-1 text-sm text-violet-200/80">
          Press space or tap pause to resume
        </p>

        {onResume ? (
          <button
            type="button"
            onClick={onResume}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-base font-bold text-white shadow-lg shadow-fuchsia-900/40 transition-transform hover:from-violet-500 hover:to-fuchsia-500 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
          >
            Resume
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default PauseOverlay;
