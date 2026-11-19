import Link from "next/link";
import { fmtDate, impactText, insights, ipl, results, seasonYears, teamName, type Result, type Season } from "@/lib/ipl";
import { PlayerName, TeamBadge, TeamLink, teamHref } from "@/components/ipl-ui";

export { TeamBadge };

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-display text-3xl font-bold leading-none md:text-4xl">{value}</span>
      {note && <span className="truncate text-xs text-soft">{note}</span>}
    </div>
  );
}

function PlayoffCard({ r }: { r: Result }) {
  return (
    <li>
      <Link href={`/ipl/match/${r.id}`} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5 transition hover:border-[#3a4656]">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span className={r.stage === "Final" ? "font-semibold text-lime" : ""}>{r.stage}</span>
        <span>{fmtDate(r.date)} · {r.venue}</span>
      </div>
      {r.scores.map((s) => (
        <div key={s.team} className="flex items-center gap-2.5">
          <TeamBadge code={s.team} size="sm" />
          <span className={`min-w-0 flex-1 truncate text-[15px] ${r.winner === s.team ? "font-bold" : "text-soft"}`}>{teamName(s.team)}</span>
          <span className="font-display text-xl font-bold leading-none">{s.runs}/{s.wickets}</span>
          <span className="w-9 text-right text-[11px] text-muted">{s.overs}</span>
        </div>
      ))}
      <p className="border-t border-line pt-2 text-[11px] text-muted">
        {r.winner ? <><span className="font-semibold text-soft">{r.winner}</span> won{r.margin === "super over" ? " in a super over" : r.margin ? ` by ${r.margin}` : ""}{r.dls ? " (DLS)" : ""}</> : "No result"}
        {r.pom && <> · Player of the match: <span className="text-soft">{r.pom}</span></>}
      </p>
      </Link>
    </li>
  );
}

const th = "py-3 pl-2.5 font-normal first:pl-4";
const num = "py-2.5 pl-2.5 text-right";

export function SeasonView({ s }: { s: Season }) {
  const final = s.playoffs.find((p) => p.stage === "Final");
  const top4 = s.table.length > 4;
  const mvp = insights.mvp[String(s.season)] ?? [];
  const all = results[String(s.season)] ?? [];
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:gap-8 md:px-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted md:text-base">Indian Premier League</p>
          <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">IPL {s.season}</h1>
        </div>
        <div className="flex items-center gap-2">
        <Link href="/ipl/seasons" className="flex h-11 items-center rounded-xl border border-line bg-card px-4 text-sm text-soft hover:text-ink">All champions</Link>
        <details className="group relative">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Season {s.season}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <div className="absolute right-0 z-20 mt-2 grid w-64 grid-cols-4 gap-1.5 rounded-2xl border border-line bg-card p-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
            {[...seasonYears].reverse().map((y) => (
              <Link key={y} href={y === ipl.latest ? "/ipl" : `/ipl/${y}`} aria-current={y === s.season ? "page" : undefined} className={`flex h-10 items-center justify-center rounded-lg text-sm ${y === s.season ? "bg-lime font-semibold text-pitch" : "bg-[#1e2632] text-soft hover:text-ink"}`}>{y}</Link>
            ))}
          </div>
        </details>
        </div>
      </div>

      {s.champion && (
        <section className="flex items-center gap-4 rounded-[20px] border border-lime/40 bg-lime/5 p-5">
          <TeamBadge code={s.champion} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wider text-lime">CHAMPIONS</span>
            <Link href={teamHref(s.champion)} className="font-display text-3xl font-bold leading-none hover:text-lime md:text-4xl">{teamName(s.champion)}</Link>
            {final && s.runnerUp && (
              <span className="text-sm text-soft">Beat {teamName(s.runnerUp)}{final.margin === "super over" ? " in a super over" : ` by ${final.margin}`} in the final at {final.venue}.</span>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Matches" value={String(s.matches)} />
        <Tile label="Runs scored" value={s.totals.runs.toLocaleString("en-IN")} />
        <Tile label="Sixes" value={s.totals.sixes.toLocaleString("en-IN")} note={s.topSixes[0] ? `Most: ${s.topSixes[0].name} (${s.topSixes[0].sixes})` : undefined} />
        <Tile label="Highest total" value={`${s.totals.highest.runs}/${s.totals.highest.wickets}`} note={`${s.totals.highest.team} v ${s.totals.highest.vs}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:gap-8">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">Points table</h2>
          <div className="overflow-clip rounded-[18px] border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className={`${th} w-14 pr-3 text-right`}>#</th>
                  <th className={`${th} pl-0`}>Team</th>
                  <th className={`${th} text-right`}>P</th>
                  <th className={`${th} text-right`}>W</th>
                  <th className={`${th} text-right`}>L</th>
                  <th className={`${th} hidden text-right sm:table-cell`}>NR</th>
                  <th className={`${th} text-right`}>NRR</th>
                  <th className={`${th} pr-4 text-right`}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {s.table.map((r, i) => (
                  <tr key={r.team} className="border-t border-line">
                    <td className={`py-2.5 pr-3 pl-4 text-right tabular-nums text-muted ${top4 && i < 4 ? "shadow-[inset_3px_0_0_#c6f432]" : ""}`}>{i + 1}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <TeamBadge code={r.team} size="sm" />
                        <TeamLink code={r.team} className="font-semibold sm:hidden" />
                        <TeamLink code={r.team} full className="hidden font-semibold sm:inline" />
                        {r.team === s.champion && <span className="rounded-full bg-lime px-1.5 py-0.5 text-[10px] font-semibold text-pitch">C</span>}
                      </div>
                    </td>
                    <td className={`${num} text-soft`}>{r.p}</td>
                    <td className={num}>{r.w}</td>
                    <td className={`${num} text-soft`}>{r.l}</td>
                    <td className={`${num} hidden text-soft sm:table-cell`}>{r.nr}</td>
                    <td className={`${num} text-soft`}>{r.nrr > 0 ? "+" : ""}{r.nrr.toFixed(3)}</td>
                    <td className={`${num} pr-4 font-display text-lg font-bold`}>{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {top4 && <p className="text-xs text-muted"><span className="mr-1.5 inline-block h-2.5 w-1 rounded-sm bg-lime align-middle" />Top four reached the playoffs · NRR = net run rate · C = champions</p>}
        </section>

        {s.playoffs.length > 0 && (
          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="font-display text-2xl font-bold">Playoffs</h2>
            <ul className="flex flex-col gap-2.5">{[...s.playoffs].reverse().map((r) => <PlayoffCard key={r.id} r={r} />)}</ul>
          </section>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><span className="h-3 w-3 rounded-full bg-[#ff9a52]" />Most runs</h2>
          <div className="overflow-clip rounded-[18px] border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className={`${th} w-14 pr-3 text-right`}>#</th><th className={`${th} pl-0`}>Batter</th>
                  <th className={`${th} hidden text-right sm:table-cell`}>Inns</th><th className={`${th} hidden text-right sm:table-cell`}>Avg</th>
                  <th className={`${th} text-right`}>SR</th><th className={`${th} hidden text-right md:table-cell`}>HS</th><th className={`${th} pr-4 text-right`}>Runs</th>
                </tr>
              </thead>
              <tbody>
                {s.topRuns.slice(0, 10).map((p, i) => (
                  <tr key={p.name} className="border-t border-line">
                    <td className="py-2.5 pr-3 pl-4 text-right tabular-nums text-muted">{i + 1}</td>
                    <td className="py-2.5"><div className="flex flex-col"><PlayerName name={p.name} className="font-semibold" /><span className="text-[11px] text-muted">{p.team}{p["100s"] ? ` · ${p["100s"]}×100` : ""}{p["50s"] ? ` · ${p["50s"]}×50` : ""}</span></div></td>
                    <td className={`${num} hidden text-soft sm:table-cell`}>{p.inns}</td>
                    <td className={`${num} hidden text-soft sm:table-cell`}>{p.avg ?? "–"}</td>
                    <td className={`${num} text-soft`}>{p.sr.toFixed(1)}</td>
                    <td className={`${num} hidden text-soft md:table-cell`}>{p.hs}</td>
                    <td className={`${num} pr-4 font-display text-lg font-bold ${i === 0 ? "text-[#ff9a52]" : ""}`}>{p.runs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><span className="h-3 w-3 rounded-full bg-[#a78bfa]" />Most wickets</h2>
          <div className="overflow-clip rounded-[18px] border border-line bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className={`${th} w-14 pr-3 text-right`}>#</th><th className={`${th} pl-0`}>Bowler</th>
                  <th className={`${th} hidden text-right sm:table-cell`}>Overs</th><th className={`${th} hidden text-right sm:table-cell`}>Avg</th>
                  <th className={`${th} text-right`}>Econ</th><th className={`${th} hidden text-right md:table-cell`}>Best</th><th className={`${th} pr-4 text-right`}>Wkts</th>
                </tr>
              </thead>
              <tbody>
                {s.topWickets.slice(0, 10).map((p, i) => (
                  <tr key={p.name} className="border-t border-line">
                    <td className="py-2.5 pr-3 pl-4 text-right tabular-nums text-muted">{i + 1}</td>
                    <td className="py-2.5"><div className="flex flex-col"><PlayerName name={p.name} className="font-semibold" /><span className="text-[11px] text-muted">{p.team} · {p.dot}% dot balls</span></div></td>
                    <td className={`${num} hidden text-soft sm:table-cell`}>{p.overs}</td>
                    <td className={`${num} hidden text-soft sm:table-cell`}>{p.avg ?? "–"}</td>
                    <td className={`${num} text-soft`}>{p.econ.toFixed(2)}</td>
                    <td className={`${num} hidden text-soft md:table-cell`}>{p.best}</td>
                    <td className={`${num} pr-4 font-display text-lg font-bold ${i === 0 ? "text-[#a78bfa]" : ""}`}>{p.wkts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {mvp.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold">Most valuable players</h2>
            <Link href="/ipl/insights" className="text-sm text-lime hover:underline">How impact works →</Link>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {mvp.slice(0, 5).map((p, i) => (
              <li key={p.name} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                <span className="font-display text-2xl font-bold text-muted">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <PlayerName name={p.name} className="truncate font-semibold" />
                  <span className="text-[11px] text-muted">{p.team} · {p.m} matches</span>
                </div>
                <span className="font-display text-xl font-bold text-lime" title="Wins added, from ball-by-ball win probability">{impactText(p.impact)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Impact = wins added: how much each player moved his team&apos;s win chance, ball by ball, across the season.</p>
        </section>
      )}

      <details className="group rounded-[18px] border border-line bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-display text-2xl font-bold [&::-webkit-details-marker]:hidden">
          All {all.length} matches
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
        </summary>
        <ul className="grid gap-x-6 border-t border-line px-5 py-2 md:grid-cols-2">
          {[...all].reverse().map((r) => (
            <li key={r.id} className="border-b border-line last:border-b-0 md:[&:nth-last-child(2)]:border-b-0">
              <Link href={`/ipl/match/${r.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-lime">
                <span className="w-14 shrink-0 text-xs text-muted">{fmtDate(r.date)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {r.scores.length === 2
                    ? <><span className={r.winner === r.scores[0].team ? "font-semibold" : "text-soft"}>{r.scores[0].team} {r.scores[0].runs}/{r.scores[0].wickets}</span> <span className="text-muted">v</span> <span className={r.winner === r.scores[1].team ? "font-semibold" : "text-soft"}>{r.scores[1].team} {r.scores[1].runs}/{r.scores[1].wickets}</span></>
                    : <span className="text-soft">{r.teams.join(" v ")}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{r.stage !== "League" ? r.stage : r.winner ? `${r.winner} won` : "No result"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-xs leading-relaxed text-muted">
        Built from {ipl.balls.toLocaleString("en-IN")} balls across {ipl.matches.toLocaleString("en-IN")} IPL matches (2008–{ipl.latest}). Ball-by-ball data from Cricsheet. Stats include playoffs; the points table covers the league stage. Super overs are not counted in player stats.
      </p>
    </main>
  );
}
