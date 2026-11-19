"""
Full names for IPL players ("V Suryavanshi" → "Vaibhav Sooryavanshi"), so search finds them by first name.

Cricsheet stores scorecard names (initials + surname). squads_2027.json has the full names of every
player in a 2027 squad (retained or released). This script pairs the two, and writes
web/data/ipl/names.json. Run after build_ipl.py.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "data" / "ipl"

# Pairs the rules below can't work out on their own (Cricsheet uses an unusual form of the name).
MANUAL = {
    "Varun Chakaravarthy": "CV Varun",
    "Sai Kishore": "R Sai Kishore",
    "Prasidh Krishna": "M Prasidh Krishna",
    "Bhuvneshwar Kumar": "B Kumar",
    "T Natarajan": "T Natarajan",
    "Eshan Malinga": "E Malinga",
    "Rasikh Dar": "Rasikh Salam",
    "Mohammed Arshad Khan": "Arshad Khan",
    "Shahbaz Ahmed": "Shahbaz Ahmed",
    "Auqib Nabi": "Auqib Nabi",
    "Sai Sudharsan": "B Sai Sudharsan",
    "Prabhsimran Singh": "P Simran Singh",
    "Vyshak Vijaykumar": "Vijaykumar Vyshak",
    "Wanindu Hasaranga": "PWH de Silva",
    "Dushmantha Chameera": "PVD Chameera",
    "Kamindu Mendis": "PHKD Mendis",
    "Dasun Shanaka": "MD Shanaka",
    "Yudhvir Singh Charak": "Yudhvir Singh",
}


def fold(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def squash(s: str) -> str:
    return re.sub(r"(.)\1+", r"\1", re.sub(r"[^a-z]", "", fold(s)))


def dist(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def close(a: str, b: str) -> bool:
    a, b = squash(a), squash(b)
    if a == b:
        return True
    allowed = 2 if min(len(a), len(b)) >= 8 else 1 if min(len(a), len(b)) >= 5 else 0
    return dist(a, b) <= allowed


def clean(full: str) -> str:
    return re.sub(r"\s*\(.*?\)|\*", "", full).strip()


def match(full: str, names: list[str]) -> list[str]:
    f = full.split()
    hits = []
    for c in names:
        t = c.split()
        initials = []
        while len(t) > 1 and re.fullmatch(r"[A-Z]{1,3}", t[0]):
            initials.append(t.pop(0))
        if initials:
            # "Q de Kock" ~ "Quinton de Kock": the words after the initials match the end of the full name,
            # and the first initial matches the first name.
            tail = f[-len(t):]
            if len(f) > len(t) and all(close(a, b) for a, b in zip(t, tail)) and initials[0][0] == f[0][0].upper():
                hits.append(c)
        elif len(t) == len(f) and all(close(a, b) for a, b in zip(t, f)):
            hits.append(c)  # "Shubman Gill", "Noor Ahmad"
    return hits


def main() -> None:
    squads = json.loads((Path(__file__).parent / "squads_2027.json").read_text(encoding="utf-8"))
    players = json.loads((OUT / "players.json").read_text(encoding="utf-8"))["players"]
    known = sorted({p["name"] for p in players})
    out: dict[str, str] = {}
    unmatched, ambiguous = [], []
    for code, team in squads["teams"].items():
        for full in [clean(x) for x in team["retained"] + team["released"]]:
            if full in MANUAL:
                if MANUAL[full] in known:
                    out[MANUAL[full]] = full
                continue
            hits = match(full, known)
            if full in hits:   # the data already has the full name ("Ramandeep Singh", not "RK Singh")
                hits = [full]
            if len(hits) == 1:
                out[hits[0]] = full
            elif len(hits) > 1:
                # Prefer the one who last played for this team.
                same = [h for h in hits if next(p for p in players if p["name"] == h)["team"] == code]
                if len(same) == 1:
                    out[same[0]] = full
                else:
                    ambiguous.append((code, full, hits))
            else:
                unmatched.append((code, full))
    (OUT / "names.json").write_text(json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(out)} full names written")
    if ambiguous:
        print("AMBIGUOUS:", ambiguous)
    print(f"{len(unmatched)} squad players not in the rating data (new or rarely played):", ", ".join(f for _, f in unmatched))


if __name__ == "__main__":
    main()
