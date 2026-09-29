#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_norse_corpus_mackenzie_teutonic.py -- Norse lineage corpus, Donald A.
Mackenzie, "Teutonic Myth and Legend" (Gresham Publishing Co., London,
1912; "Myth and Legend in Literature and Art" series -- the same series
line as Mackenzie's "Egyptian Myth and Legend", 1907, already present in
this corpus under a different lineage). Archive.org identifier
dli.ministry.23711 (OCR djvu.txt).

Same contract as the other Norse ingestion passes: this script fetches,
cleans, segments and stages a JSON file ONLY. It never touches the database
and never embeds. The real gate is the shared CLI:

    python3 scripts-resilience/ingest.py corpus/norse-mackenzie-teutonic-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/norse-mackenzie-teutonic-passages-STAGED.json "$DEV_DATABASE_URL"

CONVENTIONS REUSED FROM PASS 1/2/3 (verified against the repo 2026-09-15):
  - Target table: corpus_passage, via scripts-resilience/ingest.py. There is
    NO "myth_entry" schema anywhere in the repo.
  - Required per-entry fields: passage_id, source, section, body, voice_key.
  - voice_key for the Norse voice is "volva" (lineage_key column). Mackenzie
    titles this book "Teutonic", covering Norse/Germanic myth broadly (the
    Eddas, Beowulf, the Volsung/Nibelung cycle, Dietrich of Bern), which is
    the same subject range already staged under 'volva' from the Poetic/
    Prose Eddas, Colum, and Anderson passes -- so it is staged under the
    same voice_key, not a new lineage.
  - Provenance columns do not exist on corpus_passage; carried in the
    per-entry "_provenance" object, which ingest.py neither reads nor
    stores -- human audit only.
  - Normalization: byte-identical NFC + saltillo transform to ingest.py.
  - No "_comment" key on any entry (ingest.py --dry-run rejects it).

STRUCTURE: 42 numbered chapters, no Part/Book divisions (confirmed against
the fetched table of contents and the 42 in-body "CHAPTER <roman>" anchors,
which are unambiguous -- unlike the TOC's own heavily OCR-garbled small-caps
rendering, e.g. "Srory or CREATION" for "Story of Creation"). Each chapter
opens with: a CHAPTER heading, a clean Title Case chapter title, then an
em-dash-delimited topic synopsis (an authorial chapter "argument", not
narrative prose) before the narrative body itself begins. The synopsis is
stripped from the body and preserved in "_provenance.chapter_synopsis".

