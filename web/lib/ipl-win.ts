/* The win-probability model, in the browser. Same maths as pipeline/win_model.py. */

export type WinCoefs = { first: number[]; chase: number[]; era: number; parRuns: number[]; parWkts: number[] };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

/** Chance the side batting first wins, given its innings so far. */
export function firstInningsWin(m: WinCoefs, balls: number, runs: number, wkts: number) {
  const b = Math.min(Math.max(balls, 0), 120), p = b / 120;
  const dr = (runs - m.parRuns[b]) / 10, dw = wkts - m.parWkts[b];
  return sigmoid(dot(m.first, [1, dr, dw, dr * p, dw * p]));
}

/** Chance the chasing side wins. */
export function chaseWin(m: WinCoefs, need: number, left: number, inHand: number) {
  if (need <= 0) return 1;
  if (left <= 0 || inHand <= 0) return 0;
  const z = Math.max(-15, Math.min(15, (need - (m.era / 6) * left) / Math.sqrt(left)));
  const p = Math.min(left, 120) / 120;
  return sigmoid(dot(m.chase, [1, z, inHand, p, (z * inHand) / 10, inHand * p, z * p]));
}
