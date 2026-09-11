#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_norse_corpus_edda.py -- INGESTION PASS 3: Norse lineage corpus
(Snorri Sturluson, "The Prose Edda", trans. Arthur Gilchrist Brodeur, 1916.
American-Scandinavian Foundation. Archive.org identifier proseedda00snor.)

Same contract as INGESTION PASS 1/2 (scripts-resilience/build_norse_corpus.py,
build_norse_corpus_colum.py): this script fetches, cleans, segments and STAGES
JSON only. It never touches the database and never embeds. The real gate is the
shared CLI:

    python3 scripts-resilience/ingest.py corpus/norse-edda-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/norse-edda-passages-STAGED.json "$DEV_DATABASE_URL"

CONVENTIONS REUSED FROM PASS 1/2 (verified against the repo 2026-09-10, not
re-derived):
  - Target table: corpus_passage, via scripts-resilience/ingest.py. There is
    NO "myth_entry" schema anywhere in the repo.
  - Required per-entry fields: passage_id, source, section, body, voice_key.
  - voice_key for the Norse voice is "volva" (lib/lineageToVoiceKey.ts /
    retrieval filters lineage_key = 'volva'). The brief's `lineage_id: norse`
    is recorded in _provenance for audit; the storage key is still "volva".
  - Provenance columns (source_title / translator_or_author / publication_year /
    public_domain_basis / genre / section) DO NOT EXIST on corpus_passage. They
    are carried in the per-entry "_provenance" object, which ingest.py neither
    reads nor stores -- human audit only. `section` ALSO rides the real
    corpus_passage.section text column (prologue | gylfaginning | skaldskaparmal
    prefix), which is how this pass keeps the three divisions queryable.
  - signal_affinity is the marker field: TEXT[], subset of
    wound / figure / threshold / exile / pattern (lowercase). Markers here are
    SUGGESTED / UNCONFIRMED (see _provenance.markers_status) and are attached
    ONLY to Gylfaginning chapters -- never to Skaldskaparmal.
  - Normalization: ingest.py applies NFC + K'iche' saltillo -> U+02BC to every
    body before storage. We apply the byte-identical transform here so
    `ingest.py --dry-run`'s is_canonical() check passes. Side effect: English
    apostrophes ("God's") become U+02BC ("Godʼs"). Pre-existing pipeline
    behaviour for all voices, not introduced here.
  - No "_comment" key on any entry (ingest.py --dry-run rejects it).
  - review_status = "draft" for every entry -> stored without an embedding,
    invisible to retrieval until a human promotes it to "approved".

GENRE DIFFERENCE FROM PASS 1/2:
  Guerber and Colum are prose RETELLINGS (_provenance.genre = "retelling").
  Brodeur is a TRANSLATION of a primary medieval source
  (_provenance.genre = "primary_source"). This is a _provenance audit value
  only -- corpus_passage has no genre column, confirmed against schema.sql.

THREE-PART STRUCTURE (confirmed against the fetched text, not assumed):
  - PROLOGUE      -- continuous euhemerising prose, NO numbered chapters
  - GYLFAGINNING  ("The Beguiling of Gylfi") -- 54 numbered chapters I-LIV,
    Gylfi's Q&A with the AEsir; each numbered chapter is one myth-unit
  - SKALDSKAPARMAL ("The Poesy of Skalds") -- ch. I-III narrative frame
    (AEgir & Bragi; the Thjazi/Idunn and Niflung matter), then the bulk is
    kenning-lists and poetic-diction reference, plus interpolated thulur.
    STAGED TO A SEPARATE FILE (corpus/norse-edda-skaldskaparmal-STAGED.json)
    and flagged distinctly: ch. I-III register 'narrative', ch. IV+ register
    'exposition' with _provenance.reference_material = true. INGEST APPROVED
    for the narrative-retelling voice by Jesse Barber (yesiah@gmail.com),
    2026-09-10. HATTATAL is not in Brodeur's translation.

