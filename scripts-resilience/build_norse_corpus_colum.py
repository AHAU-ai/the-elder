#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_norse_corpus_colum.py -- INGESTION PASS 2: Norse lineage corpus
(Padraic Colum, "The Children of Odin," Macmillan, 1920 printing; illustr.
Willy Pogany). Archive.org identifier cu31924058637574.

Same contract as INGESTION PASS 1 (scripts-resilience/build_norse_corpus.py):
this script fetches, cleans, segments and stages a JSON file ONLY. It never
touches the database and never embeds. The real gate is the shared CLI:

    python3 scripts-resilience/ingest.py corpus/norse-colum-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/norse-colum-passages-STAGED.json "$DEV_DATABASE_URL"

CONVENTIONS REUSED FROM PASS 1 (verified against the repo 2026-09-09, not
re-derived):
  - Target table: corpus_passage, via scripts-resilience/ingest.py. There is
    NO "myth_entry" schema anywhere in the repo.
  - Required per-entry fields: passage_id, source, section, body, voice_key.
  - voice_key for the Norse voice is "volva" (lib/lineageToVoiceKey.ts /
    retrieval filters lineage_key = 'volva'). The brief's `lineage_id: norse`
    is recorded in _provenance for audit; the storage key is still "volva".
  - Provenance columns (source_title / translator_or_author / publication_year
    / public_domain_basis / genre / register_note) DO NOT EXIST on
    corpus_passage. They are carried in the per-entry "_provenance" object,
    which ingest.py neither reads nor stores -- human audit only.
  - signal_affinity is the marker field: TEXT[], subset of
    wound / figure / threshold / exile / pattern (lowercase). Markers here are
    SUGGESTED / UNCONFIRMED (see _provenance.markers_status).
  - Normalization: ingest.py applies NFC + K'iche' saltillo -> U+02BC to every
    body before storage. We apply the byte-identical transform here so
    `ingest.py --dry-run`'s is_canonical() check passes. Side effect: English
    apostrophes ("Odin's") become U+02BC ("Odinʼs"). Pre-existing pipeline
    behaviour for all voices, not introduced here.
  - No "_comment" key on any entry (ingest.py --dry-run rejects it).
  - review_status = "draft" for every entry -> stored without an embedding,
    invisible to retrieval until a human promotes it to "approved".

STRUCTURAL NOTE -- Colum is NOT three "Books":
  The brief anticipated a three-"Book" structure (Book I "Asgard and the
  Gods" ...). Colum's actual table of contents (confirmed against the fetched
  text) is FOUR Parts:
    Part I   -- The Dwellers in Asgard          (9 numbered sections)
    Part II  -- Odin the Wanderer               (8 numbered sections)
    Part III -- The Witch's Heart               (7 numbered sections)
    Part IV  -- The Sword of the Volsungs and the Twilight of the Gods (11)
  35 numbered sections total. See SECTIONS below for the exact titles.

  Second structural difference from Pass 1 (Guerber): Colum's section titles
  DO NOT appear in the body at all -- only in the front-matter table of
  contents. Each section just begins with an ornamental drop-cap paragraph
  after a page break. Section boundaries are therefore recovered from the
  FOOT FOLIOS: a section-opening page carries no running head and prints its
  page number at the foot, so a foot-folio line marks a section start. Its
  de-OCR'd number is matched to the TOC start page. ~30 of 35 boundaries land
  this way; the rest (folio too corrupt to read) stay merged into the previous
  entry and are flagged in _provenance (boundary_auto_detected=false,
  contains_unsplit_sections on the absorbing entry) for a manual split.

  KNOWN LIMITATIONS for the mandatory human review pass:
   - each section's first sentence carries the drop-cap; its opening word(s)
     are frequently OCR-mangled or partly clipped by title-garble stripping;
   - a clause or sentence can bleed across a section boundary;
   - ordinary scannos remain ('moimtain', 'Idima', '^sir', 'Hugm').

USAGE
-----
    python3 scripts-resilience/build_norse_corpus_colum.py
    python3 scripts-resilience/build_norse_corpus_colum.py --raw path/to/cached_djvu.txt
    python3 scripts-resilience/build_norse_corpus_colum.py --out corpus/norse-colum-passages-STAGED.json
    python3 scripts-resilience/build_norse_corpus_colum.py --emit-sample   # cleaning before/after only, no write
