#!/usr/bin/env python3
"""Generate tests/fixtures/chol-qij-golden.json from the independent Python reference.

Same dates as validate-chol-qij.py (1940-01-01 + 3*i, 500 dates). The TypeScript
engine (lib/chol-qij.ts) must reproduce every row; tests/cholQijParity.test.ts checks it.
Regenerate only on a deliberate calendar decision — the fixture is the contract.
"""
import json, os
from datetime import date, timedelta

NAH = ["Imox","Iq","Aqabal","Kat","Kan","Kame","Kej","Qanil","Toj","Tzi","Batz","E","Aj","Ix","Tzikin","Ajmaq","Noj","Tijax","Kawoq","Ajpu"]
ANCHOR = date(2020, 4, 22)
SYN, MORN = 583.92, 263

def sign(dv): return {"number": ((5 - 1 + dv) % 13) + 1, "idx": (18 + dv) % 20, "nahual": NAH[(18 + dv) % 20]}

import json as _j
rows = []
for i in range(500):
    bd = date(1940, 1, 1) + timedelta(days=3 * i)
    d = (bd - ANCHOR).days
    ph = (d % SYN + SYN) % SYN
    rows.append({"date": bd.isoformat(), "center": sign(d), "origin": sign(d - 8), "destiny": sign(d + 8),
                 "paternal": sign(d - 6), "maternal": sign(d + 6),
                 "venus": "Morning Star" if ph < MORN else "Evening Star"})

out = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "chol-qij-golden.json")
with open(out, "w") as f:
    json.dump({"anchor": "2020-04-22 = 5 Kawoq", "names": NAH, "rows": rows}, f, indent=0)
print(f"wrote {len(rows)} rows")