USAGE
-----
    python3 scripts-resilience/build_norse_corpus_edda.py
    python3 scripts-resilience/build_norse_corpus_edda.py --raw path/to/cached_djvu.txt
    python3 scripts-resilience/build_norse_corpus_edda.py --emit-sample      # cleaning before/after + structure report, no write
    python3 scripts-resilience/build_norse_corpus_edda.py --no-skaldskaparmal # skip the skaldskaparmal staged file (it is written by default)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import unicodedata

SOURCE_URL = "https://archive.org/download/proseedda00snor/proseedda00snor_djvu.txt"
ARCHIVE_ID = "proseedda00snor"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(REPO_ROOT, "corpus", "norse-edda-passages-STAGED.json")
SKALD_OUT = os.path.join(REPO_ROOT, "corpus", "norse-edda-skaldskaparmal-STAGED.json")
DEFAULT_CACHE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "brodeur_prose_edda_djvu.txt"
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


# --- Roman numeral parsing (chapter headers) ----------------------------------
_ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def roman_to_int(s: str) -> int | None:
    s = s.upper()
    if not s or any(c not in _ROMAN for c in s):
        return None
    total, prev = 0, 0
    for c in reversed(s):
        v = _ROMAN[c]
        total += -v if v < prev else v
        prev = max(prev, v)
    return total


def int_to_roman(n: int) -> str:
    vals = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"),
            (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"),
            (5, "V"), (4, "IV"), (1, "I")]
    out = []
    for v, sym in vals:
        while n >= v:
            out.append(sym)
            n -= v
    return "".join(out)


# --- Section boundaries: marker lines in the body ----------------------------
RE_PROLOGUE_START = re.compile(r"^\s*PROLOGUE\s*$")
RE_GYLF_START = re.compile(r"^\s*GYLFAGINNING\s*$")
RE_SKALD_START = re.compile(r"^\s*SKALDSKAPARM[AÁ]L\s*$", re.I)
RE_INDEX_START = re.compile(r"^\s*INDEX\s*$")

# A chapter header: "I.  King Gylfi ruled...", "XLIX.  Then said Gangleri:"
# The numeral is followed by a period then a space then a capital / opening
# quote. OCR mangles the numeral freely: lowercases it, turns "I"->"1"/"l",
# splits "XLVI" -> "XL VI", renders "XIII" -> "Xni". So we match a very
# permissive token (roman letters + common OCR confusables + internal spaces),
# strip it to roman, and validate by SEQUENCE, not by the printed value -- the
# brief: "don't trust OCR'd headers ... assign sequentially."
RE_CHAPTER = re.compile(r'^\s*([IVXLCDMivxlcdm1ntaïÜ][IVXLCDMivxlcdm1ntaïÜ .]{0,9})\.\s{0,4}(["\'‘’“^–—A-Z])')


def _ocr_roman_value(tok: str) -> int | None:
    g = tok.upper().replace(" ", "").replace("1", "I").replace("T", "I").replace("Ü", "V")
    g = re.sub(r"[^IVXLCDM]", "", g)
    return roman_to_int(g) if g else None

# Running heads / page furniture to drop.
RE_RUNNING_HEAD = re.compile(
    r"^\s*(?:\d{1,3}\s+)?(?:PROSE\s+EDDA|PROLOGUE|GYLFAGINNING|"
    r"SKALDSKAPARM[AÁ]L|THE\s+BEGUILING\s+OF\s+GYLFI|HERE\s+BEGINS|"
    r"THE\s+POESY\s+OF\s+SKALDS)\s*(?:\d{1,3})?\s*$",
    re.I,
)
RE_PAGE_NUMBER = re.compile(r"^\s*[0-9ivxlcIVXLC]{1,6}\s*$")
# Footnote lines: start with * or a caret/superscript OCR marker, or are a lone
# short "N Now Laesso."-style gloss. Brodeur footnotes are set small at the
# page foot and the OCR drops them inline as short lines beginning with * ^ or
# a digit+space gloss. Conservative: only strip clear cases.
RE_FOOTNOTE = re.compile(r"^\s*[\*\^†‡]\s?\S")


def fetch_raw(cache_path: str) -> str:
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8", errors="replace") as f:
            return f.read()
    import urllib.request

    print(f"fetching {SOURCE_URL} ...", file=sys.stderr)
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "the-elder-corpus/1.0"})
    with urllib.request.urlopen(req, timeout=90, context=_SSL_CONTEXT) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        f.write(raw)
    print(f"cached to {cache_path} ({len(raw):,} bytes)", file=sys.stderr)
    return raw


