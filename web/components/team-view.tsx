import Link from "next/link";
import type { TeamPage } from "@/lib/football";
import { teamHref } from "@/components/table-tabs";
import { FavouriteToggle } from "@/components/favourite";

const formBg = { W: "bg-[#1f6b46]", D: "bg-[#3a4350]", L: "bg-[#8a2e2e]" } as const;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const card = "flex flex-col gap-3 rounded-[18px] border border-line bg-card p-5";
const h2 = "font-display text-xl font-bold";

function Compare({ label, team, league, better }: { label: string; team: number; league: number; better: "higher" | "lower" }) {
  const max = Math.max(team, league, 0.1) * 1.15;
  const good = better === "higher" ? team >= league : team <= league;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-soft">{label}</span>
        <span><span className={`font-semibold ${good ? "text-[#5ad08f]" : "text-[#ff8a8a]"}`}>{team}</span> <span className="text-muted">vs avg {league}</span></span>
      </div>
      <div className="relative h-2 rounded-full bg-[#1e2632]">
        <div className="h-full rounded-full bg-home" style={{ width: `${(team / max) * 100}%` }} />
        <div className="absolute top-[-3px] h-[14px] w-0.5 bg-ink/70" style={{ left: `${(league / max) * 100}%` }} aria-hidden="true" />
      </div>
    </div>
  );
}

