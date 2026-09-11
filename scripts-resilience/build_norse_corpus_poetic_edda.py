#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_norse_corpus_poetic_edda.py -- INGESTION PASS 4: Norse lineage corpus
(The Poetic Edda, trans. Henry Adams Bellows). Archive.org identifier
poeticedda00belluoft.

Same contract as PASSES 1-3 (scripts-resilience/build_norse_corpus.py,
build_norse_corpus_colum.py): this script fetches, cleans, segments and
stages a JSON file ONLY. It never touches the database and never embeds.
The real gate is the shared CLI:

    python3 scripts-resilience/ingest.py corpus/norse-poetic-edda-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/norse-poetic-edda-passages-STAGED.json "$DEV_DATABASE_URL"

EDITION / PUBLIC DOMAIN (verified 2026-09-09, do not re-derive)
--------------------------------------------------------------
The ingestion brief called this a "1936" edition and asked for a copyright
check. The archive.org item at identifier `poeticedda00belluoft` is NOT the
1936 printing -- it is the FIRST EDITION, 1923, The American-Scandinavian
Foundation, *Scandinavian Classics* vols. XXI-XXII, scanned by the
University of Toronto (Robarts). Archive.org rights field: NOT_IN_COPYRIGHT.
A 1923 US publication is public domain (pre-1929); no renewal-record
question applies. Recorded as publication_year 1923 in _provenance, per the
operator's decision 2026-09-09.

SCOPE (operator decision 2026-09-09): ALL 34 poems of this edition,
undifferentiated -- both the Lays of the Gods and the Lays of the Heroes
(the Sigurth / Volsung cycle), plus the two short prose bridges
(Fra Dautha Sinfjotla, Drap Niflunga) that the collection carries between
lays. Pass 5 (Volsunga Saga) will cross-reference against the heroic lays.

CONVENTIONS REUSED FROM PASSES 1-3 (verified against the repo 2026-09-09)
-----------------------------------------------------------------------
  - Target table: corpus_passage, via scripts-resilience/ingest.py. There is
    NO "myth_entry" schema anywhere in the repo.
  - Required per-entry fields: passage_id, source, section, body, voice_key.
  - voice_key for the Norse voice is "volva" (lib/lineageToVoiceKey.ts /
    retrieval filters lineage_key = 'volva'). The brief's `lineage_id: norse`
    is recorded in _provenance for audit; the storage key is still "volva".
  - The brief's metadata fields (source_title / translator_or_author /
    publication_year / public_domain_basis / genre / poem_name) DO NOT EXIST
    as columns on corpus_passage. They are carried in the per-entry
    "_provenance" object, which ingest.py neither reads nor stores -- human
    audit only.
  - signal_affinity is the marker field: TEXT[], subset of
    wound / figure / threshold / exile / pattern (lowercase). Markers here are
    SUGGESTED / UNCONFIRMED (see _provenance.markers_status). The brief's
    Pass 4 mapping is POEM-level, so a marker is attached to every stanza-group
    chunk of that poem; the review pass must confirm per chunk.
  - Normalization: ingest.py applies NFC + K'iche' saltillo -> U+02BC to every
    body before storage. We apply the byte-identical transform here so
    `ingest.py --dry-run`'s is_canonical() check passes. Side effect: English
    apostrophes ("Othin's") become U+02BC ("Othinʼs"). Pre-existing pipeline
    behaviour for all voices, not introduced here.
  - No "_comment" key on any entry (ingest.py --dry-run rejects it).
  - review_status = "draft" for every entry -> stored without an embedding,
    invisible to retrieval until a human promotes it to "approved".

