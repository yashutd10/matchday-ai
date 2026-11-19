import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { FilterArea } from "@/components/filter-area";
import { IplSearch, type SearchItem } from "@/components/ipl-search";
import { card, main, PageHeader, PlayerName } from "@/components/ipl-ui";
import { fullName, matchups, minMatchupBalls, players, type Matchup } from "@/lib/ipl";

export const metadata: Metadata = { title: "IPL matchups" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();
const nm = (n: string) => fullName(n) ?? n;
const sr = (m: Matchup) => (m.runs / m.balls) * 100;
const select = "h-10 rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus:border-lime/60";

function link(bat: string, bowl: string, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  if (bat) p.set("bat", bat);
  if (bowl) p.set("bowl", bowl);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/ipl/matchups?${s}` : "/ipl/matchups";
}

/** Who has the upper hand? Only called once there are enough balls to say. */
function verdict(m: Matchup): { text: string; tone: string } | null {
  if (m.balls < 18) return null;
  if (m.outs >= 3 && m.runs / m.outs < 16) return { text: "Bowler on top", tone: "bg-[#8a2e2e] text-ink" };
  if (sr(m) >= 160 && m.balls / Math.max(m.outs, 1) >= 18) return { text: "Batter on top", tone: "bg-lime text-pitch" };
  return null;
}

const SORTS = {
  balls: { label: "Most balls", fn: (a: Matchup, b: Matchup) => b.balls - a.balls },
  high: { label: "Highest strike rate", fn: (a: Matchup, b: Matchup) => sr(b) - sr(a) || a.outs - b.outs },
  low: { label: "Lowest strike rate", fn: (a: Matchup, b: Matchup) => sr(a) - sr(b) || b.outs - a.outs },
  outs: { label: "Most dismissals", fn: (a: Matchup, b: Matchup) => b.outs - a.outs || sr(a) - sr(b) },
} as const;
type SortKey = keyof typeof SORTS;
const MINS = [12, 24, 48] as const;

function Duel({ m }: { m: Matchup }) {
  const v = verdict(m);
  const per24 = { runs: Math.round((m.runs / m.balls) * 24), outs: ((m.outs / m.balls) * 24).toFixed(1) };
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-lime/40 bg-lime/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-lime">HEAD TO HEAD</span>
        {v && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.tone}`}>{v.text}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 flex-col"><span className="text-[11px] text-muted">Batter</span><PlayerName name={m.bat} className="truncate font-display text-2xl font-bold md:text-3xl" /></div>
        <span className="text-sm text-muted">v</span>
        <div className="flex min-w-0 flex-col items-end text-right"><span className="text-[11px] text-muted">Bowler</span><PlayerName name={m.bowl} className="truncate font-display text-2xl font-bold md:text-3xl" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[["Runs", m.runs], ["Balls", m.balls], ["Dismissals", m.outs], ["Strike rate", sr(m).toFixed(0)], ["Dot balls", `${Math.round((m.dots / m.balls) * 100)}%`], ["4s / 6s", `${m.fours} / ${m.sixes}`]].map(([l, val]) => (
          <div key={l} className="flex flex-col rounded-xl bg-[#10161d] px-3 py-2.5"><span className="text-[11px] text-muted">{l}</span><span className="font-display text-2xl font-bold leading-tight">{val}</span></div>
        ))}
      </div>
      <p className="text-sm text-soft">In a typical 4-over spell (24 balls) at these rates, <b className="text-ink">{nm(m.bat)}</b> would score about <b className="text-ink">{per24.runs}</b> and be out <b className="text-ink">{per24.outs}</b> times. Last met in {m.last}.</p>
    </section>
  );
}