OCR QUALITY: this is a raw OCR djvu transcription (unlike the Anderson
Gutenberg pass), but of noticeably higher quality than the Colum pass --
decorative front matter (dedication/plate-list pages) is heavily garbled,
but ordinary chapter prose OCRs cleanly with only scattered scannos ("1s"
for "is", curly-quote artifacts). No drop-cap/folio-mapping machinery is
needed: chapter boundaries are given directly by the 42 unambiguous
"CHAPTER <roman>" anchor lines. What IS needed, and is applied here:
  - Running heads stripped: verso "<N> TEUTONIC MYTH AND LEGEND", recto
    "<CHAPTER TITLE, upper/mixed case, OCR-variable> <N>" -- matched against
    each chapter's own already-known title, not guessed generically.
  - Occasional trailing footnote paragraphs (single digit-prefixed sentences
    at a chapter's tail, e.g. "1 Like Odin, Charlemagne, King Arthur, &c.,
    he is the Wild Huntsman...") dropped.
  - Scanner artifact lines (stray parenthesised plate/signature marks) and
    blank-line runs collapsed.

KNOWN RESIDUE for a human review pass: scattered scannos are NOT
autocorrected (unlike Colum's vocab-attested rejoin pass) since this text's
line-wrap is largely intact and scanno density is low; a manual pass should
still check each entry.

USAGE
-----
    python3 scripts-resilience/build_norse_corpus_mackenzie_teutonic.py
    python3 scripts-resilience/build_norse_corpus_mackenzie_teutonic.py --raw path/to/cached_djvu.txt
    python3 scripts-resilience/build_norse_corpus_mackenzie_teutonic.py --out corpus/norse-mackenzie-teutonic-passages-STAGED.json
    python3 scripts-resilience/build_norse_corpus_mackenzie_teutonic.py --emit-sample   # cleaning before/after only, no write
"""
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import unicodedata

SOURCE_URL = "https://archive.org/download/dli.ministry.23711/E08349_Teutonic_Myth_And_Legend_djvu.txt"
ARCHIVE_ID = "dli.ministry.23711"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(REPO_ROOT, "corpus", "norse-mackenzie-teutonic-passages-STAGED.json")
DEFAULT_CACHE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), ".cache", "mackenzie_teutonic_myth_legend_djvu.txt"
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


ROMAN_TO_INT = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10,
    "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15, "XVI": 16, "XVII": 17, "XVIII": 18,
    "XIX": 19, "XX": 20, "XXI": 21, "XXII": 22, "XXIII": 23, "XXIV": 24, "XXV": 25, "XXVI": 26,
    "XXVII": 27, "XXVIII": 28, "XXIX": 29, "XXX": 30, "XXXI": 31, "XXXII": 32, "XXXIII": 33,
    "XXXIV": 34, "XXXV": 35, "XXXVI": 36, "XXXVII": 37, "XXXVIII": 38, "XXXIX": 39, "XL": 40,
    "XLI": 41, "XLII": 42,
}

# The OCR renders 'V' as 'Vv' on one chapter heading ("CHAPTER Vv"); tolerate
# stray case noise in the roman numeral token itself.
CHAPTER_RE = re.compile(r"^CHAPTER\s+([IVXLivxl]+)\s*$")


def find_chapter_starts(lines: list[str]) -> list[tuple[int, str, int]]:
    out = []
    for i, ln in enumerate(lines):
        m = CHAPTER_RE.match(ln.strip())
        if m:
            roman = m.group(1).upper()
            if roman == "VV":  # OCR misreads 'V' as doubled 'Vv' on one heading
                roman = "V"
            if roman in ROMAN_TO_INT:
                out.append((i, roman, ROMAN_TO_INT[roman]))
    return out


def strip_boilerplate(raw: str) -> tuple[list[str], int]:
    """Body runs from the first 'CHAPTER I' anchor through just before the
    post-body 'INDEX' heading. Returns (lines, offset) where offset is the
    original line number of lines[0] (for a sanity check on chapter count)."""
    lines = raw.splitlines()
    starts = find_chapter_starts(lines)
    if len(starts) != 42:
        raise SystemExit(f"expected 42 'CHAPTER <roman>' anchors, found {len(starts)}")
    start = starts[0][0]

    end = None
    for i in range(starts[-1][0], len(lines)):
        if lines[i].strip() == "INDEX":
            end = i
            break
    if end is None:
        raise SystemExit("could not locate the post-body INDEX boundary")
    return lines[start:end], start


def extract_title(lines: list[str], after_idx: int) -> tuple[str, int]:
    i = after_idx + 1
    while i < len(lines) and not lines[i].strip():
        i += 1
    title_lines = []
    while i < len(lines) and lines[i].strip():
        title_lines.append(lines[i].strip())
        i += 1
    return re.sub(r"\s+", " ", " ".join(title_lines)).strip(), i


def split_paragraphs(lines: list[str]) -> list[str]:
    paras: list[str] = []
    cur: list[str] = []
    for ln in lines:
        if ln.strip():
            cur.append(ln.strip())
        elif cur:
            paras.append(" ".join(cur))
            cur = []
    if cur:
        paras.append(" ".join(cur))
    return paras


# Each chapter opens with a decorative drop-cap + small-caps run that the
# OCR frequently misreads letter-by-letter (not just a dropped initial, as
# in the Colum pass -- e.g. 'Tue' for 'The', 'Opin' for 'Odin', 'Wuen' for
# 'When', 'Kinc' for 'King', 'TuHor' for 'Thor'). Because the same garbled
# token decodes to DIFFERENT correct words in different chapters (chapter 4
# opens 'Ir Odin sought...' -> 'If'; chapter 36 opens 'Ir fell that...' ->
# 'It'), this cannot be fixed by a global find/replace or a generic
# letter-recovery heuristic -- each was confirmed by hand against that
# chapter's own topic synopsis and surrounding sentence. Chapters not
# listed here had a correctly-OCR'd opening word (verified by inspection).
FIRST_WORD_FIXES: dict[int, tuple[str, str]] = {
    2: ("Tue", "The"),
    3: ("Opin", "Odin"),
    4: ("Ir", "If"),
    6: ("Wuen", "When"),
    7: ("Wuen", "When"),
    8: ("Tue", "The"),
    9: ("Svrppac", "Svipdag"),
    11: ("/Ecir", "Æger"),
    12: ("Tue", "The"),
    14: ("TuHor", "Thor"),
    15: ("BaLDER THE BEauTiFuL", "Balder the Beautiful"),
    17: ("THERE", "There"),
    20: ("Browutr", "Beowulf"),
    21: ("Horuer", "Hother"),
    22: ("Kinc", "King"),
    24: ("THERE", "There"),
    27: ("SIGMUND", "Sigmund"),
    28: ("Wuen", "When"),
    29: ("WuEen", "When"),
    31: ("Wuen", "When"),
    32: ("SIEGFRIED?", "Siegfried"),
    33: ("Tue", "The"),
    35: ("SIEGFRIED", "Siegfried"),
    36: ("Ir", "It"),
    37: ("DizrricH", "Dietrich"),
    40: ("Trpincs", "Tidings"),
    41: ("Kinc ERMENRICH", "King Ermenrich"),
}


def fix_dropcap(body: str, chapter_num: int) -> str:
    fix = FIRST_WORD_FIXES.get(chapter_num)
    if fix and body.startswith(fix[0]):
        body = fix[1] + body[len(fix[0]):]
    return body


def is_footnote_paragraph(p: str) -> bool:
    return bool(re.match(r"^\d{1,2}\s+[A-Z]", p)) and len(p) < 400


def strip_running_heads(lines: list[str], title: str) -> list[str]:
    """Drop verso '<N> TEUTONIC MYTH AND LEGEND' and recto '<TITLE> <N>'
    running heads. The recto pattern is matched against this chapter's own
    title (case-insensitive, OCR-tolerant on trailing punctuation) since
    running heads reprint the exact chapter title.

    The scanner frequently failed to break the running head onto its own
    line -- it OCRs fused onto the first line of prose after a page break
    ('32, TEUTONIC MYTH AND LEGEND by the great steed Svadilfare.'), so a
    whole-line match alone misses most instances. Match and excise the
    phrase (with its adjacent folio-number noise, which OCRs variably as
    digits, punctuation, or short letter garble like 'so' for '50') wherever
    it occurs within a line, not just when it is the whole line."""
    title_core = re.escape(re.sub(r"[^A-Za-z ]", "", title).strip().upper())
    recto_re = (
        re.compile(rf"(?<![A-Za-z]){title_core}[\s_\-–—.,]{{0,6}}\d{{1,4}}[\s_\-.,]{{0,2}}", re.I)
        if len(title_core) >= 6
        else None
    )
    # folio noise: digits/punctuation/short letter-garble token adjacent to
    # the fixed phrase, on either side (folio can precede OR trail it).
    verso_re = re.compile(
        r"[\s«]*[\w.,]{0,6}[\s«=,.]*TEUTONIC\W{0,3}MYTH\W{0,3}AND\W{0,3}LEGEND[\s«=,.]*[\w.,]{0,6}",
        re.I,
    )
    scanner_artifact_re = re.compile(r"^\s*\(\s*[o0O]\s*\d{2,4}\s*\)[\s\d]*$")

    out = []
    for ln in lines:
        s = ln.strip()
        if not s:
            out.append(ln)
            continue
        if scanner_artifact_re.match(s):
            continue
        s2 = verso_re.sub(" ", ln)
        if recto_re:
            s2 = recto_re.sub(" ", s2)
        s2 = re.sub(r"[ \t]{2,}", " ", s2)
        out.append(s2)
    return out


def segment(lines: list[str]) -> list[dict]:
    starts = find_chapter_starts(lines)
    chunks: list[dict] = []
    for hi, (idx, roman, num) in enumerate(starts):
        title, body_start = extract_title(lines, idx)
        body_end = starts[hi + 1][0] if hi + 1 < len(starts) else len(lines)
        chapter_lines = strip_running_heads(lines[body_start:body_end], title)
        paragraphs = split_paragraphs(chapter_lines)

        synopsis = None
        if paragraphs and paragraphs[0].count("—") >= 3:
            synopsis = paragraphs[0]
            paragraphs = paragraphs[1:]

        paragraphs = [p for p in paragraphs if not is_footnote_paragraph(p)]

        # Reflow: a running head / scanner-artifact / folio line sits between
        # two blank lines at a page break, so stripping it (strip_running_heads,
        # above) leaves a genuine mid-sentence paragraph split behind. Rejoin
        # onto the previous paragraph whenever it does NOT end on
        # sentence-final punctuation -- a real authorial paragraph break does,
        # a page-break artifact split does not.
        reflowed: list[str] = []
        for p in paragraphs:
            if reflowed and reflowed[-1] and reflowed[-1].rstrip()[-1] not in '.!?"”:;)—':
                reflowed[-1] = reflowed[-1].rstrip() + " " + p.lstrip()
            else:
                reflowed.append(p)
        paragraphs = reflowed

        body = "\n\n".join(paragraphs).strip()
        # Residual bare folio numbers: a lone 1-4 digit token wedged between
        # sentence-final punctuation and the next capitalised word is a page
        # number the running-head strip above didn't catch (it had no
        # adjacent 'TEUTONIC MYTH AND LEGEND' or chapter-title text fused to
        # it -- e.g. '...him harm. 44 With Njord went...'). This prose never
        # otherwise uses a bare numeral (Mackenzie spells numbers out), so
        # this pattern is unambiguous.
        body = re.sub(r"(?<=[a-zA-Z.,;:!?’”])\s+\d{1,4}\s+(?=[A-Z])", " ", body)
        body = re.sub(r"[ \t]{2,}", " ", body)
        body = fix_dropcap(body, num)

        chunks.append(
            {
                "chapter_roman": roman,
                "chapter_num": num,
                "title": title,
                "synopsis": synopsis,
                "body": body,
            }
        )
    return chunks


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:56] or "chapter"


# --- Suggested marker mapping (SUGGESTED / UNCONFIRMED, pending human
# review -- same status as the other Norse passes). Keyed on chapter number
# against the confirmed TOC (chapters map 1:1 to the numbers below). --------
_kw = lambda p: re.compile(p, re.I)
MARKER_RULES: list[tuple[str, set[int], "re.Pattern | None"]] = [
    ("threshold", {1, 2}, None),  # Story of Creation; The Nine Worlds
    ("wound", {16, 17, 18}, None),  # Balder the Beautiful; The Binding of Loke; The Dusk of the Gods
    ("figure", {3, 4}, None),  # How Evil entered Asgard; The Winter War (Odin/early cosmology figures)
    ("exile", {11, 17}, _kw(r"Loke|banish|exile|bound|fetter")),
    ("pattern", {14, 15}, _kw(r"contest|wager|trick|riddle|stone giant")),  # Thor in Peril; The Great Stone Giant
    ("wound", {25, 26}, None),  # The Doom of the Volsungs; How Sigmund was Avenged
    ("wound", {38, 39}, None),  # The Betrayal of Siegfried; The Nibelungen Tragedy
]


def suggest_markers(chunk: dict) -> list[str]:
    key = chunk["chapter_num"]
    hay = f"{chunk['title']}\n{chunk['synopsis'] or ''}\n{chunk['body']}"
    found: list[str] = []
    for marker, keys, rx in MARKER_RULES:
        if key not in keys:
            continue
        if rx is None or rx.search(hay):
            if marker not in found:
                found.append(marker)
    return found


REGISTER_NOTE = (
    "narrative retelling with an em-dash topic synopsis prefacing each "
    "chapter (stripped to _provenance.chapter_synopsis) -- comparable "
    "register to Colum/Guerber, broader Teutonic-wide scope (Eddas, "
    "Beowulf, the Volsung/Nibelung cycle, Dietrich of Bern) rather than "
    "Norse-only"
)


def build_entries(chunks: list[dict]) -> list[dict]:
    entries: list[dict] = []
    for c in chunks:
        pid = f"norse-mackenzie-{c['chapter_num']:02d}-{slugify(c['title'])}"
        body = normalize_body(c["body"])
        section = f"Chapter {c['chapter_roman']}. {c['title']}"
        markers = suggest_markers(c)
        entries.append(
            {
                "passage_id": pid,
                "source": "Teutonic Myth and Legend (Donald A. Mackenzie, 1912)",
                "section": section,
                "body": body,
                "themes": [],
                "nahuales": [],
                "cruz_positions": [],
                "signal_affinity": markers,
                "register": "narrative",
                "ceremonial_sensitivity": "open",
                "review_status": "approved",
                "reviewed_by": None,
                "review_date": None,
                "_provenance": {
                    "source_title": "Teutonic Myth and Legend",
                    "translator_or_author": "Donald A. Mackenzie",
                    "publication_year": 1912,
                    "public_domain_basis": "UK/US publication pre-1929",
                    "lineage_id": "norse",
                    "genre": "retelling",
                    "register_note": REGISTER_NOTE,
                    "public_domain": True,
                    "archive_org_identifier": ARCHIVE_ID,
                    "source_url": SOURCE_URL,
                    "series": "Myth and Legend in Literature and Art (Gresham Publishing Co.)",
                    "chapter_roman": c["chapter_roman"],
                    "chapter_number": c["chapter_num"],
                    "chapter_title": c["title"],
                    "chapter_synopsis": c["synopsis"],
                    "chunk_strategy": (
                        "mackenzie-chapter: one passage per chapter, anchored on the 42 "
                        "unambiguous in-body 'CHAPTER <roman>' lines (no folio-mapping "
                        "needed, unlike the Colum pass). Each chapter's own already-known "
                        "title is used to match and strip that chapter's running heads."
                    ),
                    "markers_suggested": markers,
                    "markers_status": "SUGGESTED / UNCONFIRMED -- pending manual review (feeds NARRATIVE-01 register decision)",
                    "cleaning_applied": (
                        "front matter (title/plate pages, preface, TOC) and back matter "
                        "(INDEX) stripped; per-chapter CHAPTER heading and title lines "
                        "removed from body (recorded in 'section' instead); the em-dash "
                        "topic synopsis preceding each chapter's narrative moved to "
                        "chapter_synopsis; verso ('<N> TEUTONIC MYTH AND LEGEND') and recto "
                        "('<CHAPTER TITLE> <N>') running heads stripped per-chapter against "
                        "that chapter's own title, with paragraph reflow across the removed "
                        "page break; trailing digit-prefixed footnote paragraphs dropped; "
                        "stray scanner/signature-mark lines removed; each chapter's opening "
                        "decorative drop-cap word, hand-verified against that chapter's own "
                        "topic synopsis, corrected via FIRST_WORD_FIXES (e.g. 'Tue'->'The', "
                        "'Opin'->'Odin', 'Wuen'->'When') -- NOT autocorrected generically, "
                        "since the same garbled token decodes to different words in "
                        "different chapters. One residual NOT corrected: chapter XXIII "
                        "('Hamlet's Storm-mill') opens with a garbled quoted term "
                        "('AmLopeEʼs mealbin', likely the Amlothi/Amlodi quern-mill "
                        "reference) left as-is -- flagged for the manual review pass rather "
                        "than guessed at."
                    ),
                    "ocr_residue_note": (
                        "raw OCR djvu transcription (not a proofread edition like the "
                        "Anderson pass) -- ordinary prose OCRs cleanly but scattered scannos "
                        "were NOT autocorrected (low density, line-wrap intact); flag for "
                        "the manual review pass."
                    ),
                    "voice_authorization_note": (
                        "voice_key 'volva': same institutional-placeholder consent_grant as "
                        "the other Norse passes (Temporal Bridges Institute, 2026-01-01), not "
                        "a named tradition-bearer review. lib/traditions.ts governanceStatus "
                        "'active'. review_status here is 'approved' for TRANSCRIPTION "
                        "STRUCTURE ONLY (clean chapter anchors, running heads matched and "
                        "stripped) -- it does NOT represent ceremonial or scholarly sign-off, "
                        "which per repo memory has never actually happened for this lineage."
                    ),
                    "pulled_via": "scripts-resilience/build_norse_corpus_mackenzie_teutonic.py",
                },
                "voice_key": "volva",
            }
        )
    return entries


def cleaning_sample(raw: str) -> str:
    lines, offset = strip_boilerplate(raw)
    before = "\n".join(lines[:30])
    chunks = segment(lines)
    after_parts = []
    for c in chunks[:2]:
        after_parts.append(
            f"[Chapter {c['chapter_roman']}. {c['title']}  ({len(c['body'])} chars)]\n"
            f"synopsis: {c['synopsis']}\n\n" + c["body"][:900]
        )
    return (
        "================ BEFORE (first ~30 lines after front-matter strip) ================\n"
        + before
        + "\n\n================ AFTER (cleaned + segmented, first 2 chapters) ============================\n"
        + "\n\n".join(after_parts)
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", default=DEFAULT_CACHE, help="path to a cached _djvu.txt (downloaded if absent)")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output JSON path")
    ap.add_argument("--emit-sample", action="store_true", help="print cleaning before/after and exit (no write)")
    args = ap.parse_args()

    raw = fetch_raw(args.raw)

    if args.emit_sample:
        print(cleaning_sample(raw))
        return

    lines, _ = strip_boilerplate(raw)
    chunks = segment(lines)
    entries = build_entries(chunks)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")

    marker_counts: dict[str, int] = {}
    untagged = 0
    for e in entries:
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
                "chapters_expected": 42,
                "body_chars_min_median_max": [lengths[0], lengths[len(lengths) // 2], lengths[-1]],
                "suggested_marker_counts": marker_counts,
                "entries_with_no_marker": untagged,
                "review_status": "approved (all) -- transcription structure only, see voice_authorization_note",
                "next": [
                    "python3 scripts-resilience/ingest.py corpus/norse-mackenzie-teutonic-passages-STAGED.json --dry-run",
                    'confirm DEV DATABASE_URL, then: python3 scripts-resilience/ingest.py corpus/norse-mackenzie-teutonic-passages-STAGED.json "$DEV_DB_URL"',
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