CHUNKING -- by POEM, then by STANZA-GROUP
----------------------------------------
corpus_passage.body is TEXT with no length ceiling; the only hard limit is the
Voyage embedding input (~32k tokens), never approached here. For retrieval
quality we sub-chunk: short poems (Thrymskvitha, Alvissmol, Baldrs Draumar,
etc.) become a single entry; long poems (Hovamol 164 st., Voluspo, Atlamol
105 st., the Sigurth cycle) are split on Bellows' own stanza numbering into
groups of <= MAX_STANZAS_PER_CHUNK stanzas and <= MAX_CHARS_PER_CHUNK chars,
never splitting a stanza. Bellows' editorial apparatus -- the Introductory
Note and the per-stanza commentary footnotes -- is NOT myth-unit text; it is
kept out of `body` and preserved in `_provenance` (intro note in full; the
commentary notes whose numbers fall in the chunk's stanza range) for the
review pass.

VERSE OCR -- corruption flags (see --emit-sample for live examples)
-----------------------------------------------------------------
  - Stanza numbers survive as "N." at line start -- GOOD -- but Bellows'
    commentary footnotes ALSO start "N." and are interleaved in batches after
    each page of stanzas. They are separated here structurally: a block is
    VERSE if its lines carry the metrical caesura (a run of 3+ spaces mid-line,
    which this OCR preserves) and/or are short; otherwise it is COMMENTARY.
  - Running heads alternate every page: the poem name (verso) and "Poetic
    Edda" (recto); bracketed pagination "[3]" / "[ xxvii ]".
  - Hard line-wrap breaks mid-line: "warmed the stones of / earth."
  - Scannos: "Rtgsthula", "Sigrdriftimol", "Yaivning gap", "looo" (=1000),
    "H" for "II". Residual scannos are left for the manual review pass.

USAGE
-----
    python3 scripts-resilience/build_norse_corpus_poetic_edda.py
    python3 scripts-resilience/build_norse_corpus_poetic_edda.py --raw path/to/cached_djvu.txt
    python3 scripts-resilience/build_norse_corpus_poetic_edda.py --out corpus/norse-poetic-edda-passages-STAGED.json
    python3 scripts-resilience/build_norse_corpus_poetic_edda.py --emit-sample   # OCR before/after, no write
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
    "https://archive.org/download/poeticedda00belluoft/poeticedda00belluoft_djvu.txt"
)
ARCHIVE_ID = "poeticedda00belluoft"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(REPO_ROOT, "corpus", "norse-poetic-edda-passages-STAGED.json")
DEFAULT_CACHE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "bellows_poetic_edda_djvu.txt"
)

MAX_STANZAS_PER_CHUNK = 16
MAX_CHARS_PER_CHUNK = 1900

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


