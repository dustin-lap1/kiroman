// src/App.jsx
//
// The Kiroman application shell and screen state machine (Requirements 1.4, 2.6,
// 4.3). App owns the small amount of UI-level state that lives *outside* the
// pure engine and composes every piece built in the earlier tasks:
//
//   alias gate (task 6.1)  →  playing (GameCanvas + loop, tasks 3–5)
//                          →  paused / game-over overlays (driven by engine status)
//
// State machine
// -------------
//   `screen`  : 'alias' | 'game'
//       'alias' — show <AliasGate>; keyboard/touch input is DISABLED so typing
//                 the alias never moves Kiroman.
//       'game'  — a valid alias has been submitted (Requirement 1.4); the board
//                 runs and the engine's own status drives the in-game overlays.
//   `alias`   : the trimmed, session-persisted player alias (Requirement 1.4).
//               Persisted in sessionStorage so a reload keeps the player signed
//               in for the session; leaderboard submission (task 8) reads it.
//   `gameKey` : bumped to start a brand-new game (GameCanvas resets its state
//               when the key changes) — used by "Play again".
//   `summary` : the throttled {status, score, level, lives, highestLevel}
//               snapshot pushed up from the game loop via `onStateChange`. App
//               renders the HUD from it and detects game over (status ===
//               'gameover', Requirement 2.6) and pause (status === 'paused',
//               Requirement 4.3).
//
// Input composition
// -----------------
// Both adapters are instantiated and fed into ONE combined intent source:
// `mergeIntents(keyboard.getIntent(), touch.getIntent())`. Both are enabled only
// while `screen === 'game'`, so the alias screen ignores movement/pause keys.
// <TouchControls> is wired to the touch adapter's handlers and self-hides on
// non-touch (fine-pointer) devices via its coarse-pointer detection.
//
// PauseOverlay (Requirement 4.3) and GameOverCard (Requirements 2.6, 3.5) are
// the dedicated overlays for the paused and game-over slots (task 6.3). App
// renders them inside the `relative` board section so they blanket the maze.
// GameOverCard also accepts leaderboard-submission props (isSubmitting /
// submitError / leaderboardSlot) that task 8 will wire up; they're left unset
// here and the card renders gracefully without them.

import { useCallback, useEffect, useRef, useState } from 'react';

import AliasGate from './components/AliasGate.jsx';
import GameCanvas from './components/GameCanvas.jsx';
import GameOverCard from './components/GameOverCard.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import PauseOverlay from './components/PauseOverlay.jsx';
import TouchControls from './components/TouchControls.jsx';
import { submitScore } from './api/leaderboard.js';
import { useKeyboard } from './input/useKeyboard.js';
import { useTouch, mergeIntents } from './input/useTouch.js';

/** sessionStorage key for the persisted alias (Requirement 1.4). */
const ALIAS_STORAGE_KEY = 'kiroman:alias';

/**
 * Read the remembered session alias, if any. Defensive: sessionStorage can throw
 * (privacy mode, disabled storage) or be absent (tests/SSR), so failures fall
 * back to an empty alias rather than crashing the app.
 * @returns {string}
 */
