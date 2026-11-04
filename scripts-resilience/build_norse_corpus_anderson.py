#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_norse_corpus_anderson.py -- Norse lineage corpus, Rasmus B. Anderson,
"Norse Mythology; or, The Religion of Our Forefathers, Containing All the
Myths of the Eddas, Systematized and Interpreted" (S.C. Griggs, Chicago,
3rd ed., 1879 printing). Project Gutenberg eBook #65910 (plain UTF-8 text,
proofread by the Distributed Proofreaders team from University of Michigan
"Making of America" scans -- NOT a raw OCR/djvu dump, so this script carries
none of the OCR-repair machinery in build_norse_corpus_colum.py).

Same contract as the other Norse ingestion passes: this script fetches,
cleans, segments and stages a JSON file ONLY. It never touches the database
and never embeds. The real gate is the shared CLI:

    python3 scripts-resilience/ingest.py corpus/norse-anderson-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/norse-anderson-passages-STAGED.json "$DEV_DATABASE_URL"

CONVENTIONS REUSED FROM PASS 1/2 (verified against the repo 2026-09-15):
  - Target table: corpus_passage, via scripts-resilience/ingest.py. There is
    NO "myth_entry" schema anywhere in the repo.
  - Required per-entry fields: passage_id, source, section, body, voice_key.
  - voice_key for the Norse voice is "volva" (lineage_key column).
  - Provenance columns do not exist on corpus_passage; carried in the
    per-entry "_provenance" object, which ingest.py neither reads nor
    stores -- human audit only.
  - Normalization: byte-identical NFC + saltillo transform to ingest.py, so
    `ingest.py --dry-run`'s is_canonical() check passes. English apostrophes
    become U+02BC as a pre-existing side effect of the shared pipeline.
  - No "_comment" key on any entry (ingest.py --dry-run rejects it).

STRUCTURE (confirmed against the fetched text's own table of contents,
Gutenberg lines 309-512): an unnumbered INTRODUCTION (7 chapters) plus
PART I "The Creation and Preservation of the World" (3 chapters), PART II
"The Life and Exploits of the Gods" (7 chapters), PART III "Ragnarok and
Regeneration" (2 chapters) -- 19 chapters total. Chapter bodies commonly
contain internal "Section i./ii./..." subdivisions (per the TOC) but those
are NOT re-split here; each chapter is staged as one passage, matching the
chapter as the natural unit of Anderson's own analytic prose (this is an
essayistic/expository mythography, not a narrative retelling like Colum's
or Guerber's -- register is "exposition", not "narrative").

CLEANING APPLIED
  - Front matter (title page, preface, table of contents) and back matter
    (Vocabulary, Index, PG license) stripped; body runs from the first
    in-body "CHAPTER I." heading to the "VOCABULARY OF THE PRINCIPAL PROPER
    NAMES" heading.
  - Chapter/Part heading lines and their title lines removed from body text
    (recorded structurally instead, in "section").
  - "Footnote N:" blocks (Anderson's endnotes, collected at the chapter
    tail) dropped from the body; PG page-break "-----" rules and blank-line
    runs collapsed.
  - Greek text of the word "mythology" in Chapter I's opening etymology
    survives as-is (real content, not garble -- this is a proofread PG
    edition, not raw OCR).

REVIEW STATUS: staged "approved" (not "draft") -- unlike the Colum/Guerber
OCR passes, there is no unresolved boundary/garble residue here for a human
to adjudicate before the text is legible, so this pass does not gate on a
manual cleanup review. It STILL has not received the tradition-bearer /
register review the Colum and Guerber passes are also pending (see
voice_authorization_note below) -- promotion to "approved" here concerns
transcription fidelity only, not ceremonial or scholarly sign-off.

USAGE
-----
    python3 scripts-resilience/build_norse_corpus_anderson.py
    python3 scripts-resilience/build_norse_corpus_anderson.py --raw path/to/cached.txt
    python3 scripts-resilience/build_norse_corpus_anderson.py --out corpus/norse-anderson-passages-STAGED.json
    python3 scripts-resilience/build_norse_corpus_anderson.py --emit-sample   # cleaning before/after only, no write
