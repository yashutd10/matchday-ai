import { getAccuracy } from "@/lib/football";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export default async function AccuracyPage() {
  const acc = await getAccuracy();

  if (!acc || !acc.total) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-5 pt-8 pb-10 md:px-8 md:pt-12">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">Accuracy</h1>
        <p className="text-soft">Accuracy needs live data. Add your football-data.org key to <code className="text-lime">.env.local</code> and restart the server.</p>
      </main>
    );
  }

  const v2 = pct(acc.v2.correct, acc.total);
  const v1 = pct(acc.v1.correct, acc.total);
  const base = pct(acc.homeBaseline, acc.total);
  const diff = v2 - base;

  const cards = [
    { label: "Results called right", value: `${v2}%`, note: `${acc.v2.correct} of ${acc.total} matches` },
    { label: "Exact scores", value: `${pct(acc.v2.exact, acc.total)}%`, note: `${acc.v2.exact} spot on` },
    {
      label: "vs “always back home”",
      value: `${diff > 0 ? "+" : ""}${diff} pts`,
      note: diff > 0 ? `Beats the ${base}% baseline` : `Baseline is ${base}%, not beaten yet`,
    },
  ];

  const rows = [
    { name: "New model (v2)", acc: v2, exact: pct(acc.v2.exact, acc.total), brier: acc.v2.brier.toFixed(3), highlight: true },
    { name: "Old model (v1)", acc: v1, exact: pct(acc.v1.exact, acc.total), brier: acc.v1.brier.toFixed(3) },
    { name: "Always back home", acc: base, exact: null, brier: null },
    { name: "Random guess", acc: 33, exact: null, brier: "0.667" },
  ];

  const maxPerGw = Math.max(...acc.gameweeks.map((g) => g.total), 1);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">Accuracy</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-soft md:text-base">
          The model replays the season. Before each gameweek it only sees earlier results, predicts the round, then gets checked against what actually happened.
          {acc.usedLastSeason ? " It also starts from last season's results." : " Last season's results weren't available, so it starts from scratch."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-5">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="font-display text-5xl font-bold leading-none text-lime">{c.value}</p>
            <p className="text-xs text-soft">{c.note}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-card p-5">
        <h2 className="font-display text-2xl font-bold">Model comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 font-normal">Model</th>
                <th className="py-2 font-normal">Results right</th>
                <th className="py-2 font-normal">Exact scores</th>
                <th className="py-2 font-normal">Brier score <span className="text-[#8a94a3]">(lower is better)</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-line">
                  <td className={`py-3 font-semibold ${r.highlight ? "text-lime" : ""}`}>{r.name}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-[#1e2632]">
                        <div className={r.highlight ? "h-full bg-lime" : "h-full bg-[#5b6573]"} style={{ width: `${r.acc}%` }} />
                      </div>
                      <span className="font-semibold">{r.acc}%</span>
                    </div>
                  </td>
                  <td className="py-3 text-soft">{r.exact === null ? "–" : `${r.exact}%`}</td>
                  <td className="py-3 text-soft">{r.brier ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-relaxed text-muted">Brier score checks the probabilities, not just the pick: a model that said 70% and was right scores better than one that said 40% and was right.</p>
      </section>

      <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Correct results by gameweek</h2>
          <div className="flex items-center gap-4 text-xs text-soft">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-lime" /> New model</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#5b6573]" /> Old model</span>
          </div>
        </div>
        <div className="flex h-48 items-end gap-3" role="img" aria-label={`Correct predictions per gameweek, new vs old model: ${acc.gameweeks.map((g) => `GW${g.number} ${g.v2} vs ${g.v1} of ${g.total}`).join(", ")}`}>
          {acc.gameweeks.map((g) => (
            <div key={g.number} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-end justify-center gap-1">
                {[{ v: g.v2, cls: "bg-lime", t: "text-soft" }, { v: g.v1, cls: "bg-[#5b6573]", t: "text-muted" }].map((b, i) => (
                  <div key={i} className="flex w-full max-w-6 flex-col items-center gap-1">
                    <span className={`text-[11px] font-semibold ${b.t}`}>{b.v}</span>
                    <div className={`w-full rounded-t-md ${b.cls}`} style={{ height: `${Math.max(4, (b.v / maxPerGw) * 130)}px` }} />
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-muted">GW{g.number}</span>
            </div>
          ))}
        </div>
      </section>

      {acc.latest && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">Gameweek {acc.latest.number}: predicted vs actual</h2>
          <ul className="grid gap-2.5 lg:grid-cols-2">
            {acc.latest.predictions.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${p.exact ? "bg-lime text-pitch" : p.correct ? "bg-[#1f6b46]" : "bg-[#8a2e2e]"}`} aria-label={p.exact ? "Exact score" : p.correct ? "Correct result" : "Wrong"}>
                  {p.exact ? "★" : p.correct ? "✓" : "✗"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.home} <span className="font-normal text-muted">vs</span> {p.away}</span>
                <div className="flex shrink-0 gap-4 text-right">
                  <div><p className="text-[11px] text-muted">Predicted</p><p className="font-display text-lg font-bold leading-none">{p.predicted[0]}–{p.predicted[1]}</p></div>
                  <div><p className="text-[11px] text-muted">Actual</p><p className="font-display text-lg font-bold leading-none">{p.actual[0]}–{p.actual[1]}</p></div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
