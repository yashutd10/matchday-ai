import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { card, main, PlayerName, Rating, TeamBadge, TeamLink } from "@/components/ipl-ui";
import { getPlayer, impactText, ipl, matchups, minPhaseBalls, overs, PHASE_LABEL, PHASE_OVERS, PHASES, players, ratingSeasons, teamName, type IplPlayer, type Kind } from "@/lib/ipl";

type Params = Promise<{ id: string }>;

export function generateStaticParams() {
  return players.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = getPlayer((await params).id);
  return { title: p ? `${p.name} · IPL ratings` : "IPL player" };
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="flex flex-col"><span className="text-[11px] text-muted">{label}</span><span className="font-display text-xl font-bold leading-tight">{value}</span></div>;
}

function PhaseTable({ p, kind }: { p: IplPlayer; kind: Kind }) {
  const th = "py-2.5 pl-2 text-right font-normal";
  const td = "py-2.5 pl-2 text-right";
  return (
    <section className={`${card} flex min-w-0 flex-col gap-3 p-4 md:p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-bold">{kind === "bat" ? "Batting" : "Bowling"} by phase</h2>
        {p.type[kind] && <span className="rounded-full border border-lime/40 px-2.5 py-1 text-xs font-semibold text-lime">{p.type[kind]}</span>}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PHASES.map((ph) => (
          <div key={ph} className="flex flex-col items-center gap-1.5 rounded-xl bg-[#10161d] px-1 py-3">
            <Rating value={p.rating[kind][ph]} size="lg" />
            <span className="text-xs font-semibold">{PHASE_LABEL[ph]}</span>
            <span className="text-[10px] text-muted">{PHASE_OVERS[ph]}</span>
          </div>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-2.5 text-left font-normal">Phase</th>
            {kind === "bat"
              ? <><th className={th}>Runs</th><th className={th}>Balls</th><th className={th}>SR</th><th className={th}>Avg</th><th className={`${th} hidden sm:table-cell`}>Dot %</th><th className={`${th} hidden sm:table-cell`}>4s/6s</th></>
              : <><th className={th}>Overs</th><th className={th}>Wkts</th><th className={th}>Econ</th><th className={th}>Avg</th><th className={`${th} hidden sm:table-cell`}>Balls/wkt</th><th className={`${th} hidden sm:table-cell`}>Dot %</th></>}
          </tr>
        </thead>
        <tbody>
          {PHASES.map((ph) => {
            const b = p.recent.bat[ph], w = p.recent.bowl[ph];
            return (
              <tr key={ph} className={`border-t border-line ${ph === "all" ? "font-semibold" : ""}`}>
                <td className="py-2.5 text-left">{PHASE_LABEL[ph]}</td>
                {kind === "bat"
                  ? <><td className={td}>{b.runs}</td><td className={`${td} text-soft`}>{b.balls}</td><td className={td}>{b.balls ? b.sr.toFixed(1) : "–"}</td><td className={`${td} text-soft`}>{b.avg ?? "–"}</td><td className={`${td} hidden text-soft sm:table-cell`}>{b.dot}%</td><td className={`${td} hidden text-soft sm:table-cell`}>{b.fours}/{b.sixes}</td></>
                  : <><td className={`${td} text-soft`}>{overs(w.balls)}</td><td className={td}>{w.wkts}</td><td className={td}>{w.balls ? w.econ.toFixed(2) : "–"}</td><td className={`${td} text-soft`}>{w.avg ?? "–"}</td><td className={`${td} hidden text-soft sm:table-cell`}>{w.sr ?? "–"}</td><td className={`${td} hidden text-soft sm:table-cell`}>{w.dot}%</td></>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default async function IplPlayerPage({ params }: { params: Params }) {
  const p = getPlayer((await params).id);
  if (!p) notFound();

  const asBat = Object.keys(p.rating.bat).length > 0 || p.recent.bat.all.balls >= 60;
  const asBowl = Object.keys(p.rating.bowl).length > 0 || p.recent.bowl.all.balls >= 60;
  const vsBowlers = matchups.filter((m) => m.bat === p.name && m.balls >= 18).sort((a, b) => b.balls - a.balls).slice(0, 6);
  const vsBatters = matchups.filter((m) => m.bowl === p.name && m.balls >= 18).sort((a, b) => b.balls - a.balls).slice(0, 6);
  const c = p.career;

  return (
    <main className={main}>
      <Link href="/ipl/players" className="w-fit text-sm text-lime hover:underline">← All player ratings</Link>

      <section className="flex flex-col gap-4 rounded-[20px] border border-lime/40 bg-lime/5 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <TeamBadge code={p.team} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-4xl font-bold leading-none md:text-5xl">{p.name}</h1>
            <span className="text-sm text-soft"><TeamLink code={p.team} full /> · IPL {p.first === p.last ? p.first : `${p.first}–${p.last}`} · {p.matches} matches{p.last !== ipl.latest && ` · last played ${p.last}`}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {c.bat.balls > 0 && <><Stat label="Career runs" value={c.bat.runs.toLocaleString("en-IN")} /><Stat label="Strike rate" value={c.bat.sr.toFixed(1)} /><Stat label="Highest" value={c.bat.hs} /></>}
          {c.bowl.wkts > 0 && <><Stat label="Career wickets" value={c.bowl.wkts} /><Stat label="Economy" value={c.bowl.econ.toFixed(2)} /></>}
          <div className="flex flex-col"><span className="text-[11px] text-muted">Impact {ratingSeasons[0]}–{String(ipl.latest).slice(2)}</span><span className={`font-display text-xl font-bold leading-tight ${p.impact > 0 ? "text-lime" : "text-[#ff8a8a]"}`}>{impactText(p.impact)} wins</span></div>
        </div>
      </section>

      <p className="text-sm text-muted">Ratings (0–99) and phase numbers use IPL {ratingSeasons[0]}–{ipl.latest}. “–” means fewer than {minPhaseBalls} balls in that phase.</p>

      <div className={`grid gap-5 ${asBat && asBowl ? "lg:grid-cols-2" : ""}`}>
        {asBat && <PhaseTable p={p} kind="bat" />}
        {asBowl && <PhaseTable p={p} kind="bowl" />}
      </div>

      {(vsBowlers.length > 0 || vsBatters.length > 0) && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold">Key matchups</h2>
            <Link href={`/ipl/matchups?p=${encodeURIComponent(p.name)}`} className="text-sm text-lime hover:underline">All {p.name}&apos;s matchups →</Link>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {(vsBowlers.length >= vsBatters.length ? vsBowlers : vsBatters).map((m) => {
              const other = m.bat === p.name ? m.bowl : m.bat;
              return (
                <li key={m.bat + m.bowl} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[11px] text-muted">{m.bat === p.name ? "vs bowler" : "vs batter"}</span>
                    <PlayerName name={other} className="truncate font-semibold" />
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="font-display text-xl font-bold leading-none">{m.runs} <span className="text-sm font-normal text-muted">off {m.balls}</span></span>
                    <span className="text-[11px] text-muted">out {m.outs}× · SR {(m.runs / m.balls * 100).toFixed(0)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">Season by season</h2>
        <div className={`${card} overflow-clip`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-3 pl-4 text-left font-normal">Season</th><th className="py-3 text-left font-normal">Team</th><th className="py-3 text-right font-normal">M</th>
                <th className="py-3 text-right font-normal">Runs</th><th className="hidden py-3 text-right font-normal sm:table-cell">SR</th>
                <th className="py-3 text-right font-normal">Wkts</th><th className="hidden py-3 text-right font-normal sm:table-cell">Econ</th>
                <th className="py-3 pr-4 text-right font-normal" title="Wins added">Impact</th>
              </tr>
            </thead>
            <tbody>
              {[...p.seasons].reverse().map((s) => (
                <tr key={s.y} className="border-t border-line">
                  <td className="py-2.5 pl-4"><Link href={s.y === ipl.latest ? "/ipl" : `/ipl/${s.y}`} className="font-semibold hover:text-lime">{s.y}</Link></td>
                  <td className="py-2.5 text-soft"><span title={teamName(s.team)}>{s.team}</span></td>
                  <td className="py-2.5 text-right text-soft">{s.m}</td>
                  <td className="py-2.5 text-right">{s.runs}</td>
                  <td className="hidden py-2.5 text-right text-soft sm:table-cell">{s.sr ?? "–"}</td>
                  <td className="py-2.5 text-right">{s.wkts}</td>
                  <td className="hidden py-2.5 text-right text-soft sm:table-cell">{s.econ ?? "–"}</td>
                  <td className={`py-2.5 pr-4 text-right ${s.impact > 0 ? "text-[#5ad08f]" : s.impact < 0 ? "text-[#ff8a8a]" : "text-muted"}`}>{impactText(s.impact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