"""
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import unicodedata

SOURCE_URL = "https://www.gutenberg.org/ebooks/65910.txt.utf-8"
GUTENBERG_ID = 65910

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(REPO_ROOT, "corpus", "norse-anderson-passages-STAGED.json")
DEFAULT_CACHE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), ".cache", "anderson_norse_mythology_gutenberg65910.txt"
)

# --- SSL context: mirror scripts-resilience/ingest.py's trust-store handling ---
try:
    import truststore  # type: ignore

    truststore.inject_into_ssl()
    _SSL_CONTEXT = ssl.create_default_context()
except ImportError:
    try:
        import certifi  # type: ignore

        _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        _SSL_CONTEXT = None


# --- Normalization gate (byte-identical to scripts-resilience/ingest.py) -------
SALTILLO_CANONICAL = "ʼ"
SALTILLO_VARIANTS = ["'", "’", "‘", "՚", "ꞌ"]


def normalize_body(text: str) -> str:
    nfc = unicodedata.normalize("NFC", text)
    for v in SALTILLO_VARIANTS:
        nfc = nfc.replace(v, SALTILLO_CANONICAL)
    return nfc.strip()


def fetch_raw(cache_path: str) -> str:
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8", errors="replace") as f:
            return f.read()
    import urllib.request

    print(f"fetching {SOURCE_URL} ...", file=sys.stderr)
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "the-elder-corpus/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=_SSL_CONTEXT) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        f.write(raw)
    print(f"cached to {cache_path} ({len(raw):,} bytes)", file=sys.stderr)
    return raw


HEADING_RE = re.compile(r"^ *(PART|CHAPTER) ([IVXLC]+)\.\s*$")


def strip_boilerplate(raw: str) -> list[str]:
    """Body runs from the first in-body 'CHAPTER I.' heading (skipping the
    identical-looking table-of-contents occurrence) through just before the
    Vocabulary heading."""
    lines = raw.splitlines()

    chapter_i_hits = [i for i, ln in enumerate(lines) if HEADING_RE.match(ln) and "CHAPTER" in ln and ln.strip().rstrip(".") == "CHAPTER I"]
    # the TOC's "CHAPTER I." is immediately followed (a few lines later) by
    # a second "CHAPTER I." for the same reason further down; the BODY one
    # is the first occurrence whose title line is immediately followed by a
    # blank line then a block of running prose (not a dash-page-number TOC
    # entry). Simpler and robust here: the TOC block ends right after the
    # "Vocabulary, 439 / Index, 462" lines and "INTRODUCTION." heading (bare,
    # no page number) precedes the real Chapter I.
    intro_idx = None
    for i, ln in enumerate(lines):
        if ln.strip() == "INTRODUCTION." and i > 0:
            # the TOC's own "INTRODUCTION." (no leading spaces, followed by
            # "CHAPTER I." then a blank line then "WHAT IS MYTHOLOGY...")
            # vs the body's centered "INTRODUCTION." heading (leading spaces,
            # standalone, followed by blank lines then "CHAPTER I."). Body
            # heading is indented.
            if ln.startswith(" ") and lines[i].strip() == "INTRODUCTION.":
                intro_idx = i
                break
    if intro_idx is None:
        raise SystemExit("could not locate the body 'INTRODUCTION.' heading")
    start = intro_idx

    end = None
    for i in range(start, len(lines)):
        if "VOCABULARY OF THE PRINCIPAL PROPER NAMES" in lines[i]:
            end = i
            break
    if end is None:
        raise SystemExit("could not locate the Vocabulary boundary")

    return lines[start:end]


def strip_footnote_blocks(lines: list[str]) -> list[str]:
    """Drop 'Footnote N:' heading lines and the single indented paragraph
    that follows each one (Anderson's endnotes, collected at chapter ends)."""
    out: list[str] = []
    i = 0
    while i < len(lines):
        if re.match(r"^Footnote \d+:\s*$", lines[i].strip()):
            i += 1
            while i < len(lines) and not lines[i].strip():
                i += 1
            while i < len(lines) and lines[i].strip():
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return out


def find_headings(lines: list[str]) -> list[tuple[int, str, str]]:
    """Return (line_index, kind, roman) for every PART/CHAPTER heading."""
    out = []
    for i, ln in enumerate(lines):
        m = HEADING_RE.match(ln)
        if m:
            out.append((i, m.group(1), m.group(2)))
    return out


def extract_title(lines: list[str], after_idx: int) -> tuple[str, int]:
    """Title is the run of non-blank lines immediately after a heading line,
    joined with a single space. Returns (title, index_of_first_body_line)."""
    i = after_idx + 1
    while i < len(lines) and not lines[i].strip():
        i += 1
    title_lines = []
    while i < len(lines) and lines[i].strip():
        title_lines.append(lines[i].strip())
        i += 1
    title = re.sub(r"\s+", " ", " ".join(title_lines)).strip()
    # drop a trailing ", <page-number>" artifact if the TOC-style comma-page
    # tail leaked through (not expected in-body, defensive only)
    title = re.sub(r",\s*\d+$", "", title)
    return title, i


ROMAN_TO_INT = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10}

