import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { card, main, Rating, TeamBadge } from "@/components/ipl-ui";
import { fmtDate, ipl, PHASE_LABEL, PHASE_OVERS, players, results, seasons, teamCodes, teamName, teamPhase, type Phase } from "@/lib/ipl";

type Params = Promise<{ code: string }>;

export function generateStaticParams() {
  return teamCodes.map((c) => ({ code: c.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const code = (await params).code.toUpperCase();
  return { title: teamCodes.includes(code) ? `${teamName(code)} · IPL` : "IPL team" };
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;

async function IplTeamPageBody({ params }: { params: Params }) {
  const code = (await params).code.toUpperCase();
  if (!teamCodes.includes(code)) notFound();

  const history = seasons.flatMap((s) => {
    const pos = s.table.findIndex((r) => r.team === code);
    if (pos < 0) return [];
    const inPlayoffs = s.playoffs.some((p) => p.teams.includes(code));
    const finish = s.champion === code ? "Champions" : s.runnerUp === code ? "Runners-up" : inPlayoffs ? "Playoffs" : "League stage";
    return [{ season: s.season, pos: pos + 1, of: s.table.length, row: s.table[pos], finish }];
  });
  if (!history.length) notFound();
  const lastSeason = history[history.length - 1].season;
  const titles = history.filter((h) => h.finish === "Champions").map((h) => h.season);
  const finals = history.filter((h) => h.finish === "Champions" || h.finish === "Runners-up").length;
  const playoffs = history.filter((h) => h.finish !== "League stage").length;
  const wins = history.reduce((n, h) => n + h.row.w, 0), played = history.reduce((n, h) => n + h.row.p - h.row.nr, 0);
  const phase = teamPhase[String(lastSeason)]?.[code];
  const nTeams = Object.keys(teamPhase[String(lastSeason)] ?? {}).length;
  const squad = players.filter((p) => p.team === code && p.last === lastSeason);
  const best = (p: (typeof squad)[number]) => Math.max(p.rating.bat.all ?? -1, p.rating.bowl.all ?? -1);
  const stars = squad.filter((p) => best(p) >= 0).sort((a, b) => best(b) - best(a)).slice(0, 8);
  const recent = (results[String(lastSeason)] ?? []).filter((r) => r.teams.includes(code)).slice(-8).reverse();
  const tone = (rank: number) => (rank <= 3 ? "text-lime" : rank > nTeams - 3 ? "text-[#ff8a8a]" : "text-soft");
  const defunct = lastSeason !== ipl.latest;

  return (
    <main className={main}>
      <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-card p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <TeamBadge code={code} size="lg" />
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-4xl font-bold leading-none md:text-5xl">{teamName(code)}</h1>
            <span className="text-sm text-soft">{history[0].season}–{defunct ? lastSeason : "present"} · {history.length} season{history.length > 1 ? "s" : ""}{defunct ? " · no longer in the IPL" : ""}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          {[["Titles", titles.length], ["Finals", finals], ["Playoffs", playoffs], ["League win %", played ? `${Math.round((wins / played) * 100)}%` : "–"]].map(([l, v]) => (
            <div key={l} className="flex flex-col"><span className="text-[11px] text-muted">{l}</span><span className={`font-display text-3xl font-bold leading-none ${l === "Titles" && titles.length ? "text-lime" : ""}`}>{v}</span></div>
          ))}
        </div>
      </section>
      {titles.length > 0 && <p className="text-sm text-soft">Champions in <b className="text-ink">{titles.join(", ")}</b>.</p>}

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {phase && (
          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="font-display text-2xl font-bold">Strengths by phase, {lastSeason}</h2>
            <div className={`${card} overflow-clip`}>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-muted"><th className="py-3 pl-4 text-left font-normal">Phase</th><th className="py-3 text-right font-normal">Batting run rate</th><th className="py-3 pr-4 text-right font-normal">Bowling economy</th></tr></thead>
                <tbody>
                  {(["pp", "mid", "death"] as Exclude<Phase, "all">[]).map((ph) => (
                    <tr key={ph} className="border-t border-line">
                      <td className="py-3 pl-4"><div className="flex flex-col"><span className="font-semibold">{PHASE_LABEL[ph]}</span><span className="text-[11px] text-muted">{PHASE_OVERS[ph]}</span></div></td>
                      <td className="py-3 text-right"><span className="font-display text-xl font-bold">{phase[ph].batRR.toFixed(2)}</span> <span className={`text-xs font-semibold ${tone(phase[ph].batRRRank)}`}>{ordinal(phase[ph].batRRRank)}</span></td>
                      <td className="py-3 pr-4 text-right"><span className="font-display text-xl font-bold">{phase[ph].bowlEcon.toFixed(2)}</span> <span className={`text-xs font-semibold ${tone(phase[ph].bowlEconRank)}`}>{ordinal(phase[ph].bowlEconRank)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">Ranks are among the {nTeams} teams that season. Green = top three, red = bottom three. For bowling, lower economy is better.</p>
          </section>
        )}

        {stars.length > 0 && (
          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="font-display text-2xl font-bold">Best-rated players</h2>
            <ul className={`${card} overflow-clip`}>
              {stars.map((p) => {
                const bat = (p.rating.bat.all ?? -1) >= (p.rating.bowl.all ?? -1);
                return (
                  <li key={p.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link href={`/ipl/player/${p.id}`} className="truncate font-semibold hover:text-lime hover:underline">{p.name}</Link>
                      <span className="truncate text-[11px] text-muted">{(bat ? p.type.bat : p.type.bowl) ?? (bat ? "Batter" : "Bowler")} · {bat ? `${p.recent.bat.all.runs} runs, SR ${p.recent.bat.all.sr.toFixed(0)}` : `${p.recent.bowl.all.wkts} wkts, econ ${p.recent.bowl.all.econ.toFixed(2)}`}</span>
                    </div>
                    <span className="text-[11px] text-muted">{bat ? "BAT" : "BOWL"}</span>
                    <Rating value={bat ? p.rating.bat.all : p.rating.bowl.all} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">Season by season</h2>
          <div className={`${card} overflow-clip`}>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted"><th className="py-3 pl-4 text-left font-normal">Season</th><th className="py-3 text-left font-normal">Finish</th><th className="py-3 text-right font-normal">Table</th><th className="py-3 text-right font-normal">W–L</th><th className="py-3 pr-4 text-right font-normal">Pts</th></tr></thead>
              <tbody>
                {[...history].reverse().map((h) => (
                  <tr key={h.season} className="border-t border-line">
                    <td className="py-2.5 pl-4"><Link href={h.season === ipl.latest ? "/ipl" : `/ipl/${h.season}`} className="font-semibold hover:text-lime">{h.season}</Link></td>
                    <td className={`py-2.5 ${h.finish === "Champions" ? "font-semibold text-lime" : h.finish === "League stage" ? "text-muted" : "text-soft"}`}>{h.finish}</td>
                    <td className="py-2.5 text-right text-soft">{ordinal(h.pos)}</td>
                    <td className="py-2.5 text-right text-soft">{h.row.w}–{h.row.l}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold">{h.row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">Last matches, {lastSeason}</h2>
          <ul className="flex flex-col gap-2">
            {recent.map((r) => {
              const mine = r.scores.find((s) => s.team === code), theirs = r.scores.find((s) => s.team !== code);
              const opp = r.teams.find((t) => t !== code)!;
              const res = !r.winner ? "NR" : r.winner === code ? "W" : "L";
              return (
                <li key={r.id}>
                  <Link href={`/ipl/match/${r.id}`} className={`${card} flex items-center gap-3 px-4 py-3 transition hover:border-[#3a4656]`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${res === "W" ? "bg-[#1f6b46]" : res === "L" ? "bg-[#8a2e2e]" : "bg-[#1e2632] text-muted"}`}>{res}</span>
                    <div className="flex min-w-0 flex-1 flex-col"><span className="truncate text-sm font-semibold">v {teamName(opp)}</span><span className="text-[11px] text-muted">{fmtDate(r.date)}{r.stage !== "League" ? ` · ${r.stage}` : ""}</span></div>
                    <span className="shrink-0 text-right text-sm">{mine ? `${mine.runs}/${mine.wickets}` : "–"} <span className="text-muted">v {theirs ? `${theirs.runs}/${theirs.wickets}` : "–"}</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}

/** Loading placeholder; the page reads the URL, so it streams in under this. */
function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 animate-pulse flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12" aria-busy="true" aria-label="Loading">
      <div className="h-28 rounded-[20px] bg-card" />
      <div className="h-64 rounded-[18px] bg-card" />
      <div className="h-64 rounded-[18px] bg-card" />
    </main>
  );
}

export default function IplTeamPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Loading />}>
      <IplTeamPageBody params={params} />
    </Suspense>
  );
}
