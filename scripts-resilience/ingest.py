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
import sys
import unicodedata

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


# --- Embedding (provider-agnostic stub; wire to your embedding model) -------
def embed(text: str):
    """Return a 1536-dim vector. Replace with the actual embedding call.
    Kept as a stub so the ingestion logic is testable offline."""
    raise NotImplementedError("Wire embed() to the embedding model before production ingest.")


def upsert(conn, passage: dict, embedding):
    """Upsert one passage. embedding may be None for non-approved/restricted rows."""
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
           review_status, reviewed_by, review_date, embedding, updated_at)
        VALUES (%s,%s,%s,%s,TRUE,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
        ON CONFLICT (passage_id) DO UPDATE SET
          source=EXCLUDED.source, section=EXCLUDED.section, body=EXCLUDED.body,
          body_normalized=TRUE, themes=EXCLUDED.themes, nahuales=EXCLUDED.nahuales,
          cruz_positions=EXCLUDED.cruz_positions, signal_affinity=EXCLUDED.signal_affinity,
          register=EXCLUDED.register, ceremonial_sensitivity=EXCLUDED.ceremonial_sensitivity,
          review_status=EXCLUDED.review_status, reviewed_by=EXCLUDED.reviewed_by,
          review_date=EXCLUDED.review_date, embedding=EXCLUDED.embedding, updated_at=now()
        """,
        (
            passage["passage_id"], passage["source"], passage["section"], body,
            passage.get("themes", []), passage.get("nahuales", []),
            passage.get("cruz_positions", []), passage.get("signal_affinity", []),
            passage.get("register"), passage.get("ceremonial_sensitivity", "open"),
            passage.get("review_status", "draft"), passage.get("reviewed_by"),
            passage.get("review_date"), embedding,
        ),
    )


def build_gate_passes(passage: dict) -> bool:
    """The build gate: only approved + open passages may be embedded."""
    return (
        passage.get("review_status") == "approved"
        and passage.get("ceremonial_sensitivity", "open") == "open"
    )


def main(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        passages = json.load(f)

    import psycopg2  # imported here so the gate logic is testable without a DB

    conn = psycopg2.connect(sys.argv[2] if len(sys.argv) > 2 else __import__("os").environ["DATABASE_URL"])
    embedded = skipped = 0
    try:
        for p in passages:
            if build_gate_passes(p):
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
        sys.exit(1)
    main(sys.argv[1])
