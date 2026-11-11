import { cacheLife } from "next/cache";
import { getPlayers, type Pos } from "@/lib/players";

/*
 * Match reports for finished games, built from the free Fantasy Premier League data:
 * - /api/fixtures/          → per match: scorers, assists, own goals, cards, saves, bonus
 * - /api/event/{gw}/live/   → per player per gameweek: minutes, starts, xG, xA, tackles, recoveries…
 * Possession, shots and goal minutes aren't in any free feed, so they're not here.
 */

const FPL = "https://fantasy.premierleague.com/api";
const UA = { "user-agent": "MatchdayAI/1.0 (portfolio project)" };
/** A failure is kept for a minute only, and never throws (a throw inside "use cache" fails the build). */
const FAIL = { stale: 0, revalidate: 60, expire: 60 };

type Pair = { element: number; value: number };
type FplFixture = {
  id: number; event: number | null; finished: boolean; kickoff_time: string | null;
  team_h: number; team_a: number; team_h_score: number | null; team_a_score: number | null;
  stats: { identifier: string; h: Pair[]; a: Pair[] }[];
};

async function loadFixtures(): Promise<FplFixture[] | null> {
  "use cache";
  cacheLife("matchday");
  try {
    const res = await fetch(`${FPL}/fixtures/`, { headers: UA });
    if (!res.ok) throw new Error(`FPL fixtures responded ${res.status}`);
    const all = (await res.json()) as FplFixture[];
    // Keep only what a report needs, so the cached copy stays small.
    return all.map((f) => ({
      id: f.id, event: f.event, finished: f.finished, kickoff_time: f.kickoff_time,
      team_h: f.team_h, team_a: f.team_a, team_h_score: f.team_h_score, team_a_score: f.team_a_score,
      stats: f.stats.filter((s) => ["goals_scored", "assists", "own_goals", "yellow_cards", "red_cards", "saves", "bonus", "bps"].includes(s.identifier)),
    }));
  } catch (err) {
    console.error("Failed to load FPL fixtures:", err instanceof Error ? err.message : err);
    cacheLife(FAIL);
    return null;
  }
}

/** One player's numbers in one match. xG/xA are null when he played twice that gameweek (FPL only gives the total). */
type LiveRow = {
  id: number; fixtures: number[]; minutes: number; starts: number;
  xg: number | null; xa: number | null; tackles: number; cbi: number; recoveries: number; defcon: number; points: number;
};

async function loadLive(gw: number, finished: boolean): Promise<Map<number, LiveRow> | null> {
  "use cache";
  // A finished gameweek's numbers barely change, so keep them for days.
  if (finished) cacheLife("days");
  else cacheLife("matchday");
  try {
    const res = await fetch(`${FPL}/event/${gw}/live/`, { headers: UA });
    if (!res.ok) throw new Error(`FPL live responded ${res.status}`);
    const data = (await res.json()) as {
      elements: { id: number; stats: Record<string, number | string>; explain: { fixture: number }[] }[];
    };
    const n = (v: unknown) => Number(v) || 0;
    const rows = data.elements
      .filter((e) => n(e.stats.minutes) > 0)
      .map((e): LiveRow => {
        const fixtures = [...new Set(e.explain.map((x) => x.fixture))];
        const single = fixtures.length === 1;
        return {
          id: e.id, fixtures, minutes: n(e.stats.minutes), starts: n(e.stats.starts),
          xg: single ? n(e.stats.expected_goals) : null, xa: single ? n(e.stats.expected_assists) : null,
          tackles: n(e.stats.tackles), cbi: n(e.stats.clearances_blocks_interceptions),
          recoveries: n(e.stats.recoveries), defcon: n(e.stats.defensive_contribution), points: n(e.stats.total_points),
        };
      });
    return new Map(rows.map((r) => [r.id, r]));
  } catch (err) {
    console.error(`Failed to load FPL gameweek ${gw}:`, err instanceof Error ? err.message : err);
    cacheLife(FAIL);
    return null;
  }
}

/* ---------- the report ---------- */

export type ReportPlayer = {
  id: number; name: string; pos: Pos | "";
  minutes: number; started: boolean;
  goals: number; assists: number; ownGoals: number; yellow: number; red: number; saves: number;
  xg: number | null; xa: number | null; tackles: number; cbi: number; recoveries: number;
  bonus: number; bps: number; points: number | null;
};

export type ReportSide = {
  tla: string;
  /** Goals credited to this side, own goals included (scored by the other team's player). */
  goals: { name: string; count: number; ownGoal: boolean }[];
  starters: ReportPlayer[];
  subs: ReportPlayer[];
  totals: { xg: number | null; saves: number; tackles: number; cbi: number; recoveries: number; yellow: number; red: number };
};

export type MatchReport = { home: ReportSide; away: ReportSide; potm: (ReportPlayer & { tla: string }) | null; hasLineups: boolean };

const POS_ORDER: Record<string, number> = { GKP: 0, DEF: 1, MID: 2, FWD: 3, "": 4 };

