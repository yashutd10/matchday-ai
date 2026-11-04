import { cacheLife } from "next/cache";

/* Every Premier League player, from the official Fantasy Premier League data feed. */

export type Pos = "GKP" | "DEF" | "MID" | "FWD";
export const POSITIONS: Pos[] = ["GKP", "DEF", "MID", "FWD"];
export const POS_LABEL: Record<Pos, string> = { GKP: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };

export type Status = "available" | "doubtful" | "injured" | "suspended" | "unavailable";

export type Player = {
  id: number;
  name: string; // short name, e.g. "Saka"
  fullName: string;
  team: string; // e.g. "Arsenal"
  tla: string; // e.g. "ARS"
  pos: Pos;
  price: number; // FPL price in £m: a rough market-value signal
  minutes: number;
  starts: number;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  cleanSheets: number;
  saves: number;
  goalsConceded: number;
  defcon: number; // defensive contributions (tackles, interceptions, clearances, blocks…)
  status: Status;
  news: string;
  /** Per-90 rates, pulled toward the position average when minutes are low. */
  p90: { goals: number; assists: number; xg: number; xa: number; gi: number; xgi: number; defcon: number; saves: number; cs: number; conceded: number };
  /** 0–100: how this player ranks against others in his position on the stats that matter for it. */
  score: number;
  /** Has played enough to be ranked. */
  qualified: boolean;
};

type FplElement = {
  id: number; web_name: string; first_name: string; second_name: string; team: number; element_type: number;
  now_cost: number; minutes: number; starts?: number; goals_scored: number; assists: number;
  expected_goals?: string; expected_assists?: string; clean_sheets: number; saves: number; goals_conceded: number;
  defensive_contribution?: number; status: string; news: string;
};
type FplTeam = { id: number; name: string; short_name: string };

const POS_BY_TYPE: Record<number, Pos> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
const STATUS: Record<string, Status> = { a: "available", d: "doubtful", i: "injured", s: "suspended", u: "unavailable", n: "unavailable" };

/** Minutes needed before a player is ranked (about five full matches). */
export const MIN_MINUTES = 450;
/** Every player starts with this many "average" minutes, so a great 30-minute cameo doesn't top the rankings. */
const SHRINK_MINUTES = 450;

/** What each position is judged on, and how much each stat counts. `invert` = lower is better. */
const WEIGHTS: Record<Pos, { key: keyof Player["p90"]; w: number; invert?: boolean }[]> = {
  FWD: [{ key: "xg", w: 0.35 }, { key: "goals", w: 0.25 }, { key: "xa", w: 0.2 }, { key: "assists", w: 0.1 }, { key: "defcon", w: 0.1 }],
  MID: [{ key: "xa", w: 0.3 }, { key: "xg", w: 0.2 }, { key: "assists", w: 0.15 }, { key: "goals", w: 0.15 }, { key: "defcon", w: 0.2 }],
  DEF: [{ key: "defcon", w: 0.4 }, { key: "cs", w: 0.25 }, { key: "xgi", w: 0.2 }, { key: "conceded", w: 0.15, invert: true }],
  GKP: [{ key: "saves", w: 0.4 }, { key: "cs", w: 0.35 }, { key: "conceded", w: 0.25, invert: true }],
};

/** Stats used to judge "plays like" for the replacement finder. */
const STYLE: Record<Pos, (keyof Player["p90"])[]> = {
  FWD: ["xg", "goals", "xa", "assists", "defcon"],
  MID: ["xg", "xa", "goals", "assists", "defcon"],
  DEF: ["defcon", "cs", "xg", "xa", "conceded"],
  GKP: ["saves", "cs", "conceded"],
};

/** FPL and football-data.org disagree on a few club codes; use football-data's so links line up. */
const TLA_ALIASES: Record<string, string> = { NFO: "NOT" };

