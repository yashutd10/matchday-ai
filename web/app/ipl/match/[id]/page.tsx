import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { card, PlayerName, TeamBadge, teamHref } from "@/components/ipl-ui";
import { fmtDate, getResult, impactText, ipl, results, teamColor, teamName } from "@/lib/ipl";
import { getMatchDetail, type MatchDetail } from "@/lib/ipl-matches";

type Params = Promise<{ id: string }>;

export function generateStaticParams() {
  // Build the latest season's matches ahead of time; older ones are made on first visit.
  return results[String(ipl.latest)].map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = getResult((await params).id);
  if (!found) return { title: "IPL match" };
  const r = found.result;
  return { title: `${r.teams[0]} v ${r.teams[1]} · IPL ${found.season}` };
}

function WinChart({ d, second }: { d: MatchDetail; second: string }) {
  const W = 640, H = 220, padL = 34, padR = 10, padT = 12, padB = 26;
  const pts = [d.start, ...d.curve.a, ...d.curve.b];
  const n1 = d.curve.a.length, total = Math.max(40, pts.length - 1);
  const x = (i: number) => padL + (i / total) * (W - padL - padR);
  const y = (v: number) => padT + ((100 - v) / 100) * (H - padT - padB);
  const path = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const turnIdx = d.turn ? (d.turn.inn === 1 ? d.turn.over : n1 + d.turn.over) : null;
  const c1 = teamColor(d.first), c2 = teamColor(second);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Win probability through the match for ${d.first}, over by over`}>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={v === 50 ? "#3a4656" : "#1e2632"} strokeDasharray={v === 50 ? "4 4" : undefined} />
          <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#9aa4b2">{v}%</text>
        </g>
      ))}
      {turnIdx !== null && <rect x={x(turnIdx - 1)} width={x(turnIdx) - x(turnIdx - 1)} y={padT} height={H - padT - padB} fill="#c6f432" opacity="0.16" />}
      <line x1={x(n1)} x2={x(n1)} y1={padT} y2={H - padB} stroke="#3a4656" strokeDasharray="2 4" />
      <text x={x(n1 / 2)} y={H - 8} textAnchor="middle" fontSize="11" fill="#9aa4b2">{d.first} batting</text>
      <text x={x(n1 + (total - n1) / 2)} y={H - 8} textAnchor="middle" fontSize="11" fill="#9aa4b2">{second} batting</text>
      <text x={W - padR} y={padT + 10} textAnchor="end" fontSize="11" fontWeight="700" fill={c1}>{d.first} winning ↑</text>
      <text x={W - padR} y={H - padB - 6} textAnchor="end" fontSize="11" fontWeight="700" fill={c2}>{second} winning ↓</text>
      <path d={path} fill="none" stroke="#f2f4f7" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="4.5" fill={pts[pts.length - 1] >= 50 ? c1 : c2} />
    </svg>
  );
}

async function Match({ params }: { params: Params }) {
  const { id } = await params;
  const found = getResult(id);
  if (!found) notFound();
  const { season, result: r } = found;
  const d = await getMatchDetail(season, id);
  const second = d ? (r.teams[0] === d.first ? r.teams[1] : r.teams[0]) : r.teams[1];
  const back = season === ipl.latest ? "/ipl" : `/ipl/${season}`;

  return (
    <>
      <header className="flex items-center justify-between">
        <Link href={back} aria-label={`Back to IPL ${season}`} className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-soft">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></svg>
        </Link>
        <span className="text-sm text-muted">IPL {season} · {r.stage !== "League" ? `${r.stage} · ` : ""}{fmtDate(r.date)}</span>
        <div className="w-11" />
      </header>

      <section className={`${card} flex flex-col gap-4 p-5`}>
        {r.scores.map((s) => (
          <div key={s.team} className="flex items-center gap-3">
            <TeamBadge code={s.team} />
            <Link href={teamHref(s.team)} className={`min-w-0 flex-1 truncate text-lg hover:text-lime ${r.winner === s.team ? "font-bold" : "text-soft"}`}>{teamName(s.team)}</Link>
            <span className="font-display text-4xl font-bold leading-none">{s.runs}/{s.wickets}</span>
            <span className="w-10 text-right text-xs text-muted">{s.overs} ov</span>
          </div>
        ))}
        <p className="border-t border-line pt-3 text-sm text-soft">
          {r.winner ? <><b className="text-ink">{teamName(r.winner)}</b> won{r.margin === "super over" ? " in a super over" : r.margin ? ` by ${r.margin}` : ""}{r.dls ? " (DLS method)" : ""}.</> : "No result."}
          {d && <> {d.venue}. {d.toss}.</>}
          {r.pom && <> Player of the match: <PlayerName name={r.pom} className="text-ink" />.</>}
        </p>
      </section>

      {d && d.curve.a.length > 0 && (
        <section className={`${card} flex flex-col gap-3 p-4 md:p-5`}>
          <h2 className="font-display text-2xl font-bold">How the match swung</h2>
          <WinChart d={d} second={second} />
          {d.turn && r.winner && (
            <div className="flex gap-3 rounded-xl bg-lime/10 p-3.5 text-sm leading-relaxed">
              <span className="mt-0.5 h-5 w-1.5 shrink-0 rounded-full bg-lime" />
              <p>
                <b>Turning point: over {d.turn.over} of {d.turn.bat}&apos;s innings.</b> {d.turn.runs} run{d.turn.runs === 1 ? "" : "s"}{d.turn.wkts ? ` and ${d.turn.wkts} wicket${d.turn.wkts > 1 ? "s" : ""}` : ""} off {d.turn.bowler}&apos;s over took {r.winner}&apos;s win chance from <b>{d.turn.from}%</b> to <b>{d.turn.to}%</b>, the biggest single-over swing their way.
              </p>
            </div>
          )}
          <p className="text-xs text-muted">The line is {d.first}&apos;s chance of winning after each over, from the win-probability model. <Link href="/ipl/predictor" className="text-lime hover:underline">How it works →</Link></p>
        </section>
      )}

      {d && (
        <div className="grid gap-5 md:grid-cols-2">
          {d.cards.map((c) => (
            <section key={c.team} className={`${card} flex min-w-0 flex-col gap-3 p-4 md:p-5`}>
              <h3 className="flex items-center gap-2.5 font-display text-xl font-bold"><TeamBadge code={c.team} size="sm" />{teamName(c.team)} <span className="ml-auto text-soft">{c.runs}/{c.wkts}</span></h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">Top scorers</span>
                  {c.bat.map((b) => <div key={b.name} className="flex justify-between gap-2"><PlayerName name={b.name} className="truncate" /><span className="shrink-0 font-semibold">{b.runs}{b.out ? "" : "*"} <span className="font-normal text-muted">({b.balls})</span></span></div>)}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">Best bowling</span>
                  {c.bowl.map((b) => <div key={b.name} className="flex justify-between gap-2"><PlayerName name={b.name} className="truncate" /><span className="shrink-0 font-semibold">{b.wkts}/{b.runs} <span className="font-normal text-muted">({b.overs})</span></span></div>)}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {d && d.stars.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">Biggest impact</h2>
          <ul className="grid gap-2.5 sm:grid-cols-3">
            {d.stars.map((s, i) => (
              <li key={s.name} className={`${card} flex items-center gap-3 px-4 py-3`}>
                <span className="font-display text-2xl font-bold text-muted">{i + 1}</span>
                <PlayerName name={s.name} className="min-w-0 flex-1 truncate font-semibold" />
                <span className="font-display text-xl font-bold text-lime">{impactText(s.impact)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Wins added in this match: how much each player&apos;s balls moved his side&apos;s win chance. +0.25 means he added 25 percentage points.</p>
        </section>
      )}
    </>
  );
}

export default function IplMatchPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-5 md:gap-6 md:p-10">
      <Suspense fallback={<div className="flex animate-pulse flex-col gap-5" aria-busy="true"><div className="h-11 w-11 rounded-xl bg-card" /><div className="h-40 rounded-[18px] bg-card" /><div className="h-64 rounded-[18px] bg-card" /></div>}>
        <Match params={params} />
      </Suspense>
    </main>
  );
}
