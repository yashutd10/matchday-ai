import Link from "next/link";
import type { Metadata } from "next";
import { card, main, PageHeader, PlayerName, TeamLink } from "@/components/ipl-ui";
import { impactText, insights, ipl, type Venue } from "@/lib/ipl";

export const metadata: Metadata = { title: "IPL insights" };

export default function IplInsights() {
  const { toss, venues, mvp } = insights;
  const maxAvg = Math.max(...toss.map((t) => t.avgFirst));
  const first = toss[0], last = toss[toss.length - 1];
  const recentToss = toss.slice(-5);
  const avg = (k: "tossWinPct" | "chaseWinPct" | "fieldFirstPct") => Math.round(recentToss.reduce((s, t) => s + t[k] * t.matches, 0) / recentToss.reduce((s, t) => s + t.matches, 0));
  const latestMvp = mvp[String(ipl.latest)] ?? [];
  const byScore = [...venues].filter((v) => v.recent.avgFirst && v.recent.matches >= 8).sort((a, b) => b.recent.avgFirst! - a.recent.avgFirst!);

  const facts = [
    { big: `${last.avgFirst}`, label: `average first-innings score in ${last.season}`, note: `It was ${first.avgFirst} in ${first.season}: ${last.avgFirst - first.avgFirst} more runs an innings.` },
    { big: `${avg("fieldFirstPct")}%`, label: "of captains choose to bowl first", note: `Over the last five seasons. In ${first.season} it was ${first.fieldFirstPct}%.` },
    { big: `${avg("chaseWinPct")}%`, label: "of matches are won by the chasing side", note: "Last five seasons. Chasing is a small edge, not a guarantee." },
    { big: `${avg("tossWinPct")}%`, label: "of matches are won by the toss winner", note: "Last five seasons. Close to a coin flip: the toss matters less than people think." },
  ];

  return (
    <main className={main}>
      <PageHeader title="Insights" intro={`What ${ipl.balls.toLocaleString("en-IN")} balls say about the IPL: who really wins matches, how the game has changed, and which grounds favour whom.`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className={`${card} flex flex-col gap-1.5 p-4`}>
            <span className="font-display text-5xl font-bold leading-none text-lime">{f.big}</span>
            <span className="text-sm font-semibold">{f.label}</span>
            <span className="text-xs leading-relaxed text-muted">{f.note}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">Most valuable players, IPL {ipl.latest}</h2>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
          <ol className={`${card} overflow-clip`}>
            {latestMvp.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                <span className="w-6 font-display text-xl font-bold text-muted">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col"><PlayerName name={p.name} className="truncate font-semibold" /><span className="text-[11px] text-muted"><TeamLink code={p.team} /> · {p.m} matches</span></div>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#1e2632] sm:w-32"><div className="h-full bg-lime" style={{ width: `${Math.max(0, (p.impact / latestMvp[0].impact) * 100)}%` }} /></div>
                <span className="w-14 text-right font-display text-xl font-bold text-lime">{impactText(p.impact)}</span>
              </li>
            ))}
          </ol>
          <div className={`${card} flex flex-col gap-2.5 p-5 text-sm leading-relaxed text-soft`}>
            <h3 className="font-display text-xl font-bold text-ink">What “impact” means</h3>
            <p>Runs and wickets don&apos;t say when they came. 30 runs in a dead game and 30 in a tight chase look the same on a scorecard.</p>
            <p>Impact fixes that. Before and after every ball, the <Link href="/ipl/predictor" className="text-lime hover:underline">win model</Link> works out each side&apos;s chance of winning. The change is credited to the batter and charged to the bowler (or the other way round).</p>
            <p>Add it up over a season and you get <b className="text-ink">wins added</b>: +1.50 means the player was worth one and a half extra wins to his team.</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">How scoring has changed</h2>
        <div className={`${card} p-4 md:p-5`}>
          <div className="flex h-56 items-end gap-1 sm:gap-2" role="img" aria-label={`Average first-innings score by season: ${toss.map((t) => `${t.season} ${t.avgFirst}`).join(", ")}`}>
            {toss.map((t) => (
              <div key={t.season} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[10px] font-semibold text-soft sm:text-xs">{t.avgFirst}</span>
                <div className={`w-full rounded-t-md ${t.season === last.season ? "bg-lime" : "bg-[#3a4656]"}`} style={{ height: `${((t.avgFirst - 120) / (maxAvg - 120)) * 75}%` }} />
                <span className="text-[10px] text-muted">{`’${String(t.season).slice(2)}`}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Average first-innings score in full 20-over matches. Bars start at 120 so the change is visible.</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">Toss and chasing, season by season</h2>
        <div className={`${card} overflow-clip`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-3 pl-4 text-left font-normal">Season</th>
                <th className="py-3 text-right font-normal">Chose to bowl</th>
                <th className="py-3 text-right font-normal">Chasing side won</th>
                <th className="py-3 pr-4 text-right font-normal">Toss winner won</th>
              </tr>
            </thead>
            <tbody>
              {[...toss].reverse().map((t) => (
                <tr key={t.season} className="border-t border-line">
                  <td className="py-2.5 pl-4"><Link href={t.season === ipl.latest ? "/ipl" : `/ipl/${t.season}`} className="font-semibold hover:text-lime">{t.season}</Link></td>
                  <td className="py-2.5 text-right text-soft">{t.fieldFirstPct}%</td>
                  <td className={`py-2.5 text-right ${t.chaseWinPct >= 55 ? "font-semibold text-lime" : t.chaseWinPct <= 45 ? "text-[#ff9a52]" : ""}`}>{t.chaseWinPct}%</td>
                  <td className="py-2.5 pr-4 text-right text-soft">{t.tossWinPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">Grounds</h2>
        {byScore.length > 1 && (
          <p className="text-sm text-soft">Highest-scoring recently: <b className="text-ink">{byScore[0].name}</b> ({byScore[0].recent.avgFirst} average first innings). Lowest: <b className="text-ink">{byScore[byScore.length - 1].name}</b> ({byScore[byScore.length - 1].recent.avgFirst}).</p>
        )}
        <GroundTable rows={venues.filter((v) => v.recent.matches > 0)} recent />
        <details className="group/former">
          <summary className="cursor-pointer list-none text-sm text-lime hover:underline">
            <span className="group-open/former:hidden">Show former grounds ({venues.filter((v) => v.recent.matches === 0).length}) →</span>
            <span className="hidden group-open/former:inline">Hide former grounds</span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-soft">Grounds the IPL has used before but not in the last three seasons: South Africa hosted all of 2009 (during India&apos;s general election), the UAE hosted part of 2014, all of 2020 and the second half of 2021, and the 2022 league stage was played only in Mumbai and Pune. Rajkot was home to Gujarat Lions, a franchise that no longer exists, and Punjab Kings have moved from Mohali to the new stadium in New Chandigarh.</p>
            <GroundTable rows={venues.filter((v) => v.recent.matches === 0)} />
          </div>
        </details>
        <p className="text-xs text-muted">Grounds with at least 10 IPL matches. &ldquo;Recent&rdquo; is the last three seasons. For current grounds, chasing wins are from the last three seasons; for former grounds, all their matches.</p>
      </section>
    </main>
  );
}

function GroundTable({ rows, recent }: { rows: Venue[]; recent?: boolean }) {
  return (
    <div className={`${card} overflow-clip`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-3 pl-4 text-left font-normal">Ground</th>
            <th className="hidden py-3 text-right font-normal sm:table-cell">Matches</th>
            {recent && <th className="py-3 text-right font-normal" title="Average first-innings score, last three seasons">Avg 1st inns<span className="hidden sm:inline"> (recent)</span></th>}
            <th className={`py-3 text-right font-normal ${recent ? "hidden md:table-cell" : ""}`}>All-time avg</th>
            <th className="py-3 text-right font-normal">Chasing wins</th>
            <th className="hidden py-3 text-right font-normal md:table-cell">Sixes a match</th>
            <th className="hidden py-3 pr-4 text-right font-normal sm:table-cell">Highest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const chase = recent ? v.recent.chasePct ?? v.chasePct : v.chasePct;
            return (
              <tr key={v.name} className="border-t border-line">
                <td className="py-2.5 pl-4"><div className="flex flex-col"><span className="font-semibold">{v.name}</span><span className="text-[11px] text-muted">{v.city}</span></div></td>
                <td className="hidden py-2.5 text-right text-soft sm:table-cell">{v.matches}</td>
                {recent && <td className="py-2.5 text-right font-display text-lg font-bold">{v.recent.avgFirst ?? "–"}</td>}
                <td className={`py-2.5 text-right ${recent ? "hidden text-soft md:table-cell" : "font-display text-lg font-bold"}`}>{v.avgFirst ?? "–"}</td>
                <td className={`py-2.5 pr-4 text-right sm:pr-0 ${(chase ?? 50) >= 55 ? "font-semibold text-lime" : (chase ?? 50) <= 45 ? "text-[#ff9a52]" : ""}`}>{chase ?? "–"}%</td>
                <td className="hidden py-2.5 text-right text-soft md:table-cell">{v.sixesPerMatch}</td>
                <td className="hidden py-2.5 pr-4 text-right text-soft sm:table-cell">{v.highest}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