def split_sections(raw: str) -> dict[str, list[str]]:
    """Return {'prologue': [...], 'gylfaginning': [...], 'skaldskaparmal': [...]}
    as raw line lists, sliced at the in-body marker lines and stopping at INDEX.

    The TOC near the top of the file also contains the words PROLOGUE /
    GYLFAGINNING / SKALDSKAPARMAL, so we take the SECOND standalone PROLOGUE
    line (the body one) as the start, per inspection of the fetched text."""
    lines = raw.splitlines()

    prologue_hits = [i for i, ln in enumerate(lines) if RE_PROLOGUE_START.match(ln)]
    gylf_hits = [i for i, ln in enumerate(lines) if RE_GYLF_START.match(ln)]
    skald_hits = [i for i, ln in enumerate(lines) if RE_SKALD_START.match(ln)]
    index_hits = [i for i, ln in enumerate(lines) if RE_INDEX_START.match(ln)]
    if len(prologue_hits) < 2 or not gylf_hits or not skald_hits or not index_hits:
        raise SystemExit(
            f"section markers not found as expected: "
            f"prologue={prologue_hits[:3]} gylf={gylf_hits[:3]} "
            f"skald={skald_hits[:3]} index={index_hits[:3]}"
        )

    p_start = prologue_hits[1] + 1
    g_start = next(h for h in gylf_hits if h > p_start)
    s_start = next(h for h in skald_hits if h > g_start)
    end = next(h for h in index_hits if h > s_start)

    return {
        "prologue": lines[p_start:g_start],
        "gylfaginning": lines[g_start + 1 : s_start],
        "skaldskaparmal": lines[s_start + 1 : end],
    }


def build_vocab(lines: list[str]) -> set[str]:
    text = " ".join(lines).lower()
    return set(re.findall(r"[a-z]{3,}", text))


def declutter(lines: list[str], vocab: set[str]) -> list[str]:
    """Drop running heads / page numbers / obvious footnotes, collapse the
    doubled OCR inter-word spacing, and rejoin words split across a line break.
    Never introduces a blank line into a paragraph."""
    kept: list[str] = []
    for ln in lines:
        raw = ln.strip()
        if not raw:
            kept.append("")
            continue
        if RE_RUNNING_HEAD.match(raw) or RE_PAGE_NUMBER.match(raw):
            continue
        if RE_FOOTNOTE.match(raw) and len(raw) <= 120:
            continue
        kept.append(re.sub(r"[ \t]{2,}", " ", raw))

    # rejoin line-break word splits
    i = 0
    while i < len(kept) - 1:
        cur, nxt = kept[i], kept[i + 1]
        if not cur or not nxt:
            i += 1
            continue
        m = re.search(r"([A-Za-z]+)(-?)$", cur)
        n = re.match(r"([A-Za-z]+)([.,;:!?’'\"\)]*)(.*)$", nxt)
        if not m or not n:
            i += 1
            continue
        head, hyphen = m.group(1), m.group(2)
        tail, trail, rest = n.group(1), n.group(2), n.group(3).lstrip()
        solid = (head + tail).lower()
        form = None
        if hyphen == "-":
            form = head + tail if solid in vocab else head + "-" + tail
        elif (
            head.islower() and tail.islower() and len(solid) >= 5 and len(head) >= 3
            and solid in vocab and head not in _STOPWORDS
        ):
            form = head + tail
        if form is None:
            i += 1
            continue
        kept[i] = (cur[: m.start(1)].rstrip() + " " + form + trail).strip()
        if rest:
            kept[i + 1] = rest
        else:
            del kept[i + 1]
    return kept


_STOPWORDS = {
    "a", "i", "an", "as", "in", "on", "of", "to", "or", "he", "we", "so", "no",
    "it", "is", "at", "by", "up", "my", "the", "and", "but", "for", "her", "his",
    "him", "she", "was", "are", "not", "all", "who", "had", "has", "one", "out",
    "its", "may", "did", "our", "now", "new", "two", "own", "saw", "let", "you",
    "were", "them", "then", "they", "this", "that", "with", "from", "have",
}