const num = (v: string | number | undefined | null) => (v == null ? 0 : Number(v) || 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Null when the FPL feed can't be reached; a failure is never cached, so the next visit retries. */
export async function getPlayers(): Promise<Player[] | null> {
  try {
    return await loadPlayers();
  } catch (err) {
    console.error("Failed to load the FPL feed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function loadPlayers(): Promise<Player[]> {
  "use cache";
  cacheLife("hours");

  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
    headers: { "user-agent": "MatchdayAI/1.0 (portfolio project)" },
  });
  if (!res.ok) throw new Error(`FPL feed responded ${res.status}`);
  const data = (await res.json()) as { elements: FplElement[]; teams: FplTeam[] };

  const teams = new Map(data.teams.map((t) => [t.id, t]));
  const base = data.elements
    .filter((e) => POS_BY_TYPE[e.element_type])
    .map((e) => {
      const t = teams.get(e.team);
      return {
        id: e.id,
        name: e.web_name,
        fullName: `${e.first_name} ${e.second_name}`.trim(),
        team: t?.name ?? "",
        tla: t ? (TLA_ALIASES[t.short_name] ?? t.short_name) : "",
        pos: POS_BY_TYPE[e.element_type],
        price: e.now_cost / 10,
        minutes: e.minutes,
        starts: e.starts ?? 0,
        goals: e.goals_scored,
        assists: e.assists,
        xg: round2(num(e.expected_goals)),
        xa: round2(num(e.expected_assists)),
        cleanSheets: e.clean_sheets,
        saves: e.saves,
        goalsConceded: e.goals_conceded,
        defcon: num(e.defensive_contribution),
        status: STATUS[e.status] ?? "available",
        news: e.news,
      };
    });

  // Position averages per 90, used to steady small samples.
  const totals = (keyFn: (b: (typeof base)[number]) => number, pos: Pos) => {
    const g = base.filter((b) => b.pos === pos);
    const mins = g.reduce((s, b) => s + b.minutes, 0);
    return mins ? (g.reduce((s, b) => s + keyFn(b), 0) / mins) * 90 : 0;
  };
  const raw = {
    goals: (b: (typeof base)[number]) => b.goals,
    assists: (b: (typeof base)[number]) => b.assists,
    xg: (b: (typeof base)[number]) => b.xg,
    xa: (b: (typeof base)[number]) => b.xa,
    gi: (b: (typeof base)[number]) => b.goals + b.assists,
    xgi: (b: (typeof base)[number]) => b.xg + b.xa,
    defcon: (b: (typeof base)[number]) => b.defcon,
    saves: (b: (typeof base)[number]) => b.saves,
    cs: (b: (typeof base)[number]) => b.cleanSheets,
    conceded: (b: (typeof base)[number]) => b.goalsConceded,
  };
  const avg = Object.fromEntries(
    POSITIONS.map((pos) => [pos, Object.fromEntries(Object.entries(raw).map(([k, f]) => [k, totals(f, pos)]))]),
  ) as Record<Pos, Player["p90"]>;

  const players: Player[] = base.map((b) => {
    const p90 = Object.fromEntries(
      Object.entries(raw).map(([k, f]) => {
        const prior = avg[b.pos][k as keyof Player["p90"]];
        return [k, round2(((f(b) / 90) * 90 + (prior / 90) * SHRINK_MINUTES) / ((b.minutes + SHRINK_MINUTES) / 90))];
      }),
    ) as Player["p90"];
    return { ...b, p90, score: 0, qualified: b.minutes >= MIN_MINUTES };
  });

  // Score = weighted percentile within position, among qualified players.
  for (const pos of POSITIONS) {
    const pool = players.filter((p) => p.pos === pos && p.qualified);
    if (!pool.length) continue;
    const pctOf = (key: keyof Player["p90"], v: number, invert?: boolean) => {
      const below = pool.filter((q) => (invert ? q.p90[key] > v : q.p90[key] < v)).length;
      const equal = pool.filter((q) => q.p90[key] === v).length;
      return ((below + equal / 2) / pool.length) * 100;
    };
    const blend = new Map(
      players.filter((x) => x.pos === pos).map((p) => [p, WEIGHTS[pos].reduce((s, m) => s + m.w * pctOf(m.key, p.p90[m.key], m.invert), 0)]),
    );
    // Final score = where the blend ranks among qualified players, so the best in each position is near 100.
    const ranked = pool.map((p) => blend.get(p)!).sort((a, b) => a - b);
    for (const [p, b] of blend) {
      const below = ranked.filter((v) => v < b).length, equal = ranked.filter((v) => v === b).length;
      p.score = Math.min(99, Math.round(((below + equal / 2) / ranked.length) * 100));
    }
  }
  return players;
}

/* ---------- replacement finder ---------- */

export type Similar = { player: Player; match: number };

/** Players in the same position whose per-90 profile is closest, measured in standard deviations. */
export function findSimilar(players: Player[], target: Player, limit = 10): Similar[] {
  const pool = players.filter((p) => p.pos === target.pos && p.qualified && p.id !== target.id);
  const keys = STYLE[target.pos];
  const sd = Object.fromEntries(
    keys.map((k) => {
      const vals = [...pool, target].map((p) => p.p90[k]);
      const m = vals.reduce((s, v) => s + v, 0) / vals.length;
      return [k, Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length) || 1];
    }),
  );
  return pool
    .map((p) => {
      const d = Math.sqrt(keys.reduce((s, k) => s + ((p.p90[k] - target.p90[k]) / sd[k]) ** 2, 0) / keys.length);
      return { player: p, match: Math.max(0, Math.round(100 - d * 40)) };
    })
    .sort((a, b) => b.match - a.match)
    .slice(0, limit);
}

