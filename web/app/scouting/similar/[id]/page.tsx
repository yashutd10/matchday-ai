import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSimilar, getPlayers, POS_LABEL, type Player, type Similar } from "@/lib/players";
import { FilterArea } from "@/components/filter-area";
import { money, NeedsData, playerHref, PlayersHeader, ScoreBar, StatusDot } from "@/components/players-ui";
import { teamHref } from "@/components/table-tabs";

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateStaticParams() {
  const players = await getPlayers();
  const top = (players ?? []).filter((p) => p.qualified).sort((a, b) => b.score - a.score).slice(0, 40);
  return (top.length ? top : [{ id: 1 }]).map((p) => ({ id: String(p.id) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const p = (await getPlayers())?.find((x) => String(x.id) === id);
  return { title: p ? `Players like ${p.name}` : "Replacement finder" };
}

function Stat({ label, v, compare: r }: { label: string; v: number; compare?: number }) {
  const diff = r === undefined ? null : v - r;
  const good = diff !== null && (label.startsWith("Conceded") ? diff < 0 : diff > 0);
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="font-display text-xl font-bold leading-none">{v.toFixed(2)}
        {diff !== null && Math.abs(diff) >= 0.01 && <span className={`ml-1 text-[11px] font-semibold ${good ? "text-[#5ad08f]" : "text-[#ff8a8a]"}`}>{diff > 0 ? "+" : ""}{diff.toFixed(2)}</span>}
      </span>
    </div>
  );
}

const statsFor = (p: Player) =>
  p.pos === "GKP"
    ? [["Saves/90", p.p90.saves], ["Clean sheets/90", p.p90.cs], ["Conceded/90", p.p90.conceded]] as const
    : p.pos === "DEF"
      ? [["Def actions/90", p.p90.defcon], ["Clean sheets/90", p.p90.cs], ["xG+xA/90", p.p90.xgi]] as const
      : [["xG/90", p.p90.xg], ["xA/90", p.p90.xa], ["G+A/90", p.p90.gi], ["Def actions/90", p.p90.defcon]] as const;

/* ---------- "why it's a match" in plain words ---------- */

const NOUN: Partial<Record<keyof Player["p90"], string>> = {
  xg: "goal threat", xa: "chance creation", goals: "scoring", assists: "assists", defcon: "defensive work",
  cs: "clean sheets", saves: "shot-stopping", conceded: "goals conceded",
};

function why(s: Similar) {
  const entries = Object.entries(s.diffs) as [keyof Player["p90"], number][];
  if (!entries.length) return "";
  const closest = [...entries].sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
  const biggest = [...entries].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  if (Math.abs(biggest[1]) < 0.5) return "Very close profile across the board";
  const diff = biggest[0] === "conceded" ? (biggest[1] > 0 ? "Concedes more" : "Concedes less") : `${biggest[1] > 0 ? "More" : "Less"} ${NOUN[biggest[0]]}`;
  // Only call something "similar" if it really is (within half a standard deviation) and isn't the same stat.
  const same = closest[0] !== biggest[0] && Math.abs(closest[1]) < 0.5 ? `Similar ${NOUN[closest[0]]} · ` : "";
  return same + diff;
}

/* ---------- filter chips ---------- */

const MAX_PRICES = [["", "Any price"], ["5", "Max £5m"], ["6", "Max £6m"], ["7", "Max £7m"], ["8", "Max £8m"], ["10", "Max £10m"]] as const;
const chip = "flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-sm text-soft transition select-none hover:border-[#3a4656] has-[:checked]:border-lime has-[:checked]:bg-lime has-[:checked]:font-semibold has-[:checked]:text-pitch has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lime";

function Chip({ name, label, on }: { name: string; label: string; on: boolean }) {
  return (
    <label className={chip}>
      <input type="checkbox" name={name} value="1" defaultChecked={on} className="sr-only" />
      {label}
    </label>
  );
}

/* ---------- target's full stat line ---------- */

function FullStats({ p }: { p: Player }) {
  const rows: [string, string | number][] = [
    ["Minutes", p.minutes], ["Starts", p.starts],
    ...(p.pos === "GKP" ? [] : ([["Goals", p.goals], ["Assists", p.assists], ["xG (total)", p.xg.toFixed(2)], ["xA (total)", p.xa.toFixed(2)]] as [string, string | number][])),
    ...(p.pos === "GKP" || p.pos === "DEF" ? [["Clean sheets", p.cleanSheets] as [string, number]] : []),
    ...(p.pos === "GKP" ? [["Saves", p.saves] as [string, number], ["Conceded", p.goalsConceded] as [string, number]] : []),
    ...(p.pos === "GKP" ? [] : [["Def. actions (total)", p.defcon] as [string, number]]), ["Price", money(p.price)],
    ["Status", p.status === "available" ? "Fit" : p.status.charAt(0).toUpperCase() + p.status.slice(1)],
  ];
  return (
    <details className="group/more border-t border-lime/20 pt-3 md:col-span-2">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-semibold text-lime [&::-webkit-details-marker]:hidden">
        <span className="group-open/more:hidden">More stats</span><span className="hidden group-open/more:inline">Fewer stats</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="transition group-open/more:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
        {rows.map(([l, v]) => (
          <div key={l} className="flex flex-col">
            <dt className="text-[11px] text-muted">{l}</dt>
            <dd className="font-display text-lg font-bold leading-tight">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

async function Body({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const players = await getPlayers();
  if (!players) return <NeedsData />;
  const target = players.find((p) => String(p.id) === id);
  if (!target) notFound();

  const f = { cheaper: one(sp.cheaper) === "1", max: Number(one(sp.max)) || 0, fit: one(sp.fit) === "1", other: one(sp.other) === "1" };
  const ranked = findSimilar(players, target);
  const filtered = ranked.filter(({ player: p }) =>
    (!f.cheaper || p.price < target.price) && (!f.max || p.price <= f.max) && (!f.fit || p.status === "available") && (!f.other || p.tla !== target.tla),
  );
  const similar = filtered.slice(0, 10);
  const cheaper = ranked.filter((s) => s.player.price < target.price && s.player.status === "available");
  const base = statsFor(target);
  const anyFilter = f.cheaper || f.max || f.fit || f.other;

  return (
    <>
      <section className="grid gap-4 rounded-[20px] border border-lime/40 bg-lime/5 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wider text-lime">FINDING PLAYERS LIKE</span>
          <span className="flex items-center gap-2 font-display text-4xl font-bold leading-none"><StatusDot p={target} />{target.name}</span>
          <span className="text-sm text-soft">
            <Link href={teamHref(target.tla)} className="hover:text-lime">{target.team}</Link> · {POS_LABEL[target.pos]} · {money(target.price)} · {target.minutes} mins
          </span>
          {target.news && <span className="text-xs text-[#f5c451]">{target.news}</span>}
        </div>
        <div className="flex flex-wrap gap-5">
          {base.map(([l, v]) => <Stat key={l} label={l} v={v} />)}
          <div className="flex flex-col"><span className="text-[11px] text-muted">Scout score</span><ScoreBar score={target.score} /></div>
        </div>
        <FullStats p={target} />
      </section>

      {!target.qualified && <p className="text-sm text-[#f5c451]">{target.name} has played under 450 minutes, so these comparisons are rough.</p>}

      {cheaper.length > 0 && (
        <p className="text-sm text-soft">
          <span className="font-semibold text-lime">Best cheaper fit option:</span>{" "}
          <Link href={playerHref(cheaper[0].player.id)} className="font-semibold hover:underline">{cheaper[0].player.name}</Link> ({cheaper[0].player.team}) is a {cheaper[0].match}% match for {money(target.price - cheaper[0].player.price)} less.
        </p>
      )}

      <FilterArea path={`/scouting/similar/${target.id}`}>
      <form key={[f.cheaper, f.max, f.fit, f.other].join("-")} action={`/scouting/similar/${target.id}`} className="flex flex-wrap items-center gap-2" aria-label="Filter replacements">
        <Chip name="cheaper" label="Cheaper only" on={f.cheaper} />
        <label className="relative">
          <span className="sr-only">Maximum price</span>
          <select name="max" defaultValue={f.max ? String(f.max) : ""} className={`h-9 appearance-none rounded-full border pr-8 pl-3.5 text-sm outline-none transition ${f.max ? "border-lime bg-lime font-semibold text-pitch" : "border-line bg-card text-soft hover:border-[#3a4656]"}`}>
            {MAX_PRICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 ${f.max ? "text-pitch" : "text-muted"}`}><path d="M6 9l6 6 6-6" /></svg>
        </label>
        <Chip name="fit" label="Fit only" on={f.fit} />
        <Chip name="other" label={`Not ${target.tla}`} on={f.other} />
        <noscript><button type="submit" className="h-9 rounded-full bg-lime px-4 text-sm font-semibold text-pitch">Apply</button></noscript>
        <span className="ml-1 text-xs text-muted">
          <span className="hidden font-semibold text-lime group-data-[pending]:inline">Updating… </span>
          {filtered.length} match{filtered.length === 1 ? "" : "es"}
          {anyFilter && <Link href={`/scouting/similar/${target.id}`} className="ml-2 text-lime hover:underline">Clear</Link>}
        </span>
      </form>

      {similar.length === 0 && (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-soft">No similar {POS_LABEL[target.pos].toLowerCase()}s match those filters. Try a higher price or turn a filter off.</p>
      )}

      <ul className="grid gap-2.5 transition-opacity group-data-[pending]:pointer-events-none group-data-[pending]:opacity-40 md:grid-cols-2">
        {similar.map((s) => {
          const { player: p, match } = s;
          const save = target.price - p.price;
          return (
            <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[#1e2632]">
                  <span className="font-display text-lg font-bold leading-none text-lime">{match}%</span>
                  <span className="text-[9px] text-muted">match</span>
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 truncate font-semibold"><StatusDot p={p} /><Link href={playerHref(p.id)} className="hover:text-lime hover:underline">{p.name}</Link></span>
                  <span className="text-xs text-muted"><Link href={teamHref(p.tla)} className="hover:text-lime">{p.team}</Link> · {p.minutes} mins</span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-semibold">{money(p.price)}</span>
                  {Math.abs(save) >= 0.1 && <span className={`text-[11px] font-semibold ${save > 0 ? "text-[#5ad08f]" : "text-[#ff8a8a]"}`}>{save > 0 ? `${money(save)} cheaper` : `${money(-save)} dearer`}</span>}
                </div>
              </div>
              {why(s) && <p className="-mt-1 flex items-center gap-1.5 text-xs text-soft"><span className="text-lime" aria-hidden="true">↳</span>{why(s)}</p>}
              <div className="flex flex-wrap gap-4 border-t border-line pt-3">
                {statsFor(p).map(([l, v], i) => <Stat key={l} label={l} v={v} compare={base[i][1]} />)}
                <div className="ml-auto flex flex-col"><span className="text-[11px] text-muted">Scout score</span><ScoreBar score={p.score} /></div>
              </div>
            </li>
          );
        })}
      </ul>
      </FilterArea>
      <p className="text-xs text-muted">Match % compares per-90 style stats with {target.name}&apos;s, position by position. Green/red numbers show more/less than {target.name}. Prices are FPL prices, a rough value guide.</p>
    </>
  );
}

export default function SimilarPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <PlayersHeader title="Replacement finder" active="similar" intro="Players who play the same way on the numbers, most similar first." />
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading players" />}>
        <Body params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
