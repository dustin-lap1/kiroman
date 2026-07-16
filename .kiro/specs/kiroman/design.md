# Design Document

## Overview

Kiroman is a single-page arcade game with a small serverless backend for a global
leaderboard. The frontend is a React 19 + Vite + Tailwind app rendered onto an
HTML5 `<canvas>` for the maze, following the same LaunchPad-standard stack used by
other Lap 1 Labs projects. The only backend is a leaderboard API: an API Gateway
HTTP API in front of two Node.js 22 Lambda functions (get + submit) backed by a
single DynamoDB table. The frontend is hosted on S3 behind CloudFront; all AWS
resources are defined in Terraform in `us-east-1` and deployed into the existing
AccountRef account with a `kiroman-` resource prefix.

The design maps directly to the eight requirements: an alias gate (R1), a
canvas-based maze engine (R2), level progression (R3), a pause system (R4), a
serverless leaderboard (R5), responsive keyboard/touch controls (R6), Kiro
branding (R7), and a Terraform-defined serverless deployment (R8).

## Architecture

### System diagram

```
                 ┌─────────────────────────────────────────────┐
                 │                Browser (SPA)                 │
                 │  React UI  ─  Canvas game loop  ─  API client │
                 └───────────────┬───────────────┬──────────────┘
                     page load   │               │  on game over
                  GET /leaderboard│               │POST /scores
                                 ▼               ▼
        S3 (static)      ┌───────────────────────────────┐
        + CloudFront ◀── │   API Gateway (HTTP API)       │
        (app origin)     │   /leaderboard (GET)           │
                         │   /scores      (POST)          │
                         └───────┬───────────────┬────────┘
                                 ▼               ▼
                        Lambda getLeaderboard  Lambda submitScore
                        (Node.js 22)           (Node.js 22)
                                 └───────┬───────┘
                                         ▼
                              DynamoDB: kiroman-leaderboard
```

### Frontend architecture

The game separates **pure game logic** from **React/rendering** so the core loop
is unit-testable without a DOM:

- **Game engine (pure modules):** maze model, entity movement, collision, pellet
  and level state, and difficulty scaling. No React, no canvas, no timers — it
  exposes a `step(state, inputs, dt)` style reducer that advances game state.
- **Rendering layer:** a canvas renderer that draws a given game state each frame,
  plus a `requestAnimationFrame` loop that calls `step` then `render`.
- **React shell:** screen/state management (alias gate → playing → paused → game
  over), the leaderboard panel, the welcome header, and the input adapters
  (keyboard + touch) that feed intents into the engine.

```
src/
  game/                  # pure, testable engine (no React/canvas)
    maze.js              # maze layout(s), wall/pellet grids
    engine.js            # step(state, input, dt) → nextState; win/lose/level rules
    entities.js          # Kiroman + Kiro chaser movement + chase AI
    difficulty.js        # level → chaser speed mapping (capped)
    constants.js         # tile size, speeds, lives, colors tokens
  render/
    canvasRenderer.js    # draw(state, ctx) — sprites, pellets, walls, Kiro logo
    useGameLoop.js       # rAF loop hook: fixed-timestep step + render
  input/
    useKeyboard.js       # arrows/WASD + spacebar → intents
    useTouch.js          # swipe/d-pad + tap-pause → intents
  api/
    leaderboard.js       # getLeaderboard(), submitScore(alias, level)
  components/
    WelcomeHeader.jsx    # "Welcome to Kiroman!" + branding
    Leaderboard.jsx      # top-3 panel, refreshes on load
    AliasGate.jsx        # alias entry + validation (R1)
    GameCanvas.jsx       # canvas element + loop wiring
    TouchControls.jsx    # on-screen d-pad + pause for mobile (R6)
    PauseOverlay.jsx     # paused indicator (R4)
    GameOverCard.jsx     # result + submit + play again
  App.jsx                # screen state machine, composes the above
  config.js              # API base URL, brand tokens
```

### Backend architecture

- **API Gateway (HTTP API)** `kiroman-api` with two routes:
  - `GET /leaderboard` → `kiroman-get-leaderboard`
  - `POST /scores` → `kiroman-submit-score`
- **Lambdas (Node.js 22, ESM):** use only `@aws-sdk/*` (provided by the runtime),
  so they deploy lean. Each is an async handler returning API Gateway proxy
  responses with CORS headers.
- **DynamoDB** single table `kiroman-leaderboard`, PAY_PER_REQUEST.

### Deployment architecture