def scrub(text: str) -> str:
    # Brodeur's OCR renders opening quotes as ^^ / '^ / ^ and closing as ''
    text = re.sub(r"(?:\^\^|'\^|\^')", '"', text)
    text = text.replace("^", "").replace("«", "").replace("»", "")
    # Æsir / Ægir ligature, however the OCR mangled it
    text = re.sub(r"\bi?[EÆ]sir\b", "Æsir", text)
    text = re.sub(r"\b[iJ]?[EÆ]gir\b", "Ægir", text)
    text = re.sub(r"\bt?[JÍ]?Ítgarda-Loki\b", "Útgarda-Loki", text)
    text = re.sub(r"\btJtgarda-Loki\b", "Útgarda-Loki", text)
    text = re.sub(r"\s+([.,;:!?])", r"\1", text)
    text = re.sub(r'\s+"', ' "', text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def blocks_of(lines: list[str]) -> list[list[str]]:
    blocks: list[list[str]] = []
    cur: list[str] = []
    for ln in lines:
        if ln.strip():
            cur.append(ln)
        elif cur:
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)
    return blocks


def segment_prologue(lines: list[str], vocab: set[str]) -> list[dict]:
    """No chapters. Chunk by paragraph, accumulating to ~SOFT chars on
    paragraph boundaries only."""
    SOFT = 3200
    kept = declutter(lines, vocab)
    paras = [" ".join(b) for b in blocks_of(kept)]
    chunks, buf, size, n = [], [], 0, 0
    for p in paras:
        if size and size + len(p) > SOFT:
            n += 1
            chunks.append({"n": n, "body": scrub("\n\n".join(buf))})
            buf, size = [], 0
        buf.append(p)
        size += len(p) + 2
    if buf:
        n += 1
        chunks.append({"n": n, "body": scrub("\n\n".join(buf))})
    return chunks


def segment_chapters(lines: list[str], vocab: set[str], expected: int, label: str) -> list[dict]:
    """Split on chapter headers, assigning numbers sequentially (not from the
    OCR'd numeral). Returns [{'num', 'roman', 'head_line', 'ocr_numeral', 'body'}]."""
    kept = declutter(lines, vocab)
    chunks: list[dict] = []
    cur_body: list[str] = []
    num = 0
    ocr_num = None
    head_line = None

    def flush():
        nonlocal cur_body
        if num == 0:
            cur_body = []
            return
        body = scrub("\n\n".join(" ".join(b) for b in blocks_of(cur_body)))
        body = re.sub(r"\n{3,}", "\n\n", body).strip()
        chunks.append({
            "num": num, "roman": int_to_roman(num),
            "head_line": head_line, "ocr_numeral": ocr_num, "body": body,
        })
        cur_body = []

    lines_since_head = 999
    for ln in kept:
        m = RE_CHAPTER.match(ln)
        lines_since_head += 1
        if m and len(ln.strip()) < 110 and lines_since_head >= 3:
            raw_num = m.group(1).strip()
            rv = _ocr_roman_value(raw_num)
            # Guard against real words that look like a numeral+period ("It.",
            # "In.", "As."): a genuine header token carries a tens/fives roman
            # (X/L/V/C/D/M) unless it is chapters I-III.
            numeral_ish = bool(re.search(r"[XLVCDMxlvcdm]", raw_num)) or \
                raw_num.replace(" ", "").isdigit() or \
                raw_num.upper().strip(" .") in ("I", "II", "III")
            if not numeral_ish:
                cur_body.append(ln)
                continue
            # accept as the next chapter header when EITHER the parsed numeral
            # is the next one (or a small OCR jump forward), OR the numeral is
            # unreadable but we're still short of `expected` -- sequential
            # assignment, per the brief.
            # next chapter cleanly, or a clean forward jump over a few headers
            # the OCR mangled beyond recognition (common in Skáldskaparmál).
            good_value = rv is not None and num + 1 <= rv <= num + 6
            # OCR under/over-count (e.g. "Xni" -> parses as XI, real XIII): if
            # we're mid-sequence, short of `expected`, and the numeral doesn't
            # place forward cleanly, still take it as the next chapter.
            fallback = (rv is None or rv <= num) and 0 < num < expected
            if good_value or fallback or (num == 0 and (rv == 1 or rv is None)):
                flush()
                num += 1
                ocr_num = raw_num
                head_line = re.sub(r"[ \t]{2,}", " ", ln.strip())[:90]
                cur_body.append(ln.strip())
                lines_since_head = 0
                continue
        cur_body.append(ln)
    flush()

    if len(chunks) != expected:
        print(
            f"WARNING [{label}]: segmented {len(chunks)} chapters, expected {expected}. "
            f"Inspect boundary detection before trusting output.",
            file=sys.stderr,
        )
    return chunks


