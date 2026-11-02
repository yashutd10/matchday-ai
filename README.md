# Matchday AI

**Live:** [matchday-ai-theta.vercel.app](https://matchday-ai-theta.vercel.app)

AI-powered Premier League match previews and predictions, built for fans in India (kickoffs in IST).

## What it does

- **This weekend:** every fixture in the next gameweek with a predicted score, win/draw/loss probabilities and a confidence level.
- **Match previews:** why the model thinks what it thinks, last-5 form and season stats.
- **Accuracy tracker:** the model replays the season with no data leakage (each gameweek is predicted using only earlier results) and is scored against what actually happened.
- **Ask AI:** a chat analyst grounded in the live league table and fixtures (Claude API).
- **Your team:** pick a favourite club to see their match first.

## The model

A Poisson goals model, improved in three versions and scored on every match this season:

- **v1:** home-only / away-only scoring rates.
- **v2:** attack and defence strength from all of a team's matches plus a league-wide home advantage; last season's results as a prior (weighted 40%); weaker starting ratings for promoted teams; shrinkage toward the league average; a Dixon–Coles correction for low-scoring draws.
- **v3:** v2 plus recency weighting: a result's weight halves every 5 gameweeks, so current form counts more.

The live site uses a **champion/challenger** setup: it automatically serves whichever of v2 and v3 has the better Brier score in the backtest (once at least 50 matches have been tested).

Backtest so far this season (gameweeks 2–9, 79 matches), each gameweek predicted using only earlier results:

| Model | Results right | Exact scores | Brier score |
|---|---|---|---|
| **v3 (live)** | **46%** | **9%** | **0.619** |
| v2 | 44% | 9% | 0.624 |
| v1 | 38% | 4% | 0.734 |
| Always back home | 37% | – | – |
| Random guess | 33% | – | 0.667 |

Changes were tested on 300 simulated seasons before going live; a "predict more draws" rule was tried and dropped because it lowered accuracy. The live numbers update every gameweek on the [Accuracy page](https://matchday-ai-theta.vercel.app/accuracy).

## Tech

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4. Data from [football-data.org](https://www.football-data.org/).

## Run it locally

```bash
cd web
npm install
# create web/.env.local with:
#   FOOTBALL_DATA_KEY=your-football-data-key
#   ANTHROPIC_API_KEY=your-anthropic-key   (optional, for Ask AI)
npm run dev
```

Open http://localhost:3000.

Predictions are for fun and analysis only, not betting advice.