# --- The 34 poems + 2 prose bridges, in reading order -------------------------
# key, canonical title, regex matching the OCR'd ALL-CAPS in-body header,
# register, [suggested poem-level markers from the Pass 4 brief].
# The brief's marker map (step 7):
#   wound     -> Baldrs Draumar
#   threshold -> Voluspo
#   pattern   -> Voluspo ; Hymiskvitha ; Thrymskvitha
#   exile     -> Lokasenna
#   figure    -> Hovamol ; Lokasenna ; Voluspo
POEMS: list[dict] = [
    dict(key="voluspo", title="Völuspá", rx=r"VOLUSPO", reg="invocation",
         markers=["threshold", "pattern", "figure"]),
    dict(key="hovamol", title="Hávamál", rx=r"HOVAMOL", reg="invocation",
         markers=["figure"]),
    dict(key="vafthruthnismol", title="Vafþrúðnismál", rx=r"VAFTHRUTHNISMOL",
         reg="invocation", markers=[]),
    dict(key="grimnismol", title="Grímnismál", rx=r"GRIMNISMOL", reg="invocation",
         markers=[]),
    dict(key="skirnismol", title="Skírnismál", rx=r"SKIRNISMOL", reg="narrative",
         markers=[]),
    dict(key="harbarthsljoth", title="Hárbarðsljóð", rx=r"HARBARTHSLJOTH",
         reg="narrative", markers=[]),
    dict(key="hymiskvitha", title="Hymiskviða", rx=r"HYMISKVITHA", reg="narrative",
         markers=["pattern"]),
    dict(key="lokasenna", title="Lokasenna", rx=r"LOKASENNA", reg="narrative",
         markers=["exile", "figure"]),
    dict(key="thrymskvitha", title="Þrymskviða", rx=r"THRYMSKVITHA", reg="narrative",
         markers=["pattern"]),
    dict(key="alvissmol", title="Alvíssmál", rx=r"ALVISSMOL", reg="invocation",
         markers=[]),
    dict(key="baldrs-draumar", title="Baldrs draumar", rx=r"BALDRS\s+DRAUMAR",
         reg="invocation", markers=["wound"]),
    dict(key="rigsthula", title="Rígsþula", rx=r"RIGSTHULA", reg="narrative",
         markers=[]),
    dict(key="hyndluljoth", title="Hyndluljóð", rx=r"HYNDLULJOTH", reg="invocation",
         markers=[]),
    dict(key="svipdagsmol", title="Svipdagsmál", rx=r"SVIPDAGSMOL", reg="invocation",
         markers=[]),
    dict(key="volundarkvitha", title="Völundarkviða", rx=r"VOLUNDARKVITHA",
         reg="narrative", markers=[]),
    dict(key="helgakvitha-hjorvarthssonar", title="Helgakviða Hjörvarðssonar",
         rx=r"HJORVARTHSSONAR", reg="narrative", markers=[]),
    dict(key="helgakvitha-hundingsbana-i", title="Helgakviða Hundingsbana I",
         rx=r"HELGAKVITHA\s+HUNDINGSBANA\s+I\b", reg="narrative", markers=[]),
    dict(key="helgakvitha-hundingsbana-ii", title="Helgakviða Hundingsbana II",
         rx=r"HELGAKVITHA\s+HUNDINGSBANA\s+(?:II|H)\b", reg="narrative", markers=[]),
    dict(key="fra-dautha-sinfjotla", title="Frá dauða Sinfjötla",
         rx=r"FRA\s+DAUTHA\s+SINFJOTLA", reg="narrative", markers=[], prose=True),
    dict(key="gripisspo", title="Grípisspá", rx=r"GRIPISSPO", reg="invocation",
         markers=[]),
    dict(key="reginsmol", title="Reginsmál", rx=r"REGINSMOL", reg="narrative",
         markers=[]),
    dict(key="fafnismol", title="Fáfnismál", rx=r"FAFNISMOL", reg="narrative",
         markers=[]),
    dict(key="sigrdrifumol", title="Sigrdrífumál", rx=r"SIGRDRIFUMOL",
         reg="invocation", markers=[]),
    dict(key="brot-af-sigurtharkvithu", title="Brot af Sigurðarkviðu",
         rx=r"BROT\s+AF\s+SIGURTHARKVITHU", reg="narrative", markers=[]),
    dict(key="guthrunarkvitha-i", title="Guðrúnarkviða I",
         rx=r"GUTHRUNARKVITHA\s+I\b", reg="narrative", markers=[]),
    dict(key="sigurtharkvitha-en-skamma", title="Sigurðarkviða en skamma",
         rx=r"SIGURTHARKVITHA\s+EN\s+SKAMMA", reg="narrative", markers=[]),
    dict(key="helreith-brynhildar", title="Helreið Brynhildar",
         rx=r"HELREITH\s+BRYNHILDAR", reg="narrative", markers=[]),
    dict(key="drap-niflunga", title="Dráp Niflunga", rx=r"DRAP\s+NIFLUNGA",
         reg="narrative", markers=[], prose=True),
    dict(key="guthrunarkvitha-ii", title="Guðrúnarkviða II (en forna)",
         rx=r"GUTHRUNARKVITHA\s+II\b", reg="narrative", markers=[]),
    dict(key="guthrunarkvitha-iii", title="Guðrúnarkviða III",
         rx=r"GUTHRUNARKVITHA\s+III\b", reg="narrative", markers=[]),
    dict(key="oddrunargratr", title="Oddrúnargrátr", rx=r"ODDRUNARGRATR",
         reg="narrative", markers=[]),
    dict(key="atlakvitha", title="Atlakviða en grœnlenzka",
         rx=r"ATLAKVITHA\s+EN\s+GRONLENZKA", reg="narrative", markers=[]),
    dict(key="atlamol", title="Atlamál en grœnlenzku",
         rx=r"ATLAMOL\s+EN\s+GRONLENZKU", reg="narrative", markers=[]),
    dict(key="guthrunarhvot", title="Guðrúnarhvöt", rx=r"GUTHRUNARHVOT",
         reg="narrative", markers=[]),
    dict(key="hamthesmol", title="Hamðismál", rx=r"HAMTHESMOL", reg="narrative",
         markers=[]),
]
# Drap Niflunga is a prose bridge; in THIS edition it carries its own
# "Introductory Note", so it anchors like any other poem (POEMS entry above).
RE_END = re.compile(r"^\s*PRONOUNCING\s+INDEX", re.I)
RE_INTRO_NOTE = re.compile(r"^\s*Introductory\s+No[a-z]{1,3}\.?\s*$")  # OCR: "Note"/"Nots"
RE_PAGENUM = re.compile(r"^\s*\[\s*[\divxlcIVXLC]{1,7}\s*\]\s*$")
RE_CAESURA = re.compile(r"\S\s{3,}\S")
RE_SPEAKER = re.compile(
    r"^\s*[\"“]?[A-Z][A-Za-z]+(?:\s+(?:the\s+)?[A-Za-z]+){0,4}\s+"
    r"(?:spake|said|sang|cried|answered|spoke|replied|quoth)"
    r"(?:\s+in\s+reply)?\s*[:.]?\s*$"
)
RE_RUNHEAD_GENERIC = re.compile(
    r"^\s*(?:Poetic\s+Edda|THE\s+POETIC\s+EDDA|LAYS\s+OF\s+THE\s+(?:GODS|HEROES)"
    r"|VOLUME\s+[IVX]+)\s*$",
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


def locate_spans(lines: list[str]) -> list[dict]:
    """Anchor on the 35 'Introductory Note' lines. Each poem's title is the
    ALL-CAPS line(s) 1-4 lines above its Introductory Note; its content span
    runs from the note to the next poem's title block (last span ends at the
    PRONOUNCING INDEX)."""
    _caps = re.compile(r"\b[A-Z]{4,}\b")
    _caps_stop = {"NOTE", "NOTS", "LAYS", "GODS", "HEROES", "THE", "POETIC", "EDDA"}

    def has_title_above(ni: int) -> bool:
        blob = " ".join(lines[max(0, ni - 6) : ni])
        return any(t not in _caps_stop for t in _caps.findall(blob))

    note_idx = [
        i for i, ln in enumerate(lines) if RE_INTRO_NOTE.match(ln) and has_title_above(i)
    ]
    end_idx = next((i for i, ln in enumerate(lines) if RE_END.match(ln)), len(lines))

    if len(note_idx) != len(POEMS):
        raise SystemExit(
            f"expected {len(POEMS)} 'Introductory Note' anchors, found {len(note_idx)} "
            f"-- OCR/TOC drift, stop and inspect before trusting the output."
        )

    spans: list[dict] = []
    for n, ni in enumerate(note_idx):
        poem = POEMS[n]
        # title block: the ~6 lines above the note carry TITLE / blank /
        # subtitle / blank / "Introductory Note". Scan all of them.
        title_start = max(0, ni - 6)
        header_blob = " ".join(lines[k] for k in range(title_start, ni)).upper()
        if not re.search(poem["rx"], header_blob):
            raise SystemExit(
                f"poem #{n} ({poem['title']}): expected header /{poem['rx']}/ "
                f"above its Introductory Note, got {header_blob!r} -- stop and inspect."
            )
        content_start = ni + 1
        # the next poem's block above its note is TITLE / blank / subtitle /
        # blank / "Introductory Note" -> a fixed 5-line backoff clears it; any
        # residual ALL-CAPS header line is also dropped in parse_stanzas.
        content_end = (note_idx[n + 1] - 5) if n + 1 < len(note_idx) else end_idx
        spans.append(dict(poem=poem, body_lines=lines[content_start:content_end]))
    return spans


def split_intro_and_body(span: dict) -> tuple[str, list[str]]:
    """Separate the Introductory Note prose (kept for provenance) from the
    verse+commentary lines (the part we chunk). The body span already begins
    just after the 'Introductory Note' line; the note prose runs until the
    first blank-delimited block that scans as verse."""
    lines = span["body_lines"]

    # blank-delimited blocks, with their start line index
    blocks: list[tuple[int, list[str]]] = []
    cur: list[str] = []
    start = 0
    for i, ln in enumerate(lines):
        if ln.strip():
            if not cur:
                start = i
            cur.append(ln.strip())
        elif cur:
            blocks.append((start, cur))
            cur = []
    if cur:
        blocks.append((start, cur))

    for bstart, block in blocks:
        if classify_block(block) == "verse":
            intro = " ".join(
                l.strip() for l in lines[:bstart] if l.strip()
            )
            return intro, lines[bstart:]

    # no verse found -> prose bridge / all-prose poem
    return "\n".join(l.strip() for l in lines if l.strip()), []


# Editorial / footnote vocabulary. This OCR mangles stanza numerals badly
# ("fo."=10, "II."=11, "i"=1, "53^"=536), so segmentation CANNOT lean on the
# numbers. The metrical caesura (a 3+-space run this OCR preserves) plus line
# length is the reliable signal for verse-vs-apparatus.
EDITORIAL_RX = re.compile(
    r"\b(cf\.|stanzas?\b|editors?\b|editions?\b|manuscript|Regius|Hauksbok|Snorri"
    r"|interpolat|lacuna|the poet\b|the word\b|lit\.|literally|emendation|MS\."
    r"|apparently|probably|here rendered|is uncertain|is doubtful|Bugge|Finnur"
    r"|Gering|Mullenhoff|Sijmons)\b",
    re.I,
)
# a gloss footnote: "Heimdall: the watchman ...", "4. Bur's sons: Othin ..."
GLOSS_RX = re.compile(
    r"^[\"“(]?\d{0,3}[).\s]{0,3}[\"“(]?[A-Z][A-Za-zʼ'’\-]+(?:\s+[A-Za-zʼ'’\-]+){0,3}"
    r"[\"”)]?\s*(?:\([^)]*\))?\s*:"
)
RE_LEAD_NUM = re.compile(r"^\s*[\"“(]?\(?(\d{1,3})\s*[).\-]\s*")
RE_INLINE_NUM = re.compile(r"^\s*(\d{1,3})\s*[.\-]\s+(?=[\"“A-Z])")


def _split_verse_block_on_numbers(block: list[str]) -> list[list[str]]:
    """This OCR frequently runs several stanzas together inside one blank-
    delimited block. A verse line almost never starts 'NN. Capital', so split
    the block at every interior line that does."""
    out: list[list[str]] = []
    cur: list[str] = []
    for line in block:
        if cur and RE_INLINE_NUM.match(line):
            out.append(cur)
            cur = [line]
        else:
            cur.append(line)
    if cur:
        out.append(cur)
    return out or [block]


def _has_caesura(line: str) -> bool:
    return bool(RE_CAESURA.search(line))


def classify_block(block: list[str]) -> str:
    """verse | commentary | skip -- by caesura + line shape, NOT by numeral."""
    ne = [l for l in block if l.strip()]
    if not ne:
        return "skip"
    caes_frac = sum(_has_caesura(l) for l in ne) / len(ne)
    long_frac = sum(len(l.strip()) > 64 for l in ne) / len(ne)
    head = " ".join(ne[:2])
    if GLOSS_RX.match(ne[0]) and caes_frac < 0.5:
        return "commentary"
    if caes_frac >= 0.34 and not (EDITORIAL_RX.search(ne[0]) and caes_frac < 0.5):
        return "verse"
    if long_frac >= 0.4 or EDITORIAL_RX.search(head):
        return "commentary"
    if all(len(l.strip()) <= 64 for l in ne) and len(ne) <= 8:
        return "verse"
    return "commentary"


def parse_stanzas(
    vlines: list[str], poem_title: str, poem_rx: str = ""
) -> tuple[list[dict], list[dict], int]:
    """Return (stanzas, commentary, n_inferred_numbers).
    stanzas: [{num, text, speaker}]  commentary: [{num, text}].

    Blank-line-delimited blocks, each classified verse|commentary by caesura +
    line shape (NOT by numeral). This OCR inserts blank lines *within* stanzas
    in parts of the book, so consecutive verse blocks are accreted into the
    current stanza UNLESS a block opens with an OCR-legible stanza number that
    is a plausible +1..+3 increment -- only then does a new stanza begin."""
    heads = {poem_title.split(" (")[0].lower()}
    if poem_rx:
        heads.add(re.sub(r"\\[a-zA-Z]|[\\^$.|?*+()\[\]{}]", "", poem_rx).replace(" ", "").lower())

    def is_runhead(s: str) -> bool:
        return re.sub(r"[^a-z]", "", s.lower()) in heads and len(s) <= 40

    def is_header_junk(s: str) -> bool:
        letters = re.sub(r"[^A-Za-z]", "", s)
        return len(letters) >= 4 and letters.isupper()

    kept: list[str] = []
    for ln in vlines:
        s = ln.strip()
        if not s:
            kept.append("")
            continue
        if (
            RE_PAGENUM.match(ln)
            or RE_RUNHEAD_GENERIC.match(ln)
            or is_runhead(s)
            or is_header_junk(s)
        ):
            continue
        kept.append(s)

    blocks: list[list[str]] = []
    cur: list[str] = []
    for s in kept:
        if s:
            cur.append(s)
        elif cur:
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)

    stanzas: list[dict] = []
    commentary: list[dict] = []
    pending_speaker: str | None = None
    stanza_seq = 0
    note_seq = 0
    inferred = 0
    cur: list[str] | None = None   # lines of the stanza being accreted
    cur_speaker: str | None = None

    def close_stanza():
        nonlocal cur
        if cur:
            text = _join_verse(cur)
            if text:
                stanzas.append(dict(num=stanza_seq, text=text, speaker=cur_speaker))
        cur = None

    # expand: (kind, sub-block). verse blocks are split on interior stanza
    # numbers; speaker lines and commentary/skip pass through whole.
    items: list[tuple[str, list[str]]] = []
    for block in blocks:
        if len(block) == 1 and RE_SPEAKER.match(block[0]):
            items.append(("speaker", block))
            continue
        kind = classify_block(block)
        if kind == "skip":
            continue
        if kind == "verse":
            items.extend(("verse", sb) for sb in _split_verse_block_on_numbers(block))
        else:
            items.append((kind, block))

    for kind, block in items:
        if kind == "speaker":
            close_stanza()
            pending_speaker = re.sub(r"\s+", " ", block[0].strip("\"“ :."))
            continue

        m = RE_LEAD_NUM.match(block[0])
        parsed = int(m.group(1)) if m else None
        body_block = list(block)
        if m:
            body_block[0] = block[0][m.end():]

        if kind == "commentary":
            close_stanza()
            text = _join_prose(body_block)
            if not text:
                continue
            if parsed is not None and note_seq < parsed <= note_seq + 3:
                note_seq = parsed
            else:
                note_seq += 1
            commentary.append(dict(num=note_seq, text=text))
            continue

        # verse block: a new stanza begins only on an OCR-legible incrementing
        # number; otherwise these lines belong to the stanza in progress.
        starts_new = parsed is not None and stanza_seq < parsed <= stanza_seq + 3
        if starts_new or cur is None:
            close_stanza()
            if starts_new:
                stanza_seq = parsed
            else:
                stanza_seq += 1
                inferred += 1
            cur = list(body_block)
            cur_speaker = pending_speaker
            pending_speaker = None
        else:
            cur.extend(body_block)
    close_stanza()

    return stanzas, commentary, inferred


