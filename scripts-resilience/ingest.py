#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ingest.py — Corpus ingestion with the build gate and normalization gate enforced.

Run pattern (heredoc-safe for K'iche' apostrophes — never python3 -c):
    python3 scripts/ingest.py corpus/passages.json

INVARIANTS (these are the resilience guarantees, in code):
  1. Normalization gate: every passage body is normalized (NFC + saltillo -> U+02BC)
     BEFORE storage, and body_normalized is set TRUE as proof the gate ran.
  2. Build gate: only review_status == 'approved' AND ceremonial_sensitivity == 'open'
     passages receive an embedding. Everything else is stored WITHOUT an embedding and
     is therefore invisible to retrieval (which reads the retrievable_passage view).
  3. Single door: re-running this script is the only sanctioned way content enters or
     leaves the index — the same principle as La Baluka's publication gate.
"""
import json
import ssl
import sys
import unicodedata

# Windows' default Python build doesn't consult the OS trust store, which
# breaks on machines where something local (endpoint security, a corporate
# proxy) issues certs signed by a locally-installed root CA. `truststore`
# makes ssl.create_default_context() defer to the real OS trust store
# (same one curl/schannel use) instead of a fixed public bundle -- still
# real verification, just against the trust roots this machine actually has.
try:
    import truststore
    truststore.inject_into_ssl()
    _SSL_CONTEXT = ssl.create_default_context()
except ImportError:
    try:
        import certifi
        _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        _SSL_CONTEXT = None

# --- Normalization gate (mirror of src/corpus/normalize.ts) ----------------
SALTILLO_CANONICAL = "\u02bc"  # MODIFIER LETTER APOSTROPHE
SALTILLO_VARIANTS = ["\u0027", "\u2019", "\u2018", "\u055a", "\ua78c"]


def normalize_kiche(text: str) -> str:
    nfc = unicodedata.normalize("NFC", text)
    for v in SALTILLO_VARIANTS:
        nfc = nfc.replace(v, SALTILLO_CANONICAL)
    return nfc.strip()


def is_canonical(text: str) -> bool:
    return normalize_kiche(text) == text


# --- Embedding ---------------------------------------------------------------
# Voyage AI voyage-multilingual-2: natively 1024 dims, matching the deployed
# corpus_passage.embedding column (confirmed live: vector(1024), NOT the 1536
# scripts-resilience/schema.sql currently documents -- that file is stale
# relative to the actual DB; flagged for a follow-up fix, not corrected here
# by unilaterally altering a production column). Built for multilingual text,
# a better fit for Hebrew/Aramaic corpus content than a general-purpose model.
# Anthropic recommends Voyage as its embeddings partner since Anthropic itself
# offers no embeddings endpoint.
VOYAGE_MODEL = "voyage-multilingual-2"
VOYAGE_DIMS = 1024
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"


def embed(text: str):
    """Return a VOYAGE_DIMS-dim vector via the Voyage AI embeddings API.
    Requires VOYAGE_API_KEY in the environment. Raises loudly on any
    non-200 response or malformed payload -- never fails silently into
    a zero-vector or cached stand-in."""
    import os
    import urllib.request
    import urllib.error

    api_key = os.environ.get("VOYAGE_API_KEY")
    if not api_key:
        raise RuntimeError("VOYAGE_API_KEY not set -- cannot embed without it.")

    payload = json.dumps({
        "input": [text],
        "model": VOYAGE_MODEL,
        "input_type": "document",
    }).encode("utf-8")

    req = urllib.request.Request(
        VOYAGE_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=_SSL_CONTEXT) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Voyage embeddings API error {e.code}: {e.read().decode('utf-8')}")

    vec = body["data"][0]["embedding"]
    if len(vec) != VOYAGE_DIMS:
        raise RuntimeError(f"Expected {VOYAGE_DIMS}-dim embedding, got {len(vec)} -- model/schema mismatch.")
    return vec


def upsert(conn, passage: dict, embedding):
    """Upsert one passage. embedding may be None for non-approved/restricted rows.

    lineage_key is REQUIRED (no default) -- corpus_passage's lineage_key
    column has a table-level default of 'ojer_tzij' left over from when the
    table served only one voice; every non-ojer_tzij passage MUST set this
    explicitly or it silently mislabels as ojer_tzij (this happened for real:
    see migrations/013_fix_lineage_key_drift.sql)."""
    if not passage.get("voice_key"):
        raise RuntimeError(
            f"{passage.get('passage_id', '<unknown>')}: missing required 'voice_key' field "
            f"-- corpus_passage.lineage_key has a silent default ('ojer_tzij') and will NOT "
            f"be left null by omission. Set voice_key explicitly in the passage JSON."
        )
    body = normalize_kiche(passage["body"])
    if not is_canonical(body):
        # Should never happen after normalize; loud failure, never silent.
        raise RuntimeError(f"NormalizationGateViolation on {passage['passage_id']}")
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO corpus_passage
          (passage_id, source, section, body, body_normalized, themes, nahuales,
           cruz_positions, signal_affinity, register, ceremonial_sensitivity,
           review_status, reviewed_by, review_date, embedding, lineage_key, updated_at)
        VALUES (%s,%s,%s,%s,TRUE,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
        ON CONFLICT (passage_id) DO UPDATE SET
          source=EXCLUDED.source, section=EXCLUDED.section, body=EXCLUDED.body,
          body_normalized=TRUE, themes=EXCLUDED.themes, nahuales=EXCLUDED.nahuales,
          cruz_positions=EXCLUDED.cruz_positions, signal_affinity=EXCLUDED.signal_affinity,
          register=EXCLUDED.register, ceremonial_sensitivity=EXCLUDED.ceremonial_sensitivity,
          review_status=EXCLUDED.review_status, reviewed_by=EXCLUDED.reviewed_by,
          review_date=EXCLUDED.review_date, embedding=EXCLUDED.embedding,
          lineage_key=EXCLUDED.lineage_key, updated_at=now()
        """,
        (
            passage["passage_id"], passage["source"], passage["section"], body,
            passage.get("themes", []), passage.get("nahuales", []),
            passage.get("cruz_positions", []), passage.get("signal_affinity", []),
            passage.get("register"), passage.get("ceremonial_sensitivity", "open"),
            passage.get("review_status", "draft"), passage.get("reviewed_by"),
            passage.get("review_date"), embedding, passage["voice_key"],
        ),
    )