"""
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import unicodedata

SOURCE_URL = "https://archive.org/download/cu31924058637574/cu31924058637574_djvu.txt"
ARCHIVE_ID = "cu31924058637574"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(REPO_ROOT, "corpus", "norse-colum-passages-STAGED.json")
DEFAULT_CACHE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "colum_children_of_odin_djvu.txt"
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


# --- Colum's table of contents (confirmed against the fetched front matter) ---
# (part_roman, part_arabic, part_title, section_number, canonical_title,
#  subtitle_or_None, toc_start_page)
SECTIONS: list[tuple[str, int, str, int, str, str | None, int]] = [
    # PART I -- The Dwellers in Asgard
    ("I", 1, "The Dwellers in Asgard", 1, "Far Away and Long Ago", None, 3),
    ("I", 1, "The Dwellers in Asgard", 2, "The Building of the Wall", None, 6),
    ("I", 1, "The Dwellers in Asgard", 3, "Iduna and Her Apples", "How Loki Put the Gods in Danger", 13),
    ("I", 1, "The Dwellers in Asgard", 4, "Sif's Golden Hair", "How Loki Wrought Mischief in Asgard", 27),
    ("I", 1, "The Dwellers in Asgard", 5, "How Brock the Dwarf Brought Judgement on Loki", None, 34),
    ("I", 1, "The Dwellers in Asgard", 6, "How Freya Gained Her Necklace and How Her Loved One Was Lost to Her", None, 45),
    ("I", 1, "The Dwellers in Asgard", 7, "How Frey Won Gerda, the Giant Maiden, and How He Lost His Magic Sword", None, 53),
    ("I", 1, "The Dwellers in Asgard", 8, "Heimdall and Little Hnossa", "How All Things Came to Be", 64),
    ("I", 1, "The Dwellers in Asgard", 9, "The All-Father's Forebodings", "How He Leaves Asgard", 71),
    # PART II -- Odin the Wanderer
    ("II", 2, "Odin the Wanderer", 1, "Odin Goes to Mimir's Well", "His Sacrifice for Wisdom", 79),
    ("II", 2, "Odin the Wanderer", 2, "Odin Faces an Evil Man", None, 85),
    ("II", 2, "Odin the Wanderer", 3, "Odin Wins for Men the Magic Mead", None, 93),
    ("II", 2, "Odin the Wanderer", 4, "Odin Tells to Vidar, His Silent Son, the Secret of His Doings", None, 102),
    ("II", 2, "Odin the Wanderer", 5, "Thor and Loki in the Giants' City", None, 108),
    ("II", 2, "Odin the Wanderer", 6, "How Thor and Loki Befooled Thrym the Giant", None, 120),
    ("II", 2, "Odin the Wanderer", 7, "Ægir's Feast", "How Thor Triumphed", 129),
    ("II", 2, "Odin the Wanderer", 8, "The Dwarf's Hoard, and the Curse that It Brought", None, 141),
    # PART III -- The Witch's Heart
    ("III", 3, "The Witch's Heart", 1, "Foreboding in Asgard", None, 157),
    ("III", 3, "The Witch's Heart", 2, "Loki the Betrayer", None, 161),
    ("III", 3, "The Witch's Heart", 3, "Loki against the Æsir", None, 171),
    ("III", 3, "The Witch's Heart", 4, "The Valkyrie", None, 176),
    ("III", 3, "The Witch's Heart", 5, "The Children of Loki", None, 181),
    ("III", 3, "The Witch's Heart", 6, "Baldur's Doom", None, 187),
    ("III", 3, "The Witch's Heart", 7, "Loki's Punishment", None, 200),
    # PART IV -- The Sword of the Volsungs and the Twilight of the Gods
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 1, "Sigurd's Youth", None, 207),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 2, "The Sword Gram and the Dragon Fafnir", None, 216),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 3, "The Dragon's Blood", None, 223),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 4, "The Story of Sigmund and Signy", None, 232),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 5, "The Story of Sigmund and Sinfiotli", None, 242),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 6, "The Story of the Vengeance of the Volsungs and of the Death of Sinfiotli", None, 248),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 7, "Brynhild in the House of Flame", None, 255),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 8, "Sigurd at the House of the Nibelungs", None, 260),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 9, "How Brynhild Was Won for Gunnar", None, 265),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 10, "The Death of Sigurd", None, 270),
    ("IV", 4, "The Sword of the Volsungs and the Twilight of the Gods", 11, "The Twilight of the Gods", None, 276),
]

# Running-head lines. Verso is always "CHILDREN OF ODIN"; recto is the part
# title. OCR mangles them, attaches a page number, and sometimes wraps the
# Part IV title across two lines ("THE SWORD OF THE VOLSUNGS AND THE" /
# "TWILIGHT OF THE GODS"). Detect by phrase-contains + "no lowercase content".
_RH_PHRASES = [
    "CHILDREN OF ODIN",
    "DWELLERS IN ASGARD",
    "ODIN THE WANDERER",
    "WITCH",  # THE WITCH'S HEART (apostrophe OCR-variable)
    "SWORD OF THE VOLSUNGS",
    "TWILIGHT OF THE GODS",
]


def is_running_head(line: str) -> bool:
    s = line.strip()
    if not s or len(s) > 46:
        return False
    up = s.upper()
    if not any(p in up for p in _RH_PHRASES):
        return False
    # a real running head has no lowercase prose (only stray OCR lowercase ok)
    lower = sum(c.islower() for c in s)
    return lower <= 2


RE_PART_HEAD = re.compile(r"^\s*Part\s+(?:I|II|III|IV)\s*$", re.I)


def is_page_number_line(line: str) -> bool:
    """A standalone page number, tolerant of the OCR punctuation noise the
    scanner drops around folios: ':7i', '7a', 'ji', '2o8', '.176.'"""
    s = line.strip()
    if not s or len(s) > 8:
        return False
    core = re.sub(r"[^0-9A-Za-z]", "", s)
    if not (1 <= len(core) <= 5):
        return False
    # must be dominated by digits / roman-ish / common OCR digit-lookalikes
    digit_like = sum(c in "0123456789ivxlcIVXLCoOilJsStabg" for c in core)
    return digit_like == len(core) and any(c.isdigit() for c in core + s)



# Verse attribution / ornamental section-subtitle lines: mostly non-alphabetic
# OCR garble from the decorative display font (e.g. "f)h 9acRiRccr©R CDisd©m").
def _is_garble(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    # characters the display-font OCR emits that never occur in this prose
    if "^" in s or "\\" in s or "©" in s:
        return True
    # a lowercase->uppercase transition inside a token (e.g. 'QodslnBanQCR',
    # 'i^ppfesi^oo', 'SiFsQolden') is display-font garble, not a real word
    for t in s.split():
        core = t.strip(".,;:!?\"'ʼ()[]—-")
        if len(core) >= 4 and not core.isupper() and re.search(r"[a-z][A-Z]", core):
            return True
    letters = sum(c.isalpha() for c in s)
    if letters == 0:
        return True
    non_ascii_alpha = sum(1 for c in s if c.isalpha() and ord(c) > 127)
    weird = sum(1 for c in s if not (c.isalnum() or c.isspace() or c in ".,;:'\"!?-—()"))
    ratio_alpha = letters / max(len(s), 1)
    return (len(s) <= 42 and (ratio_alpha < 0.55 or weird >= 3 or non_ascii_alpha >= 2))


def _repair_encoding(raw: str) -> str:
    # The djvu.txt is UTF-8 except for 22 stray cp1252 en-dash bytes (0x96)
    # that decode to U+FFFD; every one sits between spaces as a dash. Also
    # normalise the cp1252 em-dash if the fetch ever produces one.
    return raw.replace("\ufffd", "\u2014")


def fetch_raw(cache_path: str) -> str:
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8", errors="replace") as f:
            return _repair_encoding(f.read())
    import urllib.request

    print(f"fetching {SOURCE_URL} ...", file=sys.stderr)
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "the-elder-corpus/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=_SSL_CONTEXT) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        f.write(raw)
    print(f"cached to {cache_path} ({len(raw):,} bytes)", file=sys.stderr)
    return _repair_encoding(raw)


def strip_boilerplate(raw: str) -> list[str]:
    """Drop archive.org front matter (everything before the body 'Part I'
    line -- the mixed-case one at the start of the narrative, NOT the all-caps
    'PART I' in the table of contents) and the trailing printer's colophon."""
    lines = raw.splitlines()

    start = None
    for i, ln in enumerate(lines):
        if re.match(r"^\s*Part\s+I\s*$", ln) and not ln.strip().isupper():
            # require the next few lines to look like the part title, not TOC
            window = " ".join(lines[i + 1 : i + 4]).upper()
            if "DWELLERS IN ASGARD" in window:
                start = i
                break
    if start is None:
        raise SystemExit("could not locate the body 'Part I' line in the source text")

    end = len(lines)
    for i in range(len(lines) - 1, start, -1):
        up = lines[i].upper()
        if "PRINTED IN THE UNITED STATES" in up or "FRIATED IN THE UNITED STATES" in up:
            end = i
            break
    return lines[start:end]


