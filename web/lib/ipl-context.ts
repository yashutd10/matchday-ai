import { insights, ipl, PHASE_LABEL, players, ratingSeasons, seasons, teamName, teamPhase, type Kind, type Phase } from "@/lib/ipl";

/** The facts Ask AI is given for IPL questions. Kept compact: it is sent with every question. */
export function buildIplContext() {
  const L: string[] = [];
  const latest = seasons[seasons.length - 1];

  L.push("ALL SEASONS (season | champions | runners-up | most runs | most wickets | avg first-innings score | chasing side won %)");
  for (const s of seasons) {
    const t = insights.toss.find((x) => x.season === s.season);
    L.push(`${s.season} | ${s.champion ? teamName(s.champion) : "-"} | ${s.runnerUp ? teamName(s.runnerUp) : "-"} | ${s.topRuns[0]?.name} ${s.topRuns[0]?.runs} | ${s.topWickets[0]?.name} ${s.topWickets[0]?.wkts} | ${t?.avgFirst ?? "-"} | ${t?.chaseWinPct ?? "-"}`);
  }
  const titles = new Map<string, number[]>();
  for (const s of seasons) if (s.champion) titles.set(s.champion, [...(titles.get(s.champion) ?? []), s.season]);
  L.push("", "TITLES: " + [...titles].sort((a, b) => b[1].length - a[1].length).map(([c, ys]) => `${teamName(c)} ${ys.length} (${ys.join(", ")})`).join("; "));

  L.push("", `IPL ${latest.season} POINTS TABLE (pos. team | P W L NR | Pts | NRR)`);
  latest.table.forEach((r, i) => L.push(`${i + 1}. ${teamName(r.team)} (${r.team}) | ${r.p} ${r.w} ${r.l} ${r.nr} | ${r.pts} | ${r.nrr}`));
  L.push("", `IPL ${latest.season} PLAYOFFS`);
  for (const p of latest.playoffs) L.push(`${p.stage}: ${p.scores.map((s) => `${s.team} ${s.runs}/${s.wickets} (${s.overs})`).join(" v ")}; ${p.winner} won by ${p.margin}; player of the match ${p.pom}`);
  L.push("", `IPL ${latest.season} MOST RUNS (name | team | inns | runs | avg | SR | HS | 6s)`);
  for (const p of latest.topRuns.slice(0, 12)) L.push(`${p.name} | ${p.team} | ${p.inns} | ${p.runs} | ${p.avg} | ${p.sr} | ${p.hs} | ${p["6s"]}`);
  L.push("", `IPL ${latest.season} MOST WICKETS (name | team | wkts | econ | avg | best)`);
  for (const p of latest.topWickets.slice(0, 12)) L.push(`${p.name} | ${p.team} | ${p.wkts} | ${p.econ} | ${p.avg} | ${p.best}`);
  L.push("", `IPL ${latest.season} MOST VALUABLE (impact = wins added from ball-by-ball win probability): ` + (insights.mvp[String(latest.season)] ?? []).map((p) => `${p.name} (${p.team}) +${(p.impact / 100).toFixed(2)}`).join(", "));

  const span = `${ratingSeasons[0]}-${ipl.latest}`;
  L.push("", `PLAYER RATINGS ${span} (0-99 percentile within phase; powerplay = overs 1-6, middle = 7-15, death = 16-20; "-" = too few balls)`);
  const line = (kind: Kind) => {
    const pool = players.filter((p) => p.rating[kind].all !== undefined && p.last === ipl.latest).sort((a, b) => b.rating[kind].all! - a.rating[kind].all!);
    for (const p of pool) {
      const r = (ph: Phase) => p.rating[kind][ph] ?? "-";
      const st = kind === "bat" ? `${p.recent.bat.all.runs} runs SR ${p.recent.bat.all.sr} avg ${p.recent.bat.all.avg}` : `${p.recent.bowl.all.wkts} wkts econ ${p.recent.bowl.all.econ}`;
      L.push(`${p.name}${p.full ? ` (${p.full})` : ""} | ${p.team} | ${p.type[kind] ?? "-"} | overall ${r("all")} pp ${r("pp")} mid ${r("mid")} death ${r("death")} | ${st} | impact ${(p.impact / 100).toFixed(2)} | career ${kind === "bat" ? `${p.career.bat.runs} runs` : `${p.career.bowl.wkts} wkts`}`);
    }
  };
  L.push(`BATTERS (name | team | type | ratings | ${span} stats | impact | career)`); line("bat");
  L.push(`BOWLERS (name | team | type | ratings | ${span} stats | impact | career)`); line("bowl");

  const ph = teamPhase[String(latest.season)];
  if (ph) {
    L.push("", `TEAM RUN RATES BY PHASE, ${latest.season} (team | phase: batting run rate (rank) / bowling economy (rank))`);
    for (const [code, v] of Object.entries(ph))
      L.push(`${code} | ` + (["pp", "mid", "death"] as const).map((p) => `${PHASE_LABEL[p].toLowerCase()}: ${v[p].batRR} (${v[p].batRRRank}) / ${v[p].bowlEcon} (${v[p].bowlEconRank})`).join("; "));
  }

  L.push("", "GROUNDS (name, city | matches | avg first-innings score last 3 seasons | all-time avg | chasing side won % | highest total)");
  for (const v of insights.venues.slice(0, 14)) L.push(`${v.name}, ${v.city} | ${v.matches} | ${v.recent.avgFirst ?? "-"} | ${v.avgFirst} | ${v.chasePct} | ${v.highest}`);
  return L.join("\n");
}