def build_gate_passes(passage: dict) -> bool:
    """The build gate: only approved + open passages may be embedded."""
    return (
        passage.get("review_status") == "approved"
        and passage.get("ceremonial_sensitivity", "open") == "open"
    )


def dry_run(path: str) -> None:
    """Validate JSON shape, normalization, and build-gate outcome for every
    passage -- no DB connection, no embedding API call, no writes."""
    with open(path, encoding="utf-8") as f:
        passages = json.load(f)

    required_fields = ["passage_id", "source", "section", "body", "voice_key"]
    would_embed = would_skip = 0
    problems = []

    for i, p in enumerate(passages):
        label = p.get("passage_id", f"<item {i}>")
        missing = [k for k in required_fields if not p.get(k)]
        if missing:
            problems.append(f"{label}: missing required field(s) {missing}")
            continue

        body = normalize_kiche(p["body"])
        if not is_canonical(body):
            problems.append(f"{label}: NormalizationGateViolation")

        if p.get("_comment") or "REPLACE with verified" in p["body"]:
            problems.append(f"{label}: looks like a template/placeholder entry, not real data")

        if build_gate_passes(p):
            would_embed += 1
        else:
            would_skip += 1

    print(json.dumps({
        "mode": "dry-run",
        "passages_checked": len(passages),
        "would_embed": would_embed,
        "would_store_without_embedding": would_skip,
        "problems": problems,
    }, indent=2, ensure_ascii=False))
    if problems:
        sys.exit(1)


def main(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        passages = json.load(f)

    import psycopg2  # imported here so the gate logic is testable without a DB

    conn = psycopg2.connect(sys.argv[2] if len(sys.argv) > 2 else __import__("os").environ["DATABASE_URL"])
    embedded = skipped = 0
    import os as _os
    import time as _time
    embed_sleep = float(_os.environ.get("EMBED_SLEEP_SECONDS", "0"))
    try:
        for p in passages:
            if build_gate_passes(p):
                if embedded > 0 and embed_sleep:
                    _time.sleep(embed_sleep)
                vec = embed(normalize_kiche(p["body"]))
                upsert(conn, p, vec)
                embedded += 1
            else:
                upsert(conn, p, None)  # stored, but invisible to retrieval
                skipped += 1
        conn.commit()
    finally:
        conn.close()
    print(json.dumps({"embedded": embedded, "stored_without_embedding": skipped}))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python3 scripts/ingest.py corpus/passages.json [DATABASE_URL]")
        print("       python3 scripts/ingest.py corpus/passages.json --dry-run")
        sys.exit(1)
    if sys.argv[-1] == "--dry-run":
        dry_run(sys.argv[1])
    else:
        main(sys.argv[1])
