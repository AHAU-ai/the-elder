#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_egyptian_corpus.py -- first Egyptian-lineage ingestion sweep (wave 1:
the clean proofread Project Gutenberg texts; a second wave may follow for
the messier-structured candidates -- Budge's "Legends of the Gods", Renouf
& Naville's "The Egyptian Book of the Dead", and Wilson's "Egyptian
Literature" anthology -- each of which has TOC/body title mismatches,
repeated running-head titles, or ambiguous duplicate section names that
need more bespoke handling than the four texts here).

  budge_book_of_dead   The Book of the Dead (Sir E. A. Wallis Budge,
                        popular/abridged edition) -- PG 7145
  budge_future_life    Egyptian Ideas of the Future Life (Budge) -- PG 11277
  petrie_tales_1        Egyptian Tales, Translated from the Papyri: First
                        Series, IVth to XIIth Dynasty (W. M. Flinders
                        Petrie) -- PG 7386
  petrie_tales_2        Egyptian Tales, Translated from the Papyri: Second
                        Series, XVIIIth to XIXth Dynasty (Petrie) -- PG 7413

GOVERNANCE NOTE (lib/traditions.ts, 'egyptian' entry, "Hem-netjer"): the
Egyptian voice's tradition definition forbids borrowing from Greek or
Roman tradition, and specifically flags "Roman deity names: Isis (Roman
syncretism context)" -- i.e. Isis is authentically Egyptian, but content
that frames her (or Osiris) through the Greco-Roman mystery-cult lens
(Plutarch's De Iside et Osiride, etc.) is out of scope. None of the four
texts here are Greek/Roman-authored accounts of Egypt -- all are direct
Egyptological translations from Egyptian source material (Budge, Petrie).
This note is carried forward into the wave-2 script too, since Budge's
"Legends of the Gods" contains one chapter explicitly titled "The Legend
of Isis and Osiris ACCORDING TO CLASSICAL WRITERS" that must be excluded
on this basis.

Same contract as every other lineage's ingestion passes: fetch, clean,
segment, stage a JSON file ONLY. Never touches the database, never embeds.
Real gate is the shared CLI:

    python3 scripts-resilience/ingest.py corpus/egyptian-<book>-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/egyptian-<book>-passages-STAGED.json "$DEV_DATABASE_URL"

voice_key for corpus_passage is 'hem_netjer' per lib/lineageToVoiceKey.ts's
egyptian -> 'hem_netjer' mapping. NOTE: this lineage already has 15
hand-seeded stub passages in the dev DB (passage_ids like 'egy-eml-001',
5 each from 3 sources) predating this sweep -- this script uses a
different passage_id scheme ('egyptian-<book>-NN') so it cannot collide
with or overwrite those existing rows; the two will coexist unless a
human later reconciles/dedupes them.

NO PER-BOOK MARKER SUGGESTIONS (signal_affinity left empty), same as
every batch pass in this corpus -- pending human review.

USAGE
-----
    python3 scripts-resilience/build_egyptian_corpus.py <book>
    python3 scripts-resilience/build_egyptian_corpus.py all
"""
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import unicodedata

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
CORPUS_DIR = os.path.join(REPO_ROOT, "corpus")

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

SALTILLO_CANONICAL = "ʼ"
SALTILLO_VARIANTS = ["'", "’", "‘", "՚", "ꞌ"]


def normalize_body(text: str) -> str:
    nfc = unicodedata.normalize("NFC", text)
    for v in SALTILLO_VARIANTS:
        nfc = nfc.replace(v, SALTILLO_CANONICAL)
    return nfc.strip()


def fetch_raw(gutenberg_id: int, cache_name: str) -> str:
    cache_path = os.path.join(CACHE_DIR, cache_name)
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8", errors="replace") as f:
            return f.read()
    import urllib.request

    url = f"https://www.gutenberg.org/ebooks/{gutenberg_id}.txt.utf-8"
    print(f"fetching {url} ...", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "the-elder-corpus/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=_SSL_CONTEXT) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        f.write(raw)
    return raw


def find_pg_end(lines: list[str]) -> int:
    for i, ln in enumerate(lines):
        if ln.strip().startswith("*** END OF THE PROJECT GUTENBERG") or ln.strip().startswith("*** END OF THIS PROJECT GUTENBERG"):
            return i
    return len(lines)


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


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:56] or "passage"


VOICE_AUTH_NOTE = (
    "voice_key 'hem_netjer' (lineage 'egyptian' per lib/lineageToVoiceKey.ts): "
    "institutional-placeholder consent_grant, not a named tradition-bearer "
    "review -- same status as every lineage in this corpus. "
    "review_status 'approved' here means TRANSCRIPTION STRUCTURE ONLY "
    "(clean proofread Gutenberg source, unambiguous chapter/title anchors) "
    "-- it does NOT represent ceremonial or scholarly sign-off. Sourced "
    "directly from Egyptological translations (Budge, Petrie), not a "
    "Greek/Roman-authored account of Egypt, per lib/traditions.ts's "
    "'never borrows from Greek, Roman' rule for this voice. "
    "signal_affinity intentionally left empty pending human marker review."
)


def make_entry(passage_id: str, source: str, section: str, body: str, provenance: dict) -> dict:
    return {
        "passage_id": passage_id,
        "source": source,
        "section": section,
        "body": normalize_body(body),
        "themes": [],
        "nahuales": [],
        "cruz_positions": [],
        "signal_affinity": [],
        "register": provenance.get("register", "exposition"),
        "ceremonial_sensitivity": "open",
        "review_status": "approved",
        "reviewed_by": None,
        "review_date": None,
        "_provenance": provenance,
        "voice_key": "hem_netjer",
    }


def prov(**kw) -> dict:
    base = {"lineage_id": "egyptian", "public_domain": True, "voice_authorization_note": VOICE_AUTH_NOTE}
    base.update(kw)
    return base


# ==================================================================== budge chapter books
def _build_budge_chapters(gid: int, cache: str, src: str, title: str, chap_pattern: str, expected: int, id_prefix: str) -> list[dict]:
    raw = fetch_raw(gid, cache)
    lines = raw.splitlines()
    chap_re = re.compile(chap_pattern)
    starts = [(i, m.group(1)) for i, ln in enumerate(lines) if (m := chap_re.match(ln.strip()))]
    if len(starts) != expected:
        raise SystemExit(f"{id_prefix}: expected {expected} chapters, found {len(starts)}")

    def chapter_title(idx: int) -> tuple[str, int]:
        # title is simply the single line immediately following the CHAPTER
        # heading (after skipping blanks) -- these titles are ordinary
        # mixed-case sentences ('The Preservation of the Mummified Body in
        # the Tomb by Thoth.'), so no case-based heuristic is needed or
        # reliable; just take up to the next blank line.
        i = idx + 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        title = lines[i].strip() if i < len(lines) else ""
        i += 1
        return title, i

    entries: list[dict] = []
    for ci, (idx, roman) in enumerate(starts):
        ctitle, body_start = chapter_title(idx)
        cend = starts[ci + 1][0] if ci + 1 < len(starts) else find_pg_end(lines)
        body = "\n\n".join(split_paragraphs(lines[body_start:cend])).strip()
        pid = f"egyptian-{id_prefix}-{ci+1:02d}-{slugify(ctitle or 'chapter')}"
        entries.append(
            make_entry(
                pid, src, f"Chapter {roman}. {ctitle.title() if ctitle.isupper() else ctitle}", body,
                prov(
                    source_title=title, translator_or_author="Sir E. A. Wallis Budge",
                    public_domain_basis=f"US publication pre-1929; Project Gutenberg eBook #{gid}",
                    genre="Egyptological translation/exposition",
                    gutenberg_id=gid, source_url=f"https://www.gutenberg.org/ebooks/{gid}",
                    chapter_roman=roman, chapter_title=ctitle,
                    chunk_strategy=f"{id_prefix}-chapter: one passage per CHAPTER anchor.",
                    pulled_via=f"scripts-resilience/build_egyptian_corpus.py:{id_prefix}",
                ),
            )
        )
    return entries


def build_budge_book_of_dead() -> list[dict]:
    return _build_budge_chapters(7145, "gutenberg_budge_book_of_dead_7145.txt", "The Book of the Dead (Sir E. A. Wallis Budge)", "The Book of the Dead", r"^CHAPTER ([IVXL]+)\s*$", 9, "budgebod")


def build_budge_future_life() -> list[dict]:
    return _build_budge_chapters(11277, "gutenberg_budge_future_life_11277.txt", "Egyptian Ideas of the Future Life (Sir E. A. Wallis Budge)", "Egyptian Ideas of the Future Life", r"^CHAPTER ([IVXL]+)\.\s*$", 5, "budgefuturelife")


# ==================================================================== petrie tales
def _petrie_titles(lines: list[str], toc_start_marker: str) -> list[str]:
    toc_start = next(i for i, ln in enumerate(lines) if ln.strip() == toc_start_marker)
    titles: list[str] = []
    i = toc_start + 1
    blanks = 0
    while i < len(lines):
        s = lines[i].strip()
        if not s:
            blanks += 1
            if blanks >= 2 and titles:
                break
            i += 1
            continue
        blanks = 0
        # 'TALES OF THE MAGICIANS' is a group-title divider page with no
        # content of its own (Khafra's/Baufra's/Hordedef's Tale follow
        # immediately after it) -- exclude it as a would-be empty passage.
        if s not in ("INTRODUCTION", "REMARKS", "INDEX", "TALES OF THE MAGICIANS"):
            titles.append(s)
        i += 1
    return titles


def _build_petrie(gid: int, cache: str, src: str, title: str, toc_marker: str, expected_titles: int, id_prefix: str, dynasty_note: str) -> list[dict]:
    raw = fetch_raw(gid, cache)
    lines = raw.splitlines()
    titles = _petrie_titles(lines, toc_marker)
    if len(titles) != expected_titles:
        raise SystemExit(f"{id_prefix}: expected {expected_titles} tale titles, found {len(titles)}: {titles}")

    def norm(s: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]", " ", s.upper())).strip()

    starts: list[tuple[int, str]] = []
    for t in titles:
        target = norm(t)
        occ = [i for i, ln in enumerate(lines) if norm(ln.strip()) == target and ln.strip() and ln.strip()[0].isupper()]
        if len(occ) < 2:
            raise SystemExit(f"{id_prefix}: expected a TOC + body occurrence pair for '{t}', found {len(occ)}")
        starts.append((occ[-1], t))
    starts.sort()

    body_end = find_pg_end(lines)
    for i, ln in enumerate(lines):
        if ln.strip() == "INDEX" and i > starts[-1][0]:
            body_end = i
            break

    entries: list[dict] = []
    for si, (idx, ttitle) in enumerate(starts):
        # bound each tale at the next tale OR the next 'REMARKS' marker,
        # whichever comes first -- REMARKS is Petrie's own scholarly
        # commentary, not part of the ancient tale.
        send = starts[si + 1][0] if si + 1 < len(starts) else body_end
        for i in range(idx + 1, send):
            if lines[i].strip() == "REMARKS":
                send = i
                break
        body = "\n\n".join(split_paragraphs(lines[idx + 1 : send])).strip()
        pid = f"egyptian-{id_prefix}-{si+1:02d}-{slugify(ttitle)}"
        entries.append(
            make_entry(
                pid, src, ttitle.title(), body,
                prov(
                    source_title=title, translator_or_author="W. M. Flinders Petrie",
                    public_domain_basis=f"US publication pre-1929; Project Gutenberg eBook #{gid}",
                    genre="ancient Egyptian tale (primary source, translated from papyri)",
                    register="narrative",
                    dynasty=dynasty_note,
                    gutenberg_id=gid, source_url=f"https://www.gutenberg.org/ebooks/{gid}",
                    tale_title=ttitle.title(),
                    chunk_strategy=f"{id_prefix}-tale: one passage per tale, bounded at the next tale title or Petrie's own 'REMARKS' commentary section (excluded), whichever comes first.",
                    pulled_via=f"scripts-resilience/build_egyptian_corpus.py:{id_prefix}",
                ),
            )
        )
    return entries


def build_petrie_tales_1() -> list[dict]:
    return _build_petrie(
        7386, "gutenberg_petrie_egyptian_tales_1_7386.txt",
        "Egyptian Tales, Translated from the Papyri: First Series, IVth to XIIth Dynasty (W. M. Flinders Petrie)",
        "Egyptian Tales, Translated from the Papyri: First Series, IVth to XIIth Dynasty",
        "LIST OF CONTENTS", 6, "petrietales1", "IVth to XIIth Dynasty",
    )


def build_petrie_tales_2() -> list[dict]:
    return _build_petrie(
        7413, "gutenberg_petrie_egyptian_tales_2_7413.txt",
        "Egyptian Tales, Translated from the Papyri: Second Series, XVIIIth to XIXth Dynasty (W. M. Flinders Petrie)",
        "Egyptian Tales, Translated from the Papyri: Second Series, XVIIIth to XIXth Dynasty",
        "CONTENTS", 4, "petrietales2", "XVIIIth to XIXth Dynasty",
    )


# ==================================================================== budge_legends_of_gods
def build_budge_legends_of_gods() -> list[dict]:
    GID, CACHE = 9411, "gutenberg_budge_legends_of_gods_9411.txt"
    SRC = "Legends of the Gods (Sir E. A. Wallis Budge)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    # GOVERNANCE EXCLUSION: Chapter IX, "The Legend of Isis and Osiris
    # According to Classical Writers," is Budge's reprint of Plutarch's
    # De Iside et Osiride -- a Greek author's Greek-lensed retelling
    # (addressed to "O Clea," using Greek names Rhea/Kronos/Helios/Hermes/
    # Selene for the Egyptian deities). lib/traditions.ts's 'egyptian'
    # voice explicitly forbids Greek-tradition borrowing and flags Isis
    # specifically for "Roman syncretism context" risk -- this chapter is
    # exactly that risk materialized. Its start ('I. Though it be the
    # wise man's duty, O Clea...') is used as the hard upper bound; nothing
    # at or after this line is ever included below.
    plutarch_start = next(i for i, ln in enumerate(lines) if ln.strip().startswith("I.  Though it be the wise man's duty, O Clea"))

    heading_re = re.compile(r"^(?:THE|A)\s+LEGEND\s+OF\s+.+$")

    def norm_title(s: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]", " ", s.upper())).strip()

    raw_headings = [(i, lines[i].strip()) for i in range(200, plutarch_start) if heading_re.match(lines[i].strip())]

    # group consecutive occurrences sharing a normalized title into ONE
    # section (Budge repeats the section title as a running head on every
    # page of that section's technical/literal-translation presentation --
    # 5 occurrences within ~300 lines is a running head, not 5 sections);
    # a differently-titled heading always starts a new section.
    sections: list[tuple[int, str, list[int]]] = []  # (start_idx, title, [running-head repeat idxs])
    for idx, text in raw_headings:
        nt = norm_title(text)
        if sections and norm_title(sections[-1][1]) == nt:
            sections[-1][2].append(idx)
        else:
            sections.append((idx, text, []))

    entries: list[dict] = []
    for si, (idx, title, repeats) in enumerate(sections):
        send = sections[si + 1][0] if si + 1 < len(sections) else plutarch_start
        strip_set = set(repeats)
        body_lines = [ln for i, ln in enumerate(lines[idx + 1 : send], start=idx + 1) if i not in strip_set]
        body = "\n\n".join(split_paragraphs(body_lines)).strip()
        if not body:
            continue
        clean_title = re.sub(r"\[FN#\d+\]", "", title).rstrip(".").strip()
        pid = f"egyptian-budgelegends-{si+1:02d}-{slugify(clean_title)}"
        entries.append(
            make_entry(
                pid, SRC, clean_title.title(), body,
                prov(
                    source_title="Legends of the Gods", translator_or_author="Sir E. A. Wallis Budge",
                    public_domain_basis=f"US publication pre-1929; Project Gutenberg eBook #{GID}",
                    genre="Egyptological translation of mythological papyri",
                    gutenberg_id=GID, source_url=f"https://www.gutenberg.org/ebooks/{GID}",
                    legend_title=clean_title.title(),
                    chunk_strategy=(
                        "budgelegends-title-run: sections are runs of consecutive "
                        "occurrences of the same normalized legend title (Budge presents "
                        "each legend twice -- an English narrative treatment, then a more "
                        "literal technical translation reprinting the same title as a "
                        "running head on every page -- both are kept as one merged "
                        "passage per legend, with the repeated running-head title lines "
                        "stripped)."
                    ),
                    governance_exclusion=(
                        "Chapter IX ('The Legend of Isis and Osiris According to Classical "
                        "Writers' -- Budge's reprint of Plutarch's De Iside et Osiride) is "
                        "DELIBERATELY EXCLUDED from this staging: it is a Greek author's "
                        "Greek-lensed account (addressed to 'O Clea,' using Rhea/Kronos/"
                        "Helios/Hermes/Selene for the Egyptian deities), which the Egyptian "
                        "voice's governance (lib/traditions.ts) explicitly forbids ('never "
                        "borrows from Greek... Roman deity names: Isis (Roman syncretism "
                        "context)')."
                    ),
                    pulled_via="scripts-resilience/build_egyptian_corpus.py:budge_legends_of_gods",
                ),
            )
        )
    return entries


def longest_ascending_run(candidates: list[tuple[int, int]], tolerance: int = 3) -> list[tuple[int, int]]:
    """Longest run of (line_index, number) candidates whose values increase
    by 1..tolerance in document order, skipping a single spurious candidate
    when the one after it resumes the sequence. Shared algorithm, reused
    (reimplemented locally, not cross-imported) from the Norse/Greek batch
    scripts."""
    best_run: list[tuple[int, int]] = []
    run: list[tuple[int, int]] = []
    last_num = None
    i = 0
    while i < len(candidates):
        idx, num = candidates[i]
        if last_num is None or 1 <= num - last_num <= tolerance:
            run.append((idx, num))
            last_num = num
            i += 1
            continue
        if i + 1 < len(candidates):
            _, nnum = candidates[i + 1]
            if 1 <= nnum - last_num <= tolerance:
                i += 1
                continue
        if len(run) > len(best_run):
            best_run = run
        run = [(idx, num)]
        last_num = num
        i += 1
    if len(run) > len(best_run):
        best_run = run
    return best_run


def _roman_to_int(s: str) -> int:
    vals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total, prev = 0, 0
    for ch in reversed(s):
        v = vals[ch]
        total += -v if v < prev else v
        prev = v
    return total


# ==================================================================== renouf_naville
def build_renouf_naville() -> list[dict]:
    GID, CACHE = 69566, "gutenberg_renouf_naville_book_of_dead_69566.txt"
    SRC = "The Egyptian Book of the Dead (trans. P. Le Page Renouf and Edouard Naville)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    chap_re = re.compile(r"^\s*CHAPTER ([IVXLCDM]+)\.\s*$")
    # Every real chapter heading is picked up here EXCEPT those inside an
    # '[Illustration: CHAPTER I. Papyrus in the British Museum...]' plate
    # caption block, which reprints the chapter number a second time right
    # after its real heading -- tracked and skipped directly (multi-line
    # blocks opened by '[Illustration:' and closed by a line ending ']').
    #
    # This is NOT the same problem as Rydberg/Heimskringla/Pausanias: there
    # the noise was a handful of stray citation numbers to reject via
    # longest-ascending-run. Here the *real* signal is genuinely
    # non-monotonic -- Naville's critical edition presents several variant
    # papyrus recensions of the same chapter number consecutively (three
    # separate 'CHAPTER XVI.'s in a row), and later chapters out of strict
    # numeric order -- so an ascending-run filter would silently discard
    # legitimate alternate-recension content as if it were noise. Every
    # occurrence surviving the illustration-block filter is kept as its own
    # passage; a repeated number gets a variant-letter suffix (a, b, c...).
    candidates: list[tuple[int, int]] = []
    in_illustration = False
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s.startswith("[Illustration:"):
            in_illustration = True
        if in_illustration:
            if s.endswith("]"):
                in_illustration = False
            continue
        if (m := chap_re.match(ln)):
            candidates.append((i, _roman_to_int(m.group(1))))
    if len(candidates) < 100:
        raise SystemExit(f"renouf_naville: expected 100+ chapters, found {len(candidates)}")

    variant_seen: dict[int, int] = {}
    chapters: list[tuple[int, int, str]] = []  # (idx, num, variant_letter)
    for idx, num in candidates:
        n = variant_seen.get(num, 0)
        variant_seen[num] = n + 1
        letter = "" if n == 0 else chr(ord("a") + n - 1)
        chapters.append((idx, num, letter))

    body_end = find_pg_end(lines)

    def chapter_title(idx: int) -> tuple[str, int]:
        # the chapter's descriptive title is an italic-underscore-quoted
        # line immediately after the heading ('_Chapter whereby one
        # knoweth the Power of Hermopolis._'), sometimes wrapped across two
        # or three lines ('_Chapter whereby work may not be imposed [upon a
        # person] in the\n  Netherworld._'); not every chapter has one on
        # its own line (some open directly into verse) -- only consume it
        # if the very next non-blank line starts with an underscore, and
        # keep consuming lines until one ENDS with '_.' (the real close),
        # so the tail of a wrapped title is never left dangling into body.
        i = idx + 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i < len(lines) and lines[i].strip().startswith("_"):
            title_parts = []
            j = i
            while j < len(lines):
                title_parts.append(lines[j].strip())
                if lines[j].strip().endswith(("._", "_.")) or j - i > 4:
                    break
                j += 1
            title = re.sub(r"\s+", " ", " ".join(title_parts))
            return re.sub(r"[_]", "", title).strip(), j + 1
        return "", idx + 1

    entries: list[dict] = []
    for ci, (idx, num, letter) in enumerate(chapters):
        title, body_start = chapter_title(idx)
        cend = chapters[ci + 1][0] if ci + 1 < len(chapters) else body_end
        body_lines = lines[body_start:cend]
        # drop this chapter's own trailing 'NOTES.' scholarly commentary
        # and any '[Illustration: ...]' / 'PLATE N.' caption blocks.
        notes_idx = next((i for i, ln in enumerate(body_lines) if ln.strip() == "NOTES."), None)
        if notes_idx is not None:
            body_lines = body_lines[:notes_idx]
        cleaned = []
        skip_illustration = False
        for ln in body_lines:
            s = ln.strip()
            if s.startswith("[Illustration:"):
                skip_illustration = True
            if skip_illustration:
                if s.endswith("]"):
                    skip_illustration = False
                continue
            if re.match(r"^PLATE [IVXLCDM]+\.?\s*$", s) or s == "BOOK OF THE DEAD.":
                continue
            if re.fullmatch(r"[-—\s]{5,}", s):
                continue
            cleaned.append(ln)
        body = "\n\n".join(split_paragraphs(cleaned)).strip()
        if not body:
            continue
        pid = f"egyptian-renoufnaville-{num:03d}{letter}"
        variant_note = f" (variant {letter})" if letter else ""
        section = f"Chapter {num}{variant_note}" + (f". {title}" if title else "")
        entries.append(
            make_entry(
                pid, SRC, section, body,
                prov(
                    source_title="The Egyptian Book of the Dead",
                    translator_or_author="P. Le Page Renouf and Edouard Naville",
                    public_domain_basis=f"US publication pre-1929; Project Gutenberg eBook #{GID}",
                    genre="Egyptological translation (primary source)", register="verse",
                    gutenberg_id=GID, source_url=f"https://www.gutenberg.org/ebooks/{GID}",
                    chapter_number=num, chapter_variant=letter or None, chapter_title=title,
                    chunk_strategy=(
                        "renoufnaville-chapter: one passage per CHAPTER heading in document "
                        "order, EXCLUDING occurrences inside '[Illustration: ...]' plate-"
                        "caption blocks (which reprint the chapter number a second time). "
                        "Unlike this corpus's other numbered texts, real chapter numbers "
                        "here are genuinely non-monotonic (Naville's critical edition "
                        "presents multiple variant papyrus recensions of the same chapter "
                        "number consecutively, and chapters out of strict numeric order "
                        "elsewhere) -- an ascending-run filter would have wrongly discarded "
                        "legitimate alternate-recension content as noise, so none is "
                        "applied; a repeated chapter number instead gets a variant-letter "
                        "suffix (a, b, c...) preserving every recension as its own passage. "
                        "Each chapter's own trailing scholarly 'NOTES.' commentary excluded, "
                        "kept to the translated text itself."
                    ),
                    pulled_via="scripts-resilience/build_egyptian_corpus.py:renouf_naville",
                ),
            )
        )
    return entries


# ==================================================================== wilson_egyptian_literature
# Wilson's "Egyptian Literature" is a ~180-section anthology (compiled from
# the "Records of the Past" series, many different named translators per
# piece) whose "Book of the Dead" excerpt section and "Egyptian Tales"
# section both have extensive duplicate-titled entries ("Preserving The
# Heart" x4, "Of Making Perfect The Khu" x3, etc.) AND are largely redundant
# with material already staged from other translations in this corpus
# (Renouf/Naville and Budge for the Book of the Dead; Petrie for the tales).
# Rather than build a fragile positional-matching system for content this
# corpus mostly already has, this pass takes ONLY the anthology's unique,
# non-redundant, clearly-mythological/liturgical material: nine hymns and
# litanies plus the Epic of Penta-Our, none of which are ingested elsewhere
# and none of which have duplicate titles anywhere in the book (verified by
# exact-match occurrence count before inclusion). The Tell Amarna Tablets
# (diplomatic correspondence) and secular travel narratives in the same
# anthology are skipped as non-mythological.
_WILSON_TITLES = [
    "Hymn To Osiris", "Hymn To The Nile", "The Solemn Festal Dirge Of The Egyptians",
    "Hymns To Amen", "Hymn To Amen-Ra", "Hymn To Ra-Harmachis",
    "The Lamentations Of Isis And Nephthys", "The Litany Of Ra", "The Book Of Respirations",
]


def build_wilson_egyptian_literature() -> list[dict]:
    GID, CACHE = 28282, "gutenberg_wilson_egyptian_literature_28282.txt"
    SRC = "Egyptian Literature (ed. Epiphanius Wilson, from the Records of the Past series)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    def find_body_occurrence(title: str) -> int:
        # the real body section divider is the title-case heading (NOT the
        # TOC's identical listing, which comes first in the file, and NOT
        # any later ALL-CAPS translated-text sub-heading) -- take the first
        # occurrence after line 300 (past the whole CONTENTS block).
        occ = [i for i, ln in enumerate(lines) if ln.strip() == title and i > 300]
        if not occ:
            raise SystemExit(f"wilson: no body occurrence found for {title!r}")
        return occ[0]

    starts = [(find_body_occurrence(t), t) for t in _WILSON_TITLES]
    epitome_idx = next(i for i, ln in enumerate(lines) if ln.strip() == "THE EPIC OF PENTA-OUR")
    starts.append((epitome_idx, "The Epic Of Penta-Our"))
    starts.sort()

    footnotes_idx = next(i for i, ln in enumerate(lines) if ln.strip() == "FOOTNOTES" and i > epitome_idx)

    entries: list[dict] = []
    for si, (idx, title) in enumerate(starts):
        send = starts[si + 1][0] if si + 1 < len(starts) else footnotes_idx
        body = "\n\n".join(split_paragraphs(lines[idx + 1 : send])).strip()
        pid = f"egyptian-wilson-{si+1:02d}-{slugify(title)}"
        entries.append(
            make_entry(
                pid, SRC, title, body,
                prov(
                    source_title="Egyptian Literature", editor="Epiphanius Wilson",
                    public_domain_basis=f"US publication pre-1929; Project Gutenberg eBook #{GID}",
                    genre="hymn/litany (primary source, multiple named translators per piece)",
                    register="verse" if title != "The Epic Of Penta-Our" else "narrative",
                    gutenberg_id=GID, source_url=f"https://www.gutenberg.org/ebooks/{GID}",
                    piece_title=title,
                    chunk_strategy=(
                        "wilson-unique-piece: one of only 10 pieces taken from this ~180-"
                        "section anthology -- deliberately NOT the Book of the Dead excerpt "
                        "or Egyptian Tales sections (both heavily duplicate-titled AND "
                        "largely redundant with the Renouf/Naville, Budge, and Petrie "
                        "passes already in this corpus); selected for being unique, "
                        "non-redundant, clearly mythological/liturgical, and unambiguously "
                        "single-occurrence in the source text."
                    ),
                    pulled_via="scripts-resilience/build_egyptian_corpus.py:wilson_egyptian_literature",
                ),
            )
        )
    return entries


BOOKS = {
    "budge_book_of_dead": build_budge_book_of_dead,
    "budge_legends_of_gods": build_budge_legends_of_gods,
    "renouf_naville": build_renouf_naville,
    "wilson_egyptian_literature": build_wilson_egyptian_literature,
    "budge_future_life": build_budge_future_life,
    "petrie_tales_1": build_petrie_tales_1,
    "petrie_tales_2": build_petrie_tales_2,
}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("book", choices=list(BOOKS.keys()) + ["all"])
    ap.add_argument("--out-dir", default=CORPUS_DIR)
    args = ap.parse_args()

    todo = list(BOOKS.keys()) if args.book == "all" else [args.book]
    os.makedirs(args.out_dir, exist_ok=True)
    summary = {}
    for name in todo:
        entries = BOOKS[name]()
        out_path = os.path.join(args.out_dir, f"egyptian-{name.replace('_', '')}-passages-STAGED.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
            f.write("\n")
        lengths = sorted(len(e["body"]) for e in entries)
        summary[name] = {
            "wrote": os.path.relpath(out_path, REPO_ROOT),
            "entries": len(entries),
            "body_chars_min_median_max": [lengths[0], lengths[len(lengths) // 2], lengths[-1]] if lengths else [0, 0, 0],
        }
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