def split_long(entry_body: str, soft: int = 6000) -> list[str]:
    if len(entry_body) <= soft:
        return [entry_body]
    paras = [p for p in entry_body.split("\n\n") if p.strip()]
    parts, buf, size = [], [], 0
    for p in paras:
        if size and size + len(p) > soft:
            parts.append("\n\n".join(buf))
            buf, size = [], 0
        buf.append(p)
        size += len(p) + 2
    if buf:
        parts.append("\n\n".join(buf))
    return parts or [entry_body]


# --- Suggested marker mapping (Gylfaginning ONLY) ----------------------------
# Brief: Baldr's death = wound, Yggdrasil/wells = threshold, Ragnarok = pattern,
# Loki's binding = exile, Odin/Loki/Norns = figure. Keyword-driven over the
# chapter body because Brodeur's chapter numbering can't be predicted exactly.
_kw = lambda p: re.compile(p, re.I)
MARKER_RULES: list[tuple[str, "re.Pattern"]] = [
    ("wound", _kw(r"\bBaldr\b.{0,400}?(mistletoe|Hoðr|Höd|slain|dead|death|pyre|Hel\b|Hermoðr|Nanna)")),
    ("wound", _kw(r"mistletoe")),
    ("threshold", _kw(r"Yggdrasil|Ygdrasil|Well of Urdr|Urdarbrunnr|Mimirʼs Well|Mimir’s Well|Mimir's Well|three roots|the Bridge of the Æsir|Bifröst|Bifrost")),
    ("pattern", _kw(r"Ragnarök|Ragnarok|the Twilight of the Gods|the Weird of the Gods|Vígriðr|Vigrid|Surtr.{0,60}fire|Fenris-Wolf.{0,60}(loose|free)")),
    ("exile", _kw(r"(bound|bind|fettered|fetter).{0,80}Loki|Loki.{0,80}(bound|fettered|cave|Sigyn)|serpentʼs venom|serpent’s venom|serpent's venom")),
    ("figure", _kw(r"\bLoki\b")),
    ("figure", _kw(r"\bNorn(s|)\b|Urðr,? Verðandi|Urdr, Verdandi|Skuld\b")),
    ("figure", _kw(r"\bAll-father\b|\bAll-Father\b|Odin (is|was) (called|named)|Odin has (by-|)names|names of Odin")),
]


def suggest_markers(body: str) -> list[str]:
    found: list[str] = []
    for marker, rx in MARKER_RULES:
        if marker in found:
            continue
        hits = rx.findall(body)
        if not hits:
            continue
        # "figure" fires on a bare mention far too readily; only suggest it when
        # the figure is plausibly the chapter's subject (named early, or named
        # repeatedly). Still SUGGESTED / UNCONFIRMED either way.
        if marker == "figure" and len(hits) < 3 and not rx.search(body[:220]):
            continue
        found.append(marker)
    return found


PROLOGUE_N_PAD = 2


