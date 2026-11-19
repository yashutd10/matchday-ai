"""
Build the IPL data files for Matchday AI from Cricsheet ball-by-ball data.

Input : pipeline/ipl_json.zip  (https://cricsheet.org/downloads/ipl_json.zip)
Output: web/data/ipl/*.json    (small files the website reads)

Run   : python pipeline/build_ipl.py
Needs only the Python standard library.
"""
from __future__ import annotations

import json
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ZIP = ROOT / "pipeline" / "ipl_json.zip"
OUT = ROOT / "web" / "data" / "ipl"

# Franchises that were renamed are treated as one team.
TEAMS = {
    "Chennai Super Kings": ("CSK", "Chennai Super Kings"),
    "Mumbai Indians": ("MI", "Mumbai Indians"),
    "Kolkata Knight Riders": ("KKR", "Kolkata Knight Riders"),
    "Royal Challengers Bangalore": ("RCB", "Royal Challengers Bengaluru"),
    "Royal Challengers Bengaluru": ("RCB", "Royal Challengers Bengaluru"),
    "Sunrisers Hyderabad": ("SRH", "Sunrisers Hyderabad"),
    "Rajasthan Royals": ("RR", "Rajasthan Royals"),
    "Delhi Daredevils": ("DC", "Delhi Capitals"),
    "Delhi Capitals": ("DC", "Delhi Capitals"),
    "Kings XI Punjab": ("PBKS", "Punjab Kings"),
    "Punjab Kings": ("PBKS", "Punjab Kings"),
    "Lucknow Super Giants": ("LSG", "Lucknow Super Giants"),
    "Gujarat Titans": ("GT", "Gujarat Titans"),
    "Deccan Chargers": ("DEC", "Deccan Chargers"),
    "Kochi Tuskers Kerala": ("KTK", "Kochi Tuskers Kerala"),
    "Pune Warriors": ("PWI", "Pune Warriors India"),
    "Rising Pune Supergiant": ("RPS", "Rising Pune Supergiant"),
    "Rising Pune Supergiants": ("RPS", "Rising Pune Supergiant"),
    "Gujarat Lions": ("GL", "Gujarat Lions"),
}

# Dismissals credited to the bowler.
BOWLER_WICKETS = {"caught", "bowled", "lbw", "caught and bowled", "stumped", "hit wicket"}
# Ways of leaving the crease that are not a dismissal.
NOT_OUT_KINDS = {"retired hurt"}


def phase_of(over: int) -> str:
    """Overs are numbered from 0: powerplay = 1-6, middle = 7-15, death = 16-20."""
    return "pp" if over < 6 else "mid" if over < 15 else "death"


def overs_text(balls: int) -> str:
    return f"{balls // 6}.{balls % 6}"


def load_matches() -> list[dict]:
    if not ZIP.exists():
        sys.exit(f"Missing {ZIP}. Download https://cricsheet.org/downloads/ipl_json.zip and put it there.")
    matches = []
    with zipfile.ZipFile(ZIP) as z:
        for name in z.namelist():
            if name.endswith(".json"):
                m = json.loads(z.read(name))
                m["id"] = name[:-5]
                matches.append(m)
    matches.sort(key=lambda m: (m["info"]["dates"][0], m["id"]))
    return matches


def innings_totals(inn: dict) -> dict:
    """Runs, wickets and legal balls for one innings."""
    runs = wickets = balls = 0
    for over in inn["overs"]:
        for b in over["deliveries"]:
            runs += b["runs"]["total"]
            extras = b.get("extras", {})
            if "wides" not in extras and "noballs" not in extras:
                balls += 1
            wickets += sum(1 for w in b.get("wickets", []) if w["kind"] not in NOT_OUT_KINDS)
    return {"runs": runs, "wickets": wickets, "balls": balls}


def new_bat() -> dict:
    return {"runs": 0, "balls": 0, "outs": 0, "inns": 0, "hs": 0, "hs_no": False, "4s": 0, "6s": 0, "50s": 0, "100s": 0, "team": ""}


def new_bowl() -> dict:
    return {"balls": 0, "runs": 0, "wkts": 0, "inns": 0, "best_w": 0, "best_r": 0, "dots": 0, "team": ""}


