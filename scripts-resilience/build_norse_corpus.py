#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_norse_corpus.py -- INGESTION PASS 1: Norse lineage corpus (Guerber 1909).

WHAT THIS DOES
--------------
Fetches H.A. Guerber, "Myths of the Norsemen from the Eddas and Sagas" (1909)
from archive.org, cleans the OCR, splits it into sub-section-level chunks using
Guerber's own chapter + sub-heading structure, attaches SUGGESTED (unconfirmed)
signal markers, and writes:

    corpus/norse-passages-STAGED.json

It does NOT touch the database and does NOT embed anything. It only writes the
staged JSON file. A human reviews that file, then runs the real gate:

    python3 scripts-resilience/ingest.py corpus/norse-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/norse-passages-STAGED.json "$DEV_DATABASE_URL"

Every entry is written with review_status = "draft", so even if it is ingested
it is stored WITHOUT an embedding and is invisible to retrieval until a human
promotes it to "approved" (see the build gate in scripts-resilience/ingest.py
and the retrievable_passage view in scripts-resilience/schema.sql).

SCHEMA NOTES (verified against the repo 2026-09-09)
--------------------------------------------------
- Target table: corpus_passage. There is no separate "myth_entry" schema.
- Required fields per entry: passage_id, source, section, body, voice_key.
- voice_key for the Norse voice is "volva" (lib/lineageToVoiceKey.ts;
  retrieval filters `WHERE lineage_key = 'volva'`). NOT "norse".
- The columns source_title / translator_or_author / publication_year /
  public_domain_basis / genre DO NOT EXIST. Provenance is carried in the
  per-entry "_provenance" object, which ingest.py neither reads nor stores --
  it is retained in the JSON for human audit only.
- signal_affinity is the marker field: TEXT[], subset of
  wound / figure / threshold / exile / pattern (lowercase).
- ingest.py applies NFC + K'iche' saltillo normalization to every body before
  storage. We apply the identical transform here so `ingest.py --dry-run`'s
  is_canonical() check passes. Side effect: straight/curly apostrophes in the
  English text become U+02BC (e.g. "Odin's" -> "Odinʼs"). This is pre-existing
  pipeline behaviour applied to all voices, not introduced here.
- Do NOT put a "_comment" key on any entry -- ingest.py --dry-run rejects any
  entry containing one as a placeholder.

USAGE
-----
    python3 scripts-resilience/build_norse_corpus.py
    python3 scripts-resilience/build_norse_corpus.py --raw path/to/cached_djvu.txt
    python3 scripts-resilience/build_norse_corpus.py --out corpus/norse-passages-STAGED.json
    python3 scripts-resilience/build_norse_corpus.py --emit-sample   # cleaning before/after only, no write
