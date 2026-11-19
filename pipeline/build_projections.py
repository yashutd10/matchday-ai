"""
IPL player projections for the next season (Marcel-style).

For each player we take the last three seasons, weight recent ones more, compare each season
with that season's league rate (so 2026's high scoring doesn't inflate everyone), and add a fixed
number of league-average balls ("prior") so small samples are pulled toward average.
Backtest: tune weights/prior on 2025, then test on 2026 (never seen) against simple baselines.
"""
from __future__ import annotations
import math
from collections import defaultdict

BOWLER_WICKETS = {"caught", "bowled", "lbw", "caught and bowled", "stumped", "hit wicket"}
NOT_OUT = {"retired hurt", "retired not out"}
STATS = ("sr", "out", "econ", "wkt")   # bat runs/ball, bat outs/ball, bowl runs/ball, bowl wkts/ball


def season_lines(matches, year_of):
    """per[year][player] = [bat runs, bat balls, outs, bowl balls, bowl runs, wkts]; lg[year] = league totals."""
    per = defaultdict(lambda: defaultdict(lambda: [0, 0, 0, 0, 0, 0]))
    for m in matches:
        y = year_of(m)
        for inn in m["innings"]:
            if inn.get("super_over"):
                continue
            for over in inn["overs"]:
                for b in over["deliveries"]:
                    ex = b.get("extras", {})
                    wide, nb = "wides" in ex, "noballs" in ex
                    bat, bowl = per[y][b["batter"]], per[y][b["bowler"]]
                    if not wide:
                        bat[0] += b["runs"]["batter"]; bat[1] += 1
                    if not wide and not nb:
                        bowl[3] += 1
                    bowl[4] += b["runs"]["total"] - ex.get("byes", 0) - ex.get("legbyes", 0)
                    for w in b.get("wickets", []):
                        if w["kind"] in NOT_OUT:
                            continue
                        per[y][w["player_out"]][2] += 1
                        if w["kind"] in BOWLER_WICKETS:
                            bowl[5] += 1
    lg = {}
    for y, ps in per.items():
        t = [sum(p[i] for p in ps.values()) for i in range(6)]
        lg[y] = {"sr": t[0] / t[1], "out": t[2] / t[1], "econ": t[4] / t[3], "wkt": t[5] / t[3]}
    return per, lg


def num_den(line, stat):
    return {"sr": (line[0], line[1]), "out": (line[2], line[1]), "econ": (line[4], line[3]), "wkt": (line[5], line[3])}[stat]


def project(per, lg, player, target, stat, weights, prior, base_year):
    """Projected rate for `target` season, in base_year's league terms. Returns (rate, effective balls)."""
    num = den = 0.0
    for k, w in enumerate(weights):
        y = target - 1 - k
        if y not in per or player not in per[y]:
            continue
        n, d = num_den(per[y][player], stat)
        if d == 0:
            continue
        num += w * n / lg[y][stat]      # in "league-average units"
        den += w * d
    rel = (num + prior) / (den + prior) if den + prior > 0 else 1.0  # prior balls at exactly league average (rel = 1)
    return rel * lg[base_year][stat], den


def evaluate(per, lg, target, weights, prior, min_balls=60):
    """Ball-weighted RMSE per stat for players with history and >= min_balls in target."""
    out = {}
    for stat in STATS:
        se = {"model": 0.0, "last": 0.0, "avg3": 0.0, "league": 0.0}; tot = 0
        for p, line in per[target].items():
            n, d = num_den(line, stat)
            if d < min_balls:
                continue
            hist = [(per[target - 1 - k][p] if p in per.get(target - 1 - k, {}) else None) for k in range(3)]
            hist_d = [num_den(h, stat) for h in hist if h]
            if sum(x[1] for x in hist_d) < 30:
                continue
            actual = n / d
            # the model can't know next season's league rate; use last season's (same for every method)
            pred, _ = project(per, lg, p, target, stat, weights, prior, target - 1)
            last = hist[0] and num_den(hist[0], stat)
            lastp = last[0] / last[1] if last and last[1] else lg[target - 1][stat]
            a3 = sum(x[0] for x in hist_d) / sum(x[1] for x in hist_d)
            for k, v in (("model", pred), ("last", lastp), ("avg3", a3), ("league", lg[target - 1][stat])):
                se[k] += d * (v - actual) ** 2
            tot += d
        out[stat] = {k: math.sqrt(v / tot) for k, v in se.items()} | {"n": tot}
    return out


