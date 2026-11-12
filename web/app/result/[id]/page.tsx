import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeasonFixtures, type SeasonMatch } from "@/lib/football";
import { getMatchReport, type MatchReport, type ReportPlayer, type ReportSide } from "@/lib/match-report";
import { teamHref } from "@/components/table-tabs";
import { playerHref } from "@/components/players-ui";
import { LiveDataError } from "@/components/live-data-error";

type Params = Promise<{ id: string }>;

async function findMatch(id: string): Promise<{ m: SeasonMatch; gw: number } | null | undefined> {
  const season = await getSeasonFixtures();
  if (!season) return null;
  for (const g of season.gameweeks) {
    const m = g.matches.find((x) => String(x.id) === id);
    if (m) return { m, gw: g.number };
  }
  return undefined;
}

export async function generateStaticParams() {
  // Build every finished match's report at deploy time, so opening one never waits on football-data.org.
  // Results that come in after a deploy are made on first visit, then saved.
  const season = await getSeasonFixtures();
  const done = season?.gameweeks.flatMap((g) => g.matches).filter((m) => m.state === "finished") ?? [];
  return done.length ? done.map((m) => ({ id: String(m.id) })) : [{ id: "0" }];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const found = await findMatch(id);
  if (!found) return { title: "Match report" };
  const { m } = found;
  return { title: `${m.home.name} ${m.score?.[0] ?? ""}–${m.score?.[1] ?? ""} ${m.away.name}` };
}

export default function ResultPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-5 md:gap-6 md:p-10">
      <Suspense fallback={<Skeleton />}>
        <Report params={params} />
      </Suspense>
    </main>
  );
}

function Skeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-label="Loading match report">
      <div className="h-11 w-11 rounded-xl bg-card" />
      <div className="h-40 rounded-[18px] bg-card" />
      <div className="h-24 rounded-[18px] bg-card" />
      <div className="h-72 rounded-[18px] bg-card" />
    </div>
  );
}

/* ---------- pieces ---------- */

const Ball = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0">
    <circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 4.5h-5L8 10z" />
  </svg>
);
const Card = ({ red }: { red?: boolean }) => (
  <span aria-label={red ? "Red card" : "Yellow card"} className={`inline-block h-3 w-2 rounded-[2px] ${red ? "bg-[#ff5c5c]" : "bg-[#ffd23f]"}`} />
);