# OCR of a bracketed page number stranded mid-verse: "[174]" -> "L 174 J",
# "I 174 I", "( 174 )", "1 74 ]" etc.
RE_PAGENUM_INLINE = re.compile(r"^\s*[\[\](){}ILlJ|1i]{0,2}\s*\d{1,4}\s*[\[\](){}ILlJ|1i]{0,2}\s*$")


def _join_verse(block: list[str]) -> str:
    out = []
    for l in block:
        l = RE_CAESURA.sub(lambda m: m.group(0)[0] + " " + m.group(0)[-1], l)
        l = re.sub(r"\s{2,}", " ", l).strip()
        if not l or RE_PAGENUM_INLINE.match(l):
            continue
        if out and not re.search(r"[.,;:!?\"”)]$", out[-1]) and l[:1].islower():
            out[-1] = out[-1] + " " + l
        else:
            out.append(l)
    return "\n".join(out).strip()


def _join_prose(block: list[str]) -> str:
    t = " ".join(l.strip() for l in block if l.strip())
    t = re.sub(r"\s+([.,;:!?])", r"\1", t)
    return re.sub(r"\s{2,}", " ", t).strip()


def group_stanzas(stanzas: list[dict]) -> list[list[dict]]:
    groups: list[list[dict]] = []
    cur: list[dict] = []
    cur_chars = 0
    for st in stanzas:
        add = len(st["text"]) + (len(st["speaker"]) + 2 if st["speaker"] else 0) + 6
        if cur and (len(cur) >= MAX_STANZAS_PER_CHUNK or cur_chars + add > MAX_CHARS_PER_CHUNK):
            groups.append(cur)
            cur, cur_chars = [], 0
        cur.append(st)
        cur_chars += add
    if cur:
        groups.append(cur)
    return groups