PART_TITLES = {
    1: "The Creation and Preservation of the World",
    2: "The Life and Exploits of the Gods",
    3: "Ragnarok and Regeneration",
}


def segment(lines: list[str]) -> list[dict]:
    headings = find_headings(lines)
    chunks: list[dict] = []
    part_num = 0  # 0 == Introduction
    for hi, (idx, kind, roman) in enumerate(headings):
        if kind == "PART":
            part_num = ROMAN_TO_INT[roman]
            continue
        title, body_start = extract_title(lines, idx)
        body_end = headings[hi + 1][0] if hi + 1 < len(headings) else len(lines)
        raw_body_lines = lines[body_start:body_end]
        raw_body_lines = strip_footnote_blocks(raw_body_lines)

        # collapse PG page-break rules and runs of blank lines; join into
        # paragraphs (blank line == paragraph break, already true for this
        # reflowed PG edition -- no OCR line-wrap repair needed).
        cleaned: list[str] = []
        for ln in raw_body_lines:
            s = ln.rstrip()
            if re.fullmatch(r"\s*-{3,}\s*", s):
                continue
            cleaned.append(s)

        paragraphs: list[str] = []
        cur: list[str] = []
        for ln in cleaned:
            if ln.strip():
                cur.append(ln.strip())
            elif cur:
                paragraphs.append(" ".join(cur))
                cur = []
        if cur:
            paragraphs.append(" ".join(cur))

        body = "\n\n".join(paragraphs).strip()
        body = re.sub(r"[ \t]{2,}", " ", body)

        chunks.append(
            {
                "part_num": part_num,
                "part_title": PART_TITLES.get(part_num, "Introduction"),
                "chapter_roman": roman,
                "chapter_num": ROMAN_TO_INT[roman],
                "title": title,
                "body": body,
            }
        )
    return chunks


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:56] or "chapter"


# --- Suggested marker mapping (SUGGESTED / UNCONFIRMED, pending human
# review -- same status as the Colum and Guerber passes). Anderson is
# analytic/expository, so markers here key off subject matter per chapter
# rather than narrative beats. ------------------------------------------------
_kw = lambda p: re.compile(p, re.I)
MARKER_RULES: list[tuple[str, set[tuple[int, int]], "re.Pattern | None"]] = [
    ("threshold", {(1, 1), (1, 2)}, None),  # The Creation; The Preservation (Ygdrasil/norns)
    ("wound", {(3, 1), (3, 2)}, None),  # Ragnarok; Regeneration
    ("figure", {(2, 1)}, None),  # Odin
    ("figure", {(2, 3)}, None),  # Balder and Nanna
    ("exile", {(2, 7)}, None),  # Loke and his offspring
    ("pattern", {(2, 4)}, _kw(r"Thrym|Hrungner|Geirrod|Skrymer|contest|wager")),  # Thor
]


def suggest_markers(chunk: dict) -> list[str]:
    key = (chunk["part_num"], chunk["chapter_num"])
    hay = f"{chunk['title']}\n{chunk['body']}"
    found: list[str] = []
    for marker, keys, rx in MARKER_RULES:
        if key not in keys:
            continue
        if rx is None or rx.search(hay):
            if marker not in found:
                found.append(marker)
    return found


REGISTER_NOTE = (
    "analytic/expository mythography (comparative-religion essay register), "
    "not a narrative retelling -- distinct in kind from Colum and Guerber in "
    "this same lineage"
)