_STOPWORDS = {
    "a", "i", "an", "as", "in", "on", "of", "to", "or", "he", "we", "so", "no",
    "it", "is", "at", "by", "up", "my", "the", "and", "but", "for", "her", "his",
    "him", "she", "was", "are", "not", "all", "who", "had", "has", "one", "out",
    "its", "may", "did", "our", "now", "new", "two", "own", "saw", "let", "you",
    "were", "them", "then", "they", "this", "that", "with", "from", "have",
}


def build_vocab(lines: list[str]) -> set[str]:
    text = " ".join(lines).lower()
    return set(re.findall(r"[a-z]{3,}", text))


def join_line_splits(lines: list[str], vocab: set[str]) -> list[str]:
    """Rejoin words broken across a line break without ever introducing a blank
    line. (1) explicit hyphen at EOL -> solid form if attested, else hyphenated.
    (2) bare split -> join only when the concatenation is attested elsewhere and
    the leading fragment is not itself a common standalone word.
    Byte-identical logic to Pass 1's build_norse_corpus.join_line_splits."""
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


# Words a Colum section can plausibly open with, once the ornamental initial
# is restored. Used to disambiguate drop-cap repair.
_OPENERS = {
    "the", "and", "then", "there", "these", "this", "that", "those", "when",
    "while", "where", "what", "who", "how", "now", "once", "one", "out", "over",
    "under", "up", "upon", "since", "always", "after", "before", "far", "long",
    "deep", "high", "near", "all", "also", "among", "around", "because", "but",
    "down", "even", "every", "for", "from", "into", "like", "many", "more",
    "most", "much", "next", "not", "only", "other", "some", "soon", "still",
    "such", "than", "they", "though", "through", "thus", "till", "two", "very",
    "with", "within", "without", "would", "your", "you", "she", "his", "their",
    "them", "here", "hard", "great", "bright", "old", "young", "three", "four",
    "odin", "loki", "thor", "baldur", "frey", "freya", "frigga", "sif", "tyr",
    "heimdall", "sigurd", "sigmund", "signy", "brynhild", "gunnar", "fafnir",
    "gerda", "iduna", "hnossa", "asgard", "bifrost", "mimir", "ragnarok",
    "gulveig", "andvari", "regin", "gram", "gram",
}
_OPENER_AVOID_ALONE = {"he", "it", "is", "as", "an", "a", "i", "we", "be", "so", "no", "of", "on", "in", "at"}