def render_group(group: list[dict]) -> str:
    parts = []
    for st in group:
        head = f"{st['num']}. "
        if st["speaker"]:
            parts.append(f"[{st['speaker']}]")
        parts.append(head + st["text"].replace("\n", "\n" + " " * len(head)))
    return "\n\n".join(parts).strip()


def build_entries(spans: list[dict]) -> list[dict]:
    entries: list[dict] = []
    for span in spans:
        poem = span["poem"]
        intro, vlines = split_intro_and_body(span)
        stanzas, commentary, inferred = parse_stanzas(vlines, poem["title"], poem["rx"])

        if not stanzas:  # prose bridge (Fra Dautha Sinfjotla, Drap Niflunga) or
            # a poem this heuristic could not segment into verse -- keep the whole
            # span as one flagged entry for the reviewer, hard-split if huge.
            whole = normalize_body(_join_prose([intro]))
            slices = _hard_split(whole)
            for gi, sl in enumerate(slices, 1):
                e = _entry(poem, gi, len(slices), sl, None, intro if gi == 1 else "", "", prose=True)
                e["_provenance"]["needs_manual_segmentation"] = (
                    "no verse structure detected — Introductory Note, any prose "
                    "narrative, and commentary are all in `body`; split by hand"
                )
                entries.append(e)
            continue

        groups = group_stanzas(stanzas)
        n_out = sum(len(_hard_split(normalize_body(render_group(g)))) for g in groups)
        oi = 0
        for group in groups:
            lo, hi = group[0]["num"], group[-1]["num"]
            notes = "\n\n".join(
                f"{c['num']}. {c['text']}" for c in commentary if lo <= c["num"] <= hi
            )
            for sl in _hard_split(normalize_body(render_group(group))):
                oi += 1
                e = _entry(poem, oi, n_out, sl, (lo, hi),
                           intro if oi == 1 else "", notes if sl else "")
                if inferred:
                    e["_provenance"]["stanza_numbers_inferred_in_poem"] = inferred
                entries.append(e)
    return entries


