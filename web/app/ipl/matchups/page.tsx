import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { IplSearch, type SearchItem } from "@/components/ipl-search";
import { card, main, PageHeader, PlayerName } from "@/components/ipl-ui";
import { matchups, minMatchupBalls, players, type Matchup } from "@/lib/ipl";

export const metadata: Metadata = { title: "IPL matchups" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const href = (name: string) => `/ipl/matchups?p=${encodeURIComponent(name)}`;
const sr = (m: Matchup) => (m.runs / m.balls) * 100;

/** Who has the upper hand? Only called once there are enough balls to say. */
function verdict(m: Matchup): { text: string; tone: string } | null {
  if (m.balls < 18) return null;
  if (m.outs >= 3 && m.runs / m.outs < 16) return { text: "Bowler on top", tone: "bg-[#8a2e2e] text-ink" };
  if (sr(m) >= 160 && m.balls / Math.max(m.outs, 1) >= 18) return { text: "Batter on top", tone: "bg-lime text-pitch" };
  return null;
}

function Table({ rows, who }: { rows: Matchup[]; who: "bowl" | "bat" }) {
  const th = "py-3 pl-2 text-right font-normal";
  return (
    <div className={`${card} overflow-clip`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-3 pl-4 text-left font-normal">{who === "bowl" ? "Bowler" : "Batter"}</th>
            <th className={th}>Runs</th><th className={th}>Balls</th><th className={th}>Out</th><th className={th}>SR</th>
            <th className={`${th} hidden sm:table-cell`}>Avg</th><th className={`${th} hidden sm:table-cell`}>Dot %</th><th className={`${th} hidden pr-4 md:table-cell`}>4s/6s</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const other = who === "bowl" ? m.bowl : m.bat;
            const v = verdict(m);
            return (
              <tr key={m.bat + m.bowl} className="border-t border-line">
                <td className="py-2.5 pl-4">
                  <div className="flex flex-col items-start gap-0.5">
                    <Link href={href(other)} className="font-semibold hover:text-lime hover:underline">{other}</Link>
                    {v ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${v.tone}`}>{v.text}</span> : <span className="text-[11px] text-muted">last met {m.last}</span>}
                  </div>
                </td>
                <td className="py-2.5 pl-2 text-right font-display text-lg font-bold">{m.runs}</td>
                <td className="py-2.5 pl-2 text-right text-soft">{m.balls}</td>
                <td className="py-2.5 pl-2 text-right">{m.outs}</td>
                <td className="py-2.5 pl-2 text-right pr-0 sm:pr-0">{sr(m).toFixed(0)}</td>
                <td className="hidden py-2.5 pl-2 text-right text-soft sm:table-cell">{m.outs ? (m.runs / m.outs).toFixed(1) : "–"}</td>
                <td className="hidden py-2.5 pl-2 text-right text-soft sm:table-cell">{Math.round((m.dots / m.balls) * 100)}%</td>
                <td className="hidden py-2.5 pr-4 pl-2 text-right text-soft md:table-cell">{m.fours}/{m.sixes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.p) ? sp.p[0] : sp.p;
  const name = (raw ?? "").trim();

  const teamOf = new Map(players.map((p) => [p.name, p.team]));
  const names = new Set<string>();
  for (const m of matchups) { names.add(m.bat); names.add(m.bowl); }
  const items: SearchItem[] = [...names].sort().map((n) => ({ label: n, sub: teamOf.get(n) ?? "", href: href(n) }));

  const asBat = matchups.filter((m) => m.bat === name).sort((a, b) => b.balls - a.balls);
  const asBowl = matchups.filter((m) => m.bowl === name).sort((a, b) => b.balls - a.balls);
  const found = asBat.length + asBowl.length > 0;
  const classics = [...matchups].sort((a, b) => b.balls - a.balls).slice(0, 12);

  return (
    <>
      <IplSearch key={name} items={items} placeholder="Type a player, e.g. Kohli or Bumrah" defaultValue={name} />

      {name && !found && <p className={`${card} p-5 text-soft`}>No matchups found for “{name}”. Pick a name from the suggestions as you type.</p>}

      {found ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-3xl font-bold"><PlayerName name={name} /></h2>
            <Link href="/ipl/matchups" className="text-sm text-lime hover:underline">Clear</Link>
          </div>
          {asBat.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Batting against · {asBat.length} bowlers</h3>
              <Table rows={asBat.slice(0, 40)} who="bowl" />
            </section>
          )}
          {asBowl.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Bowling to · {asBowl.length} batters</h3>
              <Table rows={asBowl.slice(0, 40)} who="bat" />
            </section>
          )}
        </>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">The most-played duels in IPL history</h2>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {classics.map((m) => (
              <li key={m.bat + m.bowl} className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Link href={href(m.bat)} className="truncate font-semibold hover:text-lime">{m.bat}</Link>
                  <span className="shrink-0 text-xs text-muted">v</span>
                  <Link href={href(m.bowl)} className="truncate text-right font-semibold hover:text-lime">{m.bowl}</Link>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-2">
                  <span className="font-display text-2xl font-bold leading-none">{m.runs} <span className="text-sm font-normal text-muted">off {m.balls}</span></span>
                  <span className="text-xs text-muted">out {m.outs}× · SR {sr(m).toFixed(0)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted">Head-to-heads with at least {minMatchupBalls} balls, across every IPL season. Wickets count only when the bowler dismissed that batter (not run-outs).</p>
    </>
  );
}

export default function IplMatchups({ searchParams }: { searchParams: SP }) {
  return (
    <main className={main}>
      <PageHeader title="Matchups" intro="Batter against bowler, head to head: runs, balls and dismissals from every ball they've faced each other in the IPL." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[18px] bg-card" aria-busy="true" aria-label="Loading matchups" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
