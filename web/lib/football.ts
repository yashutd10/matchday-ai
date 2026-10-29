import { cacheLife } from "next/cache";
import { fixtures as sampleFixtures, gameweek as sampleGameweek, type Fixture, type Form } from "./fixtures";
import { brier, fitV1, fitV2, outcomeOf, type Predictor, type TrainMatch } from "./model";

export type Matchday = {
  source: "live" | "sample";
  gameweek: { number: number; date: string };
  fixtures: Fixture[];
};

type ApiTeam = { id: number; name: string; shortName: string; tla: string };
export type ApiMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: { fullTime: { home: number | null; away: number | null } };
};

type Rec = {
  homeGP: number; homeGF: number; homeGA: number; homeW: number; homeD: number; homeL: number;
  awayGP: number; awayGF: number; awayGA: number; awayW: number; awayD: number; awayL: number;
  results: Form[];
};

const emptyRec = (): Rec => ({
  homeGP: 0, homeGF: 0, homeGA: 0, homeW: 0, homeD: 0, homeL: 0,
  awayGP: 0, awayGF: 0, awayGA: 0, awayW: 0, awayD: 0, awayL: 0,
  results: [],
});

const IST = "Asia/Kolkata";
const fmtKickoff = (iso: string) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: IST, weekday: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: IST, hour: "numeric", minute: "2-digit" }).format(d);
  return `${day} · ${time} IST`;
};
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: IST, weekday: "short", day: "numeric", month: "short" })
    .format(new Date(iso))
    .replace(",", "");

const round1 = (n: number) => Math.round(n * 10) / 10;

/* ---------- data ---------- */

/**
 * Premier League matches for a season (default: the current one), cached for an hour.
 * Null when there is no key, the API fails, or the free plan doesn't cover that season.
 */
export async function getSeasonMatches(season?: number): Promise<ApiMatch[] | null> {
  "use cache";
  cacheLife("hours");

  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) return null;
  const url = `https://api.football-data.org/v4/competitions/PL/matches${season ? `?season=${season}` : ""}`;
  try {
    const res = await fetch(url, { headers: { "X-Auth-Token": key } });
    if (!res.ok) {
      console.error(`football-data.org responded ${res.status} for ${season ? `season ${season}` : "current season"}`);
      return null;
    }
    const { matches } = (await res.json()) as { matches: ApiMatch[] };
    return matches.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  } catch (err) {
    console.error("Failed to load fixtures", err);
    return null;
  }
}

const isFinished = (m: ApiMatch) => m.status === "FINISHED" && m.score.fullTime.home !== null;
const isUpcoming = (m: ApiMatch) => m.status === "TIMED" || m.status === "SCHEDULED";

const toTrain = (ms: ApiMatch[], weight: number): TrainMatch[] =>
  ms.filter(isFinished).map((m) => ({
    home: m.homeTeam.id, away: m.awayTeam.id, hg: m.score.fullTime.home!, ag: m.score.fullTime.away!, weight,
  }));

/** Last season counts for 40% of a match this season: a useful starting point that fades as games are played. */
const LAST_SEASON_WEIGHT = 0.4;

/** Current season plus, when the API allows it, last season's results and which teams were promoted. */
async function getHistory() {
  const current = await getSeasonMatches();
  if (!current?.length) return null;

  const first = new Date(current[0].utcDate);
  const startYear = first.getUTCMonth() >= 6 ? first.getUTCFullYear() : first.getUTCFullYear() - 1;
  const previous = await getSeasonMatches(startYear - 1);

  const promoted = new Set<number>();
  if (previous?.length) {
    const lastSeasonTeams = new Set(previous.flatMap((m) => [m.homeTeam.id, m.awayTeam.id]));
    for (const m of current) for (const id of [m.homeTeam.id, m.awayTeam.id]) if (!lastSeasonTeams.has(id)) promoted.add(id);
  }
  return { current, prevTrain: previous ? toTrain(previous, LAST_SEASON_WEIGHT) : [], promoted };
}

/* ---------- current-season records (for the stats shown on screen) ---------- */

function buildRecords(finished: ApiMatch[]) {
  const recs = new Map<number, Rec>();
  const rec = (id: number) => recs.get(id) ?? recs.set(id, emptyRec()).get(id)!;
  for (const m of finished) {
    const hg = m.score.fullTime.home!, ag = m.score.fullTime.away!;
    const h = rec(m.homeTeam.id), a = rec(m.awayTeam.id);
    h.homeGP++; h.homeGF += hg; h.homeGA += ag;
    a.awayGP++; a.awayGF += ag; a.awayGA += hg;
    if (hg > ag) { h.homeW++; a.awayL++; h.results.push("W"); a.results.push("L"); }
    else if (hg < ag) { h.homeL++; a.awayW++; h.results.push("L"); a.results.push("W"); }
    else { h.homeD++; a.awayD++; h.results.push("D"); a.results.push("D"); }
  }
  return recs;
}