def _hard_split(body: str) -> list[str]:
    """Last-resort: cut an over-long body at paragraph/line breaks so no chunk
    grossly exceeds the target size (a single un-numbered mega-stanza, or an
    unsegmentable prose poem)."""
    cap = int(MAX_CHARS_PER_CHUNK * 1.6)
    if len(body) <= cap:
        return [body]
    out, buf = [], ""
    for para in re.split(r"(\n\n+)", body):
        if buf and len(buf) + len(para) > cap:
            out.append(buf.strip())
            buf = ""
        buf += para
    if buf.strip():
        out.append(buf.strip())
    return out


SOURCE_LABEL = (
    "The Poetic Edda (trans. Henry Adams Bellows, 1923; The American-Scandinavian "
    "Foundation, Scandinavian Classics XXI–XXII) — primary source, Old Norse verse"
)


def _prov(key, title, span, intro, notes, prose=False, note="") -> dict:
    p = {
        "lineage_id": "norse",
        "source_title": "The Poetic Edda",
        "translator_or_author": "trans. Henry Adams Bellows",
        "publication_year": 1923,
        "public_domain_basis": "US publication 1923 — public domain (pre-1929); "
        "archive.org rights field NOT_IN_COPYRIGHT. NB: the ingestion brief said "
        "'1936'; the item at this identifier is the 1923 first edition.",
        "public_domain": True,
        "genre": "primary_source",
        "poem_name": title,
        "poem_key": key,
        "archive_org_identifier": ARCHIVE_ID,
        "source_url": SOURCE_URL,
        "chunk_strategy": "poem -> stanza-group (Bellows' own stanza numbering; "
        f"<= {MAX_STANZAS_PER_CHUNK} stanzas and <= {MAX_CHARS_PER_CHUNK} chars per chunk, "
        "stanzas never split)",
        "markers_status": "SUGGESTED / UNCONFIRMED — poem-level map from the Pass 4 brief, "
        "pending manual review (per-chunk confirmation still required)",
        "ocr_cleanup": (
            "archive.org front/back matter stripped; running heads (poem name / "
            "'Poetic Edda') and bracketed page numbers removed; Introductory Note "
            "and per-stanza commentary footnotes separated from verse structurally "
            "(caesura + line-shape + stanza-number monotonicity) and moved to "
            "_provenance; metrical caesura normalized from OCR multi-space to a "
            "single space; obvious hard line-wraps rejoined. Residual scannos "
            "(e.g. 'Rtgsthula', 'looo'=1000) left for the manual review pass."
        ),
        "voice_authorization_note": (
            "voice_key 'volva': consent_grant is a Temporal Bridges Institute "
            "institutional placeholder, not a named tradition-bearer review "
            "(same status flagged in Passes 1–3)."
        ),
        "pulled_via": "scripts-resilience/build_norse_corpus_poetic_edda.py",
    }
    if span:
        p["stanza_range"] = {"from": span[0], "to": span[1]}
    if intro:
        p["introductory_note"] = intro
    if notes:
        p["commentary_notes_in_range"] = notes
    if prose:
        p["chunk_strategy"] = "whole prose bridge (no numbered stanzas)"
    if note:
        p["note"] = note
    return p


