/**
 * IPL 2027 auction planner: what each squad still needs, and who in the auction pool fits.
 * Squads (retained, released, purse, slots) come from data/ipl/squads.json (see pipeline/squads_2027.json).
 * "Strength" uses the phase ratings in players.json, so it only knows players with enough recent IPL balls.
 */
import squadsJson from "@/data/ipl/squads.json";
import { fullName, players, type IplPlayer, type Kind } from "@/lib/ipl";

export type Area = { kind: Kind; phase: "pp" | "mid" | "death" };
export const AREAS: (Area & { label: string; short: string; depth: number })[] = [
  { kind: "bat", phase: "pp", label: "Powerplay batting", short: "Openers", depth: 2 },
  { kind: "bat", phase: "mid", label: "Middle-overs batting", short: "Middle order", depth: 3 },
  { kind: "bat", phase: "death", label: "Death batting", short: "Finishers", depth: 2 },
  { kind: "bowl", phase: "pp", label: "Powerplay bowling", short: "New-ball bowlers", depth: 2 },
  { kind: "bowl", phase: "mid", label: "Middle-overs bowling", short: "Middle-overs bowlers", depth: 2 },
  { kind: "bowl", phase: "death", label: "Death bowling", short: "Death bowlers", depth: 2 },
];
export const areaKey = (a: Area) => `${a.kind}-${a.phase}`;

type RawTeam = { purse: number; slots: number; overseasSlots: number; retained: string[]; released: string[] };
const raw = (squadsJson as unknown as { _source: string; teams: Record<string, RawTeam> });
export const squadSource = raw._source;

export type SquadPlayer = { name: string; overseas: boolean; traded: boolean; retired: boolean; p: IplPlayer | null };

const byFull = new Map<string, IplPlayer>();
for (const p of players) byFull.set(p.full ?? p.name, p);
const clean = (s: string) => s.replace(/\*/g, "").replace(/\s*\(.*?\)/g, "").trim();
function parse(entry: string): SquadPlayer {
  const name = clean(entry);
  return { name, overseas: entry.includes("*"), traded: /\(T\)/.test(entry), retired: /retired/i.test(entry), p: byFull.get(name) ?? null };
}

export const rating = (p: IplPlayer | null, a: Area) => (p ? p.rating[a.kind][a.phase] : undefined);

/** Key numbers for a player in one area (last three seasons). */
export function areaStat(p: IplPlayer, a: Area) {
  if (a.kind === "bat") { const l = p.recent.bat[a.phase]; return `${l.runs} runs off ${l.balls} balls, SR ${l.sr}`; }
  const l = p.recent.bowl[a.phase]; return `${l.wkts} wkts in ${Math.floor(l.balls / 6)} overs, econ ${l.econ}`;
}

export type AreaReport = Area & { label: string; short: string; depth: number; score: number; rank: number; best: { sp: SquadPlayer; r: number }[]; rated: number };
export type Target = { sp: SquadPlayer; from: string; r: number; area: AreaReport };
export type TeamPlan = {
  code: string; purse: number; slots: number; overseasSlots: number; perSlot: number;
  retained: SquadPlayer[]; overseasRetained: number; unrated: SquadPlayer[];
  areas: AreaReport[]; needs: AreaReport[]; targets: Record<string, Target[]>; radar: Target[];
};

/** Everyone released by any team (the auction pool we know about), with who released them. */
export const pool: { sp: SquadPlayer; from: string }[] = Object.entries(raw.teams).flatMap(([code, t]) => t.released.map((e) => ({ sp: parse(e), from: code }))).filter((x) => !x.sp.retired);

function areaReports(retained: SquadPlayer[]) {
  return AREAS.map((a) => {
    const rated = retained.map((sp) => ({ sp, r: rating(sp.p, a) })).filter((x): x is { sp: SquadPlayer; r: number } => x.r !== undefined).sort((x, y) => y.r - x.r);
    const top = rated.slice(0, a.depth);
    // Average of the best `depth` players; an empty spot counts as 0, because nobody proven fills it.
    const score = Math.round(top.reduce((s, x) => s + x.r, 0) / a.depth);
    return { ...a, score, rank: 0, best: top, rated: rated.length };
  });
}

function build(): Record<string, TeamPlan> {
  const base = Object.entries(raw.teams).map(([code, t]) => {
    const retained = t.retained.map(parse);
    return { code, t, retained, areas: areaReports(retained) };
  });
  // Rank each area across the ten teams (1 = strongest).
  AREAS.forEach((_, i) => {
    const order = [...base].sort((x, y) => y.areas[i].score - x.areas[i].score);
    order.forEach((b, r) => { b.areas[i].rank = r + 1; });
  });

  const out: Record<string, TeamPlan> = {};
  for (const { code, t, retained, areas } of base) {
    const needs = [...areas].sort((x, y) => y.rank - x.rank || x.score - y.score).slice(0, 2);
    const eligible = pool.filter((x) => x.sp.p && (t.overseasSlots > 0 || !x.sp.overseas));
    const targets: Record<string, Target[]> = {};
    for (const area of needs) {
      targets[areaKey(area)] = eligible
        .map((x) => ({ sp: x.sp, from: x.from, r: rating(x.sp.p, area) ?? -1, area }))
        .filter((x) => x.r >= 0)
        .sort((x, y) => y.r - x.r)
        .slice(0, 5);
    }
    const shortlisted = new Set(Object.values(targets).flat().map((x) => x.sp.name));
    // Under the radar: Indian players with fewer than 30 IPL matches who rate well in a needed area.
    const radar = eligible
      .filter((x) => !x.sp.overseas && (x.sp.p?.matches ?? 99) < 30 && !shortlisted.has(x.sp.name))
      .map((x) => {
        const best = needs.map((area) => ({ area, r: rating(x.sp.p, area) ?? -1 })).sort((a, b) => b.r - a.r)[0];
        return { sp: x.sp, from: x.from, r: best.r, area: best.area };
      })
      .filter((x) => x.r >= 50)
      .sort((x, y) => y.r - x.r)
      .slice(0, 4);
    out[code] = {
      code, purse: t.purse, slots: t.slots, overseasSlots: t.overseasSlots, perSlot: t.slots ? t.purse / t.slots : 0,
      retained, overseasRetained: retained.filter((s) => s.overseas).length, unrated: retained.filter((s) => !s.p || AREAS.every((a) => rating(s.p, a) === undefined)),
      areas, needs, targets, radar,
    };
  }
  return out;
}

export const plans = build();
export const planTeams = Object.keys(plans).sort();
export const displayName = (sp: SquadPlayer) => (sp.p ? fullName(sp.p.name) ?? sp.name : sp.name);
