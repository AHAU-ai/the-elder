#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_norse_corpus_volsunga.py -- INGESTION PASS 5: Norse lineage corpus
(Volsunga Saga, Magnusson & Morris 1888).

WHAT THIS DOES
--------------
Fetches "The Story of the Volsungs (Volsunga Saga)", trans. Eirikr Magnusson
and William Morris (1888, Norroena Society "Viking Edition"), from archive.org,
cleans the OCR, splits it into CHAPTER-level chunks using the saga's own 43
numbered chapter divisions, attaches SUGGESTED (unconfirmed) signal markers,
and MERGES the entries into:

    corpus/norse-passages-STAGED.json

(Pass 4's answer to the "where do the entries go" question was: append to the
existing staged file next to the Guerber (Pass 1) entries. This script does a
keyed merge -- it drops any pre-existing entry whose passage_id starts with
"norse-volsunga-" and re-adds this run's, leaving every other voice/pass
entry in the file untouched. Because several sessions may write this file
concurrently, run this one LAST, or re-run it after the others settle.)

It does NOT touch the database and does NOT embed anything. A human reviews the
staged file, then runs the real gate:

    python3 scripts-resilience/ingest.py corpus/norse-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/norse-passages-STAGED.json "$DEV_DATABASE_URL"

Every entry is written with review_status = "draft", so even if it is ingested
it is stored WITHOUT an embedding and is invisible to retrieval until a human
promotes it to "approved" (build gate in ingest.py; retrievable_passage view
in scripts-resilience/schema.sql).

SCHEMA NOTES (verified against the repo 2026-09-09, identical to Pass 1)
----------------------------------------------------------------------
- Target table: corpus_passage. There is NO separate "myth_entry" schema --
  the Pass-5 brief's "myth_entry / lineage_id / genre / publication_year /
  public_domain_basis" field names do not exist as columns. The brief's
  requested metadata is preserved verbatim in the per-entry "_provenance"
  object, which ingest.py neither reads nor stores (human audit only).
- Required fields per entry: passage_id, source, section, body, voice_key.
- voice_key for the Norse voice is "volva" (lib/lineageToVoiceKey.ts;
  retrieval filters WHERE lineage_key = 'volva'). NOT "norse".
- signal_affinity is the marker field: TEXT[], subset of
  wound / figure / threshold / exile / pattern (lowercase).
- ingest.py applies NFC + K'iche' saltillo normalization to every body before
  storage; we apply the identical transform here so ingest.py --dry-run's
  is_canonical() check passes (side effect: "Sigurd's" -> "Sigurdʼs").
- Do NOT put a "_comment" / "_comment" key on any entry -- ingest.py --dry-run
  rejects any entry containing one as a placeholder.

