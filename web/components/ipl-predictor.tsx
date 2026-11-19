"use client";

import { useState } from "react";
import { chaseWin, firstInningsWin, type WinCoefs } from "@/lib/ipl-win";

type Strength = { batRR: number; bowlEcon: number; batRRRank: number; bowlEconRank: number };
export type PredictorTeam = { code: string; name: string; color: string; phase: Record<"pp" | "mid" | "death", Strength>; chase: { won: number; n: number }; defend: { won: number; n: number } };
const PHASES = [["pp", "Powerplay", "overs 1–6", 36], ["mid", "Middle overs", "overs 7–15", 90], ["death", "Death overs", "overs 16–20", 120]] as const;
const pctOf = (r: { won: number; n: number }) => (r.n ? Math.round((r.won / r.n) * 100) : null);
const nth = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

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

export function IplPredictor({ model, season, teams = [], games = [], recent = [] }: { model: WinCoefs; season: number; teams?: PredictorTeam[]; games?: [number, string, string, string][]; recent?: number[] }) {
  const [mode, setMode] = useState<"chase" | "first">("chase");
  const [firstT, setFirstT] = useState(""), [secondT, setSecondT] = useState("");
  const team = (c: string) => teams.find((t) => t.code === c);
  const pickTeam = (which: "first" | "second") => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (which === "first") { if (v && v === secondT) setSecondT(firstT); setFirstT(v); } else { if (v && v === firstT) setFirstT(secondT); setSecondT(v); }
  };
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

  const leftT = team(mode === "chase" ? secondT : firstT), rightT = team(mode === "chase" ? firstT : secondT);
  const batT = team(mode === "chase" ? secondT : firstT), bowlT = team(mode === "chase" ? firstT : secondT);
  const A = team(firstT), B = team(secondT);
  const meet = A && B ? games.filter(([, x, y]) => (x === A.code && y === B.code) || (x === B.code && y === A.code)) : [];
  const h2h = (g: typeof games) => ({ a: g.filter((x) => x[3] === A?.code).length, b: g.filter((x) => x[3] === B?.code).length });
  const allTime = h2h(meet), lately = h2h(meet.filter(([y]) => recent.includes(y)));
  const startAt = mode === "chase" || balls < 120 ? Math.min(balls, 119) : 120;
  const ahead = PHASES.filter(([, , , end]) => end > startAt);
  const span = recent.length ? `${recent[0]}–${String(recent[recent.length - 1]).slice(2)}` : "";
  const sel = "h-11 w-full rounded-xl border border-line bg-pitch px-3 text-sm font-semibold text-ink outline-none focus:border-lime/60";

  const tab = (m: "chase" | "first", label: string) => (
    <button type="button" onClick={() => { setMode(m); setF(scenarios[m][0].v); }} aria-pressed={mode === m} className={`flex h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${mode === m ? "bg-lime text-pitch" : "text-soft hover:text-ink"}`}>{label}</button>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
      <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-card p-4 md:p-5">
        <div className="flex gap-1 rounded-2xl border border-line bg-pitch p-1">{tab("chase", "Chasing")}{tab("first", "Batting first")}</div>
        {teams.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">Batted first
              <select value={firstT} onChange={pickTeam("first")} className={sel}><option value="">Any team</option>{teams.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">Chasing
              <select value={secondT} onChange={pickTeam("second")} className={sel}><option value="">Any team</option>{teams.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}</select>
            </label>
          </div>
        )}
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
            <span className="text-xs font-semibold tracking-wider text-lime">{(mode === "chase" ? team(secondT)?.name : team(firstT)?.name)?.toUpperCase() ?? (mode === "chase" ? "CHASING SIDE" : "SIDE BATTING FIRST")}</span>
            <span className="font-display text-7xl font-bold leading-none md:text-8xl">{pct}%</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-semibold tracking-wider text-muted">{(mode === "chase" ? team(firstT)?.name : team(secondT)?.name)?.toUpperCase() ?? (mode === "chase" ? "DEFENDING SIDE" : "CHASING SIDE")}</span>
            <span className="font-display text-4xl font-bold leading-none text-soft md:text-5xl">{100 - pct}%</span>
          </div>
        </div>
        <div className="flex h-3 gap-1 overflow-hidden rounded-full">
          <div className="rounded-full bg-lime transition-all duration-300" style={{ width: `${Math.max(pct, 1)}%`, ...(leftT ? { background: leftT.color } : {}) }} />
          <div className="flex-1 rounded-full bg-[#3a4656]" style={rightT ? { background: rightT.color, opacity: 0.55 } : undefined} />
        </div>
        <p className="text-sm leading-relaxed text-soft">{line}</p>
        {(A || B) && (
          <p className="rounded-xl border border-line bg-pitch/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
            <b className="text-soft">Same for any two teams.</b> We tested adding team form, the playing XI and the venue: each made predictions slightly worse. Once a match is under way, the score says far more than the names. <a href="#why-teams" className="text-lime hover:underline">See why ↓</a>
          </p>
        )}
      </section>

      {(A || B) && (
        <section className="flex flex-col gap-5 rounded-[18px] border border-line bg-card p-5 md:p-6 lg:col-span-2">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-2xl font-bold">Team context</h2>
            <p className="text-xs text-muted">Background on the sides. It doesn&apos;t move the percentage: on paper, the stronger IPL team wins only about half the time (see below).</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {A && B && (
              <div className="flex flex-col gap-2 rounded-xl bg-[#10161d] p-4">
                <span className="text-[11px] font-semibold tracking-wider text-muted">HEAD TO HEAD</span>
                {meet.length ? (
                  <>
                    <p className="text-sm text-soft"><b className="text-ink">{A.code}</b> {allTime.a} – {allTime.b} <b className="text-ink">{B.code}</b> <span className="text-muted">all time ({meet.length} results)</span></p>
                    <p className="text-sm text-soft"><b className="text-ink">{A.code}</b> {lately.a} – {lately.b} <b className="text-ink">{B.code}</b> <span className="text-muted">in {span}</span></p>
                    <p className="text-xs text-muted">Last meeting: {meet[meet.length - 1][0]}, won by {meet[meet.length - 1][3]}.</p>
                  </>
                ) : <p className="text-sm text-soft">They haven&apos;t met in a completed match.</p>}
              </div>
            )}
            {(B || A) && (
              <div className="flex flex-col gap-2 rounded-xl bg-[#10161d] p-4">
                <span className="text-[11px] font-semibold tracking-wider text-muted">CHASING AND DEFENDING, {span}</span>
                {B && <p className="text-sm text-soft"><b className="text-ink">{B.name}</b> won {B.chase.won} of {B.chase.n} chases{pctOf(B.chase) !== null && <> ({pctOf(B.chase)}%)</>}.</p>}
                {A && <p className="text-sm text-soft"><b className="text-ink">{A.name}</b> defended {A.defend.won} of {A.defend.n} totals{pctOf(A.defend) !== null && <> ({pctOf(A.defend)}%)</>}.</p>}
              </div>
            )}
            {(batT || bowlT) && ahead.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl bg-[#10161d] p-4">
                <span className="text-[11px] font-semibold tracking-wider text-muted">OVERS STILL TO COME, {season} FORM</span>
                {ahead.map(([k, label, ov]) => (
                  <div key={k} className="flex flex-col gap-0.5 border-t border-line pt-2 first-of-type:border-t-0 first-of-type:pt-0">
                    <span className="text-xs font-semibold text-ink">{label} <span className="font-normal text-muted">({ov})</span></span>
                    {batT && <span className="text-sm text-soft">{batT.code} batting: {batT.phase[k].batRR.toFixed(1)} an over, <b className="text-ink">{nth(batT.phase[k].batRRRank)}</b> of {teams.length}</span>}
                    {bowlT && <span className="text-sm text-soft">{bowlT.code} bowling: {bowlT.phase[k].bowlEcon.toFixed(1)} an over, <b className="text-ink">{nth(bowlT.phase[k].bowlEconRank)}</b> of {teams.length}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
