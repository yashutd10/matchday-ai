import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { clubList, getPlayers } from "@/lib/players";
import { NeedsData, PlayersHeader } from "@/components/players-ui";

export const metadata: Metadata = { title: "Team needs" };

async function Clubs() {
  const players = await getPlayers();
  if (!players) return <NeedsData />;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {clubList(players).map((c) => (
        <Link key={c.tla} href={`/scouting/team/${c.tla.toLowerCase()}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-3 transition hover:border-lime/50">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e2632] font-display text-sm font-bold">{c.tla}</span>
          <span className="truncate text-sm font-semibold">{c.team}</span>
        </Link>
      ))}
    </div>
  );
}

export default function TeamNeedsIndex() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <PlayersHeader title="Team needs" active="needs" intro="Pick a club to see how each position rates against the rest of the league, where it's weakest, and which players would be an upgrade." />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading clubs" />}>
        <Clubs />
      </Suspense>
    </main>
  );
}
