import Link from "next/link";
import type { Metadata } from "next";
import { TeamBadge } from "@/components/ipl-ui";
import { ipl, seasons, teamName } from "@/lib/ipl";

export const metadata: Metadata = { title: "IPL champions" };

export default function IplSeasons() {
  const titles = new Map<string, number>();
  for (const s of seasons) if (s.champion) titles.set(s.champion, (titles.get(s.champion) ?? 0) + 1);
  const ranked = [...titles].sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:gap-8 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">Champions</h1>
        <p className="text-sm text-soft md:text-base">Every IPL season since 2008: who won it, who scored the most runs and who took the most wickets.</p>
      </div>

      <section className="flex flex-wrap gap-2">
        {ranked.map(([code, n]) => (
          <span key={code} className="flex items-center gap-2 rounded-full border border-line bg-card py-1.5 pr-3.5 pl-1.5 text-sm">
            <TeamBadge code={code} size="sm" /><span className="font-semibold">{code}</span><span className="text-muted">{n} title{n > 1 ? "s" : ""}</span>
          </span>
        ))}
      </section>

      <div className="overflow-clip rounded-[18px] border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-3 pl-4 font-normal">Season</th>
              <th className="py-3 font-normal">Champions</th>
              <th className="hidden py-3 font-normal md:table-cell">Runners-up</th>
              <th className="hidden py-3 font-normal sm:table-cell">Most runs</th>
              <th className="hidden py-3 pr-4 font-normal sm:table-cell">Most wickets</th>
            </tr>
          </thead>
          <tbody>
            {[...seasons].reverse().map((s) => (
              <tr key={s.season} className="border-t border-line">
                <td className="py-3 pl-4"><Link href={s.season === ipl.latest ? "/ipl" : `/ipl/${s.season}`} className="font-display text-xl font-bold hover:text-lime">{s.season}</Link></td>
                <td className="py-3">
                  {s.champion && (
                    <div className="flex items-center gap-2.5">
                      <TeamBadge code={s.champion} size="sm" />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-semibold"><span className="lg:hidden">{s.champion}</span><span className="hidden lg:inline">{teamName(s.champion)}</span></span>
                        <span className="text-[11px] text-muted sm:hidden">{s.topRuns[0]?.name} {s.topRuns[0]?.runs} · {s.topWickets[0]?.name} {s.topWickets[0]?.wkts}w</span>
                      </div>
                    </div>
                  )}
                </td>
                <td className="hidden py-3 text-soft md:table-cell">{s.runnerUp && <><span className="lg:hidden">{s.runnerUp}</span><span className="hidden lg:inline">{teamName(s.runnerUp)}</span></>}</td>
                <td className="hidden py-3 sm:table-cell">{s.topRuns[0]?.name} <span className="text-[#ff9a52]">{s.topRuns[0]?.runs}</span></td>
                <td className="hidden py-3 pr-4 sm:table-cell">{s.topWickets[0]?.name} <span className="text-[#a78bfa]">{s.topWickets[0]?.wkts}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Tap a season to see its points table, playoffs and leaders. Data from Cricsheet.</p>
    </main>
  );
}
