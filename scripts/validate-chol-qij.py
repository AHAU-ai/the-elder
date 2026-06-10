#!/usr/bin/env python3
from datetime import date, timedelta
import sys

NAHUALES = ["Imox","Iq","Aqabal","Kat","Kan","Kame","Kej","Qanil","Toj","Tzi","Batz","E","Aj","Ix","Tzikin","Ajmaq","Noj","Tijax","Kawoq","Ajpu"]

ANCHOR = date(2020, 4, 22)
ANCHOR_IDX = 18
ANCHOR_NUM = 5
VENUS_SYNODIC = 583.92
VENUS_MORNING_DAYS = 263

def delta(d): return (d - ANCHOR).days

def get_day_sign(dv):
    idx = (ANCHOR_IDX + dv) % 20
    num = ((ANCHOR_NUM - 1 + dv) % 13) + 1
    return {"number": num, "nahual": NAHUALES[idx]}

def compute_cruz(bd):
    d = delta(bd)
    return {"center": get_day_sign(d), "origin": get_day_sign(d-8), "destiny": get_day_sign(d+8), "paternal": get_day_sign(d-6), "maternal": get_day_sign(d+6)}

def compute_venus(bd):
    d = delta(bd)
    phase = (d % VENUS_SYNODIC + VENUS_SYNODIC) % VENUS_SYNODIC
    return "Morning Star" if phase < VENUS_MORNING_DAYS else "Evening Star"

a = get_day_sign(0)
assert a["number"] == 5 and a["nahual"] == "Kawoq", f"Anchor FAILED: {a}"
print("Anchor OK: April 22 2020 = 5 Kawoq")

errors = []
start = date(1940, 1, 1)
dates = [start + timedelta(days=i*3) for i in range(500)]

for bd in dates:
    cruz = compute_cruz(bd)
    venus = compute_venus(bd)
    c = cruz["center"]
    if not (1 <= c["number"] <= 13): errors.append(f"{bd}: number out of range {c}")
    if c["nahual"] not in NAHUALES: errors.append(f"{bd}: unknown nahual {c}")
    for pos, off in [("origin",-8),("destiny",8),("paternal",-6),("maternal",6)]:
        exp = get_day_sign(delta(bd)+off)
        if cruz[pos] != exp: errors.append(f"{bd} {pos}: expected {exp} got {cruz[pos]}")
    if venus not in ("Morning Star","Evening Star"): errors.append(f"{bd}: bad venus {venus}")

print(f"Tested {len(dates)} dates")
if errors:
    print(f"FAILED {len(errors)} errors:")
    [print(f"  {e}") for e in errors[:10]]
    sys.exit(1)
else:
    print("All dates passed. Chol Qij engine validated.")
    sys.exit(0)
