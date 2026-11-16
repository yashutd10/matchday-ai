import type { Metadata } from "next";
import { IplPredictor } from "@/components/ipl-predictor";
import { card, main, PageHeader } from "@/components/ipl-ui";
import { ipl, winModel } from "@/lib/ipl";

export const metadata: Metadata = { title: "IPL win predictor" };

export default function IplPredictorPage() {
  const m = winModel, ev = m.evaluation;
  const model = { first: m.first, chase: m.chase, era: m.era[String(m.latest)], parRuns: m.parRuns, parWkts: m.parWkts };
  return (
    <main className={main}>
      <PageHeader title="Win predictor" intro={`Enter any match situation and see each side's chance of winning, learned from every ball of ${ipl.matches.toLocaleString("en-IN")} IPL matches.`} />
      <IplPredictor model={model} season={m.latest} />

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
        <section className={`${card} flex flex-col gap-3 p-5 text-sm leading-relaxed text-soft`}>
          <h2 className="font-display text-2xl font-bold text-ink">How it works</h2>
          <p><b className="text-ink">Chasing:</b> it compares the runs still needed with what a typical innings of this era scores from that many balls, and weighs that against wickets in hand. The fewer balls left, the less room there is for luck to close a gap.</p>
          <p><b className="text-ink">Batting first:</b> it compares the score and wickets with a typical first innings at the same point.</p>
          <p>“This era” matters: a required rate of 10 was a tall order in 2010 and is routine now. The model adjusts for each season&apos;s scoring rate, so it stays fair across 19 seasons.</p>
          <p>Its weakest spot is the last over: when 10 to 14 are needed, it has been a few points too generous to the chasing side.</p>
          <p>It knows the score, not the players. It can&apos;t tell that the set batter is a finisher, or that the best death bowler still has two overs left.</p>
        </section>

        <section className={`${card} flex flex-col gap-3 p-5`}>
          <h2 className="font-display text-2xl font-bold">How accurate is it?</h2>
          <p className="text-sm leading-relaxed text-soft">Tested on {ev.testSeasons.join(" and ")}, seasons it had never seen ({ev.balls.toLocaleString("en-IN")} balls). It favoured the eventual winner on <b className="text-ink">{ev.accuracy}%</b> of balls. When it says a number, how often does that happen?</p>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted"><th className="py-2 text-left font-normal">Model said</th><th className="py-2 text-left font-normal">Actually won</th><th className="py-2 text-right font-normal">Balls</th></tr></thead>
            <tbody>
              {ev.calibration.map((c) => (
                <tr key={c.said} className="border-t border-line">
                  <td className="py-2 font-semibold">{c.said}%</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#1e2632] sm:w-40"><div className="h-full bg-lime" style={{ width: `${c.happened}%` }} /></div>
                      <span className={Math.abs(c.happened - c.said) > 7 ? "text-[#f5c451]" : ""}>{c.happened}%</span>
                    </div>
                  </td>
                  <td className="py-2 text-right text-muted">{c.n.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs leading-relaxed text-muted">The two columns should match, and mostly do. Rows in yellow are where it was more than 7 points out. Brier score {ev.brier} (0.25 is a coin flip, 0 is perfect).</p>
        </section>
      </div>
    </main>
  );
}
