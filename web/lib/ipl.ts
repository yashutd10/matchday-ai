import summary from "@/data/ipl/summary.json";

/* IPL data, built from Cricsheet ball-by-ball files by pipeline/build_ipl.py. */

export type TableRow = { team: string; p: number; w: number; l: number; nr: number; pts: number; nrr: number };
export type BatRow = { name: string; team: string; inns: number; runs: number; avg: number | null; sr: number; hs: string; "50s": number; "100s": number; "4s": number; "6s": number };
export type BowlRow = { name: string; team: string; inns: number; wkts: number; overs: string; econ: number; avg: number | null; best: string; dot: number };
export type Result = {
  id: string; date: string; stage: string; venue: string; teams: string[]; winner: string | null; margin: string; dls: boolean;
  scores: { team: string; runs: number; wickets: number; overs: string }[]; pom: string | null;
};
export type Season = {
  season: number; matches: number; champion: string | null; runnerUp: string | null;
  table: TableRow[]; topRuns: BatRow[]; topWickets: BowlRow[]; topSixes: { name: string; team: string; sixes: number }[];
  totals: { runs: number; sixes: number; fours: number; highest: { runs: number; wickets: number; team: string; vs: string; overs: string } };
  playoffs: Result[];
};

const data = summary as unknown as { generated: string; matches: number; balls: number; latest: number; teams: Record<string, string>; seasons: Season[] };

export const ipl = { matches: data.matches, balls: data.balls, latest: data.latest, generated: data.generated };
export const seasons = data.seasons;
export const seasonYears = data.seasons.map((s) => s.season);
export const getSeason = (year: number) => data.seasons.find((s) => s.season === year);
export const teamName = (code: string) => data.teams[code] ?? code;

/** Team colours, brightened where needed so they read on the dark background. */
const COLORS: Record<string, string> = {
  CSK: "#f9cd05", MI: "#3d8bff", KKR: "#8b6fe0", RCB: "#ef3340", SRH: "#ff822a", RR: "#f0489c", DC: "#5b7fe8", PBKS: "#e8474f",
  LSG: "#2dd4bf", GT: "#c8a45c", DEC: "#9aa4b2", KTK: "#f59e0b", PWI: "#38bdf8", RPS: "#c084fc", GL: "#fb923c",
};
export const teamColor = (code: string) => COLORS[code] ?? "#9aa4b2";

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

/* ---------- players, ratings, matchups, insights (see pipeline/build_insights.py) ---------- */

import playersJson from "@/data/ipl/players.json";
import matchupsJson from "@/data/ipl/matchups.json";
import insightsJson from "@/data/ipl/insights.json";
import winJson from "@/data/ipl/winmodel.json";
import phaseJson from "@/data/ipl/teamphase.json";
import resultsJson from "@/data/ipl/results.json";

export type Phase = "all" | "pp" | "mid" | "death";
export const PHASES: Phase[] = ["all", "pp", "mid", "death"];
export const PHASE_LABEL: Record<Phase, string> = { all: "Overall", pp: "Powerplay", mid: "Middle", death: "Death" };
export const PHASE_OVERS: Record<Phase, string> = { all: "All 20 overs", pp: "Overs 1–6", mid: "Overs 7–15", death: "Overs 16–20" };

export type BatLine = { runs: number; balls: number; outs: number; sr: number; avg: number | null; dot: number; bnd: number; fours: number; sixes: number };
export type BowlLine = { balls: number; runs: number; wkts: number; econ: number; sr: number | null; avg: number | null; dot: number };
export type Kind = "bat" | "bowl";
export type IplPlayer = {
  id: string; name: string; team: string; last: number; first: number; matches: number;
  career: { bat: BatLine & { inns: number; hs: string }; bowl: BowlLine & { inns: number } };
  recent: { bat: Record<Phase, BatLine>; bowl: Record<Phase, BowlLine> };
  rating: Record<Kind, Partial<Record<Phase, number>>>;
  type: { bat: string | null; bowl: string | null };
  impact: number;
  seasons: { y: number; team: string; m: number; runs: number; sr: number | null; wkts: number; econ: number | null; impact: number }[];
};

const pj = playersJson as unknown as { seasons: number[]; minPhaseBalls: number; players: IplPlayer[] };
export const players = pj.players;
export const ratingSeasons = pj.seasons;
export const minPhaseBalls = pj.minPhaseBalls;
const byId = new Map(players.map((p) => [p.id, p]));
const byName = new Map(players.map((p) => [p.name, p]));
export const getPlayer = (id: string) => byId.get(id);
/** Player page link, when the player is in the ratings (active in the last three seasons). */
export const playerHref = (name: string) => { const p = byName.get(name); return p ? `/ipl/player/${p.id}` : null; };
export const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

export type Matchup = { bat: string; bowl: string; runs: number; balls: number; outs: number; dots: number; fours: number; sixes: number; last: number };
const mj = matchupsJson as unknown as { minBalls: number; pairs: Matchup[] };
export const matchups = mj.pairs;
export const minMatchupBalls = mj.minBalls;

export type Venue = { name: string; city: string; matches: number; avgFirst: number | null; chasePct: number | null; highest: number; sixesPerMatch: number; recent: { matches: number; avgFirst: number | null; chasePct: number | null } };
export type TossRow = { season: number; matches: number; tossWinPct: number; fieldFirstPct: number; chaseWinPct: number; avgFirst: number };
export type Mvp = { name: string; id: string | null; team: string; impact: number; m: number };
export const insights = insightsJson as unknown as { venues: Venue[]; toss: TossRow[]; mvp: Record<string, Mvp[]>; recentSeasons: number[] };

export type WinModelData = {
  first: number[]; chase: number[]; era: Record<string, number>; latest: number; parRuns: number[]; parWkts: number[];
  evaluation: { testSeasons: number[]; balls: number; brier: number; accuracy: number; calibration: { said: number; happened: number; n: number }[] };
};
export const winModel = winJson as unknown as WinModelData;

export type PhaseStrength = { batRR: number; bowlEcon: number; wktsLost: number; wktsTaken: number; batRRRank: number; bowlEconRank: number };
export const teamPhase = phaseJson as unknown as Record<string, Record<string, Record<Exclude<Phase, "all">, PhaseStrength>>>;

export const results = resultsJson as unknown as Record<string, Result[]>;
const seasonOfMatch = new Map<string, number>();
for (const [y, list] of Object.entries(results)) for (const r of list) seasonOfMatch.set(r.id, Number(y));
export const getResult = (id: string) => { const y = seasonOfMatch.get(id); return y ? { season: y, result: results[String(y)].find((r) => r.id === id)! } : null; };

export const teamCodes = Object.keys(data.teams);
export const impactText = (v: number) => `${v > 0 ? "+" : ""}${(v / 100).toFixed(2)}`;