"""
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import unicodedata

SOURCE_URL = (
    "https://archive.org/download/mythsofthenorsem00gueruoft/"
    "mythsofthenorsem00gueruoft_djvu.txt"
)
ARCHIVE_ID = "mythsofthenorsem00gueruoft"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(REPO_ROOT, "corpus", "norse-passages-STAGED.json")
DEFAULT_CACHE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "guerber_norsemen_djvu.txt"
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


# --- Chapters (Guerber's table of contents, confirmed against in-body headers) -
# roman -> (arabic, canonical title). Chapter XXIX is comparative scholarship,
# not myth -- excluded per the ingestion brief.
CHAPTERS: list[tuple[str, int, str]] = [
    ("I", 1, "The Beginning"),
    ("II", 2, "Odin"),
    ("III", 3, "Frigga"),
    ("IV", 4, "Thor"),
    ("V", 5, "Tyr"),
    ("VI", 6, "Bragi"),
    ("VII", 7, "Idun"),
    ("VIII", 8, "Niord"),
    ("IX", 9, "Frey"),
    ("X", 10, "Freya"),
    ("XI", 11, "Uller"),
    ("XII", 12, "Forseti"),
    ("XIII", 13, "Heimdall"),
    ("XIV", 14, "Hermod"),
    ("XV", 15, "Vidar"),
    ("XVI", 16, "Vali"),
    ("XVII", 17, "The Norns"),
    ("XVIII", 18, "The Valkyrs"),
    ("XIX", 19, "Hel"),
    ("XX", 20, "AEgir"),
    ("XXI", 21, "Balder"),
    ("XXII", 22, "Loki"),
    ("XXIII", 23, "The Giants"),
    ("XXIV", 24, "The Dwarfs"),
    ("XXV", 25, "The Elves"),
    ("XXVI", 26, "The Sigurd Saga"),
    ("XXVII", 27, "The Frithiof Saga"),
    ("XXVIII", 28, "The Twilight of the Gods"),
]
EXCLUDED_CHAPTER_29_TITLE_FRAGMENT = "GREEK AND"

# A CHAPTER header line in the body. OCR mangles the numeral and title
# (e.g. "CHAPTER XXIH : THE GIANTS", "CHAPTER XVI:VAU", "CHAPTER XX:>EGIR",
# "CHAPTER XXVII : THE STORY OF"), so we match the keyword only and assign
# sequentially -- the brief's instruction not to trust OCR'd headers.
RE_CHAPTER = re.compile(r"^\s*CHAPTER\s+[A-Z0-9>][A-Z0-9>.\s:]{0,60}$")

RE_RUNNING_HEAD = re.compile(r"^\s*MYTHS\s+OF\s+THE\s+NORSEMEN\s*$", re.I)
RE_PAGE_NUMBER = re.compile(r"^\s*[0-9ivxlcIVXLC]{1,6}\s*$")
RE_ALLCAPS_HEAD = re.compile(r"^\s*[A-Z][A-Z'’.,\- ]{2,55}\s*$")

# Verse attribution lines, e.g.:
#   Valhalla (J. C. Jones}.
#   Balder Dead (Matthew Arnold).
#   S&mund's Edda (Thorpe's tr.).
#   Norse Mythology (R. B. Anderson).
RE_ATTRIBUTION = re.compile(
    r"^\s*[-—]?\s*[A-Z][A-Za-z0-9'’&.,\- ]{1,45}"
    r"\([^)]*"
    r"(?:tr\.|trans\.|Arnold|Morris|Thorpe|Henderson|Anderson|Jones|Longfellow|"
    r"Gray[)\s]|Herbert|Percy|Cottle|Howitt|Buchanan|Taylor|Martin|Brooks|"
    r"Wergeland|Dollman|Ekwall|Burne|Keary|Pigott|Bayard|Rossetti)"
    r"[^)]*[)}\]][.\s]*$"
)


# OCR scannos seen in captured sub-section headings (Guerber's running heads
# scan worse than his body text). Applied as whole-word replacements to the
# subsection label only. Keep this list tight and evidence-based.
SUBSECTION_FIXES = {
    "Vc": "Ve",
    "HeimdalJ's": "Heimdall's",
    "HeimdalJ": "Heimdall",
    "Baldens": "Balder's",
    "Siggeif": "Siggeir",
    "FHthiof": "Frithiof",
    "Fimbul'winter": "Fimbul-winter",
    "Fimbulʼwinter": "Fimbul-winter",
    "'Day": "Day",
    "ʼDay": "Day",
}


def fix_subsection(s: str) -> str:
    out = " ".join(SUBSECTION_FIXES.get(w, w) for w in s.split())
    return re.sub(r"\s+([.,;:])", r"\1", out).strip()


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
    """Drop the archive.org front matter (everything before CHAPTER I) and the
    back matter (INDEX / GLOSSARY onward, and excluded chapter XXIX)."""
    lines = raw.splitlines()

    start = None
    for i, ln in enumerate(lines):
        if RE_CHAPTER.match(ln) and "BEGINNING" in ln.upper():
            start = i
            break
    if start is None:  # fall back to first CHAPTER header of any kind
        for i, ln in enumerate(lines):
            if RE_CHAPTER.match(ln):
                start = i
                break
    if start is None:
        raise SystemExit("could not locate CHAPTER I in the source text")

    end = len(lines)
    for i in range(start, len(lines)):
        up = re.sub(r"\s+", " ", lines[i].upper()).strip()
        if RE_CHAPTER.match(lines[i]) and EXCLUDED_CHAPTER_29_TITLE_FRAGMENT in up:
            end = i
            break
        if re.match(r"\s*INDEX\s+TO\s+POETICAL", up) or re.match(
            r"\s*GLOSSARY\s+AND\s+INDEX", up
        ):
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


def build_midline_bigrams(lines: list[str]) -> set[tuple[str, str]]:
    """Every adjacent lowercase word pair that occurs WITHIN a single source
    line. Used to veto a line-break rejoin whose two halves are a real word
    pair elsewhere ('see' + 'the' -> not 'seethe'; 'is' + 'land' -> not
    'island') while still allowing genuine splits ('in' + 'stance' ->
    'instance', never seen mid-line)."""
    pairs: set[tuple[str, str]] = set()
    for ln in lines:
        toks = re.findall(r"\b[a-z]{2,}\b", ln.lower())
        pairs.update(zip(toks, toks[1:]))
    return pairs


def join_line_splits(
    lines: list[str], vocab: set[str], midline: set[tuple[str, str]] | None = None
) -> list[str]:
    """Rejoin words broken across a line break, WITHOUT ever introducing a
    blank line (which would fragment a paragraph).

      1. explicit hyphen at EOL:  "Nifl-\nheim" -> "Nifl-heim" (or "Niflheim"
         if the solid form is attested elsewhere in the book).
      2. bare split, no hyphen:   "a power\nful being" -> "powerful being" and
         "for in\nstance" -> "for instance", when the concatenation is a word
         attested elsewhere AND the two halves are NOT a real word pair seen
         mid-line elsewhere in the book.
    """
    midline = midline or set()
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
            and len(solid) >= 6
            and solid in vocab
            and (head, tail) not in midline
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


def fix_dropcap(body: str) -> str:
    """Repair the ornamental chapter initial: 'A LTHOUGH ... / \\ ... JL V have'
    -> 'Although have', and small-caps first words 'ODIN,' -> 'Odin,'."""
    body = re.sub(
        r"^([A-Z])\s+([A-Z]{2,})", lambda m: (m.group(1) + m.group(2)).capitalize(), body
    )
    body = re.sub(r"^([A-Z][A-Za-z]+)((?:\s+(?:[/\\|]+|[JLVIX]{1,3})\b){1,6})\s", r"\1 ", body)
    body = re.sub(r"^([A-Z][A-Z]+)\b", lambda m: m.group(1).capitalize(), body)
    return body


def looks_like_subheading(block: list[str]) -> bool:
    """A Guerber sub-section header: a single short Title-Case line standing
    alone in its own blank-delimited block (e.g. 'The Death of Balder',
    'Ymir and Audhumla', 'Odin, Vili, and Ve')."""
    if len(block) != 1:
        return False
    s = block[0].strip()
    if not (3 <= len(s) <= 60):
        return False
    if s.upper() == s:  # ALL CAPS -> running head / plate caption, not a sub-head
        return False
    if not re.match(r"^[A-Z][A-Za-z’'ʼ.,\- ]+$", s):
        return False
    if s.endswith(".") and not re.search(r"\b[A-Z][a-z]?\.$", s):
        return False
    if "(" in s or ")" in s:
        return False
    if s[-1] in ",;:":  # a comma/semicolon ending -> mid-sentence or verse line
        return False
    words = s.split()
    if not (1 <= len(words) <= 9):
        return False
    # a line opening with a bare conjunction/adverb and running on is a verse
    # line or sentence fragment, not a section title ("But Him I dare not").
    if len(words) >= 4 and words[0].lower() in {
        "but", "and", "nor", "yet", "so", "for", "then", "when", "while", "though"
    }:
        return False
    # title case: at least half the words capitalised (lowercase function
    # words like 'of'/'and'/'the' excepted)
    caps = sum(1 for w in words if w[:1].isupper())
    return caps >= (len(words) + 1) // 2


def clean_and_segment(lines: list[str]) -> list[dict]:
    """Return a list of {chapter_roman, chapter_arabic, chapter_title,
    subsection, body} chunks."""
    vocab = build_vocab(lines)
    lines = join_line_splits(list(lines), vocab, build_midline_bigrams(lines))

    # Drop running heads, bare page numbers, standalone attribution lines,
    # and collapse the doubled inter-word spacing this OCR uses throughout.
    kept: list[str] = []
    for ln in lines:
        raw = ln.strip()
        if not raw:
            kept.append("")
            continue
        if RE_RUNNING_HEAD.match(raw) or RE_PAGE_NUMBER.match(raw):
            continue
        if RE_ATTRIBUTION.match(raw):
            continue
        kept.append(re.sub(r"[ \t]+", " ", raw))

    # blank-delimited blocks
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

    # This OCR puts a blank line between every line of a verse quotation, so a
    # stanza arrives as a run of one-line blocks. Coalesce consecutive runs of
    # short, non-sentence-final blocks (but never chapter headers / ALL-CAPS
    # heads) so verse detection sees the whole stanza. A real sub-heading is a
    # lone short block sitting between two long prose blocks, so it is not
    # absorbed.
    def mergeable_short(b: list[str]) -> bool:
        if RE_CHAPTER.match(b[0]) or (len(b) == 1 and RE_ALLCAPS_HEAD.match(b[0])):
            return False
        return all(len(l) <= 52 for l in b) and not re.search(r'[.!?]["\']?$', b[-1].strip())

    merged: list[list[str]] = []
    for b in blocks:
        if merged and mergeable_short(b) and mergeable_short(merged[-1]):
            merged[-1].extend(b)
        else:
            merged.append(list(b))
    blocks = merged

    def is_verse(block: list[str]) -> bool:
        if len(block) < 2:
            return False
        joined = " ".join(block)
        has_quote = any(q in joined for q in ('"', "”", "“"))
        comma_ends = sum(1 for l in block if l.rstrip().endswith((",", ";")))
        short = sum(1 for l in block if len(l) <= 50)
        if short / len(block) < 0.6:
            return False
        return has_quote or comma_ends / len(block) >= 0.4


    def scrub(text: str) -> str:
        text = text.replace("^", "")
        text = re.sub(r"(?<=[A-Za-z])[\"“”](?=[A-Za-z])", "", text)  # Bo"rr -> Borr
        text = re.sub(r"\s+/\s*\\?\s*", " ", text)                    # ornamental " / \ "
        text = re.sub(r"\bJL?\s+V\b\s*", "", text)                    # ornamental "JL V"
        text = re.sub(r"\s+([.,;:!?])", r"\1", text)                  # space before punctuation
        text = re.sub(r"\.{2,}", lambda m: "..." if len(m.group()) >= 3 else ".", text)
        text = re.sub(r"[ \t]{2,}", " ", text)
        return text

    chunks: list[dict] = []
    ch_idx = -1
    subsection = None
    body_parts: list[str] = []

    def flush():
        nonlocal body_parts
        if ch_idx < 0 or not body_parts:
            body_parts = []
            return
        roman, arabic, title = CHAPTERS[ch_idx]
        body = scrub("\n\n".join(body_parts)).strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        if len(body) < 200:  # too small to be a useful unit; fold forward
            if chunks and chunks[-1]["chapter_arabic"] == arabic:
                chunks[-1]["body"] += "\n\n" + body
                body_parts = []
                return
        chunks.append(
            {
                "chapter_roman": roman,
                "chapter_arabic": arabic,
                "chapter_title": title,
                "subsection": fix_subsection(subsection or title),
                "body": body,
            }
        )
        body_parts = []

    for block in blocks:
        first = block[0].strip()

        if RE_CHAPTER.match(first) and len(block) <= 3:
            flush()
            ch_idx += 1
            if ch_idx >= len(CHAPTERS):
                raise SystemExit(
                    f"found more chapter headers than the {len(CHAPTERS)} expected "
                    f"-- OCR boundary drift, stop and inspect: {first!r}"
                )
            subsection = None
            # a chapter block sometimes carries a 'Myths of Creation'-style
            # tagline on line 2; treat that as the first subsection label
            if len(block) >= 2 and looks_like_subheading([block[1].strip()]):
                subsection = block[1].strip()
            continue

        if ch_idx < 0:
            continue  # pre-chapter-I residue

        if RE_ALLCAPS_HEAD.match(first) and len(block) == 1:
            continue  # running head / plate caption

        if looks_like_subheading(block):
            flush()
            subsection = first
            continue

        if is_verse(block):
            continue

        # lone short line that isn't a sub-heading: plate caption, artist
        # credit, stray page artifact -- not prose.
        if len(block) == 1 and len(block[0]) <= 52:
            continue

        body_parts.append(" ".join(block))

    flush()

    # repair the ornamental drop-cap on the opening chunk of each chapter
    seen: set[int] = set()
    for c in chunks:
        if c["chapter_arabic"] not in seen:
            seen.add(c["chapter_arabic"])
            c["body"] = fix_dropcap(c["body"])

    if ch_idx + 1 != len(CHAPTERS):
        print(
            f"WARNING: matched {ch_idx + 1} chapters, expected {len(CHAPTERS)}. "
            f"Inspect the boundary detection before trusting the output.",
            file=sys.stderr,
        )
    return chunks


# --- Suggested marker mapping (from the ingestion brief) ----------------------
# Each rule: (marker, {chapter_arabic, ...}, subsection/body keyword regex or None).
# A marker is attached to a chunk only when its chapter matches AND (regex is
# None OR regex matches the subsection title or body). Markers are SUGGESTED
# and unconfirmed -- recorded in _provenance.markers_status.
_kw = lambda p: re.compile(p, re.I)
MARKER_RULES: list[tuple[str, set[int], "re.Pattern | None"]] = [
    # wound
    ("wound", {21}, None),  # Balder's death, whole chapter
    ("wound", {2}, _kw(r"\bMimir|\bwell\b|gave (?:up |)an eye|pledged .*eye|wisdom")),
    ("wound", {5}, _kw(r"Fenris|Fenrir|bind|bound|bit off|lost his (?:right |)hand")),
    ("wound", {22}, _kw(r"Fenris|Fenrir|bound|binding")),
    # threshold
    ("threshold", {13}, _kw(r"Bifr|rainbow bridge|Bifrost|watch|horn|Gjallar|guard")),
    ("threshold", {1}, _kw(r"Yggdrasil|world[- ]tree|Urdar|three roots|the (?:three |)wells")),
    ("threshold", {17}, _kw(r"Urdar|well|Yggdrasil|root")),
    # pattern (theft / recovery arcs, prophecy)
    ("pattern", {28}, None),  # Ragnarok prophecy, whole chapter
    ("pattern", {7}, _kw(r"apple|Thiassi|Thjazi|stolen|carried off|restored|recover")),
    ("pattern", {4}, _kw(r"Thrym|hammer .*(?:stolen|gone|lost)|stolen .*hammer|Mjolnir|recover")),
    # exile
    ("exile", {22}, _kw(r"bound|binding|cave|Sigyn|serpent|venom|punish|cast out")),
    ("exile", {8, 9}, _kw(r"Vanir|hostage|exchange|Aesir.*Vanir|Vanir.*Aesir|war (?:between|with)")),
    ("exile", {2}, _kw(r"Vanir|hostage|exchange")),
    # figure
    ("figure", {2}, None),  # Odin -- wanderer / seeker
    ("figure", {22}, None),  # Loki -- trickster
    ("figure", {17}, None),  # Norns -- fate
]


def suggest_markers(chunk: dict) -> list[str]:
    hay = f"{chunk['subsection']}\n{chunk['body']}"
    found: list[str] = []
    for marker, chapters, rx in MARKER_RULES:
        if chunk["chapter_arabic"] not in chapters:
            continue
        if rx is None or rx.search(hay):
            if marker not in found:
                found.append(marker)
    return found


def register_of(chunk: dict) -> str:
    # Guerber is prose retelling throughout; the odd invocation-flavoured
    # opening aside, "narrative" is the honest register for these chunks.
    return "narrative"


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:40] or "section"


def split_long(chunk: dict, soft_limit: int = 4200) -> list[dict]:
    """A sub-section whose in-text heading the OCR mangled can carry several
    merged episodes. Split such over-long bodies at paragraph boundaries only
    (never mid-paragraph) into ~soft_limit-sized parts."""
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
    if len(parts) == 1:
        return [chunk]
    out = []
    for k, group in enumerate(parts, 1):
        c = dict(chunk)
        c["body"] = "\n\n".join(group)
        c["subsection"] = f"{chunk['subsection']} (part {k} of {len(parts)})"
        c["_split_from_oversized"] = True
        out.append(c)
    return out


def build_entries(chunks: list[dict]) -> list[dict]:
    chunks = [c2 for c in chunks for c2 in split_long(c)]
    entries: list[dict] = []
    per_ch: dict[int, int] = {}
    for c in chunks:
        n = per_ch.get(c["chapter_arabic"], 0) + 1
        per_ch[c["chapter_arabic"]] = n
        pid = f"norse-guerber-{c['chapter_arabic']:02d}-{n:02d}"
        body = normalize_body(c["body"])
        section = f"Ch. {c['chapter_roman']}: {c['chapter_title']} — {c['subsection']}"
        markers = suggest_markers(c)
        oversized = len(body) > 6000
        split_part = c.get("_split_from_oversized", False)
        entries.append(
            {
                "passage_id": pid,
                "source": "Myths of the Norsemen from the Eddas and Sagas "
                "(H.A. Guerber, 1909) — prose retelling",
                "section": section,
                "body": body,
                "themes": [],
                "nahuales": [],
                "cruz_positions": [],
                "signal_affinity": markers,
                "register": register_of(c),
                "ceremonial_sensitivity": "open",
                "review_status": "draft",
                "reviewed_by": None,
                "review_date": None,
                "_provenance": {
                    "source_title": "Myths of the Norsemen from the Eddas and Sagas",
                    "translator_or_author": "H.A. Guerber",
                    "publication_year": 1909,
                    "public_domain_basis": "US publication pre-1929",
                    "genre": "retelling",
                    "public_domain": True,
                    "archive_org_identifier": ARCHIVE_ID,
                    "source_url": SOURCE_URL,
                    "chapter": c["chapter_roman"],
                    "chapter_title": c["chapter_title"],
                    "subsection_title": c["subsection"],
                    "chunk_strategy": "guerber-subsection (chapter + in-text sub-heading boundaries)",
                    "markers_suggested": markers,
                    "markers_status": "SUGGESTED / UNCONFIRMED — pending manual review",
                    "oversized_chunk": oversized,  # still >6000 chars after the
                    # paragraph-boundary split below; review may want finer hand-chunking
                    "auto_split_from_oversized": split_part,  # this entry is one part of
                    # a sub-section split at paragraph boundaries because the OCR mangled
                    # its interior headings
                    "ocr_cleanup": (
                        "archive.org front/back matter stripped; running heads and "
                        "page numbers removed; line-break word-splits rejoined "
                        "(hyphenated, plus bare splits where the join is an attested "
                        "word and the two halves are not a real mid-line word pair); "
                        "embedded verse quotations and their attributions removed; "
                        "drop-caps repaired; known heading scannos corrected "
                        "(SUBSECTION_FIXES); doubled whitespace and stray double "
                        "periods collapsed. A few rare residual scannos may remain "
                        "(e.g. 'so journ') — for the manual review pass."
                    ),
                    "voice_authorization_note": (
                        "voice_key 'volva': consent_grant exists but is a Temporal "
                        "Bridges Institute institutional placeholder (2026-01-01), "
                        "not a named tradition-bearer review. lib/traditions.ts "
                        "governanceStatus is 'active'."
                    ),
                    "pulled_via": "scripts-resilience/build_norse_corpus.py",
                },
                "voice_key": "volva",
            }
        )
    return entries


def cleaning_sample(raw: str) -> str:
    lines = strip_boilerplate(raw)
    before = "\n".join(lines[:46])
    chunks = clean_and_segment(lines)
    after_parts = []
    for c in chunks[:3]:
        after_parts.append(
            f"[Ch. {c['chapter_roman']}: {c['chapter_title']} — {c['subsection']}]\n"
            + c["body"][:700]
        )
    return (
        "================ BEFORE (raw OCR, first ~46 lines of Ch. I) ================\n"
        + before
        + "\n\n================ AFTER (cleaned + segmented, first 3 chunks) ==============\n"
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
    chunks = clean_and_segment(lines)
    entries = build_entries(chunks)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # summary
    by_ch: dict[str, int] = {}
    marker_counts: dict[str, int] = {}
    untagged = 0
    for e in entries:
        ch = e["_provenance"]["chapter"]
        by_ch[ch] = by_ch.get(ch, 0) + 1
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
                "chapters_covered": len(by_ch),
                "entries_per_chapter": by_ch,
                "body_chars_min_median_max": [
                    lengths[0],
                    lengths[len(lengths) // 2],
                    lengths[-1],
                ],
                "suggested_marker_counts": marker_counts,
                "entries_with_no_marker": untagged,
                "oversized_chunks_gt_6000_chars": sum(
                    1 for e in entries if e["_provenance"]["oversized_chunk"]
                ),
                "review_status": "draft (all) — not embedded, invisible to retrieval until promoted",
                "next": [
                    "human review of every entry (markers are SUGGESTED only)",
                    "python3 scripts-resilience/ingest.py corpus/norse-passages-STAGED.json --dry-run",
                    "confirm DEV DATABASE_URL, then: python3 scripts-resilience/ingest.py corpus/norse-passages-STAGED.json \"$DEV_DB_URL\"",
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