Terraform (`infra/bootstrap` for state, `infra/main` for the stack) provisions S3
+ CloudFront (frontend), the DynamoDB table, both Lambdas, the HTTP API + routes,
and IAM roles. All in `us-east-1`, using a dedicated `kiroman-terraform` profile
(a Kiroman-owned IAM user created inside the reused AccountRef account), resources
prefixed `kiroman-`. Frontend ships via `deploy.ps1` (build → S3 sync →
CloudFront invalidation). Lambda code deploys via `update-function-code` (Terraform
carries a placeholder with `ignore_changes` on code attributes).

## Components and Interfaces

### Game engine interface (pure)

```
createInitialState(level = 1, lives = 3) → GameState
step(state: GameState, input: Intent, dt: number) → GameState
// Intent: { direction?: 'up'|'down'|'left'|'right', pause?: boolean }
```

`GameState` (conceptual):

```
{
  status: 'playing' | 'paused' | 'gameover',
  level: number,
  score: number,
  lives: number,
  kiroman: { x, y, dir, nextDir },
  chasers: [{ x, y, dir }],
  pellets: Set<tileIndex>,
  maze: MazeGrid,        // static walls for the level
  highestLevel: number,
}
```

Rules encoded in `step`:
- Movement is grid-aligned; `nextDir` is applied when the path opens (classic
  Pac-Man turn buffering).
- Pellet collection removes the tile and adds score; empty pellet set → level up
  (R3.1) via `difficulty.js` speed bump (R3.3, capped).
- Chaser contact → lose a life and reset positions; zero lives → `gameover`
  (R2.5, R2.6).
- `pause: true` toggles `playing`↔`paused`; movement intents ignored while paused
  (R4).

### Input adapters

- **Keyboard (R6.1):** Arrow keys / WASD → `direction`; `Space` → `pause`
  (prevent default scroll).
- **Touch (R6.2):** on-screen d-pad buttons and a pause button emit the same
  intents; swipe gestures on the canvas optionally map to directions.
- Adapters only emit intents; the engine owns all state, so control source is
  irrelevant to game rules.

### Leaderboard API client (`src/api/leaderboard.js`)

```
getLeaderboard() → Promise<Entry[]>            // top 3, sorted
submitScore(alias, level) → Promise<void>      // best-per-alias upsert
// Entry: { alias: string, level: number, achievedAt: number }
```

Both wrap `fetch` against `config.API_BASE`, tolerate failure, and never throw
into the render path (R5.7).

### HTTP API contract

`GET /leaderboard`
- 200 → `{ "entries": [ { "alias": "...", "level": 7, "achievedAt": 172... }, ... up to 3 ] }`
- Sorted by `level` desc, then `achievedAt` asc (R5.1, R5.6).

`POST /scores`
- Request: `{ "alias": "string(1..12)", "level": integer >= 1 }`
- 200 → `{ "ok": true, "updated": boolean }` (`updated` false when existing entry
  was already higher — R5.5)
- 400 → `{ "error": "message" }` on validation failure.
- Server re-validates alias length and that `level` is a positive integer; server
  trusts nothing from the client.

## Data Models

### DynamoDB table `kiroman-leaderboard`

Best-per-alias is enforced by keying on the alias, so each alias has exactly one
item and we keep only the higher level (R5.4, R5.5).

| Attribute | Type | Notes |
|-----------|------|-------|
| `pk` (HASH) | S | Constant `"LEADERBOARD"` — groups all entries into one partition for cheap top-N reads |
| `alias` (RANGE) | S | The player alias (normalized: trimmed) |
| `level` | N | Highest level reached for this alias |
| `achievedAt` | N | Epoch ms when this best level was set (tiebreaker) |

- **Submit** uses a conditional update: write the new `level`/`achievedAt` only
  IF the item does not exist OR `level > current level`. Returns whether it wrote.
- **Get** issues a `Query` on `pk = "LEADERBOARD"` and computes the top 3 in the
  Lambda (sort by level desc, achievedAt asc), avoiding a GSI for a small dataset.

Rationale: a single hot partition is acceptable at birthday-game scale and keeps
reads to one query. If scale grew, a GSI keyed on `level` would replace the
in-Lambda sort.

### Frontend config (`src/config.js`)

```
export const API_BASE = import.meta.env.VITE_API_BASE ?? '<cloudfront-or-apigw-url>';
export const BRAND = { /* Kiro color tokens */ };
```

## Branding & Visual Design (R7)

- **Palette:** Kiro brand colors as Tailwind theme tokens (primary purple/violet
  Kiro accent, dark maze background, bright pellet/accent). Centralized so canvas
  and DOM share the same values.
- **Kiroman:** a cute rounded character in a Kiro accent color with a simple
  mouth-chomp animation.
- **Kiro chasers:** rendered from `kiro-image.png` (sourced from the birthday repo
  asset) as the chaser sprite, with a gentle bob animation.
- **Welcome header:** persistent "Welcome to Kiroman!" banner above the board
  (R7.2).