def _recover_first_word(frag: str, vocab: set[str]) -> str | None:
    """`frag` is the lowercased small-caps remainder of section word 1, with the
    ornamental initial dropped or misread by OCR. Try to restore the whole word:
      1. prepend a letter to the whole fragment  (ince -> since, lways -> always)
      2. replace a noise first letter             (ind -> and, iver -> over)
    Prefer a hit in the curated opener list, then a hit in the book vocab."""
    for pool, strong in ((_OPENERS, True), (vocab, False)):
        for c in "abcdefghijklmnopqrstuvwxyz":
            w = c + frag
            if w in pool and not (strong is False and len(w) < 4):
                return w
        for c in "abcdefghijklmnopqrstuvwxyz":
            w = c + frag[1:]
            if len(w) >= 2 and w in pool and not (strong is False and len(w) < 4):
                return w
    if frag in _OPENERS and frag not in _OPENER_AVOID_ALONE:
        return frag
    return None


_FUNCTION_WORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "by",
    "for", "with", "from", "into", "as", "is", "was", "were", "are", "be",
    "been", "that", "this", "these", "those", "there", "then", "when", "while",
    "who", "which", "his", "her", "its", "their", "them", "they", "he", "she",
    "it", "we", "you", "not", "no", "all", "had", "has", "have", "would",
    "could", "said", "one", "up", "out", "so", "if", "now", "went", "came",
    "grew", "made", "come", "day", "gods", "god", "asgard",
}


def _clean_token(tok: str) -> bool:
    """A token that looks like an ordinary English prose word: letters (plus an
    internal hyphen or apostrophe, e.g. 'All-Father', 'Odinʼs'), no digit, no
    internal capital run, plausible length."""
    t = tok.strip(".,;:!?\"'ʼ()[]—-")
    if not t or len(t) > 18:
        return False
    parts = re.split(r"[-ʼ']", t)
    for p in parts:
        if not p or not p.isalpha():
            return False
        if p[1:] != p[1:].lower():  # internal capital -> run-together OCR garble
            return False
    return True