# Tuned on 2025 (see backtest()); wicket rate is left out: nothing beat "league average" there.
CONFIG = {"sr": ((3, 2, 1), 1300), "out": ((4, 3, 3), 900), "econ": ((5, 4, 3), 1300)}
SCALE = {"sr": 100, "out": 120, "econ": 6, "wkt": 24}


def backtest(per, lg, test_year):
    """Test-season errors of the tuned model and simple baselines (in readable units)."""
    rows = {}
    for stat in ("sr", "out", "econ", "wkt"):
        w, p = CONFIG.get(stat, ((1, 0, 0), 900))
        e = evaluate(per, lg, test_year, w, p)[stat]
        best_base = min(e["last"], e["avg3"], e["league"])
        rows[stat] = {k: round(e[k] * SCALE[stat], 2) for k in ("model", "last", "avg3", "league")} | {"gain": round((1 - e["model"] / best_base) * 100)}
    return rows


def build(per, lg, names, latest):
    """Projections for latest+1 for the given players, plus risers/fallers vs last year's projection."""
    target = latest + 1

    def proj(name, t, base):
        sr, b1 = project(per, lg, name, t, "sr", *CONFIG["sr"], base)
        out, _ = project(per, lg, name, t, "out", *CONFIG["out"], base)
        econ, b2 = project(per, lg, name, t, "econ", *CONFIG["econ"], base)
        return sr, out, econ, b1 / CONFIG["sr"][0][0], b2 / CONFIG["econ"][0][0]

    conf = lambda b: "high" if b >= 500 else "medium" if b >= 200 else "low"
    players, deltas = {}, []
    for n in names:
        sr, out, econ, bb, wb = proj(n, target, latest)
        o_sr, _, o_econ, obb, owb = proj(n, latest, latest - 1)
        # how the projection moved since last year, in league-relative terms (removes scoring inflation)
        d_sr = (sr / lg[latest]["sr"] - o_sr / lg[latest - 1]["sr"]) * lg[latest]["sr"] * 100
        d_econ = (econ / lg[latest]["econ"] - o_econ / lg[latest - 1]["econ"]) * lg[latest]["econ"] * 6
        e = {}
        if bb >= 60:
            e["bat"] = {"sr": round(sr * 100, 1), "avg": round(sr / out, 1), "balls": round(bb), "conf": conf(bb), "dSr": round(d_sr, 1) if obb >= 60 else None}
        if wb >= 60:
            e["bowl"] = {"econ": round(econ * 6, 2), "balls": round(wb), "conf": conf(wb), "dEcon": round(d_econ, 2) if owb >= 60 else None}
        if e:
            players[n] = e
    pick = lambda k, f, key, rev: sorted([(n, p[k][f]) for n, p in players.items() if k in p and p[k][f] is not None and p[k]["balls"] >= 200], key=lambda x: x[1], reverse=rev)[:8]
    lgp = {"sr": round(lg[latest]["sr"] * 100, 1), "econ": round(lg[latest]["econ"] * 6, 2), "avg": round(lg[latest]["sr"] / lg[latest]["out"], 1)}
    return {
        "season": target, "base": latest, "league": lgp, "players": players,
        "risers": {"bat": pick("bat", "dSr", None, True), "bowl": pick("bowl", "dEcon", None, False)},
        "fallers": {"bat": pick("bat", "dSr", None, False), "bowl": pick("bowl", "dEcon", None, True)},
        "backtest": {"tune": latest - 1, "test": latest, "errors": backtest(per, lg, latest)},
    }


def main(matches, year_of, out_dir) -> dict:
    """Called by build_ipl.py after build_insights (needs players.json for the player list)."""
    import json
    per, lg = season_lines(matches, year_of)
    names = [p["name"] for p in json.loads((out_dir / "players.json").read_text(encoding="utf-8"))["players"]]
    res = build(per, lg, names, max(lg))
    (out_dir / "projections.json").write_text(json.dumps(res, separators=(",", ":")), encoding="utf-8")
    return res
