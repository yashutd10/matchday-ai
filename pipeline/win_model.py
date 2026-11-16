"""
Win-probability model for IPL matches: two small logistic regressions, fitted in pure Python.

- First innings : how far ahead of (or behind) a typical innings of that era the batting side is.
- Chase         : required run rate against the era's scoring rate, wickets in hand, balls left.

"Era" matters because a required rate of 10 was a tall order in 2010 and is routine in 2026.
"""
from __future__ import annotations

import math


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-30.0, min(30.0, z))))


def solve(a: list[list[float]], b: list[float]) -> list[float]:
    """Solve a·x = b by Gaussian elimination (a is small: one row per model feature)."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[piv] = m[piv], m[c]
        for r in range(c + 1, n):
            f = m[r][c] / m[c][c]
            for k in range(c, n + 1):
                m[r][k] -= f * m[c][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (m[r][n] - sum(m[r][k] * x[k] for k in range(r + 1, n))) / m[r][r]
    return x


def fit_logistic(rows: list[list[float]], labels: list[int], l2: float = 1.0, iters: int = 12) -> list[float]:
    """Logistic regression by Newton's method (IRLS), with a light L2 penalty on everything but the intercept."""
    k = len(rows[0])
    w = [0.0] * k
    for _ in range(iters):
        g = [0.0] * k
        h = [[0.0] * k for _ in range(k)]
        for x, y in zip(rows, labels):
            p = sigmoid(sum(wi * xi for wi, xi in zip(w, x)))
            d, s = p - y, p * (1 - p) + 1e-9
            for i in range(k):
                g[i] += d * x[i]
                sx, hi = s * x[i], h[i]
                for j in range(i, k):
                    hi[j] += sx * x[j]
        for i in range(k):
            for j in range(i):
                h[i][j] = h[j][i]
            if i:
                h[i][i] += l2
                g[i] += l2 * w[i]
        w = [wi - si for wi, si in zip(w, solve(h, g))]
    return w


def first_innings_features(par_runs: list[float], par_wkts: list[float], balls: int, runs: int, wkts: int) -> list[float]:
    b = min(balls, 120)
    p = b / 120
    dr = (runs - par_runs[b]) / 10
    dw = wkts - par_wkts[b]
    return [1.0, dr, dw, dr * p, dw * p]


def chase_features(era_rr: float, need: int, left: int, in_hand: int) -> list[float]:
    """
    z = how many runs the chase is behind (+) or ahead (-) of the era's normal scoring over the balls left,
    scaled by sqrt(balls left): the fewer balls remain, the less room luck has to close the gap.
    """
    z = max(-15.0, min(15.0, (need - era_rr / 6 * left) / math.sqrt(left)))
    p = min(left, 120) / 120
    return [1.0, z, float(in_hand), p, z * in_hand / 10, in_hand * p, z * p]


class WinModel:
    def __init__(self, coef1: list[float], coef2: list[float], par: dict[int, tuple[list[float], list[float]]]):
        self.coef1, self.coef2, self.par = coef1, coef2, par

    def era(self, year: int) -> float:
        return self.par[year][0][120] / 20

    def first(self, year: int, balls: int, runs: int, wkts: int) -> float:
        """Chance the side batting first wins, given its innings so far."""
        pr, pw = self.par[year]
        return sigmoid(sum(c * x for c, x in zip(self.coef1, first_innings_features(pr, pw, balls, runs, wkts))))

    def chase(self, year: int, need: int, left: int, in_hand: int) -> float:
        """Chance the chasing side wins."""
        if need <= 0:
            return 1.0
        if left <= 0 or in_hand <= 0:
            return 0.0
        return sigmoid(sum(c * x for c, x in zip(self.coef2, chase_features(self.era(year), need, left, in_hand))))