def strip_leading_title_garble(body: str) -> str:
    """Colum opens almost every section with the section title set in an
    ornamental display font that the scanner renders as a run of nonsense
    tokens ('SiFsQoldenf)aiRifx)CDLo1ii', 'Wm\\ aridUaMjDOssa'). The title is
    TOC-only for our purposes, so drop that prefix: scan the first tokens and
    cut everything before the first 6-token window that is >=5 ordinary words.
    If the token just before the cut is a headless drop-cap fragment
    (all-caps-ish, not itself a word), keep it so fix_dropcap can repair it."""
    # only the real tokens, keeping their original positions
    raw = body.split()
    toks = [(i, t) for i, t in enumerate(raw) if len(t.strip(".,;:!?\"'ʼ()[]—-")) > 0
            and not re.fullmatch(r"[.,;:!?\"'ʼ()\[\]—-]+", t)]
    if not toks:
        return body
    cut_pos = None
    for k in range(0, min(len(toks), 24) - 5):
        win = [t for _, t in toks[k : k + 6]]
        clean = sum(_clean_token(t) for t in win)
        funcs = sum(t.strip(".,;:!?\"'ʼ()[]—-").lower() in _FUNCTION_WORDS for t in win)
        if clean >= 5 and funcs >= 2:
            cut_pos = toks[k][0]
            break
    # the title garble is short; if we had to scan far in, we're cutting real
    # prose -- bail and let the manual review pass handle it.
    if cut_pos is None or cut_pos == 0 or cut_pos > 12:
        return body
    prev = raw[cut_pos - 1]
    if re.match(r"^[A-Z][A-Za-z]{0,7}[.,;:]?$", prev) and not _clean_token(prev):
        cut_pos -= 1  # keep a headless drop-cap fragment for fix_dropcap
    return " ".join(raw[cut_pos:])


def fix_dropcap(body: str, vocab: set[str]) -> str:
    """Repair the ornamental section initial. Colum's OCR usually DROPS the big
    decorative letter (unlike Guerber, which duplicated it), leaving word 1 as a
    headless all-caps fragment, often after a stray 1-2 char vignette token:
      'V\\nINCE there was another Sun'        -> 'Since there was another Sun'
      'LWAYS there had been war'              -> 'Always there had been war'
      'IND so Odin, no longer riding'         -> 'And so Odin, no longer riding'
      'HAT happened afterwards'               -> 'What happened afterwards'
    Anything it cannot resolve is left capitalised normally and flagged for the
    manual review pass (ocr_cleanup note)."""
    # drop leading punctuation / vignette garble and up to two 1-2 char tokens
    body = re.sub(r'^[^0-9A-Za-z"“]{0,6}', "", body).lstrip()
    body = re.sub(r'^(?:[A-Za-z]{1,2}\s+){1,2}(?=[A-Z]{2,})', "", body)
    m = re.match(r"^([A-Z]{2,8})\b", body)
    if m:
        frag = m.group(1).lower()
        rest = body[m.end():]
        cand = _recover_first_word(frag, vocab)
        word = cand if cand else frag
        body = word[:1].upper() + word[1:] + rest
    # any remaining leading ALLCAPS word -> Title case
    body = re.sub(r"^([A-Z]{2,})\b", lambda mm: mm.group(1).capitalize(), body)
    return body


def looks_like_verse(block: list[str]) -> bool:
    if len(block) < 2:
        return False
    joined = " ".join(block)
    if '"' not in joined and "”" not in joined and "“" not in joined:
        return False
    short = sum(1 for l in block if len(l) <= 48)
    avg = sum(len(l) for l in block) / len(block)
    return short / len(block) >= 0.6 and avg <= 46


def _parse_folio(s: str) -> int | None:
    """De-OCR a folio line to an integer. The scanner reads digits as letters
    on the small folio type: 1<-l/i/I/j/| , 0<-O/o/Q/D , 5<-S/s , 9<-g/q ,
    8<-B , 4<-A , 6<-G/b , 2<-Z/z . E.g. ':7i'->71, '4S'->45, 'I02'->102,
    'i6i'->161, '2l6'->216."""
    sub = {"l": "1", "i": "1", "I": "1", "j": "1", "|": "1", "!": "1", "t": "1",
           "o": "0", "O": "0", "Q": "0", "D": "0",
           "s": "5", "S": "5", "g": "9", "q": "9", "B": "8", "A": "4",
           "G": "6", "b": "6", "Z": "2", "z": "2"}
    d = re.sub(r"\D", "", "".join(sub.get(c, c) for c in s.strip(" .:;'\"|■_-")))
    if not d or len(d) > 3:
        return None
    return int(d)


def paginate(lines: list[str]) -> list[tuple[str, int | None, list[str]]]:
    """Split the body at running heads and standalone folio lines. Return a
    list of (leading_break_kind, raw_folio_or_None, segment_lines):
      'start' -- the pre-first-break run
      'head'  -- interior page (running head at top; folio numbers this page)
      'foot'  -- section-opening page (folio at the foot, no running head;
                 the folio numbers the page just CLOSED)."""
    out: list[tuple[str, int | None, list[str]]] = []
    kind, folio, cur = "start", None, []
    for ln in lines:
        raw = ln.strip()
        rh, pn = is_running_head(raw), is_page_number_line(raw)
        if not (rh or pn):
            cur.append(ln)
            continue
        out.append((kind, folio, cur))
        cur = []
        if rh:
            kind, folio = "head", _parse_folio(raw)
        else:
            out[-1] = ("foot", _parse_folio(raw), out[-1][2])
            kind, folio = "head", None
    out.append((kind, folio, cur))
    return out