export function TeamView({ t }: { t: TeamPage }) {
  const r = t.row;
  const played = r?.played ?? 0;
  const form = t.results.slice(0, 5).reverse();
  const homeRec = r?.home.split(",")[0] ?? "";
  const awayRec = r?.away.split(",")[0] ?? "";
  const judged = t.results.filter((x) => x.ai);
  const aiRight = judged.filter((x) => x.ai!.correct).length;
  const next = t.upcoming[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-home bg-[#1e2632] font-display text-xl font-bold">{t.tla}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">{t.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {t.position ? `${ordinal(t.position)} · ` : ""}{r ? `${r.points} pts · ${played} played · W${r.won} D${r.drawn} L${r.lost}` : "No games yet"}
          </p>
        </div>
        <FavouriteToggle tla={t.tla} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className={card}>
          <h2 className={h2}>Form</h2>
          <div className="flex gap-1.5">
            {form.length ? form.map((x) => (
              <span key={x.id} title={`${x.home ? "vs" : "at"} ${x.opponent} ${x.gf}–${x.ga}`} className={`${formBg[x.result]} flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold`}>{x.result}</span>
            )) : <span className="text-sm text-muted">No results yet</span>}
          </div>
          <p className="text-sm text-muted">Home {homeRec} · Away {awayRec}</p>
        </section>

        <section className={`${card} ${next ? "border-lime/40" : ""}`}>
          <h2 className={h2}>Next match</h2>
          {next ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{next.home ? "vs" : "at"} <Link href={teamHref(next.opponentTla)} className="font-semibold hover:text-lime">{next.opponent}</Link> · {next.date}, {next.time}</span>
                <span className="font-display text-3xl font-bold leading-none text-lime">{next.predicted[0]}–{next.predicted[1]}</span>
              </div>
              <div className="flex h-2 gap-[3px] overflow-hidden rounded-full">
                <div className="bg-home" style={{ width: `${next.win}%` }} />
                <div className="bg-[#5b6573]" style={{ width: `${next.draw}%` }} />
                <div className="bg-away" style={{ width: `${next.loss}%` }} />
              </div>
              <p className="text-xs text-soft">Win {next.win}% · Draw {next.draw}% · Loss {next.loss}%</p>
              {next.hasPreview && <Link href={`/match/${next.id}`} className="text-sm font-semibold text-lime hover:underline">Read full preview →</Link>}
              {t.upcoming.length > 1 && (
                <p className="text-xs text-muted">Then: {t.upcoming.slice(1).map((u) => `${u.opponentTla} (${u.home ? "H" : "A"})`).join(", ")}</p>
              )}
            </>
          ) : <p className="text-sm text-muted">No upcoming fixtures.</p>}
        </section>

        <section className={card}>
          <h2 className={h2}>Predicted finish</h2>
          {t.sim ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-soft">Predicted points</span>
                <span className="font-display text-3xl font-bold leading-none">{t.sim.expPoints}</span>
              </div>
              {[
                { l: "Win the league", v: t.sim.title, c: "bg-lime" },
                { l: "Top 4", v: t.sim.top4, c: "bg-home" },
                { l: "Relegated", v: t.sim.relegation, c: "bg-[#e05a5a]" },
              ].map((o) => (
                <div key={o.l} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs"><span className="text-muted">{o.l}</span><span className="font-semibold">{o.v === 0 ? "0%" : o.v < 1 ? "<1%" : o.v > 99 && o.v < 100 ? ">99%" : `${Math.round(o.v)}%`}</span></div>
                  <div className="h-1.5 rounded-full bg-[#1e2632]"><div className={`h-full rounded-full ${o.c}`} style={{ width: `${o.v}%` }} /></div>
                </div>
              ))}
              <div className="flex h-10 items-end gap-[2px]" role="img" aria-label={`Chance of each finishing position, most likely ${ordinal(t.sim.dist.indexOf(Math.max(...t.sim.dist)) + 1)}`}>
                {t.sim.dist.map((d, i) => (
                  <div key={i} className={`flex-1 rounded-t-sm ${i === t.sim!.dist.indexOf(Math.max(...t.sim!.dist)) ? "bg-lime" : "bg-[#3a4656]"}`} style={{ height: `${Math.max(3, (d / Math.max(...t.sim!.dist)) * 100)}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted"><span>1st</span><span>Finishing position</span><span>{ordinal(t.teamsCount)}</span></div>
            </>
          ) : <p className="text-sm text-muted">Not available yet.</p>}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className={h2}>Compared with the league</h2>
          {r && played ? (
            <>
              <Compare label="Goals scored per game" team={Math.round((r.gf / played) * 10) / 10} league={t.league.gfPerGame} better="higher" />
              <Compare label="Goals conceded per game" team={Math.round((r.ga / played) * 10) / 10} league={t.league.gaPerGame} better="lower" />
              <Compare label="Points per game" team={Math.round((r.points / played) * 10) / 10} league={t.league.ppg} better="higher" />
            </>
          ) : <p className="text-sm text-muted">No games played yet.</p>}
        </section>

        <section className={card}>
          <h2 className={h2}>Top scorers</h2>
          {t.scorers.length ? (
            <ul className="flex flex-col gap-2.5">
              {t.scorers.map((s) => (
                <li key={s.name} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{s.name}{s.position ? <span className="font-normal text-muted"> · {s.position}</span> : null}</span>
                  <span className="text-soft">{s.goals} G · {s.assists} A</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No players in the league&apos;s top-50 scorers yet.</p>}
          <Link href="/stats" className="text-sm text-lime hover:underline">All player stats →</Link>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={h2}>Results</h2>
          {judged.length > 0 && <span className="text-sm text-muted">AI called {t.name} right <span className="font-semibold text-lime">{aiRight}</span> of {judged.length} times</span>}
        </div>
        {t.results.length ? (
          <ul className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {t.results.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                <span className={`${formBg[x.result]} flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold`}>{x.result}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{x.home ? "vs" : "at"} <Link href={teamHref(x.opponentTla)} className="font-semibold hover:text-lime">{x.opponent}</Link></span>
                  <span className="text-[11px] text-muted">{x.date}</span>
                </div>
                <span className="font-display text-xl font-bold">{x.gf}–{x.ga}</span>
                {x.ai && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${x.ai.exact ? "bg-lime text-pitch" : x.ai.correct ? "bg-[#1f6b46]" : "bg-[#8a2e2e]"}`}>{x.ai.exact ? "AI ★" : x.ai.correct ? "AI ✓" : "AI ✗"}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No results yet.</p>}
      </section>
    </div>
  );
}