def _entry(poem, gi, ng, body, span, intro, notes, prose=False) -> dict:
    suffix = f"-{gi:02d}" if ng > 1 else ""
    section_kind = "Lays of the Gods" if _is_god_poem(poem["key"]) else "Lays of the Heroes"
    rng = f" — stanzas {span[0]}–{span[1]}" if span else ""
    return {
        "passage_id": f"norse-poetic-edda-bellows-{poem['key']}{suffix}",
        "source": SOURCE_LABEL,
        "section": f"{section_kind} — {poem['title']}{rng}",
        "body": body,
        "themes": [],
        "nahuales": [],
        "cruz_positions": [],
        "signal_affinity": list(poem["markers"]),
        "register": poem["reg"],
        "ceremonial_sensitivity": "open",
        "review_status": "draft",
        "reviewed_by": None,
        "review_date": None,
        "_provenance": _prov(poem["key"], poem["title"], span, intro, notes, prose=prose),
        "voice_key": "volva",
    }


_GOD_POEMS = {
    "voluspo", "hovamol", "vafthruthnismol", "grimnismol", "skirnismol",
    "harbarthsljoth", "hymiskvitha", "lokasenna", "thrymskvitha", "alvissmol",
    "baldrs-draumar", "rigsthula", "hyndluljoth", "svipdagsmol",
}