def segment(lines: list[str]) -> list[dict]:
    vocab = build_vocab(lines)
    lines = join_line_splits(list(lines), vocab)
    pages = paginate(lines)
    starts = [s[6] for s in SECTIONS]

    # Section boundaries: a 'foot' folio page is a section-opening page. Accept
    # it as a boundary ONLY when its de-OCR'd folio maps CONFIDENTLY to a
    # not-yet-consumed TOC start page -- exact, +/-1, or (for folios the scan
    # truncated to two digits, e.g. '26' for 265) an NN -> [NN*10 .. NN*10+9]
    # match. Spurious foot folios (illustration plates, dropped running heads,
    # unreadable numbers like '900') are left with the current section. Sections
    # whose opening folio was unreadable stay merged into the previous entry and
    # are flagged for a manual split.
    def match_section(folio: int | None, after: int) -> int | None:
        if folio is None:
            return None
        pool = range(after + 1, len(SECTIONS))
        for j in pool:
            if abs(starts[j] - folio) <= 1:
                return j
        if folio < 100:
            for j in pool:
                if folio * 10 <= starts[j] <= folio * 10 + 9:
                    return j
        return None

    sec_of_page: list[int] = []
    cur_sec = 0
    detected: set[int] = {0}
    for i, (kind, raw_folio, plines) in enumerate(pages):
        if kind == "foot":
            hit = match_section(raw_folio, cur_sec)
            if hit is not None:
                cur_sec = hit
                detected.add(cur_sec)
        sec_of_page.append(cur_sec)

    missing = [j for j in range(len(SECTIONS)) if j not in detected]

    buckets: list[list[str]] = [[] for _ in SECTIONS]
    for (kind, raw_folio, plines), sj in zip(pages, sec_of_page):
        buckets[sj].extend(plines + [""])

    chunks: list[dict] = []
    for sj, (sec, raw_lines) in enumerate(zip(SECTIONS, buckets)):
        p_roman, p_arabic, p_title, s_num, s_title, s_sub, s_page = sec
        boundary_detected = sj not in missing

        kept: list[str] = []
        for ln in raw_lines:
            raw = ln.strip()
            if not raw:
                kept.append("")
                continue
            if is_running_head(raw) or is_page_number_line(raw):
                continue
            if RE_PART_HEAD.match(raw):
                continue
            if _is_garble(raw):
                continue
            kept.append(re.sub(r"[ \t]+", " ", raw))

        blocks: list[list[str]] = []
        cb: list[str] = []
        for ln in kept:
            if ln:
                cb.append(ln)
            elif cb:
                blocks.append(cb)
                cb = []
        if cb:
            blocks.append(cb)

        raw_parts = [" ".join(b) for b in blocks if not looks_like_verse(b)]

        # Paragraph reflow: the OCR sprinkles blank lines inside paragraphs.
        # Re-join a part onto the previous one when the previous does not end
        # on sentence-final punctuation (so a real paragraph break -- prev ends
        # '.', '!', '?', '"' -- is preserved, but "a wolf" + "behind each" and
        # "who had" + "died before" are rejoined). Flagged as heuristic in the
        # ocr_cleanup provenance note.
        body_parts: list[str] = []
        for part in raw_parts:
            if body_parts and body_parts[-1] and body_parts[-1].rstrip()[-1] not in '.!?"”’:;)—':
                body_parts[-1] = body_parts[-1].rstrip() + " " + part.lstrip()
            else:
                body_parts.append(part)

        body = "\n\n".join(body_parts).strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        body = strip_leading_title_garble(body)
        body = fix_dropcap(body, vocab)

        chunks.append(
            {
                "part_roman": p_roman,
                "part_arabic": p_arabic,
                "part_title": p_title,
                "section_number": s_num,
                "section_title": s_title,
                "section_subtitle": s_sub,
                "toc_start_page": s_page,
                "boundary_detected": boundary_detected,
                "body": body,
            }
        )
    return chunks


