// src/components/Leaderboard.jsx
//
// The global top-three leaderboard panel (Requirements 5.1, 5.2, 5.7). This is
// the read-side of the leaderboard feature: it fetches the current global
// standings on mount (page load) and renders the top three entries — each with
// its rank, the player alias, and the highest level reached.
//
// Data source: `getLeaderboard()` from `src/api/leaderboard.js`. That client is
// FAILURE-TOLERANT by contract (design Property 10 / Requirement 5.7): it never
// throws and resolves to `[]` on any network / status / parse failure. Because
// the client swallows errors, this component cannot cleanly distinguish "loaded
// but empty" from "failed to load" — so it treats an empty result as the empty
// state and keeps every state NON-BLOCKING: whatever happens here, the game
// stays fully playable.
//
// Refresh: the panel refetches on mount and whenever the `refreshKey` prop
// changes. The parent (App) bumps `refreshKey` after a successful score submit
// so the player's just-submitted result shows up without a page reload.
//
// Accessibility: the standings are an ordered list (`<ol>`) inside a labelled
// region; rank medals are decorative (aria-hidden) and each row carries a text
// rank so screen readers announce position, alias, and level. A polite live
// region announces load state changes.
//
// Styling follows the Kiro brand used across the app (violet/fuchsia accents on
// a dark, rounded card) — see AliasGate.jsx / GameOverCard.jsx.

import { useEffect, useState } from 'react';

import { getLeaderboard } from '../api/leaderboard.js';

/** Decorative medal per rank; ranks beyond 3 fall back to a numbered badge. */
const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Global top-three leaderboard panel (Requirements 5.1, 5.2, 5.7).
 *
 * @param {Object} props
 * @param {number} [props.refreshKey] change this value to trigger a refetch
 *   (e.g. after a successful score submission). Refetches on mount regardless.
 * @param {string} [props.className] extra classes for the outer panel.
 * @returns {JSX.Element}
 */
function Leaderboard({ refreshKey = 0, className = '' }) {
  // 'loading' until the first fetch settles, then 'loaded'. The API client is
  // failure-tolerant (returns []), so there is no throwing "error" state — a
  // failed fetch simply lands as an empty result and shows the empty state.
  // State is only updated from the async callback (never synchronously in the
  // effect body): the initial 'loading' comes from useState, and a refetch
  // (refreshKey change) keeps the current entries visible until fresh data
  // arrives, so there is no loading flicker on refresh.
  const [status, setStatus] = useState('loading');
  const [entries, setEntries] = useState([]);

  // Fetch on mount and whenever refreshKey changes (Requirement 5.1). The
  // AbortController cancels an in-flight request if the component unmounts or a
  // newer refresh supersedes it, so a slow response can't clobber fresh state.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    getLeaderboard({ signal: controller.signal }).then((result) => {
      if (cancelled) return;
      setEntries(Array.isArray(result) ? result.slice(0, 3) : []);
      setStatus('loaded');
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshKey]);

  const isLoading = status === 'loading';
  const isEmpty = status === 'loaded' && entries.length === 0;

  return (
    <section
      aria-label="Global leaderboard"
      className={
        'w-full rounded-2xl border border-violet-300/30 bg-slate-900/60 px-4 py-3 ' +
        'shadow-lg shadow-violet-900/30 ' +
        className
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-violet-200/90">
          <span aria-hidden="true" className="mr-1">🏆</span>
          Top players
        </h2>
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-violet-300/50">
          Highest level
        </span>
      </div>

      {/* Polite live region so screen readers hear load/empty transitions. */}
      <div aria-live="polite">
        {isLoading ? (
          <p className="py-2 text-center text-sm text-violet-200/70">
            Loading leaderboard…
          </p>
        ) : isEmpty ? (
          <p className="py-2 text-center text-sm text-violet-200/70">
            No scores yet — be the first!
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {entries.map((entry, index) => {
              const rank = index + 1;
              return (
                <li
                  key={`${entry.alias}-${index}`}
                  style={{ animationDelay: `${index * 90}ms` }}
                  className="kiro-row-enter flex items-center gap-3 rounded-xl bg-slate-800/50 px-3 py-2"
                >
                  <span
                    aria-hidden="true"
                    className="w-6 flex-none text-center text-lg tabular-nums"
                  >
                    {MEDALS[index] ?? rank}
                  </span>
                  <span className="sr-only">Rank {rank}:</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">
                    {entry.alias}
                  </span>
                  <span className="flex-none tabular-nums text-sm font-bold text-fuchsia-300">
                    <span className="sr-only">level </span>
                    {entry.level}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

export default Leaderboard;
