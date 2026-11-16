"use client";

import { useState } from "react";
import { chaseWin, firstInningsWin, type WinCoefs } from "@/lib/ipl-win";

const field = "h-12 w-full rounded-xl border border-line bg-pitch px-3 text-base font-semibold text-ink outline-none focus:border-lime/60";

/** "15.2" overs → 92 balls. The digit after the dot is balls (0–5), as on a scoreboard. */
function ballsOf(text: string) {
  const [o, b = "0"] = text.trim().split(".");
  const ov = Math.max(0, Math.min(20, Number(o) || 0)), balls = Math.max(0, Math.min(5, Number(b[0]) || 0));
  return Math.min(120, ov * 6 + (ov === 20 ? 0 : balls));
}

const scenarios = {
  chase: [
    { label: "48 off 24, 6 wickets left", v: { target: "190", score: "142", wkts: "4", overs: "16.0" } },
    { label: "12 off the last over", v: { target: "181", score: "169", wkts: "5", overs: "19.0" } },
    { label: "Chasing 220 from ball one", v: { target: "220", score: "0", wkts: "0", overs: "0.0" } },
    { label: "80 off 60, 3 down", v: { target: "175", score: "95", wkts: "3", overs: "10.0" } },
  ],
  first: [
    { label: "60/0 after the powerplay", v: { target: "", score: "60", wkts: "0", overs: "6.0" } },
    { label: "40/3 after the powerplay", v: { target: "", score: "40", wkts: "3", overs: "6.0" } },
    { label: "100/2 at halfway", v: { target: "", score: "100", wkts: "2", overs: "10.0" } },
    { label: "Finished on 200", v: { target: "", score: "200", wkts: "6", overs: "20.0" } },
  ],
};

export function IplPredictor({ model, season }: { model: WinCoefs; season: number }) {
  const [mode, setMode] = useState<"chase" | "first">("chase");
  const [f, setF] = useState(scenarios.chase[0].v);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const balls = ballsOf(f.overs), score = Math.max(0, Number(f.score) || 0), wkts = Math.max(0, Math.min(10, Number(f.wkts) || 0));
  const target = Math.max(1, Number(f.target) || 0), left = 120 - balls, need = target - score;
  const batting = mode === "chase" ? chaseWin(model, need, left, 10 - wkts) : wkts >= 10 ? firstInningsWin(model, 120, score, 10) : firstInningsWin(model, balls, score, wkts);
  const pct = Math.round(batting * 100);
  const par = model.parRuns[balls], parW = model.parWkts[balls];

  let line: string;
  if (mode === "chase") {
    line = need <= 0 ? "Target reached." : left <= 0 || wkts >= 10 ? "The chase is over." : `Need ${need} from ${left} ball${left === 1 ? "" : "s"} with ${10 - wkts} wicket${10 - wkts === 1 ? "" : "s"} in hand. Required rate ${(need / left * 6).toFixed(1)} an over; a typical ${season} innings scores at ${model.era.toFixed(1)}.`;
  } else {
    const diff = Math.round(score - par);
    line = balls === 0 ? `Before a ball is bowled, sides batting first win a little under half the time.` : `A typical ${season} first innings is ${Math.round(par)}/${Math.round(parW)} at this point, so this side is ${diff === 0 ? "level with" : `${Math.abs(diff)} run${Math.abs(diff) === 1 ? "" : "s"} ${diff > 0 ? "ahead of" : "behind"}`} the usual pace.`;
  }

  const tab = (m: "chase" | "first", label: string) => (
    <button type="button" onClick={() => { setMode(m); setF(scenarios[m][0].v); }} aria-pressed={mode === m} className={`flex h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${mode === m ? "bg-lime text-pitch" : "text-soft hover:text-ink"}`}>{label}</button>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
      <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-card p-4 md:p-5">
        <div className="flex gap-1 rounded-2xl border border-line bg-pitch p-1">{tab("chase", "Chasing")}{tab("first", "Batting first")}</div>
        <div className="grid grid-cols-2 gap-3">
          {mode === "chase" && <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">Target<input inputMode="numeric" value={f.target} onChange={set("target")} className={field} /></label>}
          <label className="flex flex-col gap-1 text-xs text-muted">Score<input inputMode="numeric" value={f.score} onChange={set("score")} className={field} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted">Wickets down<input inputMode="numeric" value={f.wkts} onChange={set("wkts")} className={field} /></label>
          <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">Overs bowled (e.g. 15.2)<input inputMode="decimal" value={f.overs} onChange={set("overs")} className={field} /></label>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">Try a situation</span>
          <div className="flex flex-wrap gap-2">
            {scenarios[mode].map((s) => <button key={s.label} type="button" onClick={() => setF(s.v)} className="rounded-full border border-line px-3 py-1.5 text-xs text-soft transition hover:border-lime/50 hover:text-ink">{s.label}</button>)}
          </div>
        </div>
      </section>

      <section className="flex flex-col justify-center gap-5 rounded-[18px] border border-lime/40 bg-lime/5 p-5 md:p-7" aria-live="polite">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wider text-lime">{mode === "chase" ? "CHASING SIDE" : "SIDE BATTING FIRST"}</span>
            <span className="font-display text-7xl font-bold leading-none md:text-8xl">{pct}%</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-semibold tracking-wider text-muted">{mode === "chase" ? "DEFENDING SIDE" : "CHASING SIDE"}</span>
            <span className="font-display text-4xl font-bold leading-none text-soft md:text-5xl">{100 - pct}%</span>
          </div>
        </div>
        <div className="flex h-3 gap-1 overflow-hidden rounded-full">
          <div className="rounded-full bg-lime transition-all duration-300" style={{ width: `${Math.max(pct, 1)}%` }} />
          <div className="flex-1 rounded-full bg-[#3a4656]" />
        </div>
        <p className="text-sm leading-relaxed text-soft">{line}</p>
      </section>
    </div>
  );
}
