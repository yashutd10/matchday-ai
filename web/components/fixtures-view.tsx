import { LiveDataError } from "@/components/live-data-error";
import Link from "next/link";
import { getSeasonFixtures, type SeasonGameweek, type SeasonMatch } from "@/lib/football";
import { Icon } from "@/components/nav";
import { FavBadge } from "@/components/fixtures-client";
import { getGoalsByMatch, type Goal } from "@/lib/match-report";

type Goals = Record<string, { home: Goal[]; away: Goal[] }>;
const goalText = (gs: Goal[]) => gs.map((g) => `${g.name}${g.count > 1 ? ` ×${g.count}` : ""}${g.ownGoal ? " (OG)" : ""}`).join(", ");

function Verdict({ m }: { m: SeasonMatch }) {
  const p = m.prediction;
  if (!p) return null;
  if (m.state !== "finished") {
    return (
      <span className="text-[11px] text-muted">
        AI predicts <span className="font-semibold text-soft">{p.score[0]}–{p.score[1]}</span> · H {p.probs.home}% D {p.probs.draw}% A {p.probs.away}%
      </span>
    );
  }
  const tone = p.exact ? "bg-lime text-pitch" : p.correct ? "bg-[#1f6b46] text-ink" : "bg-[#8a2e2e] text-ink";
  const label = p.exact ? "Exact score" : p.correct ? "Right result" : "Wrong";
  return (
    <span className="flex items-center gap-2 text-[11px] text-muted">
      <span className={`rounded-full px-2 py-0.5 font-semibold ${tone}`}>{label}</span>
      AI predicted {p.score[0]}–{p.score[1]}
    </span>
  );
}