PASS-4 CROSS-CHECK (brief step 5)
--------------------------------
There is no Poetic Edda ingestion pass in this repo (no Pass 2/3/4 build
script, no cached Edda text, no edda passages file). The brief's premise --
"if the heroic/Sigurd poems from the Poetic Edda were deferred here per Pass
4's decision" -- cannot be verified against anything in the tree, so no
cross-reference IDs are emitted. The episodes that WOULD overlap a heroic-Edda
pass are recorded per-entry in _provenance.edda_overlap so a later pass can
back-fill cross-references instead of treating them as unrelated duplicates:
  ch 13-15  Reginsmal      (Regin, the shards, Andvari's gold)
  ch 16     Gripisspa      (Gripir's prophecy)
  ch 18-19  Fafnismal      (dragon-slaying, the birds, slaying of Regin)
  ch 20-21  Sigrdrifumal   (waking Brynhild, her wise redes)
  ch 25     Gudrunarkvida  (Gudrun's dream)
  ch 30-32  Brot / Sigurdarkvida en skamma (Sigurd's death, Brynhild's end)
  ch 35-39  Atlakvida / Atlamal (Atli, the Gjukings' ride, the snake-pit)
  ch 41-43  Hamdismal      (Swanhild, Gudrun's sons, the stoning)

USAGE
-----
    python3 scripts-resilience/build_norse_corpus_volsunga.py
    python3 scripts-resilience/build_norse_corpus_volsunga.py --raw path/to/cached_djvu.txt
    python3 scripts-resilience/build_norse_corpus_volsunga.py --emit-sample   # cleaning before/after only, no write
    python3 scripts-resilience/build_norse_corpus_volsunga.py --dry           # build + summary, do not write the file
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import re
import ssl
import sys
import unicodedata

SOURCE_URL = (
    "https://archive.org/download/volsungasaga008519mbp/volsungasaga008519mbp_djvu.txt"
)
ARCHIVE_ID = "volsungasaga008519mbp"
SOURCE_LABEL = (
    "The Story of the Volsungs (Volsunga Saga) "
    "(trans. Eirikr Magnusson and William Morris, 1888) — Icelandic saga, prose with interspersed verse"
)
PID_PREFIX = "norse-volsunga-"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(REPO_ROOT, "corpus", "norse-passages-STAGED.json")
DEFAULT_CACHE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "volsunga_morris_djvu.txt"
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


# --- Chapters: the saga's own 43 divisions -------------------------------------
# Titles taken from the book's CONTENTS list (lines 122-210 of the djvu text)
# and the in-body chapter headers, both heavily OCR-mangled and here normalised
# to the standard Magnusson/Morris wording. The COUNT (43) is what matters for
# boundary detection; wording is cosmetic and flagged as normalised.
CHAPTERS: list[tuple[int, str]] = [
    (1, "Of Sigi, the Son of Odin"),
    (2, "Of the Birth of Volsung, the Son of Rerir"),
    (3, "Of the Sword that Sigmund, Volsung's Son, Drew from the Branstock"),
    (4, "How King Siggeir Wedded Signy"),
    (5, "Of the Slaying of King Volsung"),
    (6, "Of How Signy Sent the Children of Her and Siggeir to Sigmund"),
    (7, "Of the Birth of Sinfjotli, the Son of Sigmund"),
    (8, "Of the Death of King Siggeir and of Signy"),
    (9, "How Helgi, the Son of Sigmund, Won King Hodbrod"),
    (10, "The Ending of Sinfjotli, Sigmund's Son"),
    (11, "Of King Sigmund's Last Battle, and of the Wooing of Hjordis"),
    (12, "Of the Shards of the Sword Gram, and How Hjordis Went to King Alf"),
    (13, "Of the Birth and Waxing of Sigurd Fafnir's-bane"),
    (14, "Regin's Tale of His Brothers, and of the Gold Called Andvari's Hoard"),
    (15, "Of the Welding Together of the Shards of the Sword Gram"),
    (16, "The Prophecy of Gripir"),
    (17, "Of Sigurd's Avenging of Sigmund His Father"),
    (18, "Of the Slaying of the Worm Fafnir"),
    (19, "Of the Slaying of Regin, Son of Hreidmar"),
    (20, "Of Sigurd's Meeting with Brynhild on the Mountain"),
    (21, "More Wise Words of Brynhild"),
    (22, "Of the Semblance and Array of Sigurd Fafnir's-bane"),
    (23, "Sigurd Comes to Hlymdale"),
    (24, "Sigurd Sees Brynhild at Hlymdale"),
    (25, "Of the Dream of Gudrun, Gjuki's Daughter"),
    (26, "Sigurd Comes to the Gjukings and Is Wedded to Gudrun"),
    (27, "The Wooing of Brynhild"),
    (28, "How the Queens Held Angry Converse Together at the Bathing"),
    (29, "Of Brynhild's Great Grief and Mourning"),
    (30, "Of the Slaying of Sigurd Fafnir's-bane"),
    (31, "Of the Lamentation of Gudrun over Sigurd Dead"),
    (32, "Of the Ending of Brynhild"),
    (33, "Gudrun Wedded to Atli"),
    (34, "Atli Bids the Gjukings to Him"),
    (35, "The Dreams of the Wives of the Gjukings"),
    (36, "Of the Journey of the Gjukings to King Atli"),
    (37, "The Battle in the Burg of King Atli"),
    (38, "The Slaying of the Gjukings"),
    (39, "The End of Atli and His Kin and of Gudrun"),
    (40, "Gudrun Casts Herself into the Sea, but Is Brought Ashore Again"),
    (41, "Of the Wedding and Slaying of Swanhild"),
    (42, "Gudrun Sends Her Sons to Avenge Swanhild"),
    (43, "The Latter End of All the Kin of the Gjukings"),
]
N_CHAPTERS = len(CHAPTERS)  # 43

# In-body chapter header detection.
#
# The leading numeral is worthless here: this 1888 scan OCRs "20." as "SO.",
# "31." as "81.", "25." as "35.", "40." as "4:0.", and eats several others
# outright. The TITLE text, however, survives OCR well. So we anchor each of
# the 43 chapters to a distinctive fragment of its own title and scan the body
# top-to-bottom, matching each anchor at or after the previous match. That
# yields a deterministic 43-way split with no fuzzy scoring. Anchors are
# deliberately loose on the letters OCR routinely corrupts in this scan
# (SLAYING<->STAYING, ATLI<->ATU, WEDDED<->WADDED, GUDRUN<->GXJDRUN).
# Every anchor was checked against the real fetched text on 2026-09-10.
_A = lambda p: re.compile(p, re.I)
CHAPTER_ANCHORS: list[tuple[int, "re.Pattern"]] = [
    (1, _A(r"SIGI,?\s+THE\s+SON\s+OF\s+ODIN")),
    (2, _A(r"BIRTH\s+OF\s+VO\w{0,3}SUNG")),
    (3, _A(r"SWORD\s+THAT\s+SIGMUND")),
    (4, _A(r"SIGGEIR\s+W\wDDED\s+SIGNY")),
    (5, _A(r"S[LT]AYING\s+OF\s+KING\s+VOL\w?SUNG")),
    (6, _A(r"SIGNY\s+SENT\s+THE\s+CHILDREN")),
    (7, _A(r"BIRTH\s+O\w{1,3}\s+SIN\w{0,3}FJOT")),
    (8, _A(r"DEATH\s+OF\s+KING\s+SIGGEIR")),
    (9, _A(r"HE\wGI.{0,30}WON\s+KING\s+HOD")),
    (10, _A(r"ENDING\s+OF\s+SINFJOT")),
    (11, _A(r"SIGMUND.{0,3}S\s+LAST\s+BATT")),
    (12, _A(r"SHARDS\b.{0,20}SWORD\s+GRAM")),
    (13, _A(r"BIRTH\s+AND\s+WAXING\s+OF\s+SIGURD")),
    (14, _A(r"REGIN.{0,3}S\s+TALE\s+OF\s+HIS\s+BROTHERS")),
    (15, _A(r"WE\wDING\s+TOGETHER")),
    (16, _A(r"PROPHECY\s+OF\s+GRI")),
    (17, _A(r"SIGURD.{0,3}S\s+AVENGING")),
    (18, _A(r"S[LT]AYING\s+OF\s+TH\w?\s+WORM\s+FAFNIR")),
    (19, _A(r"S[LT]AYING\s+OF\s+REGIN")),
    (20, _A(r"MEETING\s+WITH\s+BRYNH")),
    (21, _A(r"MORE\s+WISE.{0,4}WORDS")),
    (22, _A(r"SEMBLANCE\s+AND\s+ARRAY\s+OF\s+SIGURD")),
    (23, _A(r"\bSIGURD\s+COM\wS\s+TO\b(?!.{0,4}THE\s+GJUK)")),
    (24, _A(r"SIGURD\s+SEES\s+BRYNHILD")),
    (25, _A(r"DREAM\s+OF\s+GUDRUN")),
    (26, _A(r"SIGURD\s+COMES\s+TO\s+THE\s+GJUKINGS")),
    (27, _A(r"WOOING\s+OF\s+BRYNH")),
    (28, _A(r"HOW\s+THE\s+QUEENS\s+HE.{0,5}ANGRY")),
    (29, _A(r"BRYNHILD.{0,3}S\s+GREAT\s+GRIEF")),
    (30, _A(r"S[LT]AYING\s+OF\s+SIGURD\s+FAFNIR")),
    (31, _A(r"LAMENTATION\s+OF\s+G\w{0,2}DRUN")),
    (32, _A(r"ENDING\s+OF\s+BRYNH")),
    (33, _A(r"GUDRUN\s+WEDDED\s+TO\s+AT")),
    (34, _A(r"AT\w?\s+BIDS\s+TH\w?\s+GJUKINGS")),
    (35, _A(r"DREAMS\s+OF\s+THE\s+WIVES")),
    (36, _A(r"JOURNEY\s+O\w{1,3}\s+THE\s+GJUKINGS")),
    (37, _A(r"BATTLE\s+IN\s+THE\s+BURG")),
    (38, _A(r"S[LT]AYING\s+O\w{1,3}\s+THE\s+GJUKINGS")),
    (39, _A(r"END\s+OF\s+AT.{0,2}I\s+AND\s+HIS\s+KIN")),
    (40, _A(r"GUDRUN\s+CAST.{0,3}HERSELF\s+INTO\s+THE\s+SEA")),
    (41, _A(r"WEDDING\s+AND\s+S[LT]AYING\b.{0,6}SWANH")),
    (42, _A(r"GUDRUN\s+SENDS\s+HER\s+SONS")),
    (43, _A(r"(?:BATTER|LATTER)\s+END\b.{0,32}GJUKINGS")),
]
assert [c for c, _ in CHAPTER_ANCHORS] == [c for c, _ in CHAPTERS]

RE_RUNNING_HEAD = re.compile(
    r"^\s*(?:THE\s+STORY\s+OF\s+THE\s+)?(?:VOL[SVU]{1,4}NGS?\s+AND\s+NIBLUNGS?"
    r"|THE\s+STORY\s+OF\s+THE\s+VOLSUNGS?(?:\s+AND\s+NIBLUNGS?)?"
    r"|THE\s+STORY\s+OF\s+THE)\s*$",
    re.I,
)
RE_PAGE_NUMBER = re.compile(r"^\s*[0-9ivxlcIVXLC]{1,6}[.\)]?\s*$")
RE_ALLCAPS_LINE = re.compile(r"^\s*[A-Z][A-Z0-9\"'’.,\- ]{2,70}\s*$")

# saga body starts at the first in-body chapter header ("1. OF SIGI ...") and
# ends at the translators' closing colophon; the Wagner/Weston back matter and
# every other appended saga are excluded.
RE_BODY_START = re.compile(r"^\s*1\s*\.\s+OF\s+SIGI\b", re.I)
RE_BODY_END = re.compile(
    r"come\s+to\s+an\s+end\s+the\s+whole\s+root\s+and\s+stem"
    r"|NOW\s+MAY\s+ALL\s+EARLS"
    r"|LEGENDS?\s+OF\s+THE\s+WAGNER\s+TRILOGY",
    re.I,
)


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


def strip_boilerplate(raw: str) -> list[str]:
    """Everything before '1. OF SIGI ...' (title pages, introduction, preface,
    character list) and everything from the closing colophon / Wagner back
    matter onward is dropped."""
    lines = raw.splitlines()
    start = None
    for i, ln in enumerate(lines):
        if RE_BODY_START.match(ln):
            start = i
            break
    if start is None:
        raise SystemExit("could not locate '1. OF SIGI' -- saga body start not found")
    end = len(lines)
    for i in range(start + 5, len(lines)):
        window = lines[i] + " " + (lines[i + 1] if i + 1 < len(lines) else "")
        if RE_BODY_END.search(window):
            end = i  # drop from the closing colophon onward
            break
    if end == len(lines):
        raise SystemExit("saga body end (closing colophon) not found -- refusing to ingest back matter")
    return lines[start:end]


_STOPWORDS = {
    "a", "i", "an", "as", "in", "on", "of", "to", "or", "he", "we", "so", "no",
    "it", "is", "at", "by", "up", "my", "the", "and", "but", "for", "her", "his",
    "him", "she", "was", "are", "not", "all", "who", "had", "has", "one", "out",
    "its", "may", "did", "our", "now", "new", "two", "own", "saw", "let", "you",
    "yea", "thy", "thou", "thee", "were", "them", "then", "they", "this", "that",
    "with", "from", "have", "unto", "upon", "when", "what", "said",
}


def build_vocab(lines: list[str]) -> set[str]:
    return set(re.findall(r"[a-z]{3,}", " ".join(lines).lower()))


def join_line_splits(lines: list[str], vocab: set[str]) -> list[str]:
    """Rejoin words broken across a line break without ever inserting a blank
    line. (1) explicit trailing hyphen; (2) bare split where the concatenation
    is attested elsewhere in the book and the head fragment is not a common
    standalone word. Identical policy to build_norse_corpus.py."""
    lines = [re.sub(r"[ \t]+", " ", ln.strip()) for ln in lines]
    i = 0
    while i < len(lines) - 1:
        cur, nxt = lines[i], lines[i + 1]
        if not cur or not nxt:
            i += 1
            continue
        fm = re.search(r"([A-Za-z]+)(-?)$", cur)
        nm = re.match(r"([A-Za-z]+)(.*)$", nxt)
        if not fm or not nm:
            i += 1
            continue
        head, hyphen = fm.group(1), fm.group(2)
        tail, rest_next = nm.group(1), nm.group(2).lstrip()
        solid = (head + tail).lower()
        form = None
        if hyphen == "-":
            form = head + tail if solid in vocab else head + "-" + tail
        elif (
            head.islower()
            and tail.islower()
            and len(solid) >= 5
            and len(head) >= 3
            and solid in vocab
            and head.lower() not in _STOPWORDS
        ):
            form = head + tail
        if form is None:
            i += 1
            continue
        lines[i] = (cur[: fm.start(1)].rstrip() + " " + form).strip()
        if rest_next:
            lines[i + 1] = rest_next
        else:
            del lines[i + 1]
    return lines


RE_NUMBERED_HEAD = re.compile(r"^\s*[0-9]{1,3}\s*[.:,\-]+\s*[-\s]*[A-Za-z]")


def _is_header_continuation(s: str) -> bool:
    """A wrapped 2nd/3rd physical line of a chapter header: short, all-caps,
    not a running head or bare page number."""
    if not s or len(s) > 62:
        return False
    if RE_RUNNING_HEAD.match(s) or RE_PAGE_NUMBER.match(s):
        return False
    letters = re.sub(r"[^A-Za-z]", "", s)
    return bool(letters) and sum(c.isupper() for c in letters) / len(letters) >= 0.85


def header_line_indices(lines: list[str], hit: int) -> list[int]:
    """Physical line indices the chapter header at `hit` occupies: the numbered
    line plus up to two ALL-CAPS continuation lines. This scan sometimes puts a
    blank line *inside* the header (e.g. ch. 11: '...AND OF HOW HE' / '' / 'MUST
    YIELD UP HIS SWORD AGAIN.'), so one internal blank is tolerated -- but only
    immediately after the numbered first line, never for an unnumbered line
    (which would let a running head swallow the real header below it)."""
    idxs = [hit]
    numbered = bool(RE_NUMBERED_HEAD.match(lines[hit].strip()))
    j = hit + 1
    allowance_for_blank = numbered
    while len(idxs) < 3 and j < len(lines):
        s = lines[j].strip()
        if _is_header_continuation(s):
            idxs.append(j)
            j += 1
            allowance_for_blank = False
            continue
        if s == "" and allowance_for_blank and j + 1 < len(lines) and _is_header_continuation(
            lines[j + 1].strip()
        ):
            j += 1  # skip the single internal blank
            allowance_for_blank = False
            continue
        break
    return idxs


def locate_chapter_headers(lines: list[str]) -> list[tuple[int, int, int, str]]:
    """Scan the body top-to-bottom, matching each of the 43 title anchors at or
    after the previous match. Returns (line_index, n_physical_header_lines,
    chapter_arabic, detected_header_text) for every chapter found, in order. A
    chapter whose anchor does not match (should not happen with the verified
    anchors -- the scan is defensive) is skipped; the segmenter then emits one
    merged chunk spanning the gap, flagged boundary_uncertain."""
    found: list[tuple[int, int, int, str]] = []
    search_from = 0
    for arabic, rx in CHAPTER_ANCHORS:
        hit = None
        for i in range(search_from, len(lines)):
            s = lines[i].strip()
            if not s or len(s) > 90:
                continue
            letters = re.sub(r"[^A-Za-z]", "", s)
            if not letters or sum(c.isupper() for c in letters) / len(letters) < 0.7:
                continue  # a header line is overwhelmingly upper-case
            # the anchor title may wrap onto the next 1-2 (also all-caps) lines;
            # build the probe only from `s` + genuine continuation lines so a
            # preceding running head can never be the match site
            probe = " ".join(lines[x].strip() for x in header_line_indices(lines, i))
            if rx.search(probe):
                hit = i
                break
        if hit is None:
            continue
        idxs = header_line_indices(lines, hit)
        span_end = idxs[-1] + 1  # first body line after the header block
        header_text = re.sub(
            r"\s+", " ", " ".join(lines[x].strip() for x in idxs)
        ).strip(" .,-")
        found.append((hit, span_end - hit, arabic, header_text))
        search_from = span_end
    return found


RE_ATTRIBUTION = re.compile(
    r"^\s*[-—]?\s*(?:from\s+the\s+|inserted\s+by\s+translators|the\s+stanza\s+at\s+the\s+end)",
    re.I,
)


def scrub(text: str) -> str:
    text = text.replace("^", "")
    text = re.sub(r"(?<=[A-Za-z])[\"“”](?=[A-Za-z])", "", text)  # Bo"rr -> Borr
    text = re.sub(r"\s+([.,;:!?])", r"\1", text)                  # space before punctuation
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def is_verse_block(block: list[str]) -> bool:
    if len(block) < 3:
        return False
    short = sum(1 for l in block if len(l) <= 46)
    comma_ends = sum(1 for l in block if l.rstrip().endswith((",", ";")))
    if short / len(block) < 0.7:
        return False
    return comma_ends / len(block) >= 0.35


def clean_and_segment(lines: list[str]) -> list[dict]:
    vocab = build_vocab(lines)
    lines = join_line_splits(list(lines), vocab)
    accepted = locate_chapter_headers(lines)
    if len(accepted) < 40:
        raise SystemExit(
            f"only located {len(accepted)}/43 chapter headers -- an anchor regex has "
            f"drifted against the source; stop and inspect before trusting the split"
        )

    head_at = {li: (nlines, arabic, title) for (li, nlines, arabic, title) in accepted}
    boundary_lines = sorted(head_at)

    # slice the text into [after-header, next-header) spans
    chunks: list[dict] = []
    for idx, start_li in enumerate(boundary_lines):
        end_li = boundary_lines[idx + 1] if idx + 1 < len(boundary_lines) else len(lines)
        nlines, arabic, det_title = head_at[start_li]
        next_arabic = (
            head_at[boundary_lines[idx + 1]][1] if idx + 1 < len(boundary_lines) else N_CHAPTERS + 1
        )
        spans = list(range(arabic, next_arabic))  # chapters covered by this slice

        raw_block_lines = lines[start_li + nlines : end_li]
        # drop running heads, page numbers, standalone attribution notes
        kept: list[str] = []
        for ln in raw_block_lines:
            s = ln.strip()
            if not s:
                kept.append("")
                continue
            if RE_RUNNING_HEAD.match(s) or RE_PAGE_NUMBER.match(s):
                continue
            if RE_ATTRIBUTION.match(s):
                continue
            kept.append(re.sub(r"[ \t]+", " ", s))

        # blank-delimited blocks; drop pure-verse blocks (interspersed lays)
        blocks: list[list[str]] = []
        cur: list[str] = []
        for ln in kept:
            if ln:
                cur.append(ln)
            elif cur:
                blocks.append(cur)
                cur = []
        if cur:
            blocks.append(cur)

        prose_blocks = [b for b in blocks if not is_verse_block(b)]
        verse_dropped = len(blocks) - len(prose_blocks)
        body = scrub("\n\n".join(" ".join(b) for b in prose_blocks))
        # repair ornamental drop-cap on the first word
        body = re.sub(r"^([A-Z])\s+([A-Z]{2,})", lambda m: (m.group(1) + m.group(2)).capitalize(), body)

        title = dict(CHAPTERS)[arabic]
        chunks.append(
            {
                "chapter_arabic": arabic,
                "chapter_title": title,
                "spans_chapters": spans,
                "boundary_uncertain": len(spans) > 1,
                "detected_header": det_title,
                "verse_blocks_dropped": verse_dropped,
                "body": body,
            }
        )
    return chunks


# --- Suggested marker mapping (from the Pass-5 brief) -------------------------
_kw = lambda p: re.compile(p, re.I)
MARKER_RULES: list[tuple[str, set[int], "re.Pattern | None"]] = [
    # wound -- Sigurd's death; Fafnir's mortal wound; Gunnar/Hogni's deaths in Atli's hall & the snake-pit
    ("wound", {30}, None),
    ("wound", {18}, _kw(r"Fafnir|worm|dragon|heart|thrust|smote|blood")),
    ("wound", {5}, _kw(r"Volsung|slain|slaughter|fell")),
    ("wound", {11}, _kw(r"Sigmund|last battle|sword .*burst|fell")),
    ("wound", {37, 38, 39}, _kw(r"snake|serpent|adder|pit|heart cut|slain|smitten|stones")),
    ("wound", {31, 32}, _kw(r"lament|mourn|grief|dead|pyre|slew herself|sword")),
    # threshold -- forging of Gram; the ordeal / waking of Brynhild
    ("threshold", {15}, None),
    ("threshold", {3}, _kw(r"Branstock|sword|drew|thrust|Odin|one-eyed|stranger")),
    ("threshold", {20, 21}, _kw(r"wak|shield|flame|fire|rampart|Brynhild|redes|runes|rose up")),
    ("threshold", {13}, _kw(r"Gram|forge|weld|anvil|Regin")),
    # pattern -- Andvari's cursed ring/gold: the recurring-doom motif across the saga
    ("pattern", {14}, None),  # Regin's tale of Andvari's hoard -- the curse laid
    ("pattern", {19}, _kw(r"gold|hoard|ring|Andvari|curse")),
    ("pattern", {27, 28, 29}, _kw(r"ring|gold|Andvari|oath|curse|doom|Grimhild|potion|forget")),
    ("pattern", {43}, _kw(r"end|root and stem|doom|kin")),
    # exile -- Sigmund & Sinfjotli's outlawry / wolf-years in the wild-wood
    ("exile", {6, 7}, _kw(r"wood|wild-wood|underground|earth-house|outlaw|wolf|wolves|forest")),
    ("exile", {8}, _kw(r"wood|barrow|howe|burn|avenge|hidden")),
    ("exile", {10}, _kw(r"outlaw|wolf|Wolf in holy places|exile")),
    # figure -- Sigurd (hero), Brynhild (fate/oath), Odin's wanderer-appearances
    ("figure", {13, 16, 18}, None),  # Sigurd: birth, prophesied, dragon-slayer
    ("figure", {20, 21, 27, 32}, None),  # Brynhild: fate / oath / her ending
    ("figure", {2, 3, 5, 11, 13, 24, 40}, _kw(r"one-eyed|old man|hooded|cloak|Hnikar|Odin|stranger|guest|a man .*came")),
]


def suggest_markers(chunk: dict) -> list[str]:
    hay = f"{chunk['chapter_title']}\n{chunk['detected_header']}\n{chunk['body']}"
    found: list[str] = []
    for marker, chapters, rx in MARKER_RULES:
        if not (set(chunk["spans_chapters"]) & chapters):
            continue
        if rx is None or rx.search(hay):
            if marker not in found:
                found.append(marker)
    return found


EDDA_OVERLAP = {
    13: "Reginsmal", 14: "Reginsmal", 15: "Reginsmal",
    16: "Gripisspa",
    18: "Fafnismal", 19: "Fafnismal",
    20: "Sigrdrifumal", 21: "Sigrdrifumal",
    25: "Gudrunarkvida I",
    30: "Brot af Sigurdarkvidu", 31: "Gudrunarkvida", 32: "Sigurdarkvida en skamma / Helreid Brynhildar",
    35: "Atlamal", 36: "Atlamal", 37: "Atlakvida / Atlamal", 38: "Atlakvida", 39: "Atlakvida",
    41: "Gudrunarhvot", 42: "Hamdismal", 43: "Hamdismal",
}


def split_long(chunk: dict, soft_limit: int = 4600) -> list[dict]:
    body = chunk["body"]
    if len(body) <= soft_limit:
        return [chunk]
    paras = [p for p in body.split("\n\n") if p.strip()]
    parts: list[list[str]] = [[]]
    size = 0
    for p in paras:
        if size and size + len(p) > soft_limit:
            parts.append([])
            size = 0
        parts[-1].append(p)
        size += len(p) + 2
    # fold any undersized part into its neighbour so no entry is a stray
    # sentence (dialogue paragraphs in this saga are often one line long)
    min_part = 900
    merged_parts: list[list[str]] = []
    for grp in parts:
        if merged_parts and len("\n\n".join(grp)) < min_part:
            merged_parts[-1].extend(grp)
        else:
            merged_parts.append(grp)
    if len(merged_parts) > 1 and len("\n\n".join(merged_parts[-1])) < min_part:
        merged_parts[-2].extend(merged_parts.pop())
    parts = merged_parts
    if len(parts) == 1:
        return [chunk]
    out = []
    for k, group in enumerate(parts, 1):
        c = copy.deepcopy(chunk)
        c["body"] = "\n\n".join(group)
        c["_part"] = (k, len(parts))
        out.append(c)
    return out


def build_entries(chunks: list[dict]) -> list[dict]:
    chunks = [c2 for c in chunks for c2 in split_long(c)]
    entries: list[dict] = []
    per_ch: dict[int, int] = {}
    for c in chunks:
        arabic = c["chapter_arabic"]
        n = per_ch.get(arabic, 0) + 1
        per_ch[arabic] = n
        pid = f"{PID_PREFIX}{arabic:02d}-{n:02d}"
        body = normalize_body(c["body"])
        span = c["spans_chapters"]
        span_label = (
            f"Ch. {arabic}"
            if len(span) == 1
            else f"Ch. {span[0]}–{span[-1]} (merged: OCR dropped the intervening chapter header)"
        )
        part = c.get("_part")
        section = f"{span_label}: {c['chapter_title']}"
        if part:
            section += f" (part {part[0]} of {part[1]})"
        markers = suggest_markers(c)
        edda = sorted({EDDA_OVERLAP[x] for x in span if x in EDDA_OVERLAP})
        entries.append(
            {
                "passage_id": pid,
                "source": SOURCE_LABEL,
                "section": section,
                "body": body,
                "themes": [],
                "nahuales": [],
                "cruz_positions": [],
                "signal_affinity": markers,
                "register": "narrative",
                "ceremonial_sensitivity": "open",
                "review_status": "draft",
                "reviewed_by": None,
                "review_date": None,
                "_provenance": {
                    "source_title": "The Story of the Volsungs (Volsunga Saga)",
                    "translator_or_author": "trans. Eiríkr Magnússon and William Morris",
                    "publication_year": 1888,
                    "public_domain_basis": "US publication pre-1929",
                    "lineage_id": "norse",
                    "genre": "saga_narrative",
                    "public_domain": True,
                    "archive_org_identifier": ARCHIVE_ID,
                    "source_url": SOURCE_URL,
                    "chapter_arabic": arabic,
                    "chapter_title": c["chapter_title"],
                    "spans_chapters": span,
                    "boundary_uncertain": c["boundary_uncertain"],
                    "boundary_note": (
                        None
                        if not c["boundary_uncertain"]
                        else "The in-body header for the later chapter(s) in spans_chapters "
                        "was lost to OCR; this entry merges them. Hand-split at the chapter "
                        "boundary during review."
                    ),
                    "detected_header_ocr": c["detected_header"],
                    "auto_split_part": list(part) if part else None,
                    "verse_blocks_dropped": c["verse_blocks_dropped"],
                    "edda_overlap": edda or None,
                    "chunk_strategy": "volsunga-chapter (one entry per saga chapter; over-long chapters split at paragraph boundaries)",
                    "markers_suggested": markers,
                    "markers_status": "SUGGESTED / UNCONFIRMED — pending manual review",
                    "ocr_cleanup": (
                        "front matter (title pages, introduction, preface, character list) and "
                        "all back matter (Weston's Wagner essays, Anderson's appended sagas) stripped; "
                        "running heads ('VOLSUNGS AND NIBLUNGS', 'THE STORY OF THE') and page numbers "
                        "removed; hyphenated and vocab-attested bare line-break word-splits rejoined; "
                        "interspersed verse stanzas and translator attribution notes removed; doubled "
                        "OCR whitespace collapsed. This is a rough 19th-c. scan — residual scannos "
                        "(e.g. 'STAYING' for 'SLAYING', 'ATU' for 'ATLI', long-s errors) remain for "
                        "the manual review pass."
                    ),
                    "voice_authorization_note": (
                        "voice_key 'volva' is governanceStatus 'pending' per governance/checklist.yaml "
                        "(self-authorized, no named tradition-bearer). Draft-only; not for promotion "
                        "to 'approved' without elder review."
                    ),
                    "pass": "INGESTION PASS 5/5 (Norse — Volsunga Saga)",
                    "pass4_cross_check": (
                        "No Poetic Edda ingestion pass exists in this repo to cross-reference against; "
                        "overlapping episodes are named in edda_overlap for a future heroic-Edda pass "
                        "to back-fill rather than treat as duplicate content."
                    ),
                    "pulled_via": "scripts-resilience/build_norse_corpus_volsunga.py",
                },
                "voice_key": "volva",
            }
        )
    return entries


def merge_into_staged(out_path: str, new_entries: list[dict]) -> dict:
    existing: list[dict] = []
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as f:
            existing = json.load(f)
    kept = [e for e in existing if not str(e.get("passage_id", "")).startswith(PID_PREFIX)]
    dropped = len(existing) - len(kept)
    merged = kept + new_entries
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return {
        "file": os.path.relpath(out_path, REPO_ROOT),
        "entries_in_file_before": len(existing),
        "existing_volsunga_entries_replaced": dropped,
        "non_volsunga_entries_preserved": len(kept),
        "volsunga_entries_written": len(new_entries),
        "entries_in_file_after": len(merged),
    }


def cleaning_sample(raw: str) -> str:
    lines = strip_boilerplate(raw)
    before = "\n".join(lines[:60])
    chunks = clean_and_segment(lines)
    after_parts = []
    for c in chunks[:2]:
        span = c["spans_chapters"]
        lbl = f"Ch. {c['chapter_arabic']}" if len(span) == 1 else f"Ch. {span[0]}-{span[-1]} (merged)"
        after_parts.append(f"[{lbl}: {c['chapter_title']}]\n" + c["body"][:900])
    return (
        "================ BEFORE (raw OCR, first ~60 lines from '1. OF SIGI') ================\n"
        + before
        + "\n\n================ AFTER (cleaned + chapter-segmented, first 2 chunks) ==============\n"
        + "\n\n".join(after_parts)
    )


def summarize(entries: list[dict]) -> dict:
    by_ch: dict[int, int] = {}
    markers: dict[str, int] = {}
    untagged = 0
    uncertain = 0
    for e in entries:
        ch = e["_provenance"]["chapter_arabic"]
        by_ch[ch] = by_ch.get(ch, 0) + 1
        if e["_provenance"]["boundary_uncertain"]:
            uncertain += 1
        if not e["signal_affinity"]:
            untagged += 1
        for m in e["signal_affinity"]:
            markers[m] = markers.get(m, 0) + 1
    lengths = sorted(len(e["body"]) for e in entries)
    covered = set()
    for e in entries:
        covered.update(e["_provenance"]["spans_chapters"])
    missing = [c for c, _ in CHAPTERS if c not in covered]
    return {
        "entries": len(entries),
        "distinct_chapter_anchors": len(by_ch),
        "chapters_covered": len(covered),
        "chapters_of_43": N_CHAPTERS,
        "chapters_not_covered": missing,
        "entries_spanning_a_dropped_header": uncertain,
        "body_chars_min_median_max": [lengths[0], lengths[len(lengths) // 2], lengths[-1]],
        "suggested_marker_counts": markers,
        "entries_with_no_marker": untagged,
    }


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--raw", default=DEFAULT_CACHE, help="cached _djvu.txt (downloaded if absent)")
    ap.add_argument("--out", default=DEFAULT_OUT, help="staged JSON path to merge into")
    ap.add_argument("--emit-sample", action="store_true", help="print cleaning before/after and exit")
    ap.add_argument("--dry", action="store_true", help="build + print summary, do NOT write the file")
    args = ap.parse_args()

    raw = fetch_raw(args.raw)

    if args.emit_sample:
        print(cleaning_sample(raw))
        return

    lines = strip_boilerplate(raw)
    chunks = clean_and_segment(lines)
    entries = build_entries(chunks)
    summary = summarize(entries)

    if args.dry:
        summary["mode"] = "dry (no file written)"
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return

    merge = merge_into_staged(args.out, entries)
    print(
        json.dumps(
            {
                **merge,
                "content_summary": summary,
                "review_status": "draft (all) — not embedded, invisible to retrieval until a human promotes",
                "next": [
                    "human review of every entry — markers are SUGGESTED, several chapter boundaries are merged, OCR scannos remain",
                    "python3 scripts-resilience/ingest.py corpus/norse-passages-STAGED.json --dry-run",
                    'confirm DEV DATABASE_URL, then: python3 scripts-resilience/ingest.py corpus/norse-passages-STAGED.json "$DEV_DATABASE_URL"',
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