const perGame = (n: number, gp: number) => (gp ? round1(n / gp) : 0);
const ppg = (r: Rec) => {
  const gp = r.homeGP + r.awayGP;
  return gp ? round1((3 * (r.homeW + r.awayW) + r.homeD + r.awayD) / gp) : 0;
};

function buildFixture(m: ApiMatch, recs: Map<number, Rec>, predictor: Predictor): Fixture {
  const home = recs.get(m.homeTeam.id) ?? emptyRec();
  const away = recs.get(m.awayTeam.id) ?? emptyRec();
  const hn = m.homeTeam.shortName, an = m.awayTeam.shortName;
  const p = predictor(m.homeTeam.id, m.awayTeam.id);

  const summary =
    p.top === "H" ? `${hn} are stronger on the numbers and have home advantage over ${an}.`
    : p.top === "A" ? `${an} rate clearly stronger, enough to overcome playing away at ${hn}.`
    : `Little separates these two, so a draw is the most likely result.`;

  return {
    id: String(m.id),
    home: { name: hn, short: m.homeTeam.tla, color: "#4c8dff" },
    away: { name: an, short: m.awayTeam.tla, color: "#ff9a52" },
    kickoff: fmtKickoff(m.utcDate),
    prediction: p.score,
    probs: p.probs,
    confidence: p.confidence,
    summary,
    reasons: [
      `${hn} this season: ${perGame(home.homeGF + home.awayGF, home.homeGP + home.awayGP)} goals scored and ${perGame(home.homeGA + home.awayGA, home.homeGP + home.awayGP)} conceded per game (home W${home.homeW} D${home.homeD} L${home.homeL}).`,
      `${an} this season: ${perGame(away.homeGF + away.awayGF, away.homeGP + away.awayGP)} scored and ${perGame(away.homeGA + away.awayGA, away.homeGP + away.awayGP)} conceded per game (away W${away.awayW} D${away.awayD} L${away.awayL}).`,
      `Blending this season with last season and home advantage, the model expects about ${round1(p.lamH)} goals for ${hn} and ${round1(p.lamA)} for ${an}.`,
    ],
    form: { home: home.results.slice(-5), away: away.results.slice(-5) },
    stats: [
      { label: "Goals scored per game", home: perGame(home.homeGF + home.awayGF, home.homeGP + home.awayGP), away: perGame(away.homeGF + away.awayGF, away.homeGP + away.awayGP) },
      { label: "Goals conceded per game", home: perGame(home.homeGA + home.awayGA, home.homeGP + home.awayGP), away: perGame(away.homeGA + away.awayGA, away.homeGP + away.awayGP) },
      { label: "Points per game", home: ppg(home), away: ppg(away) },
    ],
  };
}

/* ---------- this weekend ---------- */

const sample: Matchday = { source: "sample", gameweek: sampleGameweek, fixtures: sampleFixtures };

export async function getMatchday(): Promise<Matchday> {
  const hist = await getHistory();
  if (!hist) return sample;
  const { current, prevTrain, promoted } = hist;

  const upcoming = current.filter(isUpcoming);
  if (!upcoming.length) return sample;

  const finished = current.filter(isFinished);
  const recs = buildRecords(finished);
  const predictor = fitV2([...prevTrain, ...toTrain(finished, 1)], promoted);

  const md = upcoming[0].matchday;
  const round = upcoming.filter((m) => m.matchday === md);
  const built = round.map((m) => buildFixture(m, recs, predictor));

  // AI pick of the week: the match the model is most sure about.
  const strength = (f: Fixture) => Math.max(f.probs.home, f.probs.draw, f.probs.away);
  const pickIdx = built.reduce((best, f, i) => (strength(f) > strength(built[best]) ? i : best), 0);
  const [pick] = built.splice(pickIdx, 1);

  return { source: "live", gameweek: { number: md, date: fmtDate(round[0].utcDate) }, fixtures: [pick, ...built] };
}

export async function getFixture(id: string) {
  const { fixtures, source } = await getMatchday();
  return { fixture: fixtures.find((f) => f.id === id), source };
}

/* ---------- accuracy (backtest) ---------- */

export type PastPrediction = {
  id: number;
  home: string;
  away: string;
  predicted: [number, number];
  actual: [number, number];
  correct: boolean;
  exact: boolean;
};

