import Link from "next/link";
import { getSeasonFixtures, type SeasonGameweek, type SeasonMatch } from "@/lib/football";
import { Icon } from "@/components/nav";
import { FavBadge, ScrollActiveIntoView } from "@/components/fixtures-client";

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

function MatchCard({ m }: { m: SeasonMatch }) {
  const done = m.state === "finished" || m.state === "live";
  const rows = [{ t: m.home, g: m.score?.[0] }, { t: m.away, g: m.score?.[1] }];
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
          <div key={r.t.tla} className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e2632] font-display text-[11px] font-bold">{r.t.tla}</span>
            <span className={`min-w-0 flex-1 text-[15px] leading-tight ${done && win === i ? "font-bold" : done && win !== -1 ? "text-soft" : "font-semibold"}`}>{r.t.name}</span>
            {done && <span className="w-6 text-right font-display text-[22px] font-bold leading-none">{r.g ?? "–"}</span>}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
        <Verdict m={m} />
        {m.hasPreview && <span className="shrink-0 text-[11px] font-semibold text-lime">Preview →</span>}
      </div>
    </>
  );

  const cls = "flex h-full flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5";
  return m.hasPreview ? (
    <Link href={`/match/${m.id}`} className={`${cls} transition hover:-translate-y-0.5 hover:border-[#3a4656]`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const arrowCls = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-soft transition hover:text-ink";

export function FixturesView({ weeks, week, current }: { weeks: Pick<SeasonGameweek, "number" | "state">[]; week: SeasonGameweek; current: number }) {
  const idx = weeks.findIndex((g) => g.number === week.number);
  const prev = weeks[idx - 1], next = weeks[idx + 1];
  const finished = week.matches.filter((m) => m.state === "finished");
  const called = finished.filter((m) => m.prediction?.correct).length;
  const byDate = week.matches.reduce<Record<string, SeasonMatch[]>>((acc, m) => {
    (acc[m.state === "postponed" ? "Postponed" : m.date] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex items-center gap-2" aria-label="Gameweeks">
        {prev ? <Link href={`/fixtures/${prev.number}`} aria-label="Previous gameweek" className={arrowCls}><Icon d="M15 18l-6-6 6-6" /></Link> : <span className={`${arrowCls} opacity-40`} aria-hidden="true"><Icon d="M15 18l-6-6 6-6" /></span>}
        <div id="gw-strip" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)] md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none]">
          {weeks.map((g) => {
            const active = g.number === week.number;
            return (
              <Link
                key={g.number}
                href={`/fixtures/${g.number}`}
                aria-current={active ? "page" : undefined}
                data-active={active || undefined}
                className={`flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-lime text-pitch" : g.state === "finished" ? "bg-card text-soft hover:text-ink" : "border border-line text-muted hover:text-ink"} ${g.number === current && !active ? "ring-1 ring-lime/60" : ""}`}
              >
                {g.number}
              </Link>
            );
          })}
        </div>
        {next ? <Link href={`/fixtures/${next.number}`} aria-label="Next gameweek" className={arrowCls}><Icon d="M9 18l6-6-6-6" /></Link> : <span className={`${arrowCls} opacity-40`} aria-hidden="true"><Icon d="M9 18l6-6-6-6" /></span>}
      </nav>
      <ScrollActiveIntoView containerId="gw-strip" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold leading-none md:text-4xl">Gameweek {week.number}</h2>
          <p className="mt-1 text-sm text-muted">
            {week.state === "finished" ? "Full time" : week.state === "current" ? "In progress" : "Upcoming"}
            {week.number !== current && <Link href="/fixtures" className="ml-3 text-lime hover:underline">Jump to this week</Link>}
          </p>
        </div>
        {finished.length > 0 && (
          <div className="rounded-2xl border border-line bg-card px-4 py-2.5 text-right">
            <p className="text-[11px] text-muted">AI called</p>
            <p className="font-display text-2xl font-bold leading-none"><span className="text-lime">{called}</span> / {finished.length}</p>
          </div>
        )}
      </div>

      {Object.entries(byDate).map(([date, ms]) => (
        <section key={date} className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">{date}</h3>
          <ul className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {ms.map((m) => <li key={m.id}><MatchCard m={m} /></li>)}
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
  if (!data) return <p className="text-soft">Fixtures need live data. Add your football-data.org key to <code className="text-lime">.env.local</code> and restart the server.</p>;
  const week = data.gameweeks.find((g) => g.number === (gw ?? data.current));
  if (!week) return <p className="text-soft">There&apos;s no gameweek {gw} this season.</p>;
  return <FixturesView weeks={data.gameweeks.map(({ number, state }) => ({ number, state }))} week={week} current={data.current} />;
}