def build_entries(chunks: list[dict]) -> list[dict]:
    entries: list[dict] = []
    for c in chunks:
        part_label = "Introduction" if c["part_num"] == 0 else f"Part {['', 'I', 'II', 'III'][c['part_num']]}"
        pid = f"norse-anderson-{'intro' if c['part_num'] == 0 else 'p' + str(c['part_num'])}-{c['chapter_num']:02d}-{slugify(c['title'])}"
        body = normalize_body(c["body"])
        section = f"{part_label} ({c['part_title']}) — Chapter {c['chapter_roman']}. {c['title'].title() if c['title'].isupper() else c['title']}"
        markers = suggest_markers(c)
        entries.append(
            {
                "passage_id": pid,
                "source": "Norse Mythology (Rasmus B. Anderson, 1879)",
                "section": section,
                "body": body,
                "themes": [],
                "nahuales": [],
                "cruz_positions": [],
                "signal_affinity": markers,
                "register": "exposition",
                "ceremonial_sensitivity": "open",
                "review_status": "approved",
                "reviewed_by": None,
                "review_date": None,
                "_provenance": {
                    "source_title": "Norse Mythology; or, The Religion of Our Forefathers, Containing All the Myths of the Eddas, Systematized and Interpreted",
                    "translator_or_author": "Rasmus B. Anderson",
                    "publication_year": 1879,
                    "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #65910",
                    "lineage_id": "norse",
                    "genre": "exposition",
                    "register_note": REGISTER_NOTE,
                    "public_domain": True,
                    "gutenberg_id": GUTENBERG_ID,
                    "source_url": SOURCE_URL,
                    "part_num": c["part_num"],
                    "part_title": c["part_title"],
                    "chapter_roman": c["chapter_roman"],
                    "chapter_title": c["title"],
                    "chunk_strategy": (
                        "anderson-chapter: one passage per chapter (the book's own "
                        "internal 'Section i./ii./...' subdivisions are not re-split); "
                        "text is the proofread Project Gutenberg transcription, not a "
                        "raw OCR/djvu scan, so no OCR-repair pipeline was needed."
                    ),
                    "markers_suggested": markers,
                    "markers_status": "SUGGESTED / UNCONFIRMED -- pending manual review (feeds NARRATIVE-01 register decision)",
                    "cleaning_applied": (
                        "front/back matter (title page, preface, TOC, Vocabulary, Index, "
                        "PG license) stripped; chapter/part heading and title lines removed "
                        "from body (recorded in 'section' instead); 'Footnote N:' endnote "
                        "blocks dropped; PG page-break rules and blank-line runs collapsed."
                    ),
                    "voice_authorization_note": (
                        "voice_key 'volva': same institutional-placeholder consent_grant as "
                        "the other Norse passes (Temporal Bridges Institute, 2026-01-01), not "
                        "a named tradition-bearer review. lib/traditions.ts governanceStatus "
                        "'active'. review_status here is 'approved' for TRANSCRIPTION "
                        "FIDELITY ONLY (clean PG source, no OCR residue) -- it does NOT "
                        "represent ceremonial or scholarly sign-off, which per repo memory "
                        "has never actually happened for this lineage."
                    ),
                    "pulled_via": "scripts-resilience/build_norse_corpus_anderson.py",
                },
                "voice_key": "volva",
            }
        )
    return entries


def cleaning_sample(raw: str) -> str:
    lines = strip_boilerplate(raw)
    before = "\n".join(lines[:40])
    chunks = segment(lines)
    after_parts = []
    for c in chunks[:2]:
        after_parts.append(
            f"[Part {c['part_num']} — Chapter {c['chapter_roman']}. {c['title']} "
            f"({len(c['body'])} chars)]\n" + c["body"][:900]
        )
    return (
        "================ BEFORE (first ~40 lines after front-matter strip) ================\n"
        + before
        + "\n\n================ AFTER (cleaned + segmented, first 2 chapters) ============================\n"
        + "\n\n".join(after_parts)
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", default=DEFAULT_CACHE, help="path to a cached Gutenberg .txt (downloaded if absent)")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output JSON path")
    ap.add_argument("--emit-sample", action="store_true", help="print cleaning before/after and exit (no write)")
    args = ap.parse_args()

    raw = fetch_raw(args.raw)

    if args.emit_sample:
        print(cleaning_sample(raw))
        return

    lines = strip_boilerplate(raw)
    chunks = segment(lines)
    entries = build_entries(chunks)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")

    by_part: dict[str, int] = {}
    marker_counts: dict[str, int] = {}
    untagged = 0
    for e in entries:
        pt = e["_provenance"]["part_num"]
        by_part[str(pt)] = by_part.get(str(pt), 0) + 1
        if not e["signal_affinity"]:
            untagged += 1
        for m in e["signal_affinity"]:
            marker_counts[m] = marker_counts.get(m, 0) + 1
    lengths = sorted(len(e["body"]) for e in entries)
    print(
        json.dumps(
            {
                "wrote": os.path.relpath(args.out, REPO_ROOT),
                "entries": len(entries),
                "chapters_expected": 19,
                "entries_per_part": by_part,
                "body_chars_min_median_max": [lengths[0], lengths[len(lengths) // 2], lengths[-1]],
                "suggested_marker_counts": marker_counts,
                "entries_with_no_marker": untagged,
                "review_status": "approved (all) -- transcription fidelity only, see voice_authorization_note",
                "next": [
                    "python3 scripts-resilience/ingest.py corpus/norse-anderson-passages-STAGED.json --dry-run",
                    'confirm DEV DATABASE_URL, then: python3 scripts-resilience/ingest.py corpus/norse-anderson-passages-STAGED.json "$DEV_DB_URL"',
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