function Scorers({ side, align }: { side: ReportSide; align: "left" | "right" }) {
  if (!side.goals.length) return <div />;
  return (
    <ul className={`flex flex-col gap-1 text-xs text-soft ${align === "right" ? "items-end text-right" : "items-start"}`}>
      {side.goals.map((g) => (
        <li key={g.name + g.ownGoal} className="flex items-center gap-1.5">
          <Ball />
          <span>
            {g.name}{g.count > 1 && ` ×${g.count}`}{g.ownGoal && <span className="text-muted"> (OG)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatRow({ label, h, a, digits = 0, lowerIsBetter }: { label: string; h: number; a: number; digits?: number; lowerIsBetter?: boolean }) {
  const total = h + a;
  const hw = total ? (h / total) * 100 : 50;
  const better = h === a ? 0 : (h > a) !== !!lowerIsBetter ? -1 : 1; // -1 home better, 1 away better
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={`w-12 font-semibold ${better === -1 ? "text-ink" : "text-soft"}`}>{h.toFixed(digits)}</span>
        <span className="text-xs text-muted">{label}</span>
        <span className={`w-12 text-right font-semibold ${better === 1 ? "text-ink" : "text-soft"}`}>{a.toFixed(digits)}</span>
      </div>
      <div className="flex h-1.5 gap-1">
        <div className={`rounded-full ${better === -1 ? "bg-home" : "bg-home/40"}`} style={{ width: `${hw}%` }} />
        <div className={`rounded-full ${better === 1 ? "bg-away" : "bg-away/40"}`} style={{ width: `${100 - hw}%` }} />
      </div>
    </div>
  );
}

function PlayerRow({ p }: { p: ReportPlayer }) {
  return (
    <li className="flex items-center gap-2.5 border-t border-line py-2 first:border-t-0">
      <span className="w-8 shrink-0 text-[10px] font-semibold text-muted">{p.pos}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link href={playerHref(p.id)} className="truncate text-sm font-semibold hover:text-lime">{p.name}</Link>
          {Array.from({ length: p.goals }, (_, i) => <span key={`g${i}`} className="text-lime"><Ball /></span>)}
          {p.yellow > 0 && <Card />}
          {p.red > 0 && <Card red />}
        </div>
        <span className="truncate text-[11px] text-muted">
          {[
            p.minutes ? `${p.minutes}'` : null,
            p.assists ? `${p.assists} assist${p.assists > 1 ? "s" : ""}` : null,
            p.ownGoals ? "own goal" : null,
            p.saves ? `${p.saves} saves` : null,
            p.xg !== null && p.xg >= 0.1 ? `xG ${p.xg.toFixed(2)}` : null,
            p.xa !== null && p.xa >= 0.1 ? `xA ${p.xa.toFixed(2)}` : null,
            p.tackles + p.cbi >= 4 ? `${p.tackles + p.cbi} def. actions` : null,
          ].filter(Boolean).join(" · ")}
        </span>
      </div>
      {p.points !== null && (
        <span title="Fantasy Premier League points" className={`flex h-7 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 font-display text-sm font-bold ${p.points >= 9 ? "bg-lime text-pitch" : p.points >= 5 ? "bg-[#1f6b46]" : "bg-[#1e2632] text-soft"}`}>
          {p.points}
        </span>
      )}
    </li>
  );
}

function Lineup({ name, side, color }: { name: string; side: ReportSide; color: string }) {
  return (
    <section className="flex min-w-0 flex-col rounded-[18px] border border-line bg-card p-4">
      <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{name}
      </h3>
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Starting XI</p>
      <ul>{side.starters.map((p) => <PlayerRow key={p.id} p={p} />)}</ul>
      {side.subs.length > 0 && (
        <>
          <p className="mt-3 text-[11px] font-semibold tracking-wider text-muted uppercase">Came on</p>
          <ul>{side.subs.map((p) => <PlayerRow key={p.id} p={p} />)}</ul>
        </>
      )}
    </section>
  );
}

/* ---------- page ---------- */

async function Report({ params }: { params: Params }) {
  const { id } = await params;
  const found = await findMatch(id);
  if (found === null) return <LiveDataError what="Match reports" />;
  if (!found) notFound();
  const { m, gw } = found;
  if (m.state !== "finished" || !m.score) notFound();

  const r: MatchReport | null = await getMatchReport(m.home.tla, m.away.tla);
  const p = m.prediction;
  const verdict = p ? (p.exact ? ["Exact score", "bg-lime text-pitch"] : p.correct ? ["Right result", "bg-[#1f6b46] text-ink"] : ["Wrong call", "bg-[#8a2e2e] text-ink"]) : null;

  return (
    <>
      <header className="flex items-center justify-between">
        <Link href={`/fixtures/${gw}`} aria-label={`Back to gameweek ${gw}`} className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-soft">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></svg>
        </Link>
        <span className="text-sm text-muted">Gameweek {gw} · {m.date}</span>
        <div className="w-11" />
      </header>

      {/* Scoreboard */}
      <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-card p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Link href={teamHref(m.home.tla)} className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#4c8dff] bg-[#1e2632] font-display text-lg font-bold">{m.home.tla}</span>
            <span className="text-sm font-semibold hover:text-lime">{m.home.name}</span>
          </Link>
          <div className="flex flex-col items-center gap-1">
            <span className="whitespace-nowrap font-display text-6xl font-bold leading-none md:text-7xl">{m.score[0]} – {m.score[1]}</span>
            <span className="text-[11px] font-semibold tracking-wider text-muted">FULL TIME</span>
          </div>
          <Link href={teamHref(m.away.tla)} className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#ff9a52] bg-[#1e2632] font-display text-lg font-bold">{m.away.tla}</span>
            <span className="text-sm font-semibold hover:text-lime">{m.away.name}</span>
          </Link>
        </div>
        {r && (r.home.goals.length > 0 || r.away.goals.length > 0) && (
          <div className="grid grid-cols-2 gap-6 border-t border-line pt-3">
            <Scorers side={r.home} align="left" />
            <Scorers side={r.away} align="right" />
          </div>
        )}
        {p && verdict && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line pt-3 text-xs text-muted">
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${verdict[1]}`}>{verdict[0]}</span>
            AI predicted {p.score[0]}–{p.score[1]} · H {p.probs.home}% D {p.probs.draw}% A {p.probs.away}%
          </div>
        )}
      </section>

      {!r ? (
        <p className="rounded-[18px] border border-line bg-card p-5 text-sm text-soft">
          Scorers, lineups and player stats come from the Fantasy Premier League feed, which hasn&apos;t got this match yet or couldn&apos;t be reached. They usually appear within an hour of full time. Try again shortly.
        </p>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {r.potm && (
              <section className="flex flex-col gap-3 rounded-[18px] border border-lime/40 bg-card p-5">
                <p className="text-[11px] font-semibold tracking-wider text-lime">PLAYER OF THE MATCH</p>
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={playerHref(r.potm.id)} className="font-display text-3xl font-bold leading-none hover:text-lime">{r.potm.name}</Link>
                  <span className="text-xs text-muted">{r.potm.tla} · {r.potm.pos}</span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {([
                    ["Goals", r.potm.goals], ["Assists", r.potm.assists], ["Saves", r.potm.saves],
                    ["xG", r.potm.xg], ["Def. actions", r.potm.tackles + r.potm.cbi], ["Minutes", r.potm.minutes || null],
                  ] as const).filter(([, v]) => v).map(([l, v]) => (
                    <div key={l} className="flex flex-col">
                      <span className="text-[11px] text-muted">{l}</span>
                      <span className="font-display text-xl font-bold leading-none">{typeof v === "number" && !Number.isInteger(v) ? v.toFixed(2) : v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted">Top rated by FPL&apos;s Bonus Points System, which scores every action in the match.</p>
              </section>
            )}

            <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-card p-5">
              <h2 className="font-display text-xl font-bold">Team stats</h2>
              {r.home.totals.xg !== null && r.away.totals.xg !== null && <StatRow label="Expected goals (xG)" h={r.home.totals.xg} a={r.away.totals.xg} digits={2} />}
              <StatRow label="Goalkeeper saves" h={r.home.totals.saves} a={r.away.totals.saves} />
              {r.hasLineups && <StatRow label="Tackles" h={r.home.totals.tackles} a={r.away.totals.tackles} />}
              {r.hasLineups && <StatRow label="Clearances, blocks & interceptions" h={r.home.totals.cbi} a={r.away.totals.cbi} />}
              {r.hasLineups && <StatRow label="Ball recoveries" h={r.home.totals.recoveries} a={r.away.totals.recoveries} />}
              <StatRow label="Yellow cards" h={r.home.totals.yellow} a={r.away.totals.yellow} lowerIsBetter />
              {r.home.totals.red + r.away.totals.red > 0 && <StatRow label="Red cards" h={r.home.totals.red} a={r.away.totals.red} lowerIsBetter />}
            </section>
          </div>

          {r.hasLineups && (
            <div className="grid gap-5 md:grid-cols-2">
              <Lineup name={m.home.name} side={r.home} color="#4c8dff" />
              <Lineup name={m.away.name} side={r.away} color="#ff9a52" />
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted">
            Player data from the Fantasy Premier League. The number on the right of each player is his FPL points for this match.
            Possession, shots and goal times aren&apos;t in any free data feed, so they&apos;re not shown.
          </p>
        </>
      )}
    </>
  );
}
