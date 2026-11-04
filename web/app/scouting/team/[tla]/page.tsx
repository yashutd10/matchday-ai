import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clubList, getPlayers, getTeamNeeds, POS_LABEL } from "@/lib/players";
import { money, NeedsData, playerHref, PlayersHeader, ScoreBar, StatusDot } from "@/components/players-ui";
import { teamHref } from "@/components/table-tabs";

type Params = Promise<{ tla: string }>;

export async function generateStaticParams() {
  const players = await getPlayers();
  const clubs = players ? clubList(players) : [];
  return (clubs.length ? clubs : [{ tla: "ARS" }]).map((c) => ({ tla: c.tla.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tla } = await params;
  return { title: `${tla.toUpperCase()} team needs` };
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

async function Body({ params }: { params: Params }) {
  const { tla } = await params;
  const players = await getPlayers();
  if (!players) return <NeedsData />;
  const needs = getTeamNeeds(players, tla);
  if (!needs) notFound();
  const w = needs.weakest;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-home bg-[#1e2632] font-display text-lg font-bold">{needs.tla}</span>
          <div>
            <h2 className="font-display text-3xl font-bold leading-none">{needs.team}</h2>
            <Link href={teamHref(needs.tla)} className="text-sm text-lime hover:underline">Team page →</Link>
          </div>
        </div>
        <Link href="/scouting/team" className="text-sm text-soft hover:text-ink">Change club</Link>
      </div>

      <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {needs.ratings.map((r) => {
          const weak = w?.pos === r.pos;
          return (
            <div key={r.pos} className={`flex flex-col gap-2 rounded-2xl border p-4 ${weak ? "border-[#ff8a8a]/60 bg-[#8a2e2e]/10" : "border-line bg-card"}`}>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{POS_LABEL[r.pos]}s</span>
                {weak && <span className="rounded-full bg-[#8a2e2e] px-2 py-0.5 text-[10px] font-semibold">BIGGEST NEED</span>}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold leading-none">{r.rating}</span>
                <span className="text-sm text-muted">{ordinal(r.rank)} of 20</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1e2632]"><div className={`h-full rounded-full ${weak ? "bg-[#ff8a8a]" : "bg-home"}`} style={{ width: `${r.rating}%` }} /></div>
              <ul className="flex flex-col gap-1 text-xs text-soft">
                {r.players.slice(0, 3).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <Link href={playerHref(p.id)} className="truncate hover:text-lime">{p.name}</Link>
                    <span className="shrink-0 text-muted">{p.score} · {p.minutes}′</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {w && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-2xl font-bold">Upgrade targets: {POS_LABEL[w.pos].toLowerCase()}s</h2>
            <p className="text-sm text-soft">
              {needs.team}&apos;s {POS_LABEL[w.pos].toLowerCase()}s rate {w.rating}/100, {ordinal(w.rank)} in the league. These available players score at least 10 points higher.
              {needs.budget && <> Budget pick: <Link href={playerHref(needs.budget.id)} className="font-semibold text-lime hover:underline">{needs.budget.name}</Link> ({needs.budget.team}, {money(needs.budget.price)}).</>}
            </p>
          </div>
          {needs.targets.length ? (
            <ul className="grid gap-2.5 md:grid-cols-2">
              {needs.targets.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                  <StatusDot p={p} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={playerHref(p.id)} className="truncate font-semibold hover:text-lime hover:underline">{p.name}</Link>
                    <span className="text-xs text-muted"><Link href={teamHref(p.tla)} className="hover:text-lime">{p.team}</Link> · {p.minutes} mins · {p.goals} G · {p.assists} A</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{money(p.price)}</span>
                  <ScoreBar score={p.score} />
                </li>
              ))}
            </ul>
          ) : <p className="text-soft">No clear upgrades available right now.</p>}
          <Link href={`/scouting?pos=${w.pos}&sort=value`} className="text-sm text-lime hover:underline">Search all {POS_LABEL[w.pos].toLowerCase()}s by value →</Link>
        </section>
      )}

      <p className="text-xs text-muted">Position rating = scout scores of the players who actually play there, weighted by minutes. Rank compares against all 20 clubs. Based on this season only; it doesn&apos;t know about tactics, age or contracts.</p>
    </>
  );
}

export default function TeamNeedsPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <PlayersHeader title="Team needs" active="needs" intro="How each position rates against the league, where the club is weakest, and who would be an upgrade." />
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading team needs" />}>
        <Body params={params} />
      </Suspense>
    </main>
  );
}