def build_entries(sections: dict, structure: dict) -> tuple[list[dict], list[dict]]:
    """Returns (main_entries, skaldskaparmal_entries)."""
    vocab = build_vocab(sum(sections.values(), []))
    main: list[dict] = []
    skald: list[dict] = []

    prov_common = {
        "source_title": "The Prose Edda",
        "translator_or_author": "Snorri Sturluson, trans. Arthur Gilchrist Brodeur",
        "publication_year": 1916,
        "public_domain_basis": "US publication pre-1929",
        "lineage_id": "norse",
        "genre": "primary_source",
        "public_domain": True,
        "archive_org_identifier": ARCHIVE_ID,
        "source_url": SOURCE_URL,
        "publisher": "The American-Scandinavian Foundation",
        "voice_authorization_note": (
            "voice_key 'volva': same institutional-placeholder consent_grant as "
            "Pass 1/2 (Temporal Bridges Institute, 2026-01-01), NOT a named "
            "tradition-bearer review. lib/traditions.ts governanceStatus 'active'. "
            "Staged draft only -- not embedded, invisible to retrieval until a "
            "human promotes it."
        ),
        "pulled_via": "scripts-resilience/build_norse_corpus_edda.py",
    }

    # --- Prologue -----------------------------------------------------------
    pro = segment_prologue(sections["prologue"], vocab)
    for c in pro:
        body = normalize_body(c["body"])
        main.append({
            "passage_id": f"norse-edda-prologue-{c['n']:0{PROLOGUE_N_PAD}d}",
            "source": "The Prose Edda (Snorri Sturluson, trans. A.G. Brodeur, 1916) — Prologue",
            "section": f"prologue — part {c['n']}",
            "body": body,
            "themes": [], "nahuales": [], "cruz_positions": [],
            "signal_affinity": [],
            "register": "narrative",
            "ceremonial_sensitivity": "open",
            "review_status": "draft", "reviewed_by": None, "review_date": None,
            "_provenance": {
                **prov_common,
                "section": "prologue",
                "part": c["n"],
                "chunk_strategy": "prologue-paragraph (no chapter divisions in source; ~3200-char paragraph-boundary chunks)",
                "markers_status": "n/a — markers are attached to Gylfaginning only",
                "ocr_cleanup": OCR_NOTE,
            },
            "voice_key": "volva",
        })

    # --- Gylfaginning -----------------------------------------------------
    gylf = segment_chapters(sections["gylfaginning"], vocab, structure["gylfaginning_chapters"], "gylfaginning")
    for c in gylf:
        for k, part in enumerate(split_long(scrub(c["body"])), 1):
            body = normalize_body(part)
            multi = len(split_long(scrub(c["body"]))) > 1
            markers = suggest_markers(body)
            sec = f"gylfaginning — ch. {c['roman']}" + (f" (part {k})" if multi else "")
            main.append({
                "passage_id": f"norse-edda-gylf-{c['num']:02d}" + (f"-{k}" if multi else ""),
                "source": "The Prose Edda (Snorri Sturluson, trans. A.G. Brodeur, 1916) — Gylfaginning",
                "section": sec,
                "body": body,
                "themes": [], "nahuales": [], "cruz_positions": [],
                "signal_affinity": markers,
                "register": "narrative",
                "ceremonial_sensitivity": "open",
                "review_status": "draft", "reviewed_by": None, "review_date": None,
                "_provenance": {
                    **prov_common,
                    "section": "gylfaginning",
                    "chapter_roman": c["roman"],
                    "chapter_number": c["num"],
                    "ocr_numeral_as_printed": c["ocr_numeral"],
                    "header_line": c["head_line"],
                    "split_part": k if multi else None,
                    "chunk_strategy": "gylfaginning-chapter (one numbered dialogue-chapter = one unit; >6000-char chapters split on paragraph boundaries)",
                    "markers_suggested": markers,
                    "markers_status": "SUGGESTED / UNCONFIRMED — pending manual review; same mapping as Guerber/Colum (Baldr=wound, Yggdrasil/wells=threshold, Ragnarök=pattern, Loki bound=exile, Odin/Loki/Norns=figure)",
                    "ocr_cleanup": OCR_NOTE,
                },
                "voice_key": "volva",
            })

    # --- Skaldskaparmal (SEPARATE FILE, reference_material flag) ----------
    # Decision (Jesse Barber / yesiah@gmail.com, 2026-09-10): INGEST for the
    # narrative-retelling Völva voice. Kept in its own staged file and flagged
    # distinctly per the brief. ch. I-III are the Ægir/Bragi narrative frame
    # (register 'narrative'); ch. IV onward is kenning-list / poetic-diction
    # reference (register 'exposition', reference_material = true).
    sk = segment_chapters(sections["skaldskaparmal"], vocab, structure["skaldskaparmal_chapters"], "skaldskaparmal")
    for c in sk:
        is_ref = c["num"] > 3
        for k, part in enumerate(split_long(scrub(c["body"])), 1):
            body = normalize_body(part)
            multi = len(split_long(scrub(c["body"]))) > 1
            sec = f"skaldskaparmal — ch. {c['roman']}" + (f" (part {k})" if multi else "")
            skald.append({
                "passage_id": f"norse-edda-skald-{c['num']:02d}" + (f"-{k}" if multi else ""),
                "source": "The Prose Edda (Snorri Sturluson, trans. A.G. Brodeur, 1916) — Skáldskaparmál",
                "section": sec,
                "body": body,
                "themes": [], "nahuales": [], "cruz_positions": [],
                "signal_affinity": [],
                "register": "exposition" if is_ref else "narrative",
                "ceremonial_sensitivity": "open",
                "review_status": "draft", "reviewed_by": None, "review_date": None,
                "_provenance": {
                    **prov_common,
                    "section": "skaldskaparmal",
                    "chapter_roman": c["roman"],
                    "chapter_number": c["num"],
                    "ocr_numeral_as_printed": c["ocr_numeral"],
                    "header_line": c["head_line"],
                    "split_part": k if multi else None,
                    "reference_material": is_ref,
                    "chunk_strategy": "skaldskaparmal-chapter (kept chapter-aligned; ch. I-III narrative frame, ch. IV+ kenning-lists / poetic-diction reference)",
                    "markers_status": "NOT TAGGED — Skáldskaparmál is not force-tagged per the brief",
                    "ingest_decision": "APPROVED for the narrative-retelling voice — Jesse Barber, 2026-09-10",
                    "ocr_cleanup": OCR_NOTE,
                },
                "voice_key": "volva",
            })

    return main, skald


