import { getScorers, type Scorer } from "@/lib/football";

function Leaderboard({ title, players, stat, unit }: { title: string; players: Scorer[]; stat: (p: Scorer) => number; unit: string }) {
  const max = Math.max(...players.map(stat), 1);
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-card p-5">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <ol className="flex flex-col gap-3">
        {players.map((p, i) => (
          <li key={`${p.name}-${p.tla}`} className="flex items-center gap-3">
            <span className={`w-5 text-right text-sm font-semibold ${i === 0 ? "text-lime" : "text-muted"}`}>{i + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{p.name} <span className="font-normal text-muted">· {p.team}</span></span>
                <span className="shrink-0 font-display text-xl font-bold leading-none">{stat(p)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1e2632]">
                <div className={`h-full rounded-full ${i === 0 ? "bg-lime" : "bg-[#5b6573]"}`} style={{ width: `${(stat(p) / max) * 100}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">{unit}</p>
    </section>
  );
}

export default async function StatsPage() {
  const scorers = await getScorers();

  if (!scorers?.length) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-5 pt-8 pb-10 md:px-8 md:pt-12">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">Player Stats</h1>
        <p className="text-soft">Player stats need live data. Add your football-data.org key to <code className="text-lime">.env.local</code> and restart the server.</p>
      </main>
    );
  }

  const top = (f: (p: Scorer) => number) => [...scorers].sort((a, b) => f(b) - f(a) || a.played - b.played).filter((p) => f(p) > 0).slice(0, 10);
  const goals = top((p) => p.goals);
  const assists = top((p) => p.assists);
  const contributions = top((p) => p.goals + p.assists);
  const leader = contributions[0];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">Player Stats</h1>
        <p className="text-sm text-soft md:text-base">This season&apos;s top goalscorers and creators in the Premier League.</p>
      </div>

      {leader && (
        <section className="flex flex-col gap-4 rounded-[20px] border border-lime/40 bg-lime/5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wider text-lime">MOST GOAL CONTRIBUTIONS</span>
            <span className="font-display text-4xl font-bold leading-none">{leader.name}</span>
            <span className="text-sm text-soft">{leader.team}{leader.position ? ` · ${leader.position}` : ""}{leader.nationality ? ` · ${leader.nationality}` : ""}</span>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center">
            {[["Goals", leader.goals], ["Assists", leader.assists], ["Games", leader.played]].map(([l, v]) => (
              <div key={l as string}>
                <p className="font-display text-4xl font-bold leading-none text-lime">{v}</p>
                <p className="text-xs text-muted">{l}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Leaderboard title="Top scorers" players={goals} stat={(p) => p.goals} unit="Goals this season" />
        <Leaderboard title="Most assists" players={assists} stat={(p) => p.assists} unit="Assists, among the league's top 50 scorers" />
        <Leaderboard title="Goals + assists" players={contributions} stat={(p) => p.goals + p.assists} unit="Total goal contributions" />
      </div>
    </main>
  );
}
