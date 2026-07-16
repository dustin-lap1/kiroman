# Requirements Document

## Introduction

Kiroman is a cute, Kiro-branded twist on the classic Pac-Man arcade game. The
player controls "Kiroman" through a maze, collecting pellets while running from
**Kiro** (the chaser). The game is level-based: clearing a maze advances the
player to the next, faster level, and the goal is to reach as high a level as
possible. Players identify themselves with an alias before playing, and the
highest level each player reaches feeds a **global top-three leaderboard** that is
refreshed on every page load. The game must play well on both desktop web
(keyboard) and mobile (touch), including a pause control (spacebar on web, tap on
mobile). The application is deployed to AWS as a serverless app: a static
frontend on S3 + CloudFront, and a leaderboard API on API Gateway + Lambda +
DynamoDB.

This document derives its requirements from a single starting sentence:

> Build Kiroman, a cute, Kiro-branded twist on Pac-Man where a player enters an
> alias and runs from Kiro through a maze while competing on a global top-three
> leaderboard of highest levels reached that refreshes on every page load,
> playable on both web and mobile with a spacebar-or-tap pause, and deployed to
> AWS as a serverless app.

## Requirements

### Requirement 1: Alias entry gate

**User Story:** As a player, I want to enter an alias before playing, so that my
progress can be attributed to me on the leaderboard.

#### Acceptance Criteria

1. WHEN the game first loads THEN the system SHALL display an alias-entry screen before any gameplay begins.
2. WHEN the player submits an alias THEN the system SHALL validate that it is between 1 and 12 characters after trimming surrounding whitespace.
3. IF the submitted alias is empty or exceeds 12 characters THEN the system SHALL reject it and display a validation message without starting the game.
4. WHEN a valid alias is submitted THEN the system SHALL persist it for the duration of the session and use it for any leaderboard submissions.
5. WHEN the player has entered a valid alias THEN the system SHALL enable the control to start gameplay.

### Requirement 2: Maze gameplay (run from Kiro)

**User Story:** As a player, I want to move Kiroman through a maze while avoiding
Kiro, so that I can experience Pac-Man-style gameplay.

#### Acceptance Criteria

1. WHEN a game starts THEN the system SHALL render a maze containing walls, collectible pellets, Kiroman, and at least one Kiro chaser.
2. WHEN the player issues a directional input THEN the system SHALL move Kiroman in that direction unless a wall blocks the path.
3. WHEN Kiroman moves over a pellet THEN the system SHALL remove the pellet and increase the player's score.
4. WHILE a game is active THE SYSTEM SHALL continuously move each Kiro chaser through the maze toward pursuing Kiroman.
5. WHEN a Kiro chaser contacts Kiroman THEN the system SHALL cost the player a life.
6. WHEN the player runs out of lives THEN the system SHALL end the game and display a game-over state.

### Requirement 3: Levels and progression

**User Story:** As a player, I want to advance through increasingly difficult
levels, so that I have a "highest level reached" score to compete on.

#### Acceptance Criteria

1. WHEN all pellets in the current maze are collected THEN the system SHALL advance the player to the next level.
2. WHEN a new level begins THEN the system SHALL increment the current level number and reset pellet layout while preserving score and lives.
3. WHEN the level number increases THEN the system SHALL increase difficulty by raising chaser speed up to a defined maximum.
4. WHILE a game is active THE SYSTEM SHALL display the current level number to the player.
5. WHEN the game ends THEN the system SHALL treat the highest level number reached during that game as the player's result for that session.

### Requirement 4: Pause and resume

**User Story:** As a player, I want to pause and resume the game, so that I can
step away without losing progress.

#### Acceptance Criteria

1. WHEN the player presses the spacebar on a web/keyboard device during active gameplay THEN the system SHALL pause the game.
2. WHEN the player taps the on-screen pause control on a touch device during active gameplay THEN the system SHALL pause the game.
3. WHILE the game is paused THE SYSTEM SHALL halt all movement of Kiroman and the Kiro chasers and display a visible paused indicator.
4. WHEN the player triggers the pause control again while paused THEN the system SHALL resume the game from the same state.
5. WHILE the game is paused THE SYSTEM SHALL ignore directional movement inputs until the game is resumed.

### Requirement 5: Global leaderboard

