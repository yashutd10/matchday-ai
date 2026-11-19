import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { FilterArea } from "@/components/filter-area";
import { card, main, PageHeader, Rating, TeamLink } from "@/components/ipl-ui";
import { impactText, ipl, minPhaseBalls, PHASE_LABEL, PHASE_OVERS, PHASES, players, ratingSeasons, teamName, type IplPlayer, type Kind, type Phase } from "@/lib/ipl";
import { nameMatch } from "@/lib/text";
import { IplSearch } from "@/components/ipl-search";

export const metadata: Metadata = { title: "IPL player ratings" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const select = "h-11 rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus:border-lime/60";

async function List({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asked: Kind = one(sp.kind) === "bowl" ? "bowl" : "bat";
  const sort = ([...PHASES, "impact"] as string[]).includes(one(sp.sort)) ? (one(sp.sort) as Phase | "impact") : "all";
  const team = one(sp.team).toUpperCase();
  const old = one(sp.old) === "1";
  const q = one(sp.q).trim();
  const teams = [...new Set(players.filter((p) => p.last === ipl.latest).map((p) => p.team))].sort();

  const named = (p: IplPlayer) => !q || nameMatch(q, p.name) >= 0 || (!!p.full && nameMatch(q, p.full) >= 0);
  const rated = (k: Kind) =>
    players.filter((p) => Object.keys(p.rating[k]).length > 0 && (old || p.last === ipl.latest) && (!team || p.team === team) && named(p));
  // Searching a name that only exists on the other list (e.g. "jasprit" while on Batters)? Show that list instead.
  const switched = !!q && rated(asked).length === 0 && rated(asked === "bat" ? "bowl" : "bat").length > 0;
  const kind: Kind = switched ? (asked === "bat" ? "bowl" : "bat") : asked;
  const value = (p: IplPlayer) => (sort === "impact" ? p.impact : p.rating[kind][sort] ?? -1);
  const list = rated(kind).sort((a, b) => value(b) - value(a) || (b.rating[kind].all ?? -1) - (a.rating[kind].all ?? -1));
  const shown = list.slice(0, 60);
  const suggestions = players
    .filter((p) => Object.keys(p.rating.bat).length || Object.keys(p.rating.bowl).length || p.last === ipl.latest)
    .map((p) => ({ label: p.name, alt: p.full, sub: `${p.team}${p.type.bat ?? p.type.bowl ? ` · ${p.type.bat ?? p.type.bowl}` : ""}`, href: `/ipl/player/${p.id}` }));
  const hl = (k: string) => (sort === k ? "font-semibold text-lime" : "");

  return (
    <FilterArea path="/ipl/players">
      <form key={[kind, sort, team, old, q].join("|")} action="/ipl/players" className={`${card} grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.2fr_auto]`}>
        <label className="flex flex-col gap-1 text-xs text-muted">Rate as
          <select name="kind" defaultValue={kind} className={select}><option value="bat">Batters</option><option value="bowl">Bowlers</option></select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Sort by
          <select name="sort" defaultValue={sort} className={select}>
            {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABEL[p]} rating{p !== "all" ? ` (${PHASE_OVERS[p].toLowerCase()})` : ""}</option>)}
            <option value="impact">Impact (wins added)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Team
          <select name="team" defaultValue={team} className={select}><option value="">All teams</option>{teams.map((t) => <option key={t} value={t}>{teamName(t)}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Name
          <IplSearch name="q" items={suggestions} defaultValue={q} placeholder="e.g. Kohli" className={`${select} w-full placeholder:text-[#8a94a3]`} />
        </label>
        <div className="flex items-end gap-2">
          <label className="flex h-11 flex-1 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-line px-3 text-sm text-soft hover:text-ink">
            <input type="checkbox" name="old" value="1" defaultChecked={old} className="h-4 w-4 accent-[#c6f432]" /> Past players too
          </label>
          <button type="submit" className="h-11 rounded-xl bg-lime px-4 text-sm font-semibold text-pitch">Go</button>
        </div>
      </form>

      {switched && <p className="-mb-3 text-sm text-soft">No {asked === "bat" ? "batters" : "bowlers"} by that name, so showing <b className="text-ink">{kind === "bowl" ? "bowlers" : "batters"}</b>.</p>}
      <p className="text-sm text-muted">
        <span className="hidden font-semibold text-lime group-data-[pending]:inline">Updating… </span>
        {list.length} {kind === "bat" ? "batter" : "bowler"}{list.length === 1 ? "" : "s"}{list.length > 60 ? " · showing the top 60" : ""} · sorted by {sort === "impact" ? "impact" : `${PHASE_LABEL[sort].toLowerCase()} rating`}
        {(kind !== "bat" || sort !== "all" || team || old || q) && <Link href="/ipl/players" className="ml-3 text-lime hover:underline">Clear</Link>}
      </p>

      {shown.length ? (
        <div className={`${card} overflow-clip transition-opacity group-data-[pending]:opacity-40`}>
          <table className="w-full text-sm">
            <thead className="sticky top-16 z-[5] bg-card shadow-[0_1px_0_#222b36] md:top-[72px]">
              <tr className="text-xs text-muted">
                <th className="w-8 py-3 pl-4 text-left font-normal">#</th>
                <th className="py-3 text-left font-normal">Player</th>
                {PHASES.map((p) => <th key={p} className={`w-11 py-3 text-center font-normal sm:w-14 ${hl(p)}`} title={PHASE_OVERS[p]}>{p === "all" ? "All" : p === "pp" ? "PP" : PHASE_LABEL[p].slice(0, 3)}{sort === p && " ▾"}</th>)}
                <th className="hidden py-3 pl-3 text-right font-normal md:table-cell">{kind === "bat" ? "Runs" : "Wkts"}</th>
                <th className="hidden py-3 pl-3 text-right font-normal md:table-cell">{kind === "bat" ? "SR" : "Econ"}</th>
                <th className={`hidden py-3 pr-4 pl-3 text-right font-normal sm:table-cell ${hl("impact")}`} title="Wins added over the rating seasons">Impact{sort === "impact" && " ▾"}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p, i) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-2.5 pl-4 text-muted">{i + 1}</td>
                  <td className="py-2.5 pr-1">
                    <div className="flex min-w-0 flex-col">
                      <Link href={`/ipl/player/${p.id}`} className="truncate font-semibold hover:text-lime hover:underline" title={p.full}>{p.full ?? p.name}</Link>
                      <span className="truncate text-[11px] text-muted"><TeamLink code={p.team} />{p.last !== ipl.latest && ` · last played ${p.last}`}{p.type[kind] && ` · ${p.type[kind]}`}</span>
                    </div>
                  </td>
                  {PHASES.map((ph) => <td key={ph} className="py-2.5 text-center"><Rating value={p.rating[kind][ph]} active={sort === ph} /></td>)}
                  <td className="hidden py-2.5 pl-3 text-right md:table-cell">{kind === "bat" ? p.recent.bat.all.runs : p.recent.bowl.all.wkts}</td>
                  <td className="hidden py-2.5 pl-3 text-right text-soft md:table-cell">{kind === "bat" ? p.recent.bat.all.sr.toFixed(1) : p.recent.bowl.all.econ.toFixed(2)}</td>
                  <td className={`hidden py-2.5 pr-4 pl-3 text-right sm:table-cell ${p.impact > 0 ? "text-[#5ad08f]" : "text-[#ff8a8a]"}`}>{impactText(p.impact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={`${card} p-5 text-soft`}>
          No {kind === "bat" ? "batters" : "bowlers"} match.{" "}
          {q && players.some((p) => nameMatch(q, p.name) >= 0 || (!!p.full && nameMatch(q, p.full) >= 0))
            ? <>Try {kind === "bat" ? <Link href={`/ipl/players?kind=bowl&q=${encodeURIComponent(q)}&old=1`} className="text-lime hover:underline">bowlers</Link> : <Link href={`/ipl/players?q=${encodeURIComponent(q)}&old=1`} className="text-lime hover:underline">batters</Link>}, or pick him from the suggestions to open his page.</>
            : q ? "Check the spelling, or pick a name from the suggestions as you type." : "Try clearing a filter."}
        </p>
      )}

      <details className={`${card} p-4 text-sm text-soft`}>
        <summary className="cursor-pointer font-semibold text-ink">How the ratings work</summary>
        <div className="mt-3 flex flex-col gap-2 leading-relaxed">
          <p>Each player is rated 0–99 for the <b>powerplay</b> (overs 1–6), <b>middle</b> (7–15) and <b>death</b> (16–20), from every ball he faced or bowled in IPL {ratingSeasons[0]}–{ipl.latest}. 90 means better than about 90% of rated players in that phase.</p>
          <ul className="list-disc pl-5">
            <li><b>Batters:</b> scoring rate counts most, then how rarely he gets out, then boundary hitting. At the death, scoring rate counts even more.</li>
            <li><b>Bowlers:</b> economy counts most, then how often he takes wickets, then dot balls.</li>
          </ul>
          <p>A player needs {minPhaseBalls} balls in a phase to be rated for it (“–” means too few). Small samples are pulled toward the average, so one hot streak doesn&apos;t top the list. <b>Overall</b> weights each phase by how much he actually plays in it.</p>
          <p><b>Impact</b> is different: it adds up how much each ball he was involved in moved his team&apos;s win chance. +1.00 means he was worth one extra win.</p>
        </div>
      </details>
    </FilterArea>
  );
}

export default function IplPlayers({ searchParams }: { searchParams: SP }) {
  return (
    <main className={main}>
      <PageHeader title="Player ratings" intro={`Every regular IPL batter and bowler, rated separately for the powerplay, middle and death overs, from ball-by-ball data for ${ratingSeasons[0]}–${ipl.latest}.`} />
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading ratings" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