function readStoredAlias() {
  try {
    if (typeof sessionStorage === 'undefined') return '';
    return sessionStorage.getItem(ALIAS_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Persist (or clear) the session alias. Best-effort — swallows storage errors.
 * @param {string} alias
 */
function writeStoredAlias(alias) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (alias) sessionStorage.setItem(ALIAS_STORAGE_KEY, alias);
    else sessionStorage.removeItem(ALIAS_STORAGE_KEY);
  } catch {
    /* ignore: storage is a nice-to-have, not required for play */
  }
}

function App() {
  // Session alias (Requirement 1.4). Pre-seed from sessionStorage so a reload
  // keeps the player signed in, but still start on the alias screen so the
  // player explicitly starts each session's play.
  const [alias, setAlias] = useState(readStoredAlias);
  const [screen, setScreen] = useState('alias'); // 'alias' | 'game'
  const [gameKey, setGameKey] = useState(0);
  const [summary, setSummary] = useState(null);

  // Leaderboard integration (task 8, Requirements 5.1, 5.3, 5.7).
  //   `leaderboardRefresh` — bumped after a successful submit so the panel
  //     refetches and the just-submitted score shows without a page reload.
  //   `isSubmitting` / `submitError` — passed to GameOverCard so it can show a
  //     non-blocking submit status; a failed submit NEVER blocks "Play again".
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Guard: the gameKey we last submitted a score for. Submitting exactly once
  // per game-over even though the game-over overlay re-renders (Requirement
  // 5.3). Refs hold the latest alias/summary so the submit effect can read them
  // without re-running (and re-submitting) on every HUD update. The refs are
  // synced in effects (never written during render) and declared before the
  // submit effect so they hold current values when it runs.
  const submittedGameKeyRef = useRef(null);
  const aliasRef = useRef(alias);
  const summaryRef = useRef(summary);

  useEffect(() => {
    aliasRef.current = alias;
  }, [alias]);
  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  const inGame = screen === 'game';

  // Input adapters — enabled only while playing so typing the alias never moves
  // Kiroman or toggles pause (Requirement 1.x / 4.x separation).
  const keyboard = useKeyboard({ enabled: inGame });
  const touch = useTouch({ enabled: inGame });

  // Stable references to the adapters' pollers; both are `useCallback([])` in
  // their hooks, so the combined source stays stable across renders.
  const keyboardGetIntent = keyboard.getIntent;
  const touchGetIntent = touch.getIntent;

  // One combined intent source feeding the game loop: keyboard is primary,
  // touch is secondary, and a pause edge from either source pauses the game.
  const getIntent = useCallback(
    () => mergeIntents(keyboardGetIntent(), touchGetIntent()),
    [keyboardGetIntent, touchGetIntent],
  );

  // Throttled HUD/overlay updates from the loop (fires only on meaningful
  // status/score/level/lives change — not per frame).
  const handleStateChange = useCallback((next) => {
    setSummary(next);
  }, []);

  /**
   * A valid alias was submitted from the gate (Requirement 1.4): persist it for
   * the session and start a fresh game.
   * @param {string} nextAlias trimmed, validated alias
   */
  const handleAliasSubmit = useCallback((nextAlias) => {
    setAlias(nextAlias);
    writeStoredAlias(nextAlias);
    setSummary(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setGameKey((k) => k + 1); // start a brand-new game
    setScreen('game');
  }, []);

  /** Restart with the SAME alias, keeping the player in the session. */
  const handlePlayAgain = useCallback(() => {
    setSummary(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setGameKey((k) => k + 1);
    setScreen('game');
  }, []);

  /** Leave the game and return to the alias gate (keeps alias pre-filled). */
  const handleChangeAlias = useCallback(() => {
    setScreen('alias');
    setSummary(null);
  }, []);

  const status = summary?.status;
  const isPaused = inGame && status === 'paused';
  const isGameOver = inGame && status === 'gameover';

  // Submit the session result to the leaderboard exactly once when the game
  // reaches game-over (Requirement 5.3). The `submittedGameKeyRef` guard makes
  // this idempotent across the many re-renders of the game-over overlay, and
  // depending only on [status, gameKey] (reading alias/summary from refs) means
  // a HUD update can't retrigger it. Failure is non-blocking: a failed submit
  // sets a gentle notice and never prevents "Play again" (Requirement 5.7).
  useEffect(() => {
    if (status !== 'gameover') return;
    if (submittedGameKeyRef.current === gameKey) return;
    submittedGameKeyRef.current = gameKey;

    const snapshot = summaryRef.current;
    const level = snapshot?.highestLevel ?? snapshot?.level ?? 1;
    const score = snapshot?.score ?? 0;
    const playerAlias = aliasRef.current;

    // Don't attempt a submit without a usable alias (defensive; the alias gate
    // guarantees one for normal play).
    if (!playerAlias) return;

    let cancelled = false;
    setIsSubmitting(true);
    setSubmitError(null);

    submitScore(playerAlias, level, score).then((result) => {
      if (cancelled) return;
      setIsSubmitting(false);
      if (result?.ok) {
        // Reveal the just-submitted score by refreshing the panel.
        setLeaderboardRefresh((n) => n + 1);
      } else {
        setSubmitError("Couldn't save your score — the leaderboard may be offline. You can still play again.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [status, gameKey]);

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {screen === 'alias' ? (
        <main className="flex-1">
          {/* The leaderboard is global, so show it up top even before play so
              players see who they're chasing (Requirements 5.1, 5.2). */}
          <div className="mx-auto w-full max-w-sm px-6 pt-6">
            <Leaderboard refreshKey={leaderboardRefresh} />
          </div>
          <AliasGate onSubmit={handleAliasSubmit} initialAlias={alias} />
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-4 px-4 py-6">
          {/* Welcome header (Requirement 7.2): a clear, playful, on-brand
              banner above the board. Uses the shared Kiro palette tokens
              (kiro-man/kiro-accent) that mirror the canvas colors so the DOM
              and canvas stay visually consistent (Requirement 7.1). */}
          <header className="w-full text-center">
            <h1 className="kiro-shimmer text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-kiro-man via-kiro-accent to-kiro-man drop-shadow-[0_2px_12px_rgba(192,132,252,0.35)] sm:text-5xl">
              Welcome to Kiroman!
            </h1>
            <p className="mt-1 text-sm font-medium text-kiro-accent/80">
              Chomp the pellets, dodge Kiro, climb the leaderboard.
            </p>
          </header>

          {/* Global top-three leaderboard, up top (Requirements 5.1, 5.2). */}
          <Leaderboard refreshKey={leaderboardRefresh} />

          {/* Pause hint (Requirement 4.1/4.2): tell the player how to pause on
              either modality. */}
          <p className="-mt-2 text-center text-xs font-medium text-violet-200/70">
            Hit <kbd className="rounded bg-slate-800/80 px-1.5 py-0.5 font-semibold text-violet-100">Space</kbd> or tap the screen to pause the game.
          </p>

          {/* HUD: alias + score / level / lives (Requirement 3.4). */}
          <section
            aria-label="Game status"
            className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-300/30 bg-slate-900/60 px-4 py-3 text-sm font-semibold shadow-lg shadow-violet-900/30"
          >
            <span className="flex items-center gap-2">
              <span className="text-violet-300/70">Player</span>
              <span className="text-white">{alias}</span>
            </span>
            <span className="flex items-center gap-4 tabular-nums">
              <span>
                <span className="text-violet-300/70">Score </span>
                {summary?.score ?? 0}
              </span>
              <span>
                <span className="text-violet-300/70">Level </span>
                {/* Keying on the level value remounts this span whenever the
                    player levels up, replaying the playful "pop" animation
                    (Requirement 7.4; disabled under prefers-reduced-motion). */}
                <span key={summary?.level ?? 1} className="kiro-pop">
                  {summary?.level ?? 1}
                </span>
              </span>
              <span>
                <span className="text-violet-300/70">Lives </span>
                {summary?.lives ?? 0}
              </span>
            </span>
          </section>

          {/* The board + in-game overlays. A touch tap anywhere on the board
              toggles pause (Requirement 4.2), matching the "tap the screen to
              pause" hint; mouse clicks are ignored so desktop stays keyboard-
              driven (Space). */}
          <section
            className="relative w-full"
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') touch.pressPause();
            }}
          >
            <GameCanvas
              getIntent={getIntent}
              onStateChange={handleStateChange}
              running={inGame}
              gameKey={gameKey}
            />

            {/* Visible paused indicator (Requirement 4.3). */}
            {isPaused ? <PauseOverlay /> : null}

            {/* Game-over result card (Requirements 2.6, 3.5) with leaderboard
                submission status wired in (task 8, Requirements 5.3, 5.7). */}
            {isGameOver ? (
              <GameOverCard
                alias={alias}
                score={summary?.score ?? 0}
                highestLevel={summary?.highestLevel}
                level={summary?.level ?? 1}
                onPlayAgain={handlePlayAgain}
                onChangeAlias={handleChangeAlias}
                isSubmitting={isSubmitting}
                submitError={submitError}
              />
            ) : null}
          </section>

          {/* On-screen touch controls — self-hide on fine-pointer devices. */}
          <TouchControls
            pressDirection={touch.pressDirection}
            releaseDirection={touch.releaseDirection}
            pressPause={touch.pressPause}
            className="mt-2"
          />
        </main>
      )}

      {/* Attribution footer — shown on every screen. */}
      <footer className="w-full px-4 py-5 text-center text-xs text-violet-200/60">
        Built with{' '}
        <a
          href="https://kiro.dev"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-kiro-accent underline-offset-2 hover:text-kiro-man hover:underline"
        >
          Kiro
        </a>{' '}
        by{' '}
        <a
          href="https://www.linkedin.com/in/ellisdustin/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-kiro-accent underline-offset-2 hover:text-kiro-man hover:underline"
        >
          Dustin Ellis, Kiro Ambassador
        </a>
      </footer>
    </div>
  );
}

export default App;
