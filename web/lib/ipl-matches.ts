/* Ball-by-ball detail for each match, one file per season. Generated list: add a line when a new season's file appears. */

export type MatchDetail = {
  id: string; first: string; start: number; curve: { a: number[]; b: number[] };
  turn: { inn: number; over: number; from: number; to: number; runs: number; wkts: number; bowler: string; bat: string } | null;
  cards: { team: string; runs: number; wkts: number; overs: string; bat: { name: string; runs: number; balls: number; out: boolean }[]; bowl: { name: string; wkts: number; runs: number; overs: string }[] }[];
  stars: { name: string; impact: number }[]; toss: string; venue: string;
};

const files: Record<number, () => Promise<{ default: unknown }>> = {
  2008: () => import("@/data/ipl/matches/2008.json"),
  2009: () => import("@/data/ipl/matches/2009.json"),
  2010: () => import("@/data/ipl/matches/2010.json"),
  2011: () => import("@/data/ipl/matches/2011.json"),
  2012: () => import("@/data/ipl/matches/2012.json"),
  2013: () => import("@/data/ipl/matches/2013.json"),
  2014: () => import("@/data/ipl/matches/2014.json"),
  2015: () => import("@/data/ipl/matches/2015.json"),
  2016: () => import("@/data/ipl/matches/2016.json"),
  2017: () => import("@/data/ipl/matches/2017.json"),
  2018: () => import("@/data/ipl/matches/2018.json"),
  2019: () => import("@/data/ipl/matches/2019.json"),
  2020: () => import("@/data/ipl/matches/2020.json"),
  2021: () => import("@/data/ipl/matches/2021.json"),
  2022: () => import("@/data/ipl/matches/2022.json"),
  2023: () => import("@/data/ipl/matches/2023.json"),
  2024: () => import("@/data/ipl/matches/2024.json"),
  2025: () => import("@/data/ipl/matches/2025.json"),
  2026: () => import("@/data/ipl/matches/2026.json"),
};

export async function getMatchDetail(season: number, id: string): Promise<MatchDetail | null> {
  const load = files[season];
  if (!load) return null;
  const list = (await load()).default as MatchDetail[];
  return list.find((m) => m.id === id) ?? null;
}
