import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSimilar, getPlayers, POS_LABEL, type Player } from "@/lib/players";
import { money, NeedsData, playerHref, PlayersHeader, ScoreBar, StatusDot } from "@/components/players-ui";
import { teamHref } from "@/components/table-tabs";

type Params = Promise<{ id: string }>;

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
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="font-display text-xl font-bold leading-none">{v.toFixed(2)}
        {diff !== null && Math.abs(diff) >= 0.01 && <span className={`ml-1 text-[11px] font-semibold ${diff > 0 ? "text-[#5ad08f]" : "text-[#ff8a8a]"}`}>{diff > 0 ? "+" : ""}{diff.toFixed(2)}</span>}
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

async function Body({ params }: { params: Params }) {
  const { id } = await params;
  const players = await getPlayers();
  if (!players) return <NeedsData />;
  const target = players.find((p) => String(p.id) === id);
  if (!target) notFound();
  const similar = findSimilar(players, target, 10);
  const cheaper = similar.filter((s) => s.player.price < target.price);
  const base = statsFor(target);

  return (
    <>
      <section className="flex flex-col gap-4 rounded-[20px] border border-lime/40 bg-lime/5 p-5 md:flex-row md:items-center md:justify-between">
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
      </section>

      {!target.qualified && <p className="text-sm text-[#f5c451]">{target.name} has played under 450 minutes, so these comparisons are rough.</p>}

      {cheaper.length > 0 && (
        <p className="text-sm text-soft">
          <span className="font-semibold text-lime">Best cheaper option:</span>{" "}
          <Link href={playerHref(cheaper[0].player.id)} className="font-semibold hover:underline">{cheaper[0].player.name}</Link> ({cheaper[0].player.team}) is a {cheaper[0].match}% match for {money(target.price - cheaper[0].player.price)} less.
        </p>
      )}

      <ul className="grid gap-2.5 md:grid-cols-2">
        {similar.map(({ player: p, match }) => {
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
              <div className="flex flex-wrap gap-4 border-t border-line pt-3">
                {statsFor(p).map(([l, v], i) => <Stat key={l} label={l} v={v} compare={base[i][1]} />)}
                <div className="ml-auto flex flex-col"><span className="text-[11px] text-muted">Scout score</span><ScoreBar score={p.score} /></div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">Match % compares per-90 style stats with {target.name}&apos;s, position by position. Green/red numbers show more/less than {target.name}. Prices are FPL prices, a rough value guide.</p>
    </>
  );
}

export default function SimilarPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <PlayersHeader title="Replacement finder" active="similar" intro="Players who play the same way on the numbers, most similar first." />
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading players" />}>
        <Body params={params} />
      </Suspense>
    </main>
  );
}