# --- Suggested marker mapping (from the ingestion brief, mapped to Colum's
# actual sections). Each rule: (marker, {(part_arabic, section_number), ...},
# regex over subtitle+body or None). SUGGESTED / UNCONFIRMED. -----------------
_kw = lambda p: re.compile(p, re.I)
MARKER_RULES: list[tuple[str, set[tuple[int, int]], "re.Pattern | None"]] = [
    # wound -- Baldr; the Fenrir-binding section
    ("wound", {(3, 6)}, None),  # Baldur's Doom, whole section
    ("wound", {(3, 5)}, _kw(r"Fenrir|Fenris|bind|bound|fetter|Gleipnir|wolf")),  # The Children of Loki
    ("wound", {(2, 1)}, None),  # Odin Goes to Mimir's Well -- the eye given for wisdom
    ("wound", {(3, 7)}, _kw(r"bound|serpent|venom|Sigyn")),  # Loki's Punishment
    # threshold -- opening section (Odin/World Tree); the Norns' well passage
    ("threshold", {(1, 1)}, _kw(r"Ygdrassil|Yggdrasil|World Tree|Well of Urda|Urda|Norn|Mimir")),
    ("threshold", {(2, 1)}, _kw(r"Well|Mimir|Bifrost|Rainbow Bridge|Heimdall")),
    # pattern -- the bargain-with-giant section; Thor's giant-contest sections
    ("pattern", {(1, 2)}, None),  # The Building of the Wall -- bargain-with-giant, whole
    ("pattern", {(2, 5)}, _kw(r"Utgard|Giant|contest|lift|drink|wrestle|Skrymir")),
    ("pattern", {(2, 6)}, _kw(r"Thrym|hammer|Mjolnir|Miolnir|stolen|bride")),
    ("pattern", {(2, 7)}, _kw(r"Giant|cauldron|kettle|Hymir|contest")),
    ("pattern", {(1, 3)}, _kw(r"apple|Thiazi|Thiassi|stolen|carried off|restored|recover")),
    # exile -- "How Loki Wrought Mischief in Asgard" and its punishment follow-through
    ("exile", {(1, 4)}, None),  # Sif's Golden Hair: How Loki Wrought Mischief in Asgard
    ("exile", {(1, 5)}, None),  # How Brock the Dwarf Brought Judgement on Loki
    ("exile", {(3, 7)}, _kw(r"bound|cave|cast out|punish|Sigyn|serpent|venom")),
    # figure -- Odin, Loki, and Norns
    ("figure", {(2, 1), (2, 2), (2, 3), (2, 4)}, None),  # Odin the Wanderer sections
    ("figure", {(1, 9)}, _kw(r"All-Father|Odin")),
    ("figure", {(3, 2), (3, 3)}, None),  # Loki the Betrayer / Loki against the Aesir
    ("figure", {(1, 1)}, _kw(r"Norn|Urda|Verdandi|Skuld|fate")),  # Norns passage in the opening section
]


def suggest_markers(chunk: dict) -> list[str]:
    key = (chunk["part_arabic"], chunk["section_number"])
    hay = f"{chunk['section_subtitle'] or ''}\n{chunk['body']}"
    found: list[str] = []
    for marker, keys, rx in MARKER_RULES:
        if key not in keys:
            continue
        if rx is None or rx.search(hay):
            if marker not in found:
                found.append(marker)
    return found


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:48] or "section"


REGISTER_NOTE = (
    "storytelling-forward, more child-legible register than Guerber "
    "(flag for later NARRATIVE-01 register decision)"
)


