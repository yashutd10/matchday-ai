# Matchday AI

AI-powered Premier League match previews and predictions, built for fans in India (kickoffs in IST).

## What it does

- **This weekend:** every fixture in the next gameweek with a predicted score, win/draw/loss probabilities and a confidence level.
- **Match previews:** why the model thinks what it thinks, last-5 form and season stats.
- **Accuracy tracker:** the model replays the season with no data leakage (each gameweek is predicted using only earlier results) and is scored against what actually happened.
- **Ask AI:** a chat analyst grounded in the live league table and fixtures (Claude API).
- **Your team:** pick a favourite club to see their match first.

## The model

A Poisson goals model with:

- attack and defence strength from all of a team's matches plus a league-wide home advantage
- last season's results as a prior (weighted 40%), with weaker starting ratings for promoted teams
- shrinkage toward the league average for small samples
- a Dixon–Coles correction for low-scoring draws

Backtest so far this season (gameweeks 2–8, 70 matches):

| Model | Results right | Exact scores | Brier score |
|---|---|---|---|
| v2 (current) | 43% | 9% | 0.627 |
| v1 (first version) | 34% | 3% | 0.760 |
| Always back home | 34% | – | – |
| Random guess | 33% | – | 0.667 |

Changes were tested on 300 simulated seasons before going live; a "predict more draws" rule was tried and dropped because it lowered accuracy.

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