def build_season(year: int, matches: list[dict]) -> dict:
    table: dict[str, dict] = {}
    bat: dict[str, dict] = defaultdict(new_bat)
    bowl: dict[str, dict] = defaultdict(new_bowl)
    results = []
    champion = runner_up = None
    best_total = {"runs": 0}
    total_runs = total_sixes = total_fours = 0

    def row(code: str) -> dict:
        return table.setdefault(code, {"team": code, "p": 0, "w": 0, "l": 0, "nr": 0, "pts": 0, "rf": 0, "bf": 0, "ra": 0, "bb": 0})

    for m in matches:
        info = m["info"]
        stage = info.get("event", {}).get("stage")
        codes = [TEAMS[t][0] for t in info["teams"]]
        outcome = info["outcome"]
        winner = outcome.get("winner") or outcome.get("eliminator")  # eliminator = super-over winner
        win_code = TEAMS[winner][0] if winner else None
        innings = [i for i in m["innings"] if not i.get("super_over")]
        totals = []

        for idx, inn in enumerate(innings):
            code = TEAMS[inn["team"]][0]
            other = codes[1] if codes[0] == code else codes[0]
            t = innings_totals(inn)
            # Overs this side was allowed (rain-shortened chases carry it in "target").
            quota = int(float(inn.get("target", {}).get("overs", info.get("overs", 20))) * 6) if idx == 1 else info.get("overs", 20) * 6
            t.update(team=code, other=other, quota=quota)
            totals.append(t)
            total_runs += t["runs"]
            if t["runs"] > best_total["runs"]:
                best_total = {"runs": t["runs"], "wickets": t["wickets"], "team": code, "vs": other, "overs": overs_text(t["balls"])}

            inn_bat: dict[str, dict] = defaultdict(lambda: {"runs": 0, "balls": 0, "out": False})
            inn_bowl: dict[str, dict] = defaultdict(lambda: {"runs": 0, "wkts": 0, "balls": 0})
            for over in inn["overs"]:
                for b in over["deliveries"]:
                    extras = b.get("extras", {})
                    wide, noball = "wides" in extras, "noballs" in extras
                    r = b["runs"]["batter"]
                    s = inn_bat[b["batter"]]
                    s["runs"] += r
                    if not wide:
                        s["balls"] += 1
                    if not b["runs"].get("non_boundary"):
                        if r == 4:
                            bat[b["batter"]]["4s"] += 1; total_fours += 1
                        elif r == 6:
                            bat[b["batter"]]["6s"] += 1; total_sixes += 1
                    w = inn_bowl[b["bowler"]]
                    conceded = r + extras.get("wides", 0) + extras.get("noballs", 0)
                    w["runs"] += conceded
                    if not wide and not noball:
                        w["balls"] += 1
                        if conceded == 0:
                            bowl[b["bowler"]]["dots"] += 1
                    for wk in b.get("wickets", []):
                        if wk["kind"] not in NOT_OUT_KINDS:
                            inn_bat[wk["player_out"]]["out"] = True
                        if wk["kind"] in BOWLER_WICKETS:
                            w["wkts"] += 1

            for name, s in inn_bat.items():
                p = bat[name]
                p["team"] = code
                p["inns"] += 1; p["runs"] += s["runs"]; p["balls"] += s["balls"]; p["outs"] += s["out"]
                if s["runs"] > p["hs"] or (s["runs"] == p["hs"] and not s["out"]):
                    p["hs"], p["hs_no"] = s["runs"], not s["out"]
                if s["runs"] >= 100: p["100s"] += 1
                elif s["runs"] >= 50: p["50s"] += 1
            for name, w in inn_bowl.items():
                p = bowl[name]
                p["team"] = other
                p["inns"] += 1; p["balls"] += w["balls"]; p["runs"] += w["runs"]; p["wkts"] += w["wkts"]
                if (w["wkts"], -w["runs"]) > (p["best_w"], -p["best_r"]) or p["inns"] == 1:
                    p["best_w"], p["best_r"] = w["wkts"], w["runs"]

        # League table: playoffs don't count.
        if not stage:
            for c in codes:
                row(c)["p"] += 1
            if win_code:
                lose = codes[1] if codes[0] == win_code else codes[0]
                row(win_code)["w"] += 1; row(win_code)["pts"] += 2; row(lose)["l"] += 1
            else:
                for c in codes:
                    row(c)["nr"] += 1; row(c)["pts"] += 1
            # Net run rate uses completed matches; a side bowled out is charged its full quota of overs.
            # Rain-shortened (D/L) chases: the side batting first is credited with the par score
            # (revised target minus one) over the overs the chasing side was given, as the IPL does.
            if outcome.get("result") != "no result" and len(totals) == 2:
                target = innings[1].get("target", {})
                for idx, t in enumerate(totals):
                    runs = t["runs"]
                    faced = t["quota"] if t["wickets"] >= 10 else t["balls"]
                    if idx == 0 and outcome.get("method") == "D/L" and "runs" in target:
                        runs, faced = target["runs"] - 1, totals[1]["quota"]
                    row(t["team"])["rf"] += runs; row(t["team"])["bf"] += faced
                    row(t["other"])["ra"] += runs; row(t["other"])["bb"] += faced
        elif stage == "Final" and win_code:
            champion = win_code
            runner_up = codes[1] if codes[0] == win_code else codes[0]

        by = outcome.get("by", {})
        margin = f"{by['runs']} runs" if "runs" in by else f"{by['wickets']} wickets" if "wickets" in by else "super over" if outcome.get("eliminator") else ""
        results.append({
            "id": m["id"], "date": info["dates"][0], "stage": stage or "League", "venue": info.get("city") or info.get("venue", ""),
            "teams": codes, "winner": win_code, "margin": margin, "dls": outcome.get("method") == "D/L",
            "scores": [{"team": t["team"], "runs": t["runs"], "wickets": t["wickets"], "overs": overs_text(t["balls"])} for t in totals],
            "pom": (info.get("player_of_match") or [None])[0],
        })

    # Every team plays the same number of league games (the most common count). Two corrections:
    # - fewer than that: a match was abandoned without a ball bowled, so it has no Cricsheet file,
    #   but each side still got a point;
    # - more than that: a match was abandoned and replayed from scratch (PBKS v DC, 2025), and the
    #   abandoned attempt, recorded as a no result, doesn't count.
    counts = [r["p"] for r in table.values()]
    full = max(set(counts), key=lambda c: (counts.count(c), c)) if counts else 0
    for r in table.values():
        missing = full - r["p"]
        r["p"] += missing; r["nr"] += missing; r["pts"] += missing

    rows = []
    for r in table.values():
        nrr = (r["rf"] / r["bf"] * 6 if r["bf"] else 0) - (r["ra"] / r["bb"] * 6 if r["bb"] else 0)
        rows.append({"team": r["team"], "p": r["p"], "w": r["w"], "l": r["l"], "nr": r["nr"], "pts": r["pts"], "nrr": round(nrr, 3)})
    rows.sort(key=lambda r: (-r["pts"], -r["nrr"]))

    def bat_row(name: str, p: dict) -> dict:
        return {"name": name, "team": p["team"], "inns": p["inns"], "runs": p["runs"],
                "avg": round(p["runs"] / p["outs"], 1) if p["outs"] else None,
                "sr": round(p["runs"] / p["balls"] * 100, 1) if p["balls"] else 0,
                "hs": f"{p['hs']}{'*' if p['hs_no'] else ''}", "50s": p["50s"], "100s": p["100s"], "4s": p["4s"], "6s": p["6s"]}

    def bowl_row(name: str, p: dict) -> dict:
        return {"name": name, "team": p["team"], "inns": p["inns"], "wkts": p["wkts"], "overs": overs_text(p["balls"]),
                "econ": round(p["runs"] / p["balls"] * 6, 2) if p["balls"] else 0,
                "avg": round(p["runs"] / p["wkts"], 1) if p["wkts"] else None,
                "best": f"{p['best_w']}/{p['best_r']}", "dot": round(p["dots"] / p["balls"] * 100) if p["balls"] else 0}

    top_runs = sorted(bat.items(), key=lambda kv: (-kv[1]["runs"], kv[1]["balls"]))[:15]
    top_wkts = sorted(bowl.items(), key=lambda kv: (-kv[1]["wkts"], kv[1]["runs"] / max(kv[1]["balls"], 1)))[:15]
    top_sixes = sorted(bat.items(), key=lambda kv: -kv[1]["6s"])[:5]

    return {
        "season": year, "matches": len(matches), "champion": champion, "runnerUp": runner_up,
        "table": rows,
        "topRuns": [bat_row(n, p) for n, p in top_runs],
        "topWickets": [bowl_row(n, p) for n, p in top_wkts],
        "topSixes": [{"name": n, "team": p["team"], "sixes": p["6s"]} for n, p in top_sixes],
        "totals": {"runs": total_runs, "sixes": total_sixes, "fours": total_fours, "highest": best_total},
        "playoffs": [r for r in results if r["stage"] != "League"],
        "results": results,
    }


