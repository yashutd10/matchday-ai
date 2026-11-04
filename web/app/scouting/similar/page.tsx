import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getPlayers, POS_LABEL } from "@/lib/players";
import { money, NeedsData, playerHref, PlayersHeader, StatusDot } from "@/components/players-ui";

export const metadata: Metadata = { title: "Replacement finder" };
type SP = Promise<Record<string, string | string[] | undefined>>;

async function Picker({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = String((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim();
  const players = await getPlayers();
  if (!players) return <NeedsData />;

  const ql = q.toLowerCase();
  const matches = q
    ? players.filter((p) => p.name.toLowerCase().includes(ql) || p.fullName.toLowerCase().includes(ql)).sort((a, b) => b.minutes - a.minutes).slice(0, 12)
    : [];
  const popular = [...players].filter((p) => p.qualified).sort((a, b) => b.score * b.price - a.score * a.price).slice(0, 12);

  const Chip = ({ p }: { p: (typeof players)[number] }) => (
    <Link href={playerHref(p.id)} className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 transition hover:border-lime/50">
      <StatusDot p={p} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
      <span className="shrink-0 text-xs text-muted">{p.tla} · {p.pos} · {money(p.price)}</span>
    </Link>
  );

  return (
    <>
      <form action="/scouting/similar" className="flex gap-2 rounded-[18px] border border-line bg-card p-3">
        <label htmlFor="q" className="sr-only">Player name</label>
        <input id="q" name="q" defaultValue={q} required placeholder="Type a player, e.g. Salah" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-pitch px-3 text-sm outline-none placeholder:text-[#8a94a3] focus:border-lime/60" />
        <button type="submit" className="h-11 rounded-xl bg-lime px-5 text-sm font-semibold text-pitch">Find</button>
      </form>
      {q && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">Players named “{q}”</h2>
          {matches.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{matches.map((p) => <Chip key={p.id} p={p} />)}</div> : <p className="text-soft">No player found. Try a surname.</p>}
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">Or start from a top player</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{popular.map((p) => <Chip key={p.id} p={p} />)}</div>
      </section>
      <p className="text-xs text-muted">Compares {Object.values(POS_LABEL).map((l) => l.toLowerCase() + "s").join(", ")} only with players in the same position.</p>
    </>
  );
}

export default function SimilarIndex({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <PlayersHeader title="Replacement finder" active="similar" intro="Pick a player and find others who play the same way on the numbers, with the cheaper options highlighted." />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading players" />}>
        <Picker searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