function MatchCard({ m, goals }: { m: SeasonMatch; goals?: { home: Goal[]; away: Goal[] } }) {
  const done = m.state === "finished" || m.state === "live";
  const rows = [
    { t: m.home, g: m.score?.[0], scorers: m.state === "finished" ? goals?.home : undefined },
    { t: m.away, g: m.score?.[1], scorers: m.state === "finished" ? goals?.away : undefined },
  ];
  const win = m.score ? (m.score[0] > m.score[1] ? 0 : m.score[1] > m.score[0] ? 1 : -1) : -1;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>{m.state === "postponed" ? "Date to be confirmed" : `${m.time} IST`}</span>
        <FavBadge tlas={[m.home.tla, m.away.tla]} />
        {m.state === "live" && <span className="flex items-center gap-1.5 font-semibold text-[#ff6b6b]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff6b6b]" />LIVE</span>}
        {m.state === "finished" && <span>FT</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={r.t.tla} className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e2632] font-display text-[11px] font-bold">{r.t.tla}</span>
            <span className={`min-w-0 flex-1 text-[15px] leading-tight ${done && win === i ? "font-bold" : done && win !== -1 ? "text-soft" : "font-semibold"}`}>{r.t.name}</span>
            {done && <span className="w-6 text-right font-display text-[22px] font-bold leading-none">{r.g ?? "–"}</span>}
          </div>
          {r.scorers && r.scorers.length > 0 && <p className="truncate pl-[38px] pr-8 text-[11px] text-muted">{goalText(r.scorers)}</p>}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
        <Verdict m={m} />
        {m.hasPreview && <span className="shrink-0 text-[11px] font-semibold text-lime">Preview →</span>}
        {m.state === "finished" && <span className="shrink-0 text-[11px] font-semibold text-lime">Report →</span>}
      </div>
    </>
  );

  const cls = "flex h-full flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5";
  const href = m.hasPreview ? `/match/${m.id}` : m.state === "finished" ? `/result/${m.id}` : null;
  return href ? (
    // No prefetch: ten result cards on screen would otherwise load ten reports at once.
    <Link href={href} prefetch={false} className={`${cls} transition hover:-translate-y-0.5 hover:border-[#3a4656]`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const arrowCls = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-soft transition hover:text-ink";

export function FixturesView({ weeks, week, current, goals }: { weeks: Pick<SeasonGameweek, "number" | "state">[]; week: SeasonGameweek; current: number; goals?: Goals }) {
  const idx = weeks.findIndex((g) => g.number === week.number);
  const prev = weeks[idx - 1], next = weeks[idx + 1];
  const finished = week.matches.filter((m) => m.state === "finished");
  const called = finished.filter((m) => m.prediction?.correct).length;
  const dated = week.matches.filter((m) => m.state !== "postponed");
  const dateRange = dated.length
    ? dated[0].date === dated[dated.length - 1].date ? dated[0].date : `${dated[0].date} – ${dated[dated.length - 1].date}`
    : "Dates to be confirmed";
  const playedWeeks = weeks.filter((g) => g.state === "finished").length;
  const byDate = week.matches.reduce<Record<string, SeasonMatch[]>>((acc, m) => {
    (acc[m.state === "postponed" ? "Postponed" : m.date] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-16 z-10 -mx-5 flex flex-col gap-2 border-b border-line bg-pitch/95 px-5 py-3 backdrop-blur md:top-[72px] md:-mx-8 md:px-8">
        <nav className="flex items-center gap-2 md:gap-3" aria-label="Gameweeks">
          {prev ? <Link href={`/fixtures/${prev.number}`} aria-label={`Gameweek ${prev.number}`} className={arrowCls}><Icon d="M15 18l-6-6 6-6" /></Link> : <span className={`${arrowCls} opacity-40`} aria-hidden="true"><Icon d="M15 18l-6-6 6-6" /></span>}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="font-display text-2xl font-bold leading-none md:text-3xl">Gameweek {week.number}</h2>
              <span className={`text-xs font-semibold ${week.state === "current" ? "text-[#ff8a8a]" : week.state === "finished" ? "text-muted" : "text-lime"}`}>
                {week.state === "finished" ? "Full time" : week.state === "current" ? "In progress" : "Upcoming"}
              </span>
            </div>
            <span className="truncate text-xs text-muted">{dateRange}</span>
          </div>

          {finished.length > 0 && (
            <div className="hidden shrink-0 text-right sm:block">
              <p className="text-[11px] text-muted">AI called</p>
              <p className="font-display text-xl font-bold leading-none"><span className="text-lime">{called}</span>/{finished.length}</p>
            </div>
          )}

          <details key={week.number} className="group relative shrink-0">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-line bg-card px-3 text-sm font-semibold text-soft transition hover:text-ink [&::-webkit-details-marker]:hidden">
              <span className="hidden sm:inline">All gameweeks</span><span className="sm:hidden">GW</span>
              <span className="transition group-open:rotate-180" aria-hidden="true">▾</span>
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-line bg-card p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
                <span>Pick a gameweek</span>
                {week.number !== current && <Link href="/fixtures" className="font-semibold text-lime hover:underline">This week →</Link>}
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {weeks.map((g) => {
                  const active = g.number === week.number;
                  return (
                    <Link
                      key={g.number}
                      href={`/fixtures/${g.number}`}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition ${active ? "bg-lime text-pitch" : g.state === "finished" ? "bg-[#1e2632] text-soft hover:text-ink" : "border border-line text-muted hover:text-ink"} ${g.number === current && !active ? "ring-1 ring-lime/60" : ""}`}
                    >
                      {g.number}
                    </Link>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-3 text-[10px] text-muted">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#1e2632]" />Played</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-line" />To play</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm ring-1 ring-lime/60" />This week</span>
              </div>
            </div>
          </details>

          {next ? <Link href={`/fixtures/${next.number}`} aria-label={`Gameweek ${next.number}`} className={arrowCls}><Icon d="M9 18l6-6-6-6" /></Link> : <span className={`${arrowCls} opacity-40`} aria-hidden="true"><Icon d="M9 18l6-6-6-6" /></span>}
        </nav>

        <div className="flex items-center gap-2" aria-label={`${playedWeeks} of ${weeks.length} gameweeks played`}>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#1e2632]">
            <div className="h-full rounded-full bg-lime/70" style={{ width: `${(playedWeeks / Math.max(weeks.length, 1)) * 100}%` }} />
          </div>
          <span className="shrink-0 text-[10px] text-muted">{playedWeeks} of {weeks.length} played</span>
        </div>
      </div>

      {Object.entries(byDate).map(([date, ms]) => (
        <section key={date} className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">{date}</h3>
          <ul className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {ms.map((m) => <li key={m.id}><MatchCard m={m} goals={goals?.[`${m.home.tla}-${m.away.tla}`]} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function FixturesShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">Fixtures &amp; Results</h1>
        <p className="text-sm text-soft md:text-base">Every gameweek this season. Results show what the AI predicted before kickoff; upcoming matches show its current call. Times in IST.</p>
      </div>
      {children}
    </main>
  );
}

export async function FixturesFor({ gw }: { gw?: number }) {
  const data = await getSeasonFixtures();
  if (!data) return <LiveDataError what="Fixtures" />;
  const week = data.gameweeks.find((g) => g.number === (gw ?? data.current));
  if (!week) return <p className="text-soft">There&apos;s no gameweek {gw} this season.</p>;
  // Scorers come from the FPL feed; if it's down, the cards just show scores.
  const all = week.matches.some((m) => m.state === "finished") ? await getGoalsByMatch() : null;
  const goals: Goals | undefined = all
    ? Object.fromEntries(week.matches.flatMap((m) => { const g = all.get(`${m.home.tla}-${m.away.tla}`); return g ? [[`${m.home.tla}-${m.away.tla}`, g]] : []; }))
    : undefined;
  return <FixturesView weeks={data.gameweeks.map(({ number, state }) => ({ number, state }))} week={week} current={data.current} goals={goals} />;
}