- **Motion:** subtle animations on buttons, leaderboard entries, and level-up for
  a playful arcade feel (R7.4), respecting `prefers-reduced-motion`.

## Responsive & Cross-Platform (R6)

- The canvas renders at a fixed internal tile grid and is CSS-scaled to fit the
  viewport while preserving aspect ratio (`min(vw, vh)` sizing).
- Touch controls render only on coarse-pointer devices (or always, below a
  breakpoint) so desktop stays keyboard-first.
- Layout is a vertical stack (header → leaderboard → board → controls) that
  reflows without horizontal scroll on small screens (R6.4).

## Error Handling

| Scenario | Handling | Requirement |
|----------|----------|-------------|
| Leaderboard GET fails on load | Show "Leaderboard unavailable" placeholder; game still playable | R5.7 |
| Score POST fails at game over | Toast/inline notice; offer retry; do not block "play again" | R5.7 |
| Invalid alias (client) | Inline validation message; block start | R1.3 |
| Invalid payload (server) | 400 with error; client shows notice | R5, R8.5 |
| CORS | API Gateway/Lambda return CORS headers for the CloudFront origin | R8.5 |
| Canvas/rAF unsupported | Feature-check with a friendly fallback message | R6 |

## Testing Strategy

- **Engine unit tests (primary):** pure `engine.js`/`entities.js`/`difficulty.js`
  tests for movement, wall blocking, pellet collection, level-up, life loss,
  game-over, pause ignoring inputs, and difficulty cap. These cover R2–R4 without
  a DOM.
- **API client tests:** mock `fetch`; verify sorting/shape handling and
  failure-tolerance (R5.7).
- **Lambda handler tests:** unit-test `getLeaderboard` sorting/top-3 and
  `submitScore` conditional upsert logic (best-per-alias, tiebreaker, validation)
  against a mocked DynamoDB client (R5.3–R5.6).
- **Leaderboard integration (manual/dev):** submit a few scores, confirm top-3
  ordering and best-per-alias behavior end to end.
- **Responsive/manual smoke:** desktop keyboard play and mobile touch play,
  pause/resume on both, refresh-on-load leaderboard.

## Key Design Decisions

1. **Pure engine + thin render layer** — keeps the game logic unit-testable and
   the rendering/input swappable (keyboard vs touch), directly serving R2–R4 and
   R6 without brittle DOM tests.
2. **Single-partition DynamoDB with in-Lambda top-N** — simplest correct model
   for "keep each alias's best, show top 3," avoiding a GSI at birthday-game
   scale (R5).
3. **Best-per-alias via conditional update** — guarantees R5.4/R5.5 atomically on
   the server rather than trusting client-side comparison.
4. **Reuse AccountRef account with `kiroman-` prefix** — satisfies the "save
   steps" constraint (R8.6) while keeping the two stacks cleanly separated.
5. **Kiro logo as the chaser sprite** — makes "run from Kiro" literal and on-brand
   (R7.3), reusing the existing `kiro-image.png` asset.

## Correctness Properties

These are invariants the implementation must uphold; several are suitable for
property-based testing of the pure engine.

### Property 1: No wall clipping
For any sequence of directional intents, Kiroman and every chaser always occupy a non-wall tile.
**Validates: Requirements 2.2**

### Property 2: Pellet conservation
The pellet count never increases during a level, and score increases by exactly the value of each pellet consumed.
**Validates: Requirements 2.3**

### Property 3: Level-up trigger
The game advances to the next level if and only if the pellet set becomes empty, and `level` strictly increases on advance.
**Validates: Requirements 3.1, 3.2**

### Property 4: Difficulty monotonic and capped
Chaser speed is non-decreasing as `level` increases and never exceeds the defined maximum.
**Validates: Requirements 3.3**

### Property 5: Score and lives preserved across level-up
Advancing a level never resets `score` or `lives`.
**Validates: Requirements 3.2**

### Property 6: Pause freezes state
While `status === 'paused'`, applying any number of `step` calls with directional intents leaves entity positions unchanged.
**Validates: Requirements 4.3, 4.5**

### Property 7: Highest level is a running max
`highestLevel` equals the maximum `level` observed during the session and never decreases.
**Validates: Requirements 3.5**

### Property 8: Leaderboard is best-per-alias
After any sequence of submissions, each alias appears at most once and its stored `level` equals the maximum level ever submitted for that alias.
**Validates: Requirements 5.4, 5.5**

### Property 9: Leaderboard ordering
Returned entries are sorted by `level` descending, then `achievedAt` ascending, and contain at most three items.
**Validates: Requirements 5.1, 5.6**

### Property 10: Failure isolation
A rejected leaderboard fetch or submission never transitions the game out of a valid play state.
**Validates: Requirements 5.7**