def main() -> None:
    matches = load_matches()
    by_year: dict[int, list[dict]] = defaultdict(list)
    for m in matches:
        by_year[int(m["info"]["dates"][0][:4])].append(m)

    OUT.mkdir(parents=True, exist_ok=True)
    seasons = {y: build_season(y, ms) for y, ms in sorted(by_year.items())}
    balls = sum(len(o["deliveries"]) for m in matches for i in m["innings"] for o in i["overs"])

    # summary.json: everything the IPL home page needs, without the full match lists.
    summary = {
        "generated": date.today().isoformat(),
        "matches": len(matches), "balls": balls, "latest": max(seasons),
        "teams": {code: name for code, name in dict(TEAMS.values()).items()},
        "seasons": [{k: v for k, v in s.items() if k != "results"} for s in seasons.values()],
    }
    (OUT / "summary.json").write_text(json.dumps(summary, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    # results.json: every match, season by season (for team and match pages later).
    (OUT / "results.json").write_text(json.dumps({str(y): s["results"] for y, s in seasons.items()}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    import build_insights
    extra = build_insights.build(matches, TEAMS, BOWLER_WICKETS, NOT_OUT_KINDS, OUT)
    ev = extra["evaluation"]
    print(f"{len(matches)} matches, {balls:,} balls, seasons {min(seasons)}-{max(seasons)}")
    print(f"win model on unseen seasons {ev['testSeasons']}: Brier {ev['brier']} (0.25 = coin flip), right side favoured {ev['accuracy']}% of balls")
    print(f"{extra['players']} active players rated, {extra['pairs']} matchups, {extra['venues']} venues")
    import build_names
    build_names.main()
    for f in sorted(OUT.rglob("*.json")):
        print(f"  wrote {f.relative_to(ROOT)} ({f.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
