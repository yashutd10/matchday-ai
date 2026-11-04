import { Suspense } from "react";
import { getLeagueTable } from "@/lib/football";
import Link from "next/link";
import { FavouriteRowMarker } from "@/components/favourite";
import { TableTabs, teamHref } from "@/components/table-tabs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "League Table" };

const formColor: Record<string, string> = { W: "bg-[#1f6b46]", D: "bg-[#3a4350]", L: "bg-[#8a2e2e]" };

async function Data() {
  const table = await getLeagueTable();
  return (
    <>

      {!table ? (
        <p className="text-soft">The table needs live data. Add your football-data.org key to <code className="text-lime">.env.local</code> and restart the server.</p>
      ) : (
        <div className="max-h-[calc(100dvh-11rem)] overflow-auto overscroll-contain rounded-[18px] border border-line bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-20 bg-card shadow-[0_1px_0_#222b36]">
              <tr className="text-left text-xs text-muted">
                <th className="sticky left-0 z-10 bg-card py-3 pr-2 pl-4 font-normal">#</th>
                <th className="sticky left-10 z-10 bg-card py-3 font-normal">Team</th>
                <th className="py-3 text-center font-normal">P</th>
                <th className="py-3 text-center font-normal">W</th>
                <th className="py-3 text-center font-normal">D</th>
                <th className="py-3 text-center font-normal">L</th>
                <th className="py-3 text-center font-normal">GD</th>
                <th className="py-3 text-center font-normal">Pts</th>
                <th className="py-3 font-normal">Form</th>
                <th className="py-3 pr-4 font-normal">Home / Away pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => {
                const gd = r.gf - r.ga;
                const zone = i < 4 ? "border-l-home" : i >= table.length - 3 ? "border-l-[#8a2e2e]" : "border-l-transparent";
                const maxPts = Math.max(r.homePts, r.awayPts, 1);
                return (
                  <tr key={r.tla} className="border-t border-line">
                    <td className={`sticky left-0 z-[5] w-10 border-l-4 bg-card py-3 pr-2 pl-3 font-semibold text-muted ${zone}`}>{i + 1}</td>
                    <td className="sticky left-10 z-[5] bg-card py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e2632] font-display text-xs font-bold">{r.tla}</span>
                        <Link href={teamHref(r.tla)} className="font-semibold hover:text-lime hover:underline">{r.team}</Link>
                        <FavouriteRowMarker tla={r.tla} />
                      </div>
                    </td>
                    <td className="py-3 text-center text-soft">{r.played}</td>
                    <td className="py-3 text-center text-soft">{r.won}</td>
                    <td className="py-3 text-center text-soft">{r.drawn}</td>
                    <td className="py-3 text-center text-soft">{r.lost}</td>
                    <td className="py-3 text-center text-soft">{gd > 0 ? `+${gd}` : gd}</td>
                    <td className="py-3 text-center font-display text-lg font-bold">{r.points}</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        {r.form.split("").map((f, j) => (
                          <span key={j} className={`${formColor[f]} flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold`}>{f}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex w-40 flex-col gap-1" aria-label={`${r.homePts} points at home, ${r.awayPts} away`}>
                        <div className="flex items-center gap-2"><div className="h-1.5 rounded-full bg-home" style={{ width: `${(r.homePts / maxPts) * 100}%` }} /><span className="text-[11px] text-soft">{r.homePts}</span></div>
                        <div className="flex items-center gap-2"><div className="h-1.5 rounded-full bg-away" style={{ width: `${(r.awayPts / maxPts) * 100}%` }} /><span className="text-[11px] text-soft">{r.awayPts}</span></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-home" /> Champions League places</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-[#8a2e2e]" /> Relegation</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded bg-home" /> Home pts</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded bg-away" /> Away pts</span>
          </div>
        </div>
      )}
    </>
  );
}

export default function TablePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">League Table</h1>
        <p className="text-sm text-soft md:text-base">Premier League standings this season, with last-5 form and home vs away points. Tap a team for its page.</p>
      </div>
      <TableTabs active="current" />
      <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading table" />}>
        <Data />
      </Suspense>
    </main>
  );
}
