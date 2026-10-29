// Pure prediction models: no Next.js, no network. Easy to test on its own.

export type Outcome = "H" | "D" | "A";

export type TrainMatch = {
  home: number; // team id
  away: number;
  hg: number; // home goals
  ag: number; // away goals
  weight: number; // how much this match counts (older seasons count less)
};

export type Prediction = {
  lamH: number; // expected home goals
  lamA: number; // expected away goals
  probs: { home: number; draw: number; away: number }; // whole percentages, sum to 100
  top: Outcome;
  score: [number, number];
  confidence: "High" | "Medium" | "Low";
};

export type Predictor = (home: number, away: number) => Prediction;

const MAX_GOALS = 8;

function factorial(k: number) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
}
const poisson = (lambda: number, k: number) => (Math.exp(-lambda) * lambda ** k) / factorial(k);

/** Turns expected goals into outcome probabilities and a most-likely score. */
function finish(lamH: number, lamA: number, rho: number): Prediction {
  let pH = 0, pD = 0, pA = 0;
  const best: Record<Outcome, { p: number; s: [number, number] }> = {
    H: { p: -1, s: [1, 0] }, D: { p: -1, s: [1, 1] }, A: { p: -1, s: [0, 1] },
  };
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      let p = poisson(lamH, h) * poisson(lamA, a);
      // Dixon–Coles correction: plain Poisson under-counts 0-0 and 1-1 draws.
      if (rho) {
        if (h === 0 && a === 0) p *= 1 - lamH * lamA * rho;
        else if (h === 0 && a === 1) p *= 1 + lamH * rho;
        else if (h === 1 && a === 0) p *= 1 + lamA * rho;
        else if (h === 1 && a === 1) p *= 1 - rho;
      }
      p = Math.max(p, 0);
      const k: Outcome = h > a ? "H" : h === a ? "D" : "A";
      if (k === "H") pH += p; else if (k === "D") pD += p; else pA += p;
      if (p > best[k].p) best[k] = { p, s: [h, a] };
    }
  }
  const total = pH + pD + pA;
  pH /= total; pD /= total; pA /= total;

  const probs = { home: Math.round(pH * 100), draw: Math.round(pD * 100), away: 0 };
  probs.away = 100 - probs.home - probs.draw;

  // Tested a "call a draw when it's close" rule on simulated seasons: it lowered accuracy, so it's out.
  const top: Outcome = pH >= pD && pH >= pA ? "H" : pA > pD ? "A" : "D";

  const max = Math.max(pH, pD, pA);
  const confidence = max >= 0.55 ? "High" : max >= 0.42 ? "Medium" : "Low";
  return { lamH, lamA, probs, top, score: best[top].s, confidence };
}

/* ---------- v1: the original model (kept for comparison) ---------- */

type Split = { hGP: number; hGF: number; hGA: number; aGP: number; aGF: number; aGA: number };

export function fitV1(train: TrainMatch[]): Predictor {
  const t = new Map<number, Split>();
  const get = (id: number) => t.get(id) ?? t.set(id, { hGP: 0, hGF: 0, hGA: 0, aGP: 0, aGF: 0, aGA: 0 }).get(id)!;
  let HG = 0, AG = 0;
  for (const m of train) {
    HG += m.hg; AG += m.ag;
    const h = get(m.home), a = get(m.away);
    h.hGP++; h.hGF += m.hg; h.hGA += m.ag;
    a.aGP++; a.aGF += m.ag; a.aGA += m.hg;
  }
  const n = train.length;
  const avgH = n ? HG / n : 1.5, avgA = n ? AG / n : 1.2;
  const shrink = (v: number, g: number) => (v * g + 3) / (g + 3);

  return (homeId, awayId) => {
    const h = get(homeId), a = get(awayId);
    const attH = shrink(h.hGP ? h.hGF / h.hGP / avgH : 1, h.hGP);
    const defH = shrink(h.hGP ? h.hGA / h.hGP / avgA : 1, h.hGP);
    const attA = shrink(a.aGP ? a.aGF / a.aGP / avgA : 1, a.aGP);
    const defA = shrink(a.aGP ? a.aGA / a.aGP / avgH : 1, a.aGP);
    return finish(attH * defA * avgH, attA * defH * avgA, 0);
  };
}

/* ---------- v2: the improved model ---------- */

export const V2 = {
  shrinkGames: 6, // how many "average" games every team starts with
  promotedAttack: 0.8, // newly promoted teams start weaker...
  promotedDefence: 1.2, // ...and leakier
  rho: -0.1, // Dixon–Coles draw correction
};

/**
 * Improvements over v1:
 * 1. Uses ALL of a team's games for attack/defence strength (not home-only / away-only),
 *    plus one league-wide home advantage. Twice the data per estimate.
 * 2. Pulls small samples harder toward average (shrinkGames).
 * 3. Accepts weighted matches, so last season can count as a starting point.
 * 4. Gives promoted teams a weaker starting point.
 * 5. Dixon–Coles correction so draw probabilities are realistic.
 */
export function fitV2(train: TrainMatch[], promoted: Set<number> = new Set()): Predictor {
  const gf = new Map<number, number>(), ga = new Map<number, number>(), gp = new Map<number, number>();
  const add = (map: Map<number, number>, id: number, v: number) => map.set(id, (map.get(id) ?? 0) + v);

  let W = 0, HG = 0, AG = 0;
  for (const m of train) {
    W += m.weight; HG += m.hg * m.weight; AG += m.ag * m.weight;
    add(gf, m.home, m.hg * m.weight); add(ga, m.home, m.ag * m.weight); add(gp, m.home, m.weight);
    add(gf, m.away, m.ag * m.weight); add(ga, m.away, m.hg * m.weight); add(gp, m.away, m.weight);
  }
  const mu = W ? (HG + AG) / (2 * W) : 1.4; // average goals per team per game
  const homeAdv = W && AG ? Math.min(Math.max(HG / AG, 1), 1.6) : 1.25;
  const k = Math.sqrt(homeAdv);

  const strength = (id: number) => {
    const g = gp.get(id) ?? 0;
    const isNew = promoted.has(id);
    const priorAtt = isNew ? V2.promotedAttack : 1;
    const priorDef = isNew ? V2.promotedDefence : 1;
    const att = g ? (gf.get(id)! / g / mu) : priorAtt;
    const def = g ? (ga.get(id)! / g / mu) : priorDef;
    return {
      att: (att * g + priorAtt * V2.shrinkGames) / (g + V2.shrinkGames),
      def: (def * g + priorDef * V2.shrinkGames) / (g + V2.shrinkGames),
    };
  };

  return (homeId, awayId) => {
    const h = strength(homeId), a = strength(awayId);
    return finish(mu * h.att * a.def * k, mu * a.att * h.def / k, V2.rho);
  };
}

/* ---------- scoring ---------- */

export const outcomeOf = (hg: number, ag: number): Outcome => (hg > ag ? "H" : hg === ag ? "D" : "A");

/** Brier score for one match: 0 is perfect, 2 is worst, ~0.67 is guessing 1/3 each. */
export function brier(p: Prediction, actual: Outcome) {
  const f = { H: p.probs.home / 100, D: p.probs.draw / 100, A: p.probs.away / 100 };
  return (["H", "D", "A"] as Outcome[]).reduce((s, o) => s + (f[o] - (o === actual ? 1 : 0)) ** 2, 0);
}
