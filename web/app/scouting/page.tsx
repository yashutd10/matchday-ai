import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { clubList, getPlayers, MIN_MINUTES, POSITIONS, POS_LABEL, type Player, type Pos } from "@/lib/players";
import { money, NeedsData, playerHref, PlayersHeader, ScoreBar, StatusDot } from "@/components/players-ui";
import { teamHref } from "@/components/table-tabs";
import { PlayerSearch } from "@/components/player-search";
import { fold } from "@/lib/text";

export const metadata: Metadata = { title: "Scouting" };

type SP = Promise<Record<string, string | string[] | undefined>>;

/**
 * `short`/`show`: the column that explains the order. `col`: the desktop column that already
 * shows this stat (it gets highlighted instead of duplicated). Score and price are always visible.
 */
type Sort = { label: string; get: (p: Player) => number; short?: string; show?: (p: Player) => string; col?: string };
const SORTS = {
  score: { label: "Scout score", get: (p: Player) => p.score },
  xg: { label: "xG per 90", get: (p: Player) => p.p90.xg, short: "xG/90", show: (p: Player) => p.p90.xg.toFixed(2), col: "xg" },
  xa: { label: "xA per 90", get: (p: Player) => p.p90.xa, short: "xA/90", show: (p: Player) => p.p90.xa.toFixed(2), col: "xa" },
  gi: { label: "Goals + assists per 90", get: (p: Player) => p.p90.gi, short: "G+A/90", show: (p: Player) => p.p90.gi.toFixed(2) },
  goals: { label: "Goals", get: (p: Player) => p.goals, short: "Goals", show: (p: Player) => String(p.goals), col: "g" },
  assists: { label: "Assists", get: (p: Player) => p.assists, short: "Assists", show: (p: Player) => String(p.assists), col: "a" },
  defcon: { label: "Defensive actions per 90", get: (p: Player) => p.p90.defcon, short: "Def/90", show: (p: Player) => p.p90.defcon.toFixed(1), col: "def" },
  value: { label: "Score per £m (value)", get: (p: Player) => p.score / Math.max(p.price, 3.5), short: "Pts/£m", show: (p: Player) => (p.score / Math.max(p.price, 3.5)).toFixed(1) },
  cheapest: { label: "Cheapest first", get: (p: Player) => -p.price },
} satisfies Record<string, Sort>;
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
  const q = fold(one(sp.q).trim());
  const clubs = clubList(players);

  const list = players
    .filter((p) => (!pos || p.pos === pos) && (!club || p.tla === club) && (!maxPrice || p.price <= maxPrice) && p.minutes >= minMins)
    .filter((p) => !fit || p.status === "available")
    .filter((p) => !q || fold(p.name).includes(q) || fold(p.fullName).includes(q))
    .sort((a, b) => SORTS[sort].get(b) - SORTS[sort].get(a) || b.minutes - a.minutes);
  const shown = list.slice(0, 50);
  const S: Sort = SORTS[sort];
  // Extra column for the sorted stat: everywhere if no desktop column has it, phones only if one does.
  const extra = S.show ? (S.col ? "md:hidden" : "") : null;
  const hl = (col: string) => (S.col === col ? "font-semibold text-lime" : "");
  const suggestions = players
    .filter((p) => p.minutes > 0)
    .map((p) => ({ id: p.id, name: p.name, fullName: p.fullName, tla: p.tla, pos: p.pos, price: p.price }));

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
          <PlayerSearch players={suggestions} defaultValue={one(sp.q)} className={`${select} placeholder:text-[#8a94a3]`} />
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
        <div className="overflow-clip rounded-[18px] border border-line bg-card md:max-h-[calc(100dvh-11rem)] md:overflow-auto md:overscroll-contain">
          <table className="w-full text-sm md:min-w-[860px]">
            <thead className="sticky top-16 z-20 bg-card shadow-[0_1px_0_#222b36] md:top-0">
              <tr className="text-left text-xs text-muted">
                <th className="py-3 pr-2 pl-4 font-normal">Player</th>
                <th className="hidden sm:table-cell py-3 pl-2 font-normal">Club</th>
                <th className="hidden md:table-cell py-3 font-normal">Pos</th>
                <th className={`py-3 text-right font-normal ${sort === "cheapest" ? "font-semibold text-lime" : ""}`}>Price{sort === "cheapest" && " ▴"}</th>
                <th className="hidden md:table-cell py-3 text-right font-normal">Mins</th>
                <th className={`hidden md:table-cell py-3 text-right font-normal ${hl("g")}`}>G</th>
                <th className={`hidden md:table-cell py-3 text-right font-normal ${hl("a")}`}>A</th>
                <th className={`hidden md:table-cell py-3 text-right font-normal ${hl("xg")}`} title="Expected goals per 90 minutes">xG/90</th>
                <th className={`hidden md:table-cell py-3 text-right font-normal ${hl("xa")}`} title="Expected assists per 90 minutes">xA/90</th>
                <th className={`hidden md:table-cell py-3 text-right font-normal ${hl("def")}`} title="Defensive actions per 90 minutes">Def/90</th>
                {extra !== null && <th className={`${extra} py-3 pl-3 text-right font-semibold whitespace-nowrap text-lime`} title={S.label}>{S.short} ▾</th>}
                <th className="py-3 pr-4 pl-3 text-right font-normal md:text-left"><span className={sort === "score" ? "font-semibold text-lime" : ""}><span className="md:hidden">Score</span><span className="hidden md:inline">Scout score</span>{sort === "score" && " ▾"}</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-2.5 pr-2 pl-4">
                    <div className="flex items-center gap-2">
                      <StatusDot p={p} />
                      <div className="flex min-w-0 flex-col">
                        <Link href={playerHref(p.id)} className="truncate font-semibold hover:text-lime hover:underline">{p.name}</Link>
                        <span className="text-[11px] text-muted sm:hidden">{p.tla}</span>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell py-2.5 pl-2"><Link href={teamHref(p.tla)} className="text-soft hover:text-lime">{p.tla}</Link></td>
                  <td className="hidden md:table-cell py-2.5 text-soft">{p.pos}</td>
                  <td className="py-2.5 text-right">{money(p.price)}</td>
                  <td className="hidden md:table-cell py-2.5 text-right text-soft">{p.minutes}</td>
                  <td className={`hidden md:table-cell py-2.5 text-right ${hl("g")}`}>{p.goals}</td>
                  <td className={`hidden md:table-cell py-2.5 text-right ${hl("a")}`}>{p.assists}</td>
                  <td className={`hidden md:table-cell py-2.5 text-right ${hl("xg") || "text-soft"}`}>{p.p90.xg.toFixed(2)}</td>
                  <td className={`hidden md:table-cell py-2.5 text-right ${hl("xa") || "text-soft"}`}>{p.p90.xa.toFixed(2)}</td>
                  <td className={`hidden md:table-cell py-2.5 text-right ${hl("def") || "text-soft"}`}>{p.p90.defcon.toFixed(1)}</td>
                  {extra !== null && <td className={`${extra} py-2.5 pl-3 text-right font-semibold text-lime`}>{S.show!(p)}</td>}
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
