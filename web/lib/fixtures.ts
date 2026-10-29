export type Form = "W" | "D" | "L";

export type Team = {
  name: string;
  short: string;
  color: string;
};

export type Fixture = {
  id: string;
  home: Team;
  away: Team;
  kickoff: string;
  prediction: [number, number];
  probs: { home: number; draw: number; away: number };
  confidence: "High" | "Medium" | "Low";
  summary: string;
  reasons: string[];
  form: { home: Form[]; away: Form[] };
  stats: { label: string; home: number; away: number; suffix?: string }[];
};

const t = (name: string, short: string, color: string): Team => ({ name, short, color });

export const gameweek = { number: 9, date: "Sat 25 Oct" };

export const fixtures: Fixture[] = [
  {
    id: "ars-che",
    home: t("Arsenal", "ARS", "#EF0107"),
    away: t("Chelsea", "CHE", "#034694"),
    kickoff: "Sat · 10:00 PM IST",
    prediction: [2, 1],
    probs: { home: 52, draw: 25, away: 23 },
    confidence: "Medium",
    summary: "Strong home form and Chelsea's set-piece problems point to a narrow home win.",
    reasons: [
      "Arsenal have won 4 of their last 5 at home, creating 2.1 xG per game.",
      "Chelsea concede more from set pieces than any top-half side.",
      "Chelsea usually score away, so a clean sheet is unlikely.",
    ],
    form: { home: ["W", "W", "D", "W", "W"], away: ["L", "W", "D", "W", "L"] },
    stats: [
      { label: "xG created", home: 2.1, away: 1.6 },
      { label: "xG conceded", home: 0.9, away: 1.4 },
      { label: "Possession", home: 58, away: 54, suffix: "%" },
    ],
  },
  {
    id: "liv-bri",
    home: t("Liverpool", "LIV", "#C8102E"),
    away: t("Brighton", "BHA", "#0057B8"),
    kickoff: "Sat · 7:30 PM IST",
    prediction: [3, 1],
    probs: { home: 64, draw: 20, away: 16 },
    confidence: "High",
    summary: "Liverpool's pressing should overwhelm Brighton's build-up from the back.",
    reasons: [
      "Liverpool are unbeaten at Anfield this season.",
      "Brighton have lost possession in their own third more than any other side.",
      "Brighton's attack keeps finding goals, so a shutout is unlikely.",
    ],
    form: { home: ["W", "W", "W", "D", "W"], away: ["D", "L", "W", "D", "L"] },
    stats: [
      { label: "xG created", home: 2.4, away: 1.3 },
      { label: "xG conceded", home: 1.0, away: 1.5 },
      { label: "Possession", home: 61, away: 57, suffix: "%" },
    ],
  },
  {
    id: "mci-tot",
    home: t("Man City", "MCI", "#6CABDD"),
    away: t("Tottenham", "TOT", "#132257"),
    kickoff: "Sun · 9:00 PM IST",
    prediction: [2, 2],
    probs: { home: 44, draw: 30, away: 26 },
    confidence: "Low",
    summary: "Two open sides with shaky defences: expect goals at both ends.",
    reasons: [
      "City have conceded in 5 straight league games.",
      "Spurs average the most shots on the counter in the league.",
      "Both teams have injuries at centre-back.",
    ],
    form: { home: ["W", "L", "D", "W", "L"], away: ["W", "W", "L", "D", "W"] },
    stats: [
      { label: "xG created", home: 2.0, away: 1.8 },
      { label: "xG conceded", home: 1.3, away: 1.6 },
      { label: "Possession", home: 63, away: 49, suffix: "%" },
    ],
  },
  {
    id: "new-avl",
    home: t("Newcastle", "NEW", "#241F20"),
    away: t("Aston Villa", "AVL", "#670E36"),
    kickoff: "Sun · 6:30 PM IST",
    prediction: [1, 1],
    probs: { home: 38, draw: 34, away: 28 },
    confidence: "Medium",
    summary: "Evenly matched sides who both defend deep: a tight, low-scoring draw.",
    reasons: [
      "Four of the last five meetings ended level or by a single goal.",
      "Both teams rank in the top six for fewest shots conceded.",
      "Villa have drawn three of their last four away games.",
    ],
    form: { home: ["D", "W", "D", "L", "W"], away: ["D", "D", "W", "D", "L"] },
    stats: [
      { label: "xG created", home: 1.5, away: 1.4 },
      { label: "xG conceded", home: 1.1, away: 1.2 },
      { label: "Possession", home: 51, away: 50, suffix: "%" },
    ],
  },
];

