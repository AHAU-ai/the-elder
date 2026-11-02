#!/usr/bin/env python3
"""INFORMATIONAL: compare the engine's Venus model with where Venus actually is.

Morning Star = Venus rises before the Sun (west of it); Evening Star = east of it.
Reports agreement over the 500 golden dates. It changes nothing: whether the
model should follow astronomy or a lineage convention is a decision for the
lineage holders, not a code fix. Needs: pip install ephem
"""
import json, os, sys
import ephem

fx = json.load(open(os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "chol-qij-golden.json")))

def actual(iso):
    d = ephem.Date(iso.replace("-", "/") + " 12:00")
    v, s = ephem.Venus(d), ephem.Sun(d)
    # ecliptic longitude: Venus east of Sun => visible in evening
    diff = (ephem.Ecliptic(v).lon - ephem.Ecliptic(s).lon) * 180 / 3.141592653589793
    diff = (diff + 180) % 360 - 180
    return "Evening Star" if diff > 0 else "Morning Star"

agree = sum(1 for r in fx["rows"] if actual(r["date"]) == r["venus"])
n = len(fx["rows"])
print(f"model vs astronomy: {agree}/{n} agree ({100*agree/n:.1f}%)")
print("anchor 2020-04-22 model: Morning Star; astronomy:", actual("2020-04-22"))
if agree < n * 0.5:
    print("NOTE: agreement below 50% — the model looks inverted relative to the sky, not merely approximate.")