function Table({ rows, who, bat, bowl }: { rows: Matchup[]; who: "bowl" | "bat"; bat: string; bowl: string }) {
  const th = "py-3 pl-2 text-right font-normal";
  return (
    <div className={`${card} overflow-clip transition-opacity group-data-[pending]:opacity-40`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-3 pl-4 text-left font-normal">{who === "bowl" ? "Bowler" : "Batter"}</th>
            <th className={th}>Runs</th><th className={th}>Balls</th><th className={th}>Out</th><th className={th}>SR</th>
            <th className={`${th} hidden sm:table-cell`}>Avg</th><th className={`${th} hidden sm:table-cell`}>Dot %</th><th className={`${th} hidden pr-4 md:table-cell`}>4s/6s</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const other = who === "bowl" ? m.bowl : m.bat;
            const v = verdict(m);
            return (
              <tr key={m.bat + m.bowl} className="border-t border-line">
                <td className="py-2.5 pl-4">
                  <div className="flex flex-col items-start gap-0.5">
                    <Link href={who === "bowl" ? link(bat, other) : link(other, bowl)} className="font-semibold hover:text-lime hover:underline">{nm(other)}</Link>
                    {v ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${v.tone}`}>{v.text}</span> : <span className="text-[11px] text-muted">last met {m.last}</span>}
                  </div>
                </td>
                <td className="py-2.5 pl-2 text-right font-display text-lg font-bold">{m.runs}</td>
                <td className="py-2.5 pl-2 text-right text-soft">{m.balls}</td>
                <td className="py-2.5 pl-2 text-right">{m.outs}</td>
                <td className="py-2.5 pr-4 pl-2 text-right sm:pr-0">{sr(m).toFixed(0)}</td>
                <td className="hidden py-2.5 pl-2 text-right text-soft sm:table-cell">{m.outs ? (m.runs / m.outs).toFixed(1) : "–"}</td>
                <td className="hidden py-2.5 pl-2 text-right text-soft sm:table-cell">{Math.round((m.dots / m.balls) * 100)}%</td>
                <td className="hidden py-2.5 pr-4 pl-2 text-right text-soft md:table-cell">{m.fours}/{m.sixes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  let bat = one(sp.bat), bowl = one(sp.bowl);
  // Old links (?p=Name): show him in whichever role he has more balls in.
  const legacy = one(sp.p);
  if (legacy && !bat && !bowl) {
    const asB = matchups.filter((m) => m.bat === legacy).reduce((s, m) => s + m.balls, 0);
    const asW = matchups.filter((m) => m.bowl === legacy).reduce((s, m) => s + m.balls, 0);
    if (asB >= asW) bat = legacy; else bowl = legacy;
  }
  const sort: SortKey = one(sp.sort) in SORTS ? (one(sp.sort) as SortKey) : "balls";
  const min = MINS.includes(Number(one(sp.min)) as (typeof MINS)[number]) ? Number(one(sp.min)) : minMatchupBalls;

  const teamOf = new Map(players.map((p) => [p.name, p.team]));
  const batters = new Set<string>(), bowlers = new Set<string>();
  for (const m of matchups) { batters.add(m.bat); bowlers.add(m.bowl); }
  const batItems: SearchItem[] = [...batters].sort().map((n) => ({ label: n, alt: fullName(n), sub: teamOf.get(n) ?? "", href: link(n, bowl, { sort: one(sp.sort), min: one(sp.min) }) }));
  const bowlItems: SearchItem[] = [...bowlers].sort().map((n) => ({ label: n, alt: fullName(n), sub: teamOf.get(n) ?? "", href: link(bat, n, { sort: one(sp.sort), min: one(sp.min) }) }));

  // Typed a bowler in the batter box (or the reverse)? Offer him in his own role.
  const bowlAsBat: SearchItem[] = [...bowlers].filter((n) => !batters.has(n)).sort().map((n) => ({ label: n, alt: fullName(n), sub: teamOf.get(n) ?? "", href: link("", n, { sort: one(sp.sort), min: one(sp.min) }) }));
  const batAsBowl: SearchItem[] = [...batters].filter((n) => !bowlers.has(n)).sort().map((n) => ({ label: n, alt: fullName(n), sub: teamOf.get(n) ?? "", href: link(n, "", { sort: one(sp.sort), min: one(sp.min) }) }));
  const keep = (m: Matchup) => m.balls >= min;
  const order = SORTS[sort].fn;
  const duel = bat && bowl ? matchups.find((m) => m.bat === bat && m.bowl === bowl) : undefined;
  const batList = bat ? matchups.filter((m) => m.bat === bat && keep(m)).sort(order) : [];
  const bowlList = bowl ? matchups.filter((m) => m.bowl === bowl && keep(m)).sort(order) : [];
  const batAlsoBowls = bat && !bowl && bowlers.has(bat);
  const bowlAlsoBats = bowl && !bat && batters.has(bowl);
  const classics = [...matchups].sort((a, b) => b.balls - a.balls).slice(0, 12);

  return (
    <>
      <div className={`${card} grid gap-3 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end`}>
        <label className="flex flex-col gap-1 text-xs text-muted">Batter
          <IplSearch key={`bat-${bat}`} items={batItems} placeholder="e.g. Kohli" defaultValue={bat ? nm(bat) : ""} elsewhere={bowlAsBat} elsewhereLabel="Not in the batters list (under 12 balls against any bowler). As a bowler:" />
        </label>
        <span className="hidden pb-3.5 text-sm text-muted sm:block">v</span>
        <label className="flex flex-col gap-1 text-xs text-muted">Bowler
          <IplSearch key={`bowl-${bowl}`} items={bowlItems} placeholder="e.g. Bumrah" defaultValue={bowl ? nm(bowl) : ""} elsewhere={batAsBowl} elsewhereLabel="Not in the bowlers list. As a batter:" />
        </label>
      </div>
      <p className="-mt-3 text-xs text-muted">Pick a batter, a bowler, or both for their head to head.{(bat || bowl) && <Link href="/ipl/matchups" className="ml-2 text-lime hover:underline">Clear</Link>}</p>

      {bat && bowl && (duel
        ? <Duel m={duel} />
        : <p className={`${card} p-5 text-soft`}>{nm(bat)} and {nm(bowl)} haven&apos;t faced each other for at least {minMatchupBalls} balls in the IPL.</p>)}

      {(bat || bowl) && (
        <FilterArea path="/ipl/matchups">
          <form key={[sort, min].join("|")} action="/ipl/matchups" className="flex flex-wrap items-end gap-2.5" aria-label="Sort matchups">
            {bat && <input type="hidden" name="bat" value={bat} />}
            {bowl && <input type="hidden" name="bowl" value={bowl} />}
            <label className="flex flex-col gap-1 text-xs text-muted">Sort by
              <select name="sort" defaultValue={sort} className={select}>{(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k].label}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">At least
              <select name="min" defaultValue={String(min)} className={select}>{MINS.map((n) => <option key={n} value={n}>{n} balls</option>)}</select>
            </label>
            <noscript><button type="submit" className="h-10 rounded-xl bg-lime px-4 text-sm font-semibold text-pitch">Apply</button></noscript>
            <span className="pb-2.5 text-xs text-muted"><span className="hidden font-semibold text-lime group-data-[pending]:inline">Updating… </span>Strike rate is the batter&apos;s: high is good for the batter, low is good for the bowler.</span>
          </form>

          {bat && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl font-bold"><PlayerName name={bat} /> <span className="text-soft">batting against</span>{bowl && <span className="text-soft"> other bowlers</span>}</h2>
                {batAlsoBowls && <Link href={link("", bat, { sort: one(sp.sort), min: one(sp.min) })} className="text-sm text-lime hover:underline">See him as a bowler →</Link>}
              </div>
              {batList.length ? <Table rows={batList.slice(0, 40)} who="bowl" bat={bat} bowl={bowl} /> : <p className={`${card} p-5 text-soft`}>No bowlers with at least {min} balls against him.</p>}
              {batList.length > 40 && <p className="text-xs text-muted">Showing 40 of {batList.length}.</p>}
            </section>
          )}
          {bowl && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl font-bold"><PlayerName name={bowl} /> <span className="text-soft">bowling to</span>{bat && <span className="text-soft"> other batters</span>}</h2>
                {bowlAlsoBats && <Link href={link(bowl, "", { sort: one(sp.sort), min: one(sp.min) })} className="text-sm text-lime hover:underline">See him as a batter →</Link>}
              </div>
              {bowlList.length ? <Table rows={bowlList.slice(0, 40)} who="bat" bat={bat} bowl={bowl} /> : <p className={`${card} p-5 text-soft`}>No batters with at least {min} balls against him.</p>}
              {bowlList.length > 40 && <p className="text-xs text-muted">Showing 40 of {bowlList.length}.</p>}
            </section>
          )}
        </FilterArea>
      )}

      {!bat && !bowl && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">The most-played duels in IPL history</h2>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {classics.map((m) => (
              <li key={m.bat + m.bowl}>
                <Link href={link(m.bat, m.bowl)} className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3.5 transition hover:border-[#3a4656]">
                  <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span className="truncate">{nm(m.bat)}</span><span className="shrink-0 text-xs font-normal text-muted">v</span><span className="truncate text-right">{nm(m.bowl)}</span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-line pt-2">
                    <span className="font-display text-2xl font-bold leading-none">{m.runs} <span className="text-sm font-normal text-muted">off {m.balls}</span></span>
                    <span className="text-xs text-muted">out {m.outs}× · SR {sr(m).toFixed(0)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted">Head-to-heads with at least {minMatchupBalls} balls, across every IPL season. Dismissals count only when the bowler got that batter out (not run-outs).</p>
    </>
  );
}

export default function IplMatchups({ searchParams }: { searchParams: SP }) {
  return (
    <main className={main}>
      <PageHeader title="Matchups" intro="Batter against bowler, head to head: runs, balls and dismissals from every ball they've faced each other in the IPL." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading matchups" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