def _is_god_poem(key: str) -> bool:
    return key in _GOD_POEMS


def strip_boilerplate(raw: str) -> list[str]:
    lines = raw.splitlines()
    start = next(
        (i for i, ln in enumerate(lines) if re.match(r"\s*VOLUSPO\s*$", ln)), None
    )
    if start is None:
        raise SystemExit("could not locate VOLUSPO in the source text")
    end = next((i for i, ln in enumerate(lines) if RE_END.match(ln)), len(lines))
    return lines[start:end]


def cleaning_sample(raw: str) -> str:
    lines = strip_boilerplate(raw)
    raw_window = "\n".join(lines[90:135])  # Voluspo st. 1-5 + first commentary batch
    spans = locate_spans(lines)
    entries = build_entries(spans)
    vol = [e for e in entries if e["_provenance"]["poem_key"] == "voluspo"][:2]
    her = next(e for e in entries if e["_provenance"]["poem_key"] == "sigurtharkvitha-en-skamma")
    after = []
    for e in vol:
        after.append(f"[{e['section']}]\n{e['body'][:900]}")
    after.append(f"[{her['section']}]\n{her['body'][:600]}")
    flags = (
        "CORRUPTION FLAGS FOUND:\n"
        "  * stanza numbers survive as 'N.' — but commentary footnotes also start "
        "'N.' and are interleaved after each page of verse; separated here by the "
        "metrical caesura (multi-space run) + line-shape + number monotonicity.\n"
        "  * running heads 'Voluspo' (verso) / 'Poetic Edda' (recto) every page; "
        "bracketed pagination '[3]'.\n"
        "  * hard line-wrap: 'warmed the stones of / earth.' split across lines.\n"
        "  * scannos seen: 'Rtgsthula', 'Sigrdriftimol', 'Yaivning gap', 'looo' "
        "(=1000), 'H' for 'II'.\n"
    )
    return (
        "================ BEFORE (raw OCR — Voluspo stanzas 1–5 + first note batch) ===========\n"
        + raw_window
        + "\n\n================ AFTER (cleaned, verse only; footnotes -> _provenance) ==============\n"
        + "\n\n".join(after)
        + "\n\n" + flags
    )


def main() -> None:
    try:  # Windows consoles default to cp1252; corpus text is UTF-8
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--raw", default=DEFAULT_CACHE, help="cached _djvu.txt (downloaded if absent)")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output JSON path")
    ap.add_argument("--emit-sample", action="store_true", help="print OCR before/after and exit")
    args = ap.parse_args()

    raw = fetch_raw(args.raw)

    if args.emit_sample:
        print(cleaning_sample(raw))
        return

    lines = strip_boilerplate(raw)
    spans = locate_spans(lines)
    entries = build_entries(spans)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")

    by_poem: dict[str, int] = {}
    marker_counts: dict[str, int] = {}
    for e in entries:
        k = e["_provenance"]["poem_key"]
        by_poem[k] = by_poem.get(k, 0) + 1
        for m in e["signal_affinity"]:
            marker_counts[m] = marker_counts.get(m, 0) + 1
    lengths = sorted(len(e["body"]) for e in entries)
    print(
        json.dumps(
            {
                "wrote": os.path.relpath(args.out, REPO_ROOT),
                "entries": len(entries),
                "poems_covered": len(by_poem),
                "entries_per_poem": by_poem,
                "body_chars_min_median_max": [lengths[0], lengths[len(lengths) // 2], lengths[-1]],
                "suggested_marker_counts": marker_counts,
                "review_status": "draft (all) — not embedded, invisible to retrieval until promoted",
                "next": [
                    "human review of every entry (markers are SUGGESTED only; footnotes are in _provenance)",
                    "python3 scripts-resilience/ingest.py corpus/norse-poetic-edda-passages-STAGED.json --dry-run",
                    'confirm DEV DATABASE_URL, then: python3 scripts-resilience/ingest.py corpus/norse-poetic-edda-passages-STAGED.json "$DEV_DATABASE_URL"',
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
