# Kiroman 🟣

A cute, Kiro-branded twist on Pac-Man: enter an alias, run from **Kiro** through a
maze, and climb a **global top-three leaderboard** of the highest levels reached.
Plays on web and mobile, deployed to AWS as a serverless app.

**Live:** https://d1e7yvdrsmkg9p.cloudfront.net

Built for **Day 4 of Kiro Birthday Week** — "build one app with one sentence."
The entire app started from a single declarative sentence that Kiro's spec mode
expanded into the requirements, design, and task list under
[`.kiro/specs/kiroman/`](.kiro/specs/kiroman/), which were then implemented
task by task. The one sentence:

> Build Kiroman, a cute, Kiro-branded twist on Pac-Man where a player enters an
> alias and runs from Kiro through a maze while competing on a global top-three
> leaderboard of highest levels reached that refreshes on every page load,
> playable on both web and mobile with a spacebar-or-tap pause, and deployed to
> AWS as a serverless app.

## How to play

1. Enter an alias (1–12 characters) to start.
2. Move Kiroman with the **arrow keys / WASD** (web) or the **on-screen d-pad** (mobile).
3. Eat all the pellets to clear a level; each level the Kiro chasers get faster.
4. Avoid Kiro — contact costs a life; lose all your lives and it's game over.
5. **Pause** with the **spacebar** (web) or the **pause button** (mobile).
6. Your highest level reached is submitted to the global leaderboard, shown up
   top and refreshed on every page load.

## Tech stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4, HTML5 canvas for the maze.
- **Game engine:** a pure, framework-free, unit- and property-tested reducer
  (`src/game/`) separated from rendering and input.
- **Backend (serverless):** Amazon API Gateway (HTTP API) → AWS Lambda (Node.js 22)
  → Amazon DynamoDB for the global leaderboard.
- **Hosting:** Amazon S3 + CloudFront. **IaC:** Terraform. **Region:** us-east-1.

## Project structure

```
src/
  game/        # pure engine: maze, entities, engine (step), difficulty, alias  (+ tests)
  render/      # canvasRenderer, useGameLoop (rAF fixed-timestep)
  input/       # useKeyboard, useTouch (shared getIntent contract) (+ tests)
  components/  # AliasGate, GameCanvas, TouchControls, PauseOverlay, GameOverCard, Leaderboard
  api/         # leaderboard client (failure-tolerant) (+ tests)
  App.jsx      # screen state machine (alias → play → pause → game over)
  brand.js     # single source of truth for the Kiro palette (shared by DOM + canvas)
functions/
  getLeaderboard/  # GET /leaderboard Lambda (top-3, level desc)   (+ tests)
  submitScore/     # POST /scores Lambda (best-per-alias upsert)   (+ tests)
infra/
  bootstrap/   # Terraform remote state (S3 + DynamoDB lock)
  main/        # S3 + CloudFront, DynamoDB leaderboard, Lambdas, HTTP API, IAM
.kiro/specs/kiroman/   # the Kiro-generated spec (requirements, design, tasks)
```

## Development

```bash
npm install
npm run dev        # start the dev server
npm test           # run the engine/API/unit + property tests (node --test)
npm run build      # production build
npm run lint       # eslint
```

The leaderboard API base URL is read from `VITE_API_BASE` (see `.env.production`);
without it the app still runs and the leaderboard degrades gracefully.

## Deployment

```powershell
.\deploy.ps1       # build + S3 sync + CloudFront invalidation (profile: kiroman-terraform)
```

Infrastructure is managed with Terraform in `infra/` (us-east-1). Lambda **code**
is deployed out of band via `update-function-code`; Terraform carries a
placeholder and uses `ignore_changes` on the code attributes so infra applies
never clobber live function code.

## AWS

- **Account:** 468895763486 (shared) · **Region:** us-east-1 · **Profile:** `kiroman-terraform`
- **S3:** `kiroman-site` · **CloudFront:** `E2GL4ALL4UNORO`
- **API:** `https://1k4cvisa8j.execute-api.us-east-1.amazonaws.com` (`GET /leaderboard`, `POST /scores`)
- **DynamoDB:** `kiroman-leaderboard`

---

Built with [Kiro](https://kiro.dev). © 2026 Lap 1 Labs, Inc.