def build_entries(chunks: list[dict]) -> list[dict]:
    entries: list[dict] = []
    last_real_pid = None
    last_real_idx = None
    for ci, c in enumerate(chunks):
        pid = f"norse-colum-p{c['part_arabic']}-{c['section_number']:02d}-{slugify(c['section_title'])}"
        body = normalize_body(c["body"])
        folded_into_prev: list[str] = []
        if not body:
            # Boundary not auto-detected: this section's text is currently at
            # the tail of the previous entry. Emit a clearly-marked pointer so
            # the entry count stays 1-per-section and the reviewer knows where
            # to cut. Non-empty and free of the reserved placeholder string, so
            # `ingest.py --dry-run` accepts it; stays review_status 'draft'.
            body = (
                f"[BOUNDARY NOT AUTO-DETECTED — the OCR folio for this section's "
                f"opening page was unreadable. Its text is currently appended to "
                f"the end of entry '{last_real_pid}'. In review, split it out at "
                f"the start of \"{c['section_title']}\" and paste it here.]"
            )
            if last_real_idx is not None:
                entries[last_real_idx]["_provenance"].setdefault("contains_unsplit_sections", []).append(
                    f"{c['part_roman']}.{c['section_number']} {c['section_title']}"
                )
                for mk in suggest_markers(c):
                    if mk not in entries[last_real_idx]["signal_affinity"]:
                        entries[last_real_idx]["signal_affinity"].append(mk)
        else:
            last_real_pid = pid
            last_real_idx = len(entries)
        title_full = c["section_title"] + (f": {c['section_subtitle']}" if c["section_subtitle"] else "")
        section = f"Part {c['part_roman']} ({c['part_title']}) — {c['section_number']}. {title_full}"
        markers = [] if not c["body"].strip() else suggest_markers(c)
        entries.append(
            {
                "passage_id": pid,
                "source": "The Children of Odin (Padraic Colum, 1920) — prose retelling",
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
                    "source_title": "The Children of Odin",
                    "translator_or_author": "Padraic Colum",
                    "publication_year": 1920,
                    "public_domain_basis": "US publication pre-1929",
                    "lineage_id": "norse",
                    "genre": "retelling",
                    "register_note": REGISTER_NOTE,
                    "public_domain": True,
                    "archive_org_identifier": ARCHIVE_ID,
                    "source_url": SOURCE_URL,
                    "illustrator": "Willy Pogany",
                    "part": c["part_roman"],
                    "part_title": c["part_title"],
                    "section_number": c["section_number"],
                    "section_title": c["section_title"],
                    "section_subtitle": c["section_subtitle"],
                    "toc_start_page": c["toc_start_page"],
                    "chunk_strategy": (
                        "colum-section: section boundaries anchored on the foot-folio pages "
                        "(section-opening pages carry the page number at the foot and no "
                        "running head), de-OCR'd and matched to the TOC start page. Section "
                        "titles are TOC-only, absent from the body."
                    ),
                    "boundary_auto_detected": c["boundary_detected"],
                    "boundary_status": (
                        "OK — section-start page detected"
                        if c["boundary_detected"]
                        else "NOT DETECTED — this entry's body still has the PREVIOUS section "
                        "appended to its front (or this one appended to the previous entry). "
                        "SPLIT THIS IN REVIEW at the '"
                        + (c["section_title"])
                        + "' opening."
                    ),
                    "markers_suggested": markers,
                    "markers_status": "SUGGESTED / UNCONFIRMED — pending manual review (feeds NARRATIVE-01 register decision)",
                    "ocr_cleanup": (
                        "archive.org front matter (through the body 'Part I' line) and the "
                        "printer's colophon stripped; alternating running heads ('CHILDREN OF "
                        "ODIN' / part title) and page-number lines removed; hyphenated and "
                        "vocab-attested bare line-break word-splits rejoined; ornamental "
                        "display-font section subtitles (heavy OCR garble) and embedded verse "
                        "quotations dropped; drop-cap initials repaired where confidently "
                        "recoverable; doubled OCR whitespace collapsed. KNOWN RESIDUE for the "
                        "review pass: (a) each section's first sentence carries the drop-cap "
                        "and its opening word(s) are often OCR-mangled or partly clipped; "
                        "(b) a sentence or two can bleed across a section boundary; "
                        "(c) scattered scannos ('moimtain', '^sir', 'Hugm') remain."
                    ),
                    "voice_authorization_note": (
                        "voice_key 'volva': same institutional-placeholder consent_grant as "
                        "Pass 1 (Temporal Bridges Institute, 2026-01-01), not a named "
                        "tradition-bearer review. lib/traditions.ts governanceStatus 'active'."
                    ),
                    "pulled_via": "scripts-resilience/build_norse_corpus_colum.py",
                },
                "voice_key": "volva",
            }
        )
    return entries


def cleaning_sample(raw: str) -> str:
    lines = strip_boilerplate(raw)
    before = "\n".join(lines[:52])
    chunks = segment(lines)
    after_parts = []
    for c in chunks[:2]:
        sub = f": {c['section_subtitle']}" if c["section_subtitle"] else ""
        after_parts.append(
            f"[Part {c['part_roman']} — {c['section_number']}. {c['section_title']}{sub}  "
            f"(TOC p.{c['toc_start_page']}, {len(c['body'])} chars)]\n"
            + c["body"][:900]
        )
    return (
        "================ BEFORE (raw OCR, first ~52 lines after front-matter strip) ================\n"
        + before
        + "\n\n================ AFTER (cleaned + segmented, first 2 sections) ============================\n"
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
        pt = e["_provenance"]["part"]
        by_part[pt] = by_part.get(pt, 0) + 1
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
                "sections_expected": len(SECTIONS),
                "entries_per_part": by_part,
                "body_chars_min_median_max": [lengths[0], lengths[len(lengths) // 2], lengths[-1]],
                "suggested_marker_counts": marker_counts,
                "entries_with_no_marker": untagged,
                "review_status": "draft (all) — not embedded, invisible to retrieval until promoted",
                "next": [
                    "human review of every entry (markers are SUGGESTED only; feeds NARRATIVE-01)",
                    "python3 scripts-resilience/ingest.py corpus/norse-colum-passages-STAGED.json --dry-run",
                    'confirm DEV DATABASE_URL, then: python3 scripts-resilience/ingest.py corpus/norse-colum-passages-STAGED.json "$DEV_DB_URL"',
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