OCR_NOTE = (
    "archive.org front matter (through the second standalone 'PROLOGUE' line) "
    "and back matter (from 'INDEX') stripped; running heads ('PROSE EDDA', "
    "'N PROLOGUE', 'GYLFAGINNING', 'THE POESY OF SKALDS') and bare page numbers "
    "removed; footnote lines (leading * ^ †) dropped; doubled OCR inter-word "
    "spacing collapsed; hyphenated and vocab-attested bare line-break word-splits "
    "rejoined; 'iEsir'/'iEgir' OCR ligature repaired to 'Æsir'/'Ægir'. "
    "Chapter numbers assigned sequentially, NOT trusted from the OCR'd numeral "
    "(recorded as _provenance.ocr_numeral_as_printed). Residual scannos and "
    "un-attested word-splits may remain — for the manual review pass."
)


def structure_report(sections: dict) -> dict:
    vocab = build_vocab(sum(sections.values(), []))
    g = segment_chapters(sections["gylfaginning"], vocab, 54, "gylfaginning")
    s = segment_chapters(sections["skaldskaparmal"], vocab, 80, "skaldskaparmal")
    return {
        "sections_found": list(sections.keys()),
        "prologue_lines": len(sections["prologue"]),
        "prologue_has_numbered_chapters": False,
        "gylfaginning_chapters_detected": len(g),
        "gylfaginning_expected": 54,
        "gylfaginning_first_headers": [c["head_line"] for c in g[:4]],
        "gylfaginning_last_headers": [c["head_line"] for c in g[-3:]],
        "skaldskaparmal_chapters_detected": len(s),
        "skaldskaparmal_first_headers": [c["head_line"] for c in s[:6]],
        "skaldskaparmal_note": (
            "ch. I-III are the Ægir/Bragi narrative frame (Thjazi & Idunn, "
            "the Niflung gold); from ch. IV on it is kenning-lists / poetic "
            "diction Q&A ('How should one periphrase ...?') plus interpolated "
            "thulur. Reference material, not narrative."
        ),
    }


