"""
Everything beyond the season summaries: phase ratings, win probability, impact, matchups, venues, teams.
Called by build_ipl.py; writes more files into web/data/ipl/.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict

from win_model import WinModel, chase_features, first_innings_features, fit_logistic

PHASES = ("pp", "mid", "death")
RECENT_SEASONS = 3          # ratings use the last three seasons
MIN_PHASE_BALLS = 90        # balls in a phase before a player is rated for it
MIN_TOTAL_BALLS = 240       # balls overall before a player gets an overall rating
PRIOR_BALLS = 90            # every player starts with this many "average" balls (steadies small samples)
MIN_MATCHUP_BALLS = 12
MODEL_FROM = 2008          # first season the win model learns from
TRAIN_STRIDE = 5            # use every 5th ball for fitting (neighbouring balls are near-duplicates)

VENUE_ALIASES = {
    "Feroz Shah Kotla": "Arun Jaitley Stadium", "Sardar Patel Stadium": "Narendra Modi Stadium",
    "Punjab Cricket Association Stadium": "Punjab Cricket Association IS Bindra Stadium",
    "Subrata Roy Sahara Stadium": "Maharashtra Cricket Association Stadium",
    "M.Chinnaswamy Stadium": "M Chinnaswamy Stadium", "MA Chidambaram Stadium, Chepauk": "MA Chidambaram Stadium",
    "Rajiv Gandhi International Stadium, Uppal": "Rajiv Gandhi International Stadium",
    "Sheikh Zayed Stadium": "Zayed Cricket Stadium",
}
CITY_ALIASES = {"Bangalore": "Bengaluru", "Mohali": "Chandigarh"}


def phase_of(over: int) -> str:
    return "pp" if over < 6 else "mid" if over < 15 else "death"


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def venue_of(info: dict) -> tuple[str, str]:
    raw = info.get("venue", "")
    base = VENUE_ALIASES.get(raw, raw)
    base = VENUE_ALIASES.get(base.split(",")[0].strip(), base.split(",")[0].strip())
    city = info.get("city") or (raw.split(",")[-1].strip() if "," in raw else "")
    return base, CITY_ALIASES.get(city, city)


def deliveries(inn: dict):
    for over in inn["overs"]:
        for b in over["deliveries"]:
            ex = b.get("extras", {})
            yield over["over"], b, "wides" in ex, "noballs" in ex, ex


def track(inn: dict, not_out_kinds: set[str]) -> list[tuple[int, int]]:
    """(runs, wickets) after 0, 1, 2 … legal balls."""
    runs = wkts = 0
    out = [(0, 0)]
    for _, b, wide, noball, _ in deliveries(inn):
        runs += b["runs"]["total"]
        wkts += sum(1 for w in b.get("wickets", []) if w["kind"] not in not_out_kinds)
        if not wide and not noball:
            out.append((runs, wkts))
        else:
            out[-1] = (runs, wkts)
    return out


def percentile_rank(values: dict[str, float]) -> dict[str, int]:
    """0-99: where each value sits among the others (99 = best)."""
    ordered = sorted(values.values())
    n = len(ordered)
    out = {}
    for k, v in values.items():
        below = sum(1 for x in ordered if x < v)
        equal = sum(1 for x in ordered if x == v)
        out[k] = min(99, round((below + equal / 2) / n * 100)) if n else 0
    return out


def build(matches: list[dict], team_codes: dict, bowler_wickets: set[str], not_out_kinds: set[str], out_dir) -> dict:
    code = lambda t: team_codes[t][0]
    year_of = lambda m: int(m["info"]["dates"][0][:4])
    years = sorted({year_of(m) for m in matches})
    latest = years[-1]
    recent = set(years[-RECENT_SEASONS:])

    # ---------- 1. Typical first innings per era ("par"), and the win model ----------
    tracks: dict[str, list[list[tuple[int, int]]]] = {}
    sums: dict[int, list] = {y: [[0.0] * 121, [0.0] * 121, 0] for y in years}
    for m in matches:
        inns = [i for i in m["innings"] if not i.get("super_over")]
        tracks[m["id"]] = [track(i, not_out_kinds) for i in inns]
        if inns and m["info"].get("overs", 20) == 20 and m["info"]["outcome"].get("method") != "D/L":
            t, s = tracks[m["id"]][0], sums[year_of(m)]
            for b in range(121):
                r, w = t[min(b, len(t) - 1)]
                s[0][b] += r; s[1][b] += w
            s[2] += 1
    par: dict[int, tuple[list[float], list[float]]] = {}
    for y in years:
        window = [sums[z] for z in (y - 1, y, y + 1) if z in sums]   # smooth with neighbouring seasons
        n = sum(s[2] for s in window)
        par[y] = ([sum(s[0][b] for s in window) / n for b in range(121)], [sum(s[1][b] for s in window) / n for b in range(121)])

    def states(subset: list[dict], stride: int):
        x1, y1, x2, y2 = [], [], [], []
        for idx, m in enumerate(subset):
            o = m["info"]["outcome"]
            t = tracks[m["id"]]
            if "winner" not in o or o.get("method") == "D/L" or len(t) != 2 or m["info"].get("overs", 20) != 20:
                continue
            y = year_of(m)
            first_won = int(code(o["winner"]) == code(m["innings"][0]["team"]))
            for b in range(idx % stride, len(t[0]) - 1, stride):
                x1.append(first_innings_features(par[y][0], par[y][1], b, *t[0][b])); y1.append(first_won)
            target = t[0][-1][0] + 1
            for b in range(idx % stride, len(t[1]) - 1, stride):
                need, left, in_hand = target - t[1][b][0], 120 - b, 10 - t[1][b][1]
                if need > 0 and left > 0 and in_hand > 0:
                    x2.append(chase_features(par[y][0][120] / 20, need, left, in_hand)); y2.append(1 - first_won)
        return x1, y1, x2, y2

    def fit(subset: list[dict]) -> WinModel:
        x1, y1, x2, y2 = states([m for m in subset if year_of(m) >= MODEL_FROM], TRAIN_STRIDE)
        return WinModel(fit_logistic(x1, y1), fit_logistic(x2, y2), par)

    # Honest test: fit on older seasons, score on the last two, which the model has never seen.
    test_years = set(years[-2:])
    held = fit([m for m in matches if year_of(m) not in test_years])
    x1, y1, x2, y2 = states([m for m in matches if year_of(m) in test_years], 1)
    from win_model import sigmoid
    preds = [(sigmoid(sum(c * v for c, v in zip(held.coef1, x))), y) for x, y in zip(x1, y1)] + \
            [(sigmoid(sum(c * v for c, v in zip(held.coef2, x))), y) for x, y in zip(x2, y2)]
    brier = sum((p - y) ** 2 for p, y in preds) / len(preds)
    acc = sum((p >= 0.5) == bool(y) for p, y in preds) / len(preds)
    bins = []
    for lo in range(0, 100, 10):
        grp = [(p, y) for p, y in preds if lo <= p * 100 < lo + 10 or (lo == 90 and p == 1)]
        if grp:
            bins.append({"said": round(sum(p for p, _ in grp) / len(grp) * 100), "happened": round(sum(y for _, y in grp) / len(grp) * 100), "n": len(grp)})
    evaluation = {"testSeasons": sorted(test_years), "balls": len(preds), "brier": round(brier, 4), "accuracy": round(acc * 100, 1), "calibration": bins}

    model = fit(matches)   # the model the site uses: fitted on everything

    # ---------- 2. One pass over every ball ----------
    bat = defaultdict(lambda: defaultdict(lambda: {p: [0, 0, 0, 0, 0, 0] for p in PHASES}))   # runs, balls, outs, dots, 4s, 6s
    bowl = defaultdict(lambda: defaultdict(lambda: {p: [0, 0, 0, 0, 0] for p in PHASES}))     # balls, runs, wkts, dots, boundaries
    bat_inns = defaultdict(lambda: defaultdict(int)); bowl_inns = defaultdict(lambda: defaultdict(int))
    high = defaultdict(lambda: (0, False))
    played = defaultdict(lambda: defaultdict(set))
    team_of = defaultdict(dict)
    impact = defaultdict(lambda: defaultdict(float))
    matchup = defaultdict(lambda: [0, 0, 0, 0, 0, 0, 0])     # runs, balls, outs, dots, 4s, 6s, last year
    venues = defaultdict(lambda: {"city": "", "n": 0, "first": 0, "firstN": 0, "chase": 0, "decided": 0, "high": 0, "sixes": 0, "rn": 0, "rfirst": 0, "rfirstN": 0, "rchase": 0, "rdecided": 0})
    toss = defaultdict(lambda: {"n": 0, "tossWon": 0, "field": 0, "chase": 0, "decided": 0})
    team_phase = defaultdict(lambda: defaultdict(lambda: {p: [0, 0, 0, 0, 0, 0] for p in PHASES}))  # bat runs, balls, wkts | bowl runs, balls, wkts
    detail = defaultdict(list)

    for m in matches:
        info, y = m["info"], year_of(m)
        o = info["outcome"]
        codes = [code(t) for t in info["teams"]]
        winner = o.get("winner") or o.get("eliminator")
        win_code = code(winner) if winner else None
        inns = [i for i in m["innings"] if not i.get("super_over")]
        if not inns:
            continue
        first = code(inns[0]["team"])
        second = codes[1] if codes[0] == first else codes[0]
        final_first = 0.5 if not win_code else float(win_code == first)   # how it actually ended, for the side batting first
        t = tracks[m["id"]]
        quota2 = int(float(inns[1].get("target", {}).get("overs", info.get("overs", 20))) * 6) if len(inns) > 1 else 120
        target = (inns[1].get("target", {}).get("runs") or t[0][-1][0] + 1) if len(inns) > 1 else None

        for name in {p for squad in info.get("players", {}).values() for p in squad}:
            played[name][y].add(m["id"])

        # venue and toss
        vname, city = venue_of(info)
        v = venues[vname]; v["city"] = city or v["city"]; v["n"] += 1; v["high"] = max(v["high"], *(x[-1][0] for x in t))
        tz = toss[y]; tz["n"] += 1; tz["field"] += info["toss"]["decision"] == "field"
        full = info.get("overs", 20) == 20 and o.get("method") != "D/L"
        if full and len(t[0]) > 1:
            v["first"] += t[0][-1][0]; v["firstN"] += 1
            if y in recent: v["rfirst"] += t[0][-1][0]; v["rfirstN"] += 1
        if "winner" in o:
            chased = int(win_code == second)
            v["decided"] += 1; v["chase"] += chased; tz["decided"] += 1; tz["chase"] += chased
            tz["tossWon"] += code(info["toss"]["winner"]) == win_code
            if y in recent: v["rdecided"] += 1; v["rchase"] += chased
        if y in recent: v["rn"] += 1

        curve = {"a": [], "b": []}       # win % for the side batting first, at the end of each over
        swings = []                      # per over: innings, over, change, runs, wickets, bowler
        cards = []
        match_impact = defaultdict(float)

        for idx, inn in enumerate(inns[:2]):
            bt = code(inn["team"]); fl = second if bt == first else first
            runs = wkts = legal = 0
            inn_bat = defaultdict(lambda: [0, 0, False]); inn_bowl = defaultdict(lambda: [0, 0, 0])
            last = sum(len(ov["deliveries"]) for ov in inn["overs"]) - 1
            n = -1

            def wp_first() -> float:
                """Win chance for the side batting first, in the current state."""
                if idx == 0:
                    return model.first(y, legal, runs, wkts)
                return 1 - model.chase(y, target - runs, quota2 - legal, 10 - wkts)

            before_over = wp_first()
            if idx == 0:
                start = before_over
            for over in inn["overs"]:
                ph = phase_of(over["over"])
                o_runs = o_wkts = 0
                bowler = over["deliveries"][0]["bowler"] if over["deliveries"] else ""
                for b in over["deliveries"]:
                    n += 1
                    ex = b.get("extras", {}); wide, noball = "wides" in ex, "noballs" in ex
                    before = wp_first()
                    r = b["runs"]["batter"]
                    conceded = r + ex.get("wides", 0) + ex.get("noballs", 0)
                    runs += b["runs"]["total"]; o_runs += b["runs"]["total"]
                    s = bat[b["batter"]][y][ph]; w = bowl[b["bowler"]][y][ph]; mu = matchup[(b["batter"], b["bowler"])]
                    tp_bat, tp_bowl = team_phase[y][bt][ph], team_phase[y][fl][ph]
                    team_of[b["batter"]][y] = bt; team_of[b["bowler"]][y] = fl
                    s[0] += r; inn_bat[b["batter"]][0] += r; mu[0] += r; mu[6] = y
                    tp_bat[0] += b["runs"]["total"]; tp_bowl[3] += b["runs"]["total"]
                    if not wide:
                        s[1] += 1; inn_bat[b["batter"]][1] += 1; mu[1] += 1
                        if r == 0: s[3] += 1; mu[3] += 1
                    boundary = not b["runs"].get("non_boundary") and r in (4, 6)
                    if boundary:
                        s[4 if r == 4 else 5] += 1; mu[4 if r == 4 else 5] += 1; w[4] += 1
                        if r == 6: v["sixes"] += 1
                    w[1] += conceded; inn_bowl[b["bowler"]][1] += conceded
                    if not wide and not noball:
                        legal += 1; w[0] += 1; inn_bowl[b["bowler"]][2] += 1; tp_bat[1] += 1; tp_bowl[4] += 1
                        if conceded == 0: w[3] += 1
                    for wk in b.get("wickets", []):
                        if wk["kind"] in not_out_kinds:
                            continue
                        wkts += 1; o_wkts += 1; tp_bat[2] += 1; tp_bowl[5] += 1
                        bat[wk["player_out"]][y][ph][2] += 1; inn_bat[wk["player_out"]][2] = True
                        if wk["kind"] in bowler_wickets:
                            w[2] += 1; inn_bowl[b["bowler"]][0] += 1
                            if wk["player_out"] == b["batter"]: mu[2] += 1
                    # Impact: how much this ball moved the batting side's win chance.
                    if n == last:
                        after = final_first if idx == 1 or len(inns) == 1 else 1 - model.chase(y, target, quota2, 10)
                    else:
                        after = wp_first()
                    delta = (after - before) if bt == first else (before - after)
                    if not wide:
                        impact[b["batter"]][y] += delta; match_impact[b["batter"]] += delta
                    impact[b["bowler"]][y] -= delta; match_impact[b["bowler"]] -= delta
                end = final_first if (n == last and (idx == 1 or len(inns) == 1)) else (1 - model.chase(y, target, quota2, 10) if n == last else wp_first())
                curve["a" if idx == 0 else "b"].append(round(end * 100))
                swings.append({"inn": idx + 1, "over": over["over"] + 1, "from": round(before_over * 100), "to": round(end * 100), "runs": o_runs, "wkts": o_wkts, "bowler": bowler, "bat": bt})
                before_over = end

            for name, (r, bf, out) in inn_bat.items():
                bat_inns[name][y] += 1
                if (r, not out) > high[name]: high[name] = (r, not out)
            for name in inn_bowl: bowl_inns[name][y] += 1
            cards.append({
                "team": bt, "runs": runs, "wkts": wkts, "overs": f"{legal // 6}.{legal % 6}",
                "bat": [{"name": k, "runs": r, "balls": bf, "out": out} for k, (r, bf, out) in sorted(inn_bat.items(), key=lambda kv: -kv[1][0])[:3]],
                "bowl": [{"name": k, "wkts": wk, "runs": rc, "overs": f"{lb // 6}.{lb % 6}"} for k, (wk, rc, lb) in sorted(inn_bowl.items(), key=lambda kv: (-kv[1][0], kv[1][1]))[:3]],
            })

        # Turning point: the over that moved the eventual winner's chances most, in their favour.
        turn = None
        if win_code and swings:
            sign = 1 if win_code == first else -1
            best = max(swings, key=lambda s: sign * (s["to"] - s["from"]))
            if sign * (best["to"] - best["from"]) > 0:
                f, to = (best["from"], best["to"]) if sign == 1 else (100 - best["from"], 100 - best["to"])
                turn = {**best, "from": f, "to": to}
        stars = sorted(match_impact.items(), key=lambda kv: -kv[1])[:3]
        detail[y].append({"id": m["id"], "first": first, "start": round(start * 100), "curve": curve, "turn": turn, "cards": cards,
                          "stars": [{"name": k, "impact": round(val * 100)} for k, val in stars], "toss": f"{code(info['toss']['winner'])} chose to {info['toss']['decision']}", "venue": vname})

    # ---------- 3. Player ratings by phase (last three seasons) ----------
    def agg(src, name, yrs, size):
        tot = {p: [0] * size for p in PHASES}
        for yy in yrs:
            if yy in src.get(name, {}):
                for p in PHASES:
                    tot[p] = [a + b for a, b in zip(tot[p], src[name][yy][p])]
        tot["all"] = [sum(tot[p][i] for p in PHASES) for i in range(size)]
        return tot

    active = sorted({n for n in set(bat) | set(bowl) if recent & (set(bat.get(n, {})) | set(bowl.get(n, {})))})
    rb = {n: agg(bat, n, recent, 6) for n in active}
    rw = {n: agg(bowl, n, recent, 5) for n in active}

    def league(src, i, j, phase):   # league-wide rate of stat i per stat j in a phase
        a = sum(s[phase][i] for s in src.values()); b = sum(s[phase][j] for s in src.values())
        return a / b if b else 0

    bat_blend: dict[str, dict[str, float]] = defaultdict(dict)
    bowl_blend: dict[str, dict[str, float]] = defaultdict(dict)
    ratings = defaultdict(lambda: {"bat": {}, "bowl": {}})
    for ph in PHASES:
        # batting: scoring rate matters most, then staying in, then boundary hitting
        rpb, opb, bpb = league(rb, 0, 1, ph), league(rb, 2, 1, ph), sum(s[ph][4] + s[ph][5] for s in rb.values()) / max(1, sum(s[ph][1] for s in rb.values()))
        pool = [n for n in active if rb[n][ph][1] >= MIN_PHASE_BALLS]
        sr = {n: (rb[n][ph][0] + rpb * PRIOR_BALLS) / (rb[n][ph][1] + PRIOR_BALLS) for n in pool}
        stay = {n: -(rb[n][ph][2] + opb * PRIOR_BALLS) / (rb[n][ph][1] + PRIOR_BALLS) for n in pool}
        bnd = {n: (rb[n][ph][4] + rb[n][ph][5] + bpb * PRIOR_BALLS) / (rb[n][ph][1] + PRIOR_BALLS) for n in pool}
        a, b, c = percentile_rank(sr), percentile_rank(stay), percentile_rank(bnd)
        wts = (0.6, 0.15, 0.25) if ph == "death" else (0.5, 0.3, 0.2)
        blend = {n: wts[0] * a[n] + wts[1] * b[n] + wts[2] * c[n] for n in pool}
        for n, val in percentile_rank(blend).items():
            ratings[n]["bat"][ph] = val; bat_blend[n][ph] = blend[n]
        # bowling: economy matters most, then wicket-taking, then dot balls
        rpb, wpb, dpb = league(rw, 1, 0, ph), league(rw, 2, 0, ph), league(rw, 3, 0, ph)
        pool = [n for n in active if rw[n][ph][0] >= MIN_PHASE_BALLS]
        econ = {n: -(rw[n][ph][1] + rpb * PRIOR_BALLS) / (rw[n][ph][0] + PRIOR_BALLS) for n in pool}
        strike = {n: (rw[n][ph][2] + wpb * PRIOR_BALLS) / (rw[n][ph][0] + PRIOR_BALLS) for n in pool}
        dots = {n: (rw[n][ph][3] + dpb * PRIOR_BALLS) / (rw[n][ph][0] + PRIOR_BALLS) for n in pool}
        a, b, c = percentile_rank(econ), percentile_rank(strike), percentile_rank(dots)
        blend = {n: 0.5 * a[n] + 0.3 * b[n] + 0.2 * c[n] for n in pool}
        for n, val in percentile_rank(blend).items():
            ratings[n]["bowl"][ph] = val; bowl_blend[n][ph] = blend[n]
    # overall = phase scores weighted by how much the player actually plays in each phase
    for kind, blends, src, col in (("bat", bat_blend, rb, 1), ("bowl", bowl_blend, rw, 0)):
        overall = {}
        for n, phs in blends.items():
            if src[n]["all"][col] >= MIN_TOTAL_BALLS:
                wsum = sum(src[n][p][col] for p in phs)
                overall[n] = sum(phs[p] * src[n][p][col] for p in phs) / wsum
        for n, val in percentile_rank(overall).items():
            ratings[n][kind]["all"] = val

    def bat_type(n: str) -> str | None:
        s = rb[n]; balls = s["all"][1]
        if balls < MIN_TOTAL_BALLS: return None
        share = {p: s[p][1] / balls for p in PHASES}
        sr_all = s["all"][0] / balls; lg = league(rb, 0, 1, "pp") * 0 + sum(x["all"][0] for x in rb.values()) / sum(x["all"][1] for x in rb.values())
        per_out = balls / max(1, s["all"][2])
        if share["death"] >= 0.3 and s["death"][0] / max(1, s["death"][1]) >= league(rb, 0, 1, "death"): return "Finisher"
        if share["pp"] >= 0.5 and s["pp"][0] / max(1, s["pp"][1]) >= league(rb, 0, 1, "pp") * 1.08: return "Powerplay hitter"
        if sr_all < lg and per_out >= 24: return "Anchor"
        if share["mid"] >= 0.5 and sr_all >= lg: return "Middle-overs engine"
        if sr_all >= lg * 1.12: return "Power hitter"
        return "All-phase batter"

    def bowl_type(n: str) -> str | None:
        s = rw[n]; balls = s["all"][0]
        if balls < MIN_TOTAL_BALLS: return None
        share = {p: s[p][0] / balls for p in PHASES}
        if share["death"] >= 0.33: return "Death specialist"
        if share["pp"] >= 0.45: return "Powerplay specialist"
        if share["mid"] >= 0.7: return "Middle-overs controller" if s["all"][1] / balls <= sum(x["all"][1] for x in rw.values()) / sum(x["all"][0] for x in rw.values()) else "Middle-overs bowler"
        return "All-phase bowler"

    def bat_line(v):   # runs, balls, outs, dots, 4s, 6s
        return {"runs": v[0], "balls": v[1], "outs": v[2], "sr": round(v[0] / v[1] * 100, 1) if v[1] else 0, "avg": round(v[0] / v[2], 1) if v[2] else None,
                "dot": round(v[3] / v[1] * 100) if v[1] else 0, "bnd": round((v[4] + v[5]) / v[1] * 100, 1) if v[1] else 0, "fours": v[4], "sixes": v[5]}

    def bowl_line(v):  # balls, runs, wkts, dots, boundaries
        return {"balls": v[0], "runs": v[1], "wkts": v[2], "econ": round(v[1] / v[0] * 6, 2) if v[0] else 0, "sr": round(v[0] / v[2], 1) if v[2] else None,
                "avg": round(v[1] / v[2], 1) if v[2] else None, "dot": round(v[3] / v[0] * 100) if v[0] else 0}

    slugs: dict[str, str] = {}
    used = Counter()
    for n in active:
        s = slug(n); used[s] += 1
        slugs[n] = s if used[s] == 1 else f"{s}-{used[s]}"

    players = []
    for n in active:
        all_years = sorted(set(bat.get(n, {})) | set(bowl.get(n, {})))
        cb, cw = agg(bat, n, all_years, 6)["all"], agg(bowl, n, all_years, 5)["all"]
        last_year = max(team_of[n])
        seasons = []
        for yy in all_years:
            b = agg(bat, n, [yy], 6)["all"]; w = agg(bowl, n, [yy], 5)["all"]
            seasons.append({"y": yy, "team": team_of[n].get(yy, ""), "m": len(played[n][yy]) or max(bat_inns[n][yy], bowl_inns[n][yy]), "runs": b[0], "sr": round(b[0] / b[1] * 100, 1) if b[1] else None,
                            "wkts": w[2], "econ": round(w[1] / w[0] * 6, 2) if w[0] else None, "impact": round(impact[n][yy] * 100)})
        players.append({
            "id": slugs[n], "name": n, "team": team_of[n][last_year], "last": last_year, "first": all_years[0],
            "matches": sum(len(played[n][yy]) for yy in played[n]),
            "career": {"bat": {**bat_line(cb), "inns": sum(bat_inns[n].values()), "hs": f"{high[n][0]}{'*' if high[n][1] else ''}"}, "bowl": {**bowl_line(cw), "inns": sum(bowl_inns[n].values())}},
            "recent": {"bat": {p: bat_line(rb[n][p]) for p in ("all", *PHASES)}, "bowl": {p: bowl_line(rw[n][p]) for p in ("all", *PHASES)}},
            "rating": ratings[n], "type": {"bat": bat_type(n), "bowl": bowl_type(n)},
            "impact": round(sum(impact[n][yy] for yy in recent) * 100), "seasons": seasons,
        })

    # ---------- 4. Write files ----------
    def dump(name: str, obj) -> None:
        path = out_dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    dump("players.json", {"seasons": sorted(recent), "minPhaseBalls": MIN_PHASE_BALLS, "players": players})

    pairs = [{"bat": b, "bowl": w, "runs": v[0], "balls": v[1], "outs": v[2], "dots": v[3], "fours": v[4], "sixes": v[5], "last": v[6]}
             for (b, w), v in matchup.items() if v[1] >= MIN_MATCHUP_BALLS]
    dump("matchups.json", {"minBalls": MIN_MATCHUP_BALLS, "ids": slugs, "pairs": pairs})

    dump("winmodel.json", {
        "first": [round(c, 5) for c in model.coef1], "chase": [round(c, 5) for c in model.coef2],
        "era": {str(yy): round(par[yy][0][120] / 20, 3) for yy in years}, "latest": latest,
        "parRuns": [round(x, 2) for x in par[latest][0]], "parWkts": [round(x, 3) for x in par[latest][1]],
        "evaluation": evaluation,
    })

    venue_rows = []
    for name, v in venues.items():
        if v["n"] >= 10:
            venue_rows.append({"name": name, "city": v["city"], "matches": v["n"], "avgFirst": round(v["first"] / v["firstN"]) if v["firstN"] else None,
                               "chasePct": round(v["chase"] / v["decided"] * 100) if v["decided"] else None, "highest": v["high"], "sixesPerMatch": round(v["sixes"] / v["n"], 1),
                               "recent": {"matches": v["rn"], "avgFirst": round(v["rfirst"] / v["rfirstN"]) if v["rfirstN"] else None, "chasePct": round(v["rchase"] / v["rdecided"] * 100) if v["rdecided"] >= 5 else None}})
    venue_rows.sort(key=lambda r: -r["matches"])
    toss_rows = [{"season": yy, "matches": t["n"], "tossWinPct": round(t["tossWon"] / t["decided"] * 100), "fieldFirstPct": round(t["field"] / t["n"] * 100),
                  "chaseWinPct": round(t["chase"] / t["decided"] * 100), "avgFirst": round(par_single(sums, yy))} for yy, t in sorted(toss.items())]
    mvp = {yy: [{"name": n, "id": slugs.get(n), "team": team_of[n].get(yy, ""), "impact": round(val[yy] * 100), "m": len(played[n][yy])}
                for n, val in sorted(impact.items(), key=lambda kv: -kv[1].get(yy, 0))[:10]] for yy in years}
    dump("insights.json", {"venues": venue_rows, "toss": toss_rows, "mvp": {str(k): v for k, v in mvp.items()}, "recentSeasons": sorted(recent)})

    # team strengths by phase, per season
    phase_out = {}
    for yy, teams in team_phase.items():
        rows = {}
        for tc, ph in teams.items():
            rows[tc] = {p: {"batRR": round(ph[p][0] / ph[p][1] * 6, 2) if ph[p][1] else 0, "bowlEcon": round(ph[p][3] / ph[p][4] * 6, 2) if ph[p][4] else 0,
                            "wktsLost": ph[p][2], "wktsTaken": ph[p][5]} for p in PHASES}
        for p in PHASES:
            for key, rev in (("batRR", True), ("bowlEcon", False)):
                order = sorted(rows, key=lambda tc: rows[tc][p][key], reverse=rev)
                for i, tc in enumerate(order): rows[tc][p][key + "Rank"] = i + 1
        phase_out[str(yy)] = rows
    dump("teamphase.json", phase_out)

    for yy, rows in detail.items():
        dump(f"matches/{yy}.json", rows)

    return {"evaluation": evaluation, "players": len(players), "pairs": len(pairs), "venues": len(venue_rows)}


def par_single(sums: dict, year: int) -> float:
    s = sums[year]
    return s[0][120] / s[2] if s[2] else 0
