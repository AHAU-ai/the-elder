#!/usr/bin/env python3
"""
suggest_passages.py — propose the next Mekubal corpus candidates.

WHAT THIS DOES
--------------
This does NOT add anything to corpus_passage and does NOT touch the build
gate. It only WRITES A CANDIDATE FILE for a human (Getzel, or whoever he
designates) to review -- same posture as zohar_pull.py: fetch real data,
report what's real about it, let a person decide.

It answers one question: "of the Sulam Edition (Jerusalem 1945) Zohar text
on Sefaria, which paragraphs are (a) actually digitized in that version and
(b) not already in our corpus?" -- because the earlier sourcing pass found
this specific digitization has SPARSE coverage (most paragraph slots the
base text structure allows return 404 for this version), so "pull the next
N refs" can't just increment a counter; it has to probe.

HOW
---
1. Reads scripts-resilience/../corpus/mekubal-passages.json to see which
   Sefaria refs are already sourced (via each entry's _provenance.sefaria_ref).
2. Reads Sefaria's index shape for a given book/parasha (chapter/paragraph
   counts) so it knows the theoretical address space to probe -- it does not
   guess ranges blindly.
3. Probes candidate refs against the Sulam Edition version specifically
   (same version-param logic as zohar_pull.py; imports fetch_ref/normalize_record
   from it directly rather than re-implementing).
4. Stops once it has found `--count` new, real, available passages (default 5),
   or exhausts the probe range.
5. Writes them to corpus/mekubal-candidates.json in the same schema shape as
   mekubal-passages.json, with review_status='draft' and reviewed_by=null --
   nothing here is pre-approved. A human merges + reviews before ingest.py
   ever sees it.

USAGE
-----
  python3 scripts-resilience/suggest_passages.py
  python3 scripts-resilience/suggest_passages.py --parasha Noach --count 10
  python3 scripts-resilience/suggest_passages.py --database-url "$DATABASE_URL"
      # also excludes passage_ids already committed to the DB, not just the
      # local JSON file, in case the two have drifted.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zohar_pull import fetch_ref, normalize_record, API_BASE, _SSL_CONTEXT  # noqa: E402

VERSION_TITLE = "Sulam Edition, Jerusalem 1945"
PASSAGES_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "corpus", "mekubal-passages.json")
CANDIDATES_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "corpus", "mekubal-candidates.json")


def http_get_json(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "suggest-passages-script/1.0"})
    with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CONTEXT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_parasha_shape(book="Zohar", parasha="Bereshit"):
    """Return list of paragraph-counts per chapter for one parasha, straight
    from Sefaria's own index -- never guessed."""
    data = http_get_json(f"{API_BASE}/v2/index/{urllib.parse.quote(book)}")
    for node in data["schema"]["nodes"]:
        if node["title"].lower() == parasha.lower():
            offsets = node["index_offsets_by_depth"]["2"]
            return [offsets[i + 1] - offsets[i] for i in range(len(offsets) - 1)]
    raise ValueError(f"Parasha '{parasha}' not found in {book}'s index.")


def already_sourced_refs(database_url=None):
    """Sefaria refs already in the local candidates/passages files, so we
    never re-probe or re-suggest the same ref."""
    seen = set()
    for path in (PASSAGES_JSON, CANDIDATES_JSON):
        if os.path.exists(path):
            for p in json.load(open(path, encoding="utf-8")):
                ref = (p.get("_provenance") or {}).get("sefaria_ref")
                if ref:
                    seen.add(ref)

    if database_url:
        import psycopg2
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        cur.execute("SELECT passage_id FROM corpus_passage WHERE lineage_key = 'mekubal'")
        for (pid,) in cur.fetchall():
            # zohar-bereshit-1-1 -> Zohar, Bereshit 1:1 (best-effort reconstruction,
            # only used to avoid duplicate probing, not as a source of truth)
            m = re.match(r"zohar-([a-z]+)-(\d+)-(\d+)$", pid)
            if m:
                parasha, ch, para = m.groups()
                seen.add(f"Zohar, {parasha.capitalize()} {ch}:{para}")
        conn.close()

    return seen


def suggest(parasha: str, count: int, sleep_s: float, database_url: str | None):
    shape = get_parasha_shape(parasha=parasha)
    already = already_sourced_refs(database_url)

    found = []
    tried = 0
    for chapter_idx, para_count in enumerate(shape, start=1):
        for para in range(1, para_count + 1):
            ref = f"Zohar, {parasha} {chapter_idx}:{para}"
            if ref in already:
                continue
            tried += 1
            time.sleep(sleep_s)
            try:
                data = fetch_ref(ref, version_title=VERSION_TITLE)[0]
                if data is None:
                    continue
                record, err = normalize_record(ref, data)
                if err or not record.get("text"):
                    continue
            except Exception:
                continue

            body = re.sub(r"<[^>]+>", "", record["text"]).strip()
            if not body:
                continue

            pid = f"zohar-{parasha.lower()}-{chapter_idx}-{para}"
            found.append({
                "passage_id": pid,
                "source": f"Zohar ({VERSION_TITLE}) via Sefaria",
                "section": f"{ref}",
                "body": body,
                "voice_key": "mekubal",
                "themes": [],
                "nahuales": [],
                "cruz_positions": [],
                "signal_affinity": [],
                "register": "exposition",
                "ceremonial_sensitivity": "open",
                "review_status": "draft",
                "reviewed_by": None,
                "review_date": None,
                "_provenance": {
                    "sefaria_ref": ref,
                    "sefaria_version_title": VERSION_TITLE,
                    "sefaria_license": record.get("license", "unknown"),
                    "source_url": record.get("source_url"),
                    "pulled_via": "scripts-resilience/suggest_passages.py",
                },
            })
            print(f"  found: {ref}", file=sys.stderr)
            if len(found) >= count:
                return found, tried
    return found, tried


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--parasha", default="Bereshit", help="Parasha to probe (default: Bereshit)")
    p.add_argument("--count", type=int, default=5, help="How many new candidates to find (default: 5)")
    p.add_argument("--sleep", type=float, default=0.3, help="Seconds between Sefaria requests")
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL"),
                    help="Also exclude passage_ids already in corpus_passage (voice_key='mekubal')")
    args = p.parse_args()

    found, tried = suggest(args.parasha, args.count, args.sleep, args.database_url)

    print(json.dumps({
        "parasha_probed": args.parasha,
        "refs_tried": tried,
        "candidates_found": len(found),
        "wrote_to": CANDIDATES_JSON if found else None,
    }, indent=2))

    if found:
        os.makedirs(os.path.dirname(CANDIDATES_JSON), exist_ok=True)
        existing = json.load(open(CANDIDATES_JSON, encoding="utf-8")) if os.path.exists(CANDIDATES_JSON) else []
        existing.extend(found)
        json.dump(existing, open(CANDIDATES_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"\nWrote {len(found)} new candidate(s) to {os.path.relpath(CANDIDATES_JSON)} "
              f"-- review_status is 'draft' on all of them. A human (Getzel or his "
              f"designate) must review and approve before these reach ingest.py.",
              file=sys.stderr)


if __name__ == "__main__":
    main()