def cleaning_sample(raw: str) -> str:
    lines = raw.splitlines()
    p_hits = [i for i, ln in enumerate(lines) if RE_PROLOGUE_START.match(ln)]
    start = p_hits[1] + 1
    before = "\n".join(lines[start : start + 46])

    sections = split_sections(raw)
    vocab = build_vocab(sum(sections.values(), []))
    pro = segment_prologue(sections["prologue"], vocab)
    gylf = segment_chapters(sections["gylfaginning"], vocab, 54, "gylfaginning")

    after = "[PROLOGUE — part 1]\n" + pro[0]["body"][:850]
    after += "\n\n[GYLFAGINNING — ch. I]\n" + gylf[0]["body"][:850]
    after += "\n\n[GYLFAGINNING — ch. II]\n" + gylf[1]["body"][:600]

    return (
        "================ BEFORE (raw OCR, first ~46 lines of the Prologue body) ================\n"
        + before
        + "\n\n================ AFTER (cleaned + segmented) ================\n"
        + after
        + "\n\n================ STRUCTURE ================\n"
        + json.dumps(structure_report(sections), indent=2, ensure_ascii=False)
    )


def _summary(path: str, entries: list[dict]) -> dict:
    by_sec: dict[str, int] = {}
    markers: dict[str, int] = {}
    untagged = 0
    for e in entries:
        s = e["_provenance"]["section"]
        by_sec[s] = by_sec.get(s, 0) + 1
        if e["_provenance"]["section"] == "gylfaginning" and not e["signal_affinity"]:
            untagged += 1
        for m in e["signal_affinity"]:
            markers[m] = markers.get(m, 0) + 1
    lengths = sorted(len(e["body"]) for e in entries) or [0]
    return {
        "wrote": os.path.relpath(path, REPO_ROOT),
        "entries": len(entries),
        "entries_per_section": by_sec,
        "body_chars_min_median_max": [lengths[0], lengths[len(lengths) // 2], lengths[-1]],
        "suggested_marker_counts": markers,
        "gylfaginning_chapters_with_no_marker": untagged,
        "review_status": "draft (all) — not embedded, invisible to retrieval until promoted",
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", default=DEFAULT_CACHE)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--emit-sample", action="store_true", help="cleaning before/after + structure report, no write")
    ap.add_argument("--no-skaldskaparmal", action="store_true", help="skip the Skáldskaparmál staged file (default: write it — ingest approved 2026-09-10)")
    args = ap.parse_args()

    raw = fetch_raw(args.raw)

    if args.emit_sample:
        print(cleaning_sample(raw))
        return

    sections = split_sections(raw)
    vocab = build_vocab(sum(sections.values(), []))
    structure = {
        "gylfaginning_chapters": len(segment_chapters(sections["gylfaginning"], vocab, 54, "gylfaginning")),
        "skaldskaparmal_chapters": len(segment_chapters(sections["skaldskaparmal"], vocab, 80, "skaldskaparmal")),
    }
    main_entries, skald_entries = build_entries(sections, structure)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(main_entries, f, ensure_ascii=False, indent=2)
        f.write("\n")
    out = {"main": _summary(args.out, main_entries)}

    if not args.no_skaldskaparmal:
        with open(SKALD_OUT, "w", encoding="utf-8") as f:
            json.dump(skald_entries, f, ensure_ascii=False, indent=2)
            f.write("\n")
        out["skaldskaparmal"] = _summary(SKALD_OUT, skald_entries)
    else:
        out["skaldskaparmal"] = {"skipped": True, "would_be_entries": len(skald_entries)}

    out["next"] = [
        "human review of every entry (Gylfaginning markers are SUGGESTED only)",
        "python3 scripts-resilience/ingest.py corpus/norse-edda-passages-STAGED.json --dry-run",
        "python3 scripts-resilience/ingest.py corpus/norse-edda-skaldskaparmal-STAGED.json --dry-run",
        'DEV DB only: python3 scripts-resilience/ingest.py corpus/norse-edda-passages-STAGED.json "$DEV_DATABASE_URL"',
        'DEV DB only: python3 scripts-resilience/ingest.py corpus/norse-edda-skaldskaparmal-STAGED.json "$DEV_DATABASE_URL"',
    ]
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
