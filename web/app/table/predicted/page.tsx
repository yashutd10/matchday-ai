import { LiveDataError } from "@/components/live-data-error";
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getSimulation } from "@/lib/football";
import { FavouriteRowMarker } from "@/components/favourite";
import { TableTabs, teamHref } from "@/components/table-tabs";

export const metadata: Metadata = { title: "Predicted Table" };

function Odds({ value, tone }: { value: number; tone: string }) {
  const label = value === 0 ? "–" : value < 1 ? "<1%" : value > 99 && value < 100 ? ">99%" : `${Math.round(value)}%`;
  return (
    <div className="flex items-center gap-2">
      <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-[#1e2632] md:block">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className={`w-9 text-xs md:w-10 ${value === 0 ? "text-muted" : "font-semibold"}`}>{label}</span>
    </div>
  );
}

async function Data() {
  const sim = await getSimulation();
  return (
    <>

      {!sim ? (
        <LiveDataError what="Predicted table odds" />
      ) : (
        <div className="overflow-clip rounded-[18px] border border-line bg-card md:max-h-[calc(100dvh-11rem)] md:overflow-auto md:overscroll-contain">
          <table className="w-full text-sm md:min-w-[760px]">
            <thead className="sticky top-16 z-20 bg-card shadow-[0_1px_0_#222b36] md:top-0">
              <tr className="text-left text-xs text-muted">
                <th className="bg-card py-3 pr-2 pl-4 font-normal">#</th>
                <th className="py-3 font-normal">Team</th>
                <th className="hidden sm:table-cell py-3 text-center font-normal">Pts now</th>
                <th className="py-3 pr-3 text-center font-normal"><span className="md:hidden">Pts</span><span className="hidden md:inline">Predicted pts</span></th>
                <th className="py-3 pr-1 font-normal"><span className="md:hidden">Title</span><span className="hidden md:inline">Win the league</span></th>
                <th className="py-3 pr-1 font-normal">Top 4</th>
                <th className="pr-4 py-3 font-normal"><span className="md:hidden">Down</span><span className="hidden md:inline">Relegated</span></th>
              </tr>
            </thead>
            <tbody>
              {sim.teams.map((t, i) => {
                const move = t.position - (i + 1);
                const zone = i < 4 ? "border-l-home" : i >= sim.teams.length - 3 ? "border-l-[#8a2e2e]" : "border-l-transparent";
                return (
                  <tr key={t.tla} className="border-t border-line">
                    <td className={`w-10 border-l-4 py-3 pr-2 pl-3 font-semibold text-muted ${zone}`}>{i + 1}</td>
                    <td className="max-w-[40vw] py-3 pr-3 md:max-w-none">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e2632] font-display text-xs font-bold">{t.tla}</span>
                        <Link href={teamHref(t.tla)} className="font-semibold hover:text-lime hover:underline">{t.name}</Link>
                        {move !== 0 && (
                          <span className={`text-[11px] font-semibold ${move > 0 ? "text-[#5ad08f]" : "text-[#ff8a8a]"}`} title={`Currently ${t.position}${["th", "st", "nd", "rd"][t.position % 10 > 3 || [11, 12, 13].includes(t.position % 100) ? 0 : t.position % 10]}`}>
                            {move > 0 ? `▲${move}` : `▼${-move}`}
                          </span>
                        )}
                        <FavouriteRowMarker tla={t.tla} />
                      </div>
                    </td>
                    <td className="hidden sm:table-cell py-3 text-center text-soft">{t.points}</td>
                    <td className="py-3 pr-3 text-center font-display text-lg font-bold">{t.expPoints}</td>
                    <td className="py-3"><Odds value={t.title} tone="bg-lime" /></td>
                    <td className="py-3"><Odds value={t.top4} tone="bg-home" /></td>
                    <td className="py-3 pr-4"><Odds value={t.relegation} tone="bg-[#e05a5a]" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3 text-xs text-muted">
            <span><span className="text-[#5ad08f]">▲</span>/<span className="text-[#ff8a8a]">▼</span> places up or down vs the current table</span>
            <span>Odds update every 5 minutes as results come in · not betting advice</span>
          </div>
        </div>
      )}
    </>
  );
}

export default function PredictedTablePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">League Table</h1>
        <p className="max-w-3xl text-sm text-soft md:text-base">
          The AI plays out the rest of the season 10,000 times, using its prediction for every match, then counts how often each team finishes where.
        </p>
      </div>
      <TableTabs active="predicted" />
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading table" />}>
        <Data />
      </Suspense>
    </main>
  );
}