**User Story:** As a player, I want to see the top three highest levels reached
across all players, so that I can compete globally.

#### Acceptance Criteria

1. WHEN the page loads THEN the system SHALL fetch the current global leaderboard and display the top three entries by highest level reached.
2. WHEN the leaderboard is displayed THEN the system SHALL show, for each entry, the player alias and the highest level reached.
3. WHEN a game ends THEN the system SHALL submit the player's alias and highest level reached to the leaderboard service.
4. IF a player already has a leaderboard entry AND their new result is a higher level THEN the system SHALL keep only the higher level for that alias.
5. IF a player's new result is not higher than their existing entry THEN the system SHALL leave the existing entry unchanged.
6. WHEN two entries have the same highest level THEN the system SHALL order the earlier-achieved entry ahead of the later one.
7. WHEN a leaderboard fetch or submission fails THEN the system SHALL allow gameplay to continue and display a non-blocking message rather than crashing.

### Requirement 6: Cross-platform play (web and mobile)

**User Story:** As a player on either desktop or a phone, I want the game to be
playable and readable on my device, so that I can play anywhere.

#### Acceptance Criteria

1. WHEN the game is loaded on a desktop browser THEN the system SHALL support keyboard controls (arrow keys or WASD) for directional movement.
2. WHEN the game is loaded on a touch device THEN the system SHALL present on-screen touch controls (directional control plus pause) sized for touch input.
3. WHEN the viewport is resized or rotated THEN the system SHALL scale the maze to fit the available space while preserving aspect ratio and playability.
4. WHEN the game is displayed on a small screen THEN the system SHALL keep the welcome message, leaderboard, and score readable without horizontal scrolling.

### Requirement 7: Kiro branding and presentation

**User Story:** As a player, I want the game to feel cute, fun, and clearly
Kiro-branded, so that it is delightful and on-brand.

#### Acceptance Criteria

1. WHEN any screen is displayed THEN the system SHALL apply Kiro brand colors and styling consistently.
2. WHEN the landing/start screen is displayed THEN the system SHALL show a clear welcome message such as "Welcome to Kiroman!".
3. WHEN a Kiro chaser is rendered THEN the system SHALL use the Kiro logo/character imagery.
4. WHEN interactive elements are displayed THEN the system SHALL present a playful, animated, and interactive visual style consistent with a cute arcade game.

### Requirement 8: Serverless AWS deployment

**User Story:** As the owner, I want Kiroman deployed to AWS on a serverless
stack, so that it is publicly playable, low-cost, and consistent with my other
projects.

#### Acceptance Criteria

1. WHEN the frontend is deployed THEN the system SHALL serve the static app from Amazon S3 behind Amazon CloudFront.
2. WHEN the leaderboard API is deployed THEN the system SHALL expose it via Amazon API Gateway backed by AWS Lambda (Node.js 22).
3. WHEN leaderboard data is persisted THEN the system SHALL store it in Amazon DynamoDB.
4. WHEN infrastructure is provisioned THEN the system SHALL define all AWS resources in Terraform in the `us-east-1` region.
5. WHEN the leaderboard API receives browser requests THEN the system SHALL respond with CORS headers permitting the deployed CloudFront origin.
6. WHERE the project reuses the existing AccountRef AWS account THE SYSTEM SHALL deploy without creating a new AWS account and SHALL namespace its resources with a `kiroman-` prefix to avoid collisions.

## Glossary

- **Kiroman:** The player-controlled character navigating the maze (the Pac-Man analogue).
- **Kiro (chaser):** The antagonist(s) that pursue Kiroman through the maze, rendered with Kiro logo/character imagery (the ghost analogue).
- **Alias:** A short player-chosen display name (1–12 characters) used to attribute results on the leaderboard.
- **Pellet:** A collectible dot in the maze; collecting all pellets clears the level.
- **Level:** A single maze playthrough; clearing it advances the player to the next, faster level.
- **Highest level reached:** The greatest level number a player attained in a game session; the metric ranked on the leaderboard.
- **Leaderboard:** The global, cross-player ranking of the top three highest levels reached, fetched fresh on every page load.
- **Life:** A chance to continue; contact with a Kiro chaser costs one life, and running out ends the game.
- **Serverless stack:** S3 + CloudFront (frontend) and API Gateway + Lambda + DynamoDB (leaderboard API), defined in Terraform.