export type ModelScore = { correct: number; exact: number; brier: number };

export type Accuracy = {
  total: number;
  v1: ModelScore;
  v2: ModelScore;
  homeBaseline: number;
  usedLastSeason: boolean;
  gameweeks: { number: number; total: number; v1: number; v2: number }[];
  latest: { number: number; predictions: PastPrediction[] } | null;
};

/**
 * Replays the season: before each finished gameweek, each model only sees the
 * matches played earlier, then predicts that round. No peeking at results.
 */
export async function getAccuracy(): Promise<Accuracy | null> {
  const hist = await getHistory();
  if (!hist) return null;
  const { current, prevTrain, promoted } = hist;

  const finished = current.filter(isFinished);
  const mds = [...new Set(finished.map((m) => m.matchday))].sort((a, b) => a - b).filter((md) => md >= 2);

  const score = (): ModelScore => ({ correct: 0, exact: 0, brier: 0 });
  const acc: Accuracy = {
    total: 0, v1: score(), v2: score(), homeBaseline: 0,
    usedLastSeason: prevTrain.length > 0, gameweeks: [], latest: null,
  };

  for (const md of mds) {
    const before = toTrain(finished.filter((m) => m.matchday < md), 1);
    const p1 = fitV1(before);
    const p2 = fitV2([...prevTrain, ...before], promoted);
    const gw = { number: md, total: 0, v1: 0, v2: 0 };
    const preds: PastPrediction[] = [];

    for (const m of finished.filter((x) => x.matchday === md)) {
      const actual: [number, number] = [m.score.fullTime.home!, m.score.fullTime.away!];
      const o = outcomeOf(...actual);
      const a = p1(m.homeTeam.id, m.awayTeam.id);
      const b = p2(m.homeTeam.id, m.awayTeam.id);

      acc.total++; gw.total++;
      if (o === "H") acc.homeBaseline++;
      if (a.top === o) { acc.v1.correct++; gw.v1++; }
      if (b.top === o) { acc.v2.correct++; gw.v2++; }
      if (a.score[0] === actual[0] && a.score[1] === actual[1]) acc.v1.exact++;
      const exact = b.score[0] === actual[0] && b.score[1] === actual[1];
      if (exact) acc.v2.exact++;
      acc.v1.brier += brier(a, o);
      acc.v2.brier += brier(b, o);

      preds.push({
        id: m.id, home: m.homeTeam.shortName, away: m.awayTeam.shortName,
        predicted: b.score, actual, correct: b.top === o, exact,
      });
    }
    acc.gameweeks.push(gw);
    acc.latest = { number: md, predictions: preds };
  }
  if (acc.total) {
    acc.v1.brier /= acc.total;
    acc.v2.brier /= acc.total;
  }
  return acc;
}

/* ---------- teams and table (for profile and Ask AI) ---------- */

export type TableRow = {
  team: string; tla: string; played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; points: number; form: string;
  home: string; away: string;
};

export async function getLeagueTable(): Promise<TableRow[] | null> {
  const matches = await getSeasonMatches();
  if (!matches) return null;
  const recs = buildRecords(matches.filter(isFinished));
  const teams = new Map<number, ApiTeam>();
  for (const m of matches) { teams.set(m.homeTeam.id, m.homeTeam); teams.set(m.awayTeam.id, m.awayTeam); }

  return [...teams.values()]
    .map((t) => {
      const r = recs.get(t.id) ?? emptyRec();
      const won = r.homeW + r.awayW, drawn = r.homeD + r.awayD, lost = r.homeL + r.awayL;
      return {
        team: t.shortName, tla: t.tla, played: r.homeGP + r.awayGP, won, drawn, lost,
        gf: r.homeGF + r.awayGF, ga: r.homeGA + r.awayGA, points: 3 * won + drawn,
        form: r.results.slice(-5).join(""),
        home: `W${r.homeW} D${r.homeD} L${r.homeL}, ${r.homeGF}-${r.homeGA}`,
        away: `W${r.awayW} D${r.awayD} L${r.awayL}, ${r.awayGF}-${r.awayGA}`,
      };
    })
    .sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
}

export async function getTeams(): Promise<{ name: string; tla: string }[]> {
  const table = await getLeagueTable();
  if (table) return table.map((r) => ({ name: r.team, tla: r.tla })).sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Map<string, string>();
  for (const f of sampleFixtures) { seen.set(f.home.short, f.home.name); seen.set(f.away.short, f.away.name); }
  return [...seen].map(([tla, name]) => ({ name, tla })).sort((a, b) => a.name.localeCompare(b.name));
}