/**
 * Report for a finished match, found by the two clubs' codes (each home/away pairing happens once a season).
 * Null when FPL can't be reached or doesn't have the match yet.
 */
export async function getMatchReport(homeTla: string, awayTla: string): Promise<MatchReport | null> {
  const [fixtures, players] = await Promise.all([loadFixtures(), getPlayers()]);
  if (!fixtures || !players) return null;

  const info = new Map(players.map((p) => [p.id, p]));

  // Which club is FPL team N? Every player listed on a side of a match votes with his club code.
  const votes = new Map<number, Map<string, number>>();
  for (const f of fixtures)
    for (const st of f.stats)
      for (const [team, list] of [[f.team_h, st.h], [f.team_a, st.a]] as const)
        for (const x of list) {
          const tla = info.get(x.element)?.tla;
          if (!tla) continue;
          const v = votes.get(team) ?? votes.set(team, new Map()).get(team)!;
          v.set(tla, (v.get(tla) ?? 0) + 1);
        }
  const tlaOf = new Map([...votes].map(([team, v]) => [team, [...v].sort((a, b) => b[1] - a[1])[0][0]]));

  const fx = fixtures.find((f) => tlaOf.get(f.team_h) === homeTla && tlaOf.get(f.team_a) === awayTla);
  if (!fx || !fx.event || fx.team_h_score === null) return null;

  const live = await loadLive(fx.event, fx.finished);
  const stat = (id: string, side: "h" | "a") => fx.stats.find((s) => s.identifier === id)?.[side] ?? [];
  const valueOf = (id: string, side: "h" | "a", el: number) => stat(id, side).find((x) => x.element === el)?.value ?? 0;
  const nameOf = (el: number) => info.get(el)?.name ?? `Player ${el}`;

  const side = (s: "h" | "a"): ReportSide => {
    const teamId = s === "h" ? fx.team_h : fx.team_a;
    const other = s === "h" ? "a" : "h";
    const tla = tlaOf.get(teamId) ?? "";

    // Everyone who played in this match for this club: listed on this side in the match stats,
    // or (for players with no stat line) currently at this club and in FPL's data for this match.
    const ids = new Set<number>();
    const onOtherSide = new Set(fx.stats.flatMap((st) => st[other].map((x) => x.element)));
    for (const st of fx.stats) for (const x of st[s]) ids.add(x.element);
    for (const r of live?.values() ?? [])
      if (r.fixtures.includes(fx.id) && info.get(r.id)?.tla === tla && !onOtherSide.has(r.id)) ids.add(r.id);

    const people = [...ids].map((el): ReportPlayer => {
      const r = live?.get(el);
      const p = info.get(el);
      const single = r ? r.fixtures.length === 1 : false;
      return {
        id: el, name: nameOf(el), pos: p?.pos ?? "",
        minutes: r && single ? r.minutes : 0, started: r ? r.starts > 0 : true,
        goals: valueOf("goals_scored", s, el), assists: valueOf("assists", s, el), ownGoals: valueOf("own_goals", s, el),
        yellow: valueOf("yellow_cards", s, el), red: valueOf("red_cards", s, el), saves: valueOf("saves", s, el),
        xg: r?.xg ?? null, xa: r?.xa ?? null,
        tackles: r && single ? r.tackles : 0, cbi: r && single ? r.cbi : 0, recoveries: r && single ? r.recoveries : 0,
        bonus: valueOf("bonus", s, el), bps: valueOf("bps", s, el), points: r && single ? r.points : null,
      };
    });
    const sorted = people.sort((a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.minutes - a.minutes);

    const goals = [
      ...stat("goals_scored", s).map((x) => ({ name: nameOf(x.element), count: x.value, ownGoal: false })),
      ...stat("own_goals", other).map((x) => ({ name: nameOf(x.element), count: x.value, ownGoal: true })),
    ];
    const sum = (k: "saves" | "tackles" | "cbi" | "recoveries" | "yellow" | "red") => people.reduce((t, p) => t + p[k], 0);
    const xgKnown = people.every((p) => p.xg !== null) && live;
    return {
      tla,
      goals,
      starters: sorted.filter((p) => p.started),
      subs: sorted.filter((p) => !p.started),
      totals: {
        xg: xgKnown ? Math.round(people.reduce((t, p) => t + (p.xg ?? 0), 0) * 100) / 100 : null,
        saves: sum("saves"), tackles: sum("tackles"), cbi: sum("cbi"), recoveries: sum("recoveries"), yellow: sum("yellow"), red: sum("red"),
      },
    };
  };

  const home = side("h"), away = side("a");
  // Player of the match: FPL's Bonus Points System, which rates every action in the game.
  const all = [...home.starters, ...home.subs].map((p) => ({ ...p, tla: home.tla }))
    .concat([...away.starters, ...away.subs].map((p) => ({ ...p, tla: away.tla })));
  const potm = all.filter((p) => p.bps > 0).sort((a, b) => b.bps - a.bps)[0] ?? null;
  return { home, away, potm, hasLineups: !!live };
}
