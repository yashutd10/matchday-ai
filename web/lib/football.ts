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
  // Last season never changes, so refresh it daily; this season refreshes every 5 minutes.
  if (season) cacheLife("days");
  else cacheLife("matchday");

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

/**
 * v3: recent form counts more. A match's weight halves every RECENCY_HALF_LIFE gameweeks,
 * so a result from 5 gameweeks ago counts half as much as last week's.
 */
const RECENCY_HALF_LIFE = 5;
const toTrainRecent = (ms: ApiMatch[], target: number): TrainMatch[] =>
  ms.filter(isFinished).map((m) => ({
    home: m.homeTeam.id, away: m.awayTeam.id, hg: m.score.fullTime.home!, ag: m.score.fullTime.away!,
    weight: 0.5 ** ((target - m.matchday - 1) / RECENCY_HALF_LIFE),
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
  const md = upcoming[0].matchday;
  const acc = await getAccuracy();
  const recent = acc?.live === "v3";
  const predictor = fitV2([...prevTrain, ...(recent ? toTrainRecent(finished, md) : toTrain(finished, 1))], promoted);

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
export type ModelKey = "v1" | "v2" | "v3";

export type Accuracy = {
  total: number;
  v1: ModelScore;
  v2: ModelScore;
  v3: ModelScore;
  /** The model the live site uses: whichever of v2/v3 has the better Brier score. */
  live: "v2" | "v3";
  homeBaseline: number;
  usedLastSeason: boolean;
  gameweeks: { number: number; total: number; v1: number; v2: number; v3: number }[];
  latest: { number: number; predictions: PastPrediction[] } | null;
  /** The live model's pre-match prediction for every finished match, by match id. */
  byMatch: Record<number, { predicted: [number, number]; probs: Fixture["probs"]; correct: boolean; exact: boolean }>;
};

/** Below this many backtested matches the evidence is too thin to switch models. */
const MIN_MATCHES_TO_SWITCH = 50;

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
    total: 0, v1: score(), v2: score(), v3: score(), live: "v2", homeBaseline: 0,
    usedLastSeason: prevTrain.length > 0, gameweeks: [], latest: null, byMatch: {},
  };

  const perGw: { md: number; matches: ApiMatch[]; preds: Record<ModelKey, ReturnType<Predictor>[]> }[] = [];

  for (const md of mds) {
    const earlier = finished.filter((m) => m.matchday < md);
    const before = toTrain(earlier, 1);
    const models: Record<ModelKey, Predictor> = {
      v1: fitV1(before),
      v2: fitV2([...prevTrain, ...before], promoted),
      v3: fitV2([...prevTrain, ...toTrainRecent(earlier, md)], promoted),
    };
    const gw = { number: md, total: 0, v1: 0, v2: 0, v3: 0 };
    const round = finished.filter((x) => x.matchday === md);
    const preds: Record<ModelKey, ReturnType<Predictor>[]> = { v1: [], v2: [], v3: [] };

    for (const m of round) {
      const actual: [number, number] = [m.score.fullTime.home!, m.score.fullTime.away!];
      const o = outcomeOf(...actual);
      acc.total++; gw.total++;
      if (o === "H") acc.homeBaseline++;
      for (const k of ["v1", "v2", "v3"] as const) {
        const p = models[k](m.homeTeam.id, m.awayTeam.id);
        preds[k].push(p);
        if (p.top === o) { acc[k].correct++; gw[k]++; }
        if (p.score[0] === actual[0] && p.score[1] === actual[1]) acc[k].exact++;
        acc[k].brier += brier(p, o);
      }
    }
    acc.gameweeks.push(gw);
    perGw.push({ md, matches: round, preds });
  }

  if (acc.total) for (const k of ["v1", "v2", "v3"] as const) acc[k].brier /= acc.total;
  acc.live = acc.total >= MIN_MATCHES_TO_SWITCH && acc.v3.brier < acc.v2.brier ? "v3" : "v2";

  for (const gw of perGw) {
    gw.matches.forEach((m, i) => {
      const p = gw.preds[acc.live][i];
      const hg = m.score.fullTime.home!, ag = m.score.fullTime.away!;
      acc.byMatch[m.id] = {
        predicted: p.score, probs: p.probs,
        correct: p.top === outcomeOf(hg, ag), exact: p.score[0] === hg && p.score[1] === ag,
      };
    });
  }

  const last = perGw[perGw.length - 1];
  if (last) {
    acc.latest = {
      number: last.md,
      predictions: last.matches.map((m, i) => {
        const p = last.preds[acc.live][i];
        const actual: [number, number] = [m.score.fullTime.home!, m.score.fullTime.away!];
        return {
          id: m.id, home: m.homeTeam.shortName, away: m.awayTeam.shortName, predicted: p.score, actual,
          correct: p.top === outcomeOf(...actual), exact: p.score[0] === actual[0] && p.score[1] === actual[1],
        };
      }),
    };
  }
  return acc;
}

/* ---------- teams and table (for profile and Ask AI) ---------- */

export type TableRow = {
  team: string; tla: string; played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; points: number; form: string;
  home: string; away: string;
  homePts: number; awayPts: number;
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
        homePts: 3 * r.homeW + r.homeD,
        awayPts: 3 * r.awayW + r.awayD,
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

/* ---------- players ---------- */

export type Scorer = {
  name: string;
  position: string | null;
  nationality: string | null;
  team: string;
  tla: string;
  played: number;
  goals: number;
  assists: number;
  penalties: number;
};

type ApiScorer = {
  player: { name: string; position?: string | null; section?: string | null; nationality?: string | null };
  team: { shortName: string; tla: string };
  playedMatches?: number | null;
  goals?: number | null;
  assists?: number | null;
  penalties?: number | null;
};

/** Top scorers this season (with assists), cached for an hour. Null when unavailable. */
export async function getScorers(): Promise<Scorer[] | null> {
  "use cache";
  cacheLife("hours");

  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/PL/scorers?limit=50", {
      headers: { "X-Auth-Token": key },
    });
    if (!res.ok) {
      console.error(`football-data.org responded ${res.status} for scorers`);
      return null;
    }
    const { scorers } = (await res.json()) as { scorers: ApiScorer[] };
    return scorers.map((s) => ({
      name: s.player.name,
      position: s.player.section ?? s.player.position ?? null,
      nationality: s.player.nationality ?? null,
      team: s.team.shortName,
      tla: s.team.tla,
      played: s.playedMatches ?? 0,
      goals: s.goals ?? 0,
      assists: s.assists ?? 0,
      penalties: s.penalties ?? 0,
    }));
  } catch (err) {
    console.error("Failed to load scorers", err);
    return null;
  }
}

