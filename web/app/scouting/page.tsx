import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { clubList, getPlayers, MIN_MINUTES, POSITIONS, POS_LABEL, type Player, type Pos } from "@/lib/players";
import { money, NeedsData, playerHref, PlayersHeader, ScoreBar, StatusDot } from "@/components/players-ui";
import { teamHref } from "@/components/table-tabs";

export const metadata: Metadata = { title: "Scouting" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const SORTS = {
  score: { label: "Scout score", get: (p: Player) => p.score },
  xg: { label: "xG per 90", get: (p: Player) => p.p90.xg },
  xa: { label: "xA per 90", get: (p: Player) => p.p90.xa },
  gi: { label: "Goals + assists per 90", get: (p: Player) => p.p90.gi },
  goals: { label: "Goals", get: (p: Player) => p.goals },
  assists: { label: "Assists", get: (p: Player) => p.assists },
  defcon: { label: "Defensive actions per 90", get: (p: Player) => p.p90.defcon },
  value: { label: "Score per £m (value)", get: (p: Player) => p.score / Math.max(p.price, 3.5) },
  cheapest: { label: "Cheapest first", get: (p: Player) => -p.price },
} as const;
type SortKey = keyof typeof SORTS;

const PRICES = [["", "Any price"], ["5", "Up to £5m"], ["6", "Up to £6m"], ["7", "Up to £7m"], ["8", "Up to £8m"], ["10", "Up to £10m"], ["12", "Up to £12m"]] as const;
const MINUTES = [["450", "450+ mins (5 games)"], ["900", "900+ mins (10 games)"], ["1350", "1,350+ mins (15 games)"], ["90", "90+ mins (any)"]] as const;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const select = "h-11 rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus:border-lime/60";

async function Results({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const players = await getPlayers();
  if (!players) return <NeedsData />;

  const pos = (POSITIONS as string[]).includes(one(sp.pos)) ? (one(sp.pos) as Pos) : "";
  const club = one(sp.club).toUpperCase();
  const maxPrice = Number(one(sp.price)) || 0;
  const minMins = Number(one(sp.mins)) || MIN_MINUTES;
  const fit = one(sp.fit) === "1";
  const sort: SortKey = one(sp.sort) in SORTS ? (one(sp.sort) as SortKey) : "score";
  const q = one(sp.q).trim().toLowerCase();
  const clubs = clubList(players);

  const list = players
    .filter((p) => (!pos || p.pos === pos) && (!club || p.tla === club) && (!maxPrice || p.price <= maxPrice) && p.minutes >= minMins)
    .filter((p) => !fit || p.status === "available")
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.fullName.toLowerCase().includes(q))
    .sort((a, b) => SORTS[sort].get(b) - SORTS[sort].get(a) || b.minutes - a.minutes);
  const shown = list.slice(0, 50);

  return (
    <>
      <form action="/scouting" className="grid gap-2.5 rounded-[18px] border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted">Position
          <select name="pos" defaultValue={pos} className={select}>
            <option value="">All positions</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{POS_LABEL[p]}s</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Club
          <select name="club" defaultValue={club} className={select}>
            <option value="">All clubs</option>
            {clubs.map((c) => <option key={c.tla} value={c.tla}>{c.team}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Price
          <select name="price" defaultValue={one(sp.price)} className={select}>
            {PRICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Minutes played
          <select name="mins" defaultValue={String(minMins)} className={select}>
            {MINUTES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">Name
          <input name="q" defaultValue={one(sp.q)} placeholder="Saka" className={`${select} placeholder:text-[#8a94a3]`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Sort by
          <select name="sort" defaultValue={sort} className={select}>
            {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k].label}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line px-3 text-sm text-soft">
            <input type="checkbox" name="fit" value="1" defaultChecked={fit} className="h-4 w-4 accent-[#c6f432]" /> Fit only
          </label>
          <button type="submit" className="h-11 rounded-xl bg-lime px-5 text-sm font-semibold text-pitch transition hover:brightness-110 active:scale-[0.98]">Search</button>
        </div>
      </form>

      <p className="text-sm text-muted">
        {list.length} player{list.length === 1 ? "" : "s"} match{list.length > 50 ? " · showing the top 50" : ""} · sorted by {SORTS[sort].label.toLowerCase()}
        {(pos || club || maxPrice || q || fit || minMins !== MIN_MINUTES || sort !== "score") && <Link href="/scouting" className="ml-3 text-lime hover:underline">Clear filters</Link>}
      </p>

      {shown.length ? (
        <div className="rounded-[18px] border border-line bg-card md:max-h-[calc(100dvh-11rem)] md:overflow-auto md:overscroll-contain">
          <table className="w-full text-sm md:min-w-[860px]">
            <thead className="sticky top-16 z-20 bg-card shadow-[0_1px_0_#222b36] md:top-0">
              <tr className="text-left text-xs text-muted">
                <th className="sticky left-0 z-10 bg-card py-3 pr-2 pl-4 font-normal">Player</th>
                <th className="py-3 pl-2 font-normal">Club</th>
                <th className="hidden md:table-cell py-3 font-normal">Pos</th>
                <th className="py-3 text-right font-normal">Price</th>
                <th className="hidden md:table-cell py-3 text-right font-normal">Mins</th>
                <th className="hidden md:table-cell py-3 text-right font-normal">G</th>
                <th className="hidden md:table-cell py-3 text-right font-normal">A</th>
                <th className="hidden md:table-cell py-3 text-right font-normal" title="Expected goals per 90 minutes">xG/90</th>
                <th className="hidden md:table-cell py-3 text-right font-normal" title="Expected assists per 90 minutes">xA/90</th>
                <th className="hidden md:table-cell py-3 text-right font-normal" title="Defensive actions per 90 minutes">Def/90</th>
                <th className="py-3 pr-4 pl-3 text-right font-normal md:text-left"><span className="md:hidden">Score</span><span className="hidden md:inline">Scout score</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="sticky left-0 z-[5] bg-card py-2.5 pr-2 pl-4">
                    <div className="flex items-center gap-2">
                      <StatusDot p={p} />
                      <Link href={playerHref(p.id)} className="font-semibold hover:text-lime hover:underline">{p.name}</Link>
                    </div>
                  </td>
                  <td className="py-2.5 pl-2"><Link href={teamHref(p.tla)} className="text-soft hover:text-lime">{p.tla}</Link></td>
                  <td className="hidden md:table-cell py-2.5 text-soft">{p.pos}</td>
                  <td className="py-2.5 text-right">{money(p.price)}</td>
                  <td className="hidden md:table-cell py-2.5 text-right text-soft">{p.minutes}</td>
                  <td className="hidden md:table-cell py-2.5 text-right">{p.goals}</td>
                  <td className="hidden md:table-cell py-2.5 text-right">{p.assists}</td>
                  <td className="hidden md:table-cell py-2.5 text-right text-soft">{p.p90.xg.toFixed(2)}</td>
                  <td className="hidden md:table-cell py-2.5 text-right text-soft">{p.p90.xa.toFixed(2)}</td>
                  <td className="hidden md:table-cell py-2.5 text-right text-soft">{p.p90.defcon.toFixed(1)}</td>
                  <td className="py-2.5 pr-4 pl-3"><div className="flex justify-end md:justify-start"><ScoreBar score={p.score} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-card p-5 text-soft">No players match those filters. Try a higher price or fewer minutes.</p>
      )}

      <details className="rounded-2xl border border-line bg-card p-4 text-sm text-soft">
        <summary className="cursor-pointer font-semibold text-ink">How the scout score works</summary>
        <div className="mt-3 flex flex-col gap-2">
          <p>Each player is compared only with others in his position who have played at least {MIN_MINUTES} minutes. The score (0–100) is his percentile on the stats that matter for that position:</p>
          <ul className="list-disc pl-5">
            <li><b>Forwards:</b> xG, goals, xA, assists, defensive work</li>
            <li><b>Midfielders:</b> xA, xG, assists, goals, defensive work</li>
            <li><b>Defenders:</b> defensive actions, clean sheets, attacking threat, goals conceded</li>
            <li><b>Goalkeepers:</b> saves, clean sheets, goals conceded</li>
          </ul>
          <p>Per-90 numbers are steadied for players with few minutes, so one great cameo doesn&apos;t top the list. Price is the Fantasy Premier League price: a rough value signal, not a real transfer fee.</p>
        </div>
      </details>
    </>
  );
}

export default function ScoutingPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <PlayersHeader
        title="Scouting"
        active="search"
        intro="Search every Premier League player by position, club and price, ranked on per-90 stats. Tap a player to find similar options."
      />
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading players" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