/* ---------- team needs ---------- */

export type PositionRating = { pos: Pos; rating: number; rank: number; players: Player[] };
export type TeamNeeds = { tla: string; team: string; ratings: PositionRating[]; weakest: PositionRating | null; targets: Player[]; budget: Player | null };

/** A club's rating in a position = minutes-weighted average score of the players who actually play there. */
function clubRatings(players: Player[]) {
  const clubs = [...new Set(players.map((p) => p.tla))].filter(Boolean);
  const out = new Map<string, Map<Pos, { rating: number; players: Player[] }>>();
  for (const tla of clubs) {
    const m = new Map<Pos, { rating: number; players: Player[] }>();
    for (const pos of POSITIONS) {
      const ps = players.filter((p) => p.tla === tla && p.pos === pos && p.minutes > 0).sort((a, b) => b.minutes - a.minutes);
      const mins = ps.reduce((s, p) => s + p.minutes, 0);
      m.set(pos, { rating: mins ? Math.round(ps.reduce((s, p) => s + p.score * p.minutes, 0) / mins) : 0, players: ps.slice(0, 5) });
    }
    out.set(tla, m);
  }
  return out;
}

export function getTeamNeeds(players: Player[], tlaIn: string): TeamNeeds | null {
  const tla = tlaIn.toUpperCase();
  const all = clubRatings(players);
  const mine = all.get(tla);
  if (!mine) return null;

  const ratings: PositionRating[] = POSITIONS.map((pos) => {
    const r = mine.get(pos)!;
    const better = [...all.values()].filter((c) => c.get(pos)!.rating > r.rating).length;
    return { pos, rating: r.rating, rank: better + 1, players: r.players };
  });
  // Weakest = worst rank against the other clubs (ties: lower rating).
  const weakest = [...ratings].sort((a, b) => b.rank - a.rank || a.rating - b.rating)[0] ?? null;

  const targets = weakest
    ? players
        .filter((p) => p.pos === weakest.pos && p.tla !== tla && p.qualified && p.status === "available" && p.score > weakest.rating + 10)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
    : [];
  const budget = weakest
    ? players
        .filter((p) => p.pos === weakest.pos && p.tla !== tla && p.qualified && p.status === "available" && p.score > weakest.rating + 10)
        .sort((a, b) => a.price - b.price || b.score - a.score)[0] ?? null
    : null;

  const teamName = players.find((p) => p.tla === tla)?.team ?? tla;
  return { tla, team: teamName, ratings, weakest, targets, budget };
}

export const clubList = (players: Player[]) =>
  [...new Map(players.filter((p) => p.tla).map((p) => [p.tla, p.team])).entries()]
    .map(([tla, team]) => ({ tla, team }))
    .sort((a, b) => a.team.localeCompare(b.team));