/* ---------- full season fixtures and results ---------- */

export type SeasonMatch = {
  id: number;
  home: { name: string; tla: string };
  away: { name: string; tla: string };
  date: string; // e.g. "Sat 25 Oct"
  time: string; // e.g. "8:30 PM"
  state: "finished" | "live" | "upcoming" | "postponed";
  score: [number, number] | null;
  prediction: { score: [number, number]; probs: Fixture["probs"]; correct?: boolean; exact?: boolean } | null;
  /** True for next gameweek's matches, which have a full preview page. */
  hasPreview: boolean;
};

export type SeasonGameweek = { number: number; state: "finished" | "current" | "upcoming"; matches: SeasonMatch[] };

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: IST, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso)).replace(",", "");
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: IST, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Every gameweek this season: results with the model's pre-match call, live scores, and upcoming fixtures with predictions. */
export async function getSeasonFixtures(): Promise<{ gameweeks: SeasonGameweek[]; current: number } | null> {
  const hist = await getHistory();
  if (!hist) return null;
  const { current, prevTrain, promoted } = hist;
  const acc = await getAccuracy();

  const finished = current.filter(isFinished);
  const nextMd = current.find(isUpcoming)?.matchday ?? 39;
  const predictor = fitV2(
    [...prevTrain, ...(acc?.live === "v3" ? toTrainRecent(finished, nextMd) : toTrain(finished, 1))],
    promoted,
  );

  const byGw = new Map<number, SeasonMatch[]>();
  for (const m of current) {
    const live = m.status === "IN_PLAY" || m.status === "PAUSED";
    const state: SeasonMatch["state"] = isFinished(m) ? "finished" : live ? "live" : isUpcoming(m) ? "upcoming" : "postponed";
    let prediction: SeasonMatch["prediction"] = null;
    if (state === "finished") {
      const b = acc?.byMatch[m.id];
      if (b) prediction = { score: b.predicted, probs: b.probs, correct: b.correct, exact: b.exact };
    } else {
      const p = predictor(m.homeTeam.id, m.awayTeam.id);
      prediction = { score: p.score, probs: p.probs };
    }
    const list = byGw.get(m.matchday) ?? byGw.set(m.matchday, []).get(m.matchday)!;
    list.push({
      id: m.id,
      home: { name: m.homeTeam.shortName, tla: m.homeTeam.tla },
      away: { name: m.awayTeam.shortName, tla: m.awayTeam.tla },
      date: fmtDay(m.utcDate),
      time: fmtTime(m.utcDate),
      state,
      score: m.score.fullTime.home !== null && m.score.fullTime.away !== null ? [m.score.fullTime.home, m.score.fullTime.away] : null,
      prediction,
      hasPreview: m.matchday === nextMd && state === "upcoming",
    });
  }

  const gameweeks = [...byGw.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, matches]) => ({
      number,
      matches,
      state: (matches.every((x) => x.state === "finished" || x.state === "postponed")
        ? "finished"
        : matches.some((x) => x.state !== "upcoming")
          ? "current"
          : "upcoming") as SeasonGameweek["state"],
    }));
  const current_ = gameweeks.find((g) => g.state !== "finished")?.number ?? gameweeks[gameweeks.length - 1]?.number ?? 1;
  return { gameweeks, current: current_ };
}
