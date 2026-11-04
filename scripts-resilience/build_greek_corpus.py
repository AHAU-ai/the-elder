#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_greek_corpus.py -- first Greek-lineage ingestion sweep. All texts are
clean proofread Project Gutenberg transcriptions, hand-vetted for Roman-name
contamination before inclusion (see GOVERNANCE NOTE below):

  hesiod_hymns    Hesiod, the Homeric Hymns, and Homerica (trans. Hugh G.
                  Evelyn-White, Loeb, 1914) -- PG 348
  iliad           The Iliad (trans. Andrew Lang, Walter Leaf, Ernest Myers,
                  prose, 1883) -- PG 3059
  odyssey         The Odyssey of Homer (trans. S. H. Butcher and Andrew
                  Lang, prose, 1879) -- PG 1728
  kingsley_heroes The Heroes; Or, Greek Fairy Tales for My Children
                  (Charles Kingsley, 1856) -- PG 677
  hawthorne       A Wonder Book and Tanglewood Tales, for Girls and Boys
                  (Nathaniel Hawthorne, 1851/1853 combined ed.) -- PG 35377
  church_iliad    The Story of the Iliad (Alfred J. Church, 1892) -- PG 74231
  church_odyssey  The Story of the Odyssey (Alfred J. Church, 1892) -- PG 6370
  pausanias_v1    Pausanias' Description of Greece, Vol. I (trans. A. R.
                  Shilleto, 1886) -- PG 68946 (Books I-VI)
  pausanias_v2    Pausanias' Description of Greece, Vol. II (trans. A. R.
                  Shilleto, 1886) -- PG 68680 (Books VII-X)

GOVERNANCE NOTE (lib/traditions.ts, 'greek' entry, "Pythia of Delphi"):
  The Greek voice's tradition definition explicitly forbids Roman deity
  names (Jupiter, Mars, Venus, Mercury, Juno) and lists "Stoic philosophy"
  as a separate forbidden neighbor (the existing 'stoa' lineage --
  Seneca/Epictetus/Marcus Aurelius -- must stay distinct from this one).
  Every candidate text was checked for Roman-name density before inclusion
  here (grep counts of Jupiter/Jove/Juno/Minerva/Venus/Mercury vs Zeus/
  Athene/Hermes). REJECTED on this basis and NOT in this script: Bulfinch's
  Age of Fable, Guerber's Myths of Greece and Rome, Gayley's Classic Myths
  in English Literature and Art (all use Roman names as primary headwords
  throughout, not confined to a separable chapter), Ovid's Metamorphoses
  (a Roman poet's Roman-framed retelling), Baldwin's Old Greek Stories (85
  "Jupiter" vs 2 "Zeus"), and the Pope and Cowper verse Iliad translations
  (477 "Jove" in Cowper's alone). The texts actually included here were
  verified overwhelmingly Greek-named (e.g. the Lang/Leaf/Myers Iliad: 515
  Zeus vs 0 Roman names; Butcher/Lang Odyssey: 270 Zeus vs 0). voice_key
  for corpus_passage is 'pythia' per lib/lineageToVoiceKey.ts's
  greek -> 'pythia' mapping (lineage_id 'greek' recorded in _provenance
  for audit, same convention as 'norse' -> 'volva' throughout that
  lineage's passes).

Same contract as every other lineage's ingestion passes: fetch, clean,
segment, stage a JSON file ONLY. Never touches the database, never embeds.
Real gate is the shared CLI:

    python3 scripts-resilience/ingest.py corpus/greek-<book>-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/greek-<book>-passages-STAGED.json "$DEV_DATABASE_URL"

NO PER-BOOK MARKER SUGGESTIONS (signal_affinity left empty), same as the
Norse batch2/batch3 passes -- pending human review.

USAGE
-----
    python3 scripts-resilience/build_greek_corpus.py <book>
    python3 scripts-resilience/build_greek_corpus.py all
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


def is_footnote_paragraph(p: str) -> bool:
    return bool(re.match(r"^\[\d{1,3}\]", p.strip())) and len(p) < 500


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
    return [p for p in paras if not is_footnote_paragraph(p)]


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:56] or "passage"


def longest_ascending_run(candidates: list[tuple[int, int]], tolerance: int = 3) -> list[tuple[int, int]]:
    """Longest run of (line_index, number) candidates whose values increase
    by 1..tolerance in document order, skipping a single spurious candidate
    when the one after it resumes the sequence. Shared logic, independently
    reimplemented here rather than cross-imported from the Norse batch
    scripts to keep this lineage's build self-contained."""
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


VOICE_AUTH_NOTE = (
    "voice_key 'pythia' (lineage 'greek' per lib/lineageToVoiceKey.ts): "
    "institutional-placeholder consent_grant, not a named tradition-bearer "
    "review -- same status as every lineage in this corpus. "
    "review_status 'approved' here means TRANSCRIPTION STRUCTURE ONLY "
    "(clean proofread Gutenberg source, unambiguous section/chapter "
    "anchors) -- it does NOT represent ceremonial or scholarly sign-off. "
    "Text was checked for Roman-name contamination before inclusion (see "
    "module docstring); signal_affinity intentionally left empty pending "
    "human marker review."
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
        "register": provenance.get("register", "narrative"),
        "ceremonial_sensitivity": "open",
        "review_status": "approved",
        "reviewed_by": None,
        "review_date": None,
        "_provenance": provenance,
        "voice_key": "pythia",
    }


def prov(**kw) -> dict:
    base = {"lineage_id": "greek", "public_domain": True, "voice_authorization_note": VOICE_AUTH_NOTE}
    base.update(kw)
    return base


# ==================================================================== hesiod_hymns
def build_hesiod_hymns() -> list[dict]:
    GID, CACHE = 348, "gutenberg_hesiod_hymns_evelynwhite_348.txt"
    SRC = "Hesiod, the Homeric Hymns, and Homerica (trans. Hugh G. Evelyn-White, 1914)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    hesiod_start = next(i for i, ln in enumerate(lines) if ln.strip() == "HESIOD" and i > 1000)
    endnotes_start = next(i for i, ln in enumerate(lines) if ln.strip() == "ENDNOTES" and i > hesiod_start)

    hymn_re = re.compile(r"^([IVXL]+)\.\s+TO\s+(.+?)\d*\s*$")
    hymn_starts = [(i, m.group(1), m.group(2).strip()) for i, ln in enumerate(lines) if (m := hymn_re.match(ln.strip())) and hesiod_start < i < endnotes_start]
    if len(hymn_starts) != 33:
        raise SystemExit(f"expected 33 Homeric Hymns, found {len(hymn_starts)}")
    hymn_idx_set = {i for i, _, _ in hymn_starts}

    # every other major work/fragment heading: an all-caps line (letters,
    # spaces, apostrophes, hyphens only -- no digits/periods, which the
    # 'I. TO DEMETER'-style hymn headings always carry) between HESIOD and
    # ENDNOTES, excluding the container labels 'THE HOMERIC HYMNS' and
    # 'HOMERICA' which are section dividers, not works with their own body.
    # PG's inline endnote markers sometimes fuse a bare digit onto the end
    # of a heading with no space (e.g. 'THE CATALOGUES OF WOMEN AND
    # EOIAE1701') -- strip a trailing digit run before matching/storing.
    work_re = re.compile(r"^[A-Z][A-Z’' -]{4,55}$")
    skip = {"THE HOMERIC HYMNS", "HOMERICA"}
    work_starts = [
        (i, re.sub(r"\d+$", "", ln.strip()).strip()) for i, ln in enumerate(lines)
        if hesiod_start < i < endnotes_start
        and work_re.match(re.sub(r"\d+$", "", ln.strip()))
        and re.sub(r"\d+$", "", ln.strip()).strip() not in skip
    ]

    combined: list[tuple[int, str, str]] = [(i, "work", t) for i, t in work_starts] + [(i, "hymn", f"{n}. To {t.title()}") for i, n, t in hymn_starts]
    combined.sort()

    entries: list[dict] = []
    for ci, (idx, kind, title) in enumerate(combined):
        cend = combined[ci + 1][0] if ci + 1 < len(combined) else endnotes_start
        body = "\n\n".join(split_paragraphs(lines[idx + 1 : cend])).strip()
        if not body:
            continue
        pid = f"greek-hesiodhymns-{ci+1:03d}-{slugify(title)}"
        entries.append(
            make_entry(
                pid, SRC, title, body,
                prov(
                    source_title="Hesiod, the Homeric Hymns, and Homerica",
                    translator_or_author="Hugh G. Evelyn-White", publication_year=1914,
                    public_domain_basis="US publication pre-1929; Project Gutenberg eBook #348",
                    genre="eddic-equivalent primary epic/hymn poetry", register="verse" if kind == "hymn" else "verse",
                    gutenberg_id=GID, source_url=f"https://www.gutenberg.org/ebooks/{GID}",
                    work_or_hymn_title=title, unit_kind=kind,
                    chunk_strategy="hesiodhymns-work-or-hymn: each of Hesiod's named works/fragments (Works and Days, Theogony, Shield of Heracles, epic-cycle fragments, etc.) as one passage; each of the 33 numbered Homeric Hymns as a separate passage.",
                    pulled_via="scripts-resilience/build_greek_corpus.py:hesiod_hymns",
                ),
            )
        )
    return entries


# ==================================================================== iliad / odyssey
def _build_homer_book_poem(gid: int, cache: str, src: str, translator: str, year: int, id_prefix: str, title_word: str) -> list[dict]:
    raw = fetch_raw(gid, cache)
    lines = raw.splitlines()
    book_re = re.compile(r"^BOOK ([IVXLC]+)\.\s*$")
    all_starts = [(i, m.group(1)) for i, ln in enumerate(lines) if (m := book_re.match(ln.strip()))]
    # the TOC lists all 24 'BOOK <roman>.' lines consecutively before the
    # real body occurrences (which are spread across thousands of lines) --
    # the back half of an exact 2x24 match set is the real sequence.
    starts = all_starts[len(all_starts) // 2 :] if len(all_starts) == 48 else all_starts
    if len(starts) != 24:
        raise SystemExit(f"{id_prefix}: expected 24 books, found {len(starts)} (raw {len(all_starts)})")

    entries: list[dict] = []
    for bi, (idx, roman) in enumerate(starts):
        bend = starts[bi + 1][0] if bi + 1 < len(starts) else find_pg_end(lines)
        body = "\n\n".join(split_paragraphs(lines[idx + 1 : bend])).strip()
        pid = f"greek-{id_prefix}-{bi+1:02d}"
        entries.append(
            make_entry(
                pid, src, f"Book {roman}", body,
                prov(
                    source_title=f"The {title_word} of Homer" if title_word == "Odyssey" else f"The {title_word}",
                    translator_or_author=translator, publication_year=year,
                    public_domain_basis=f"US publication pre-1929; Project Gutenberg eBook #{gid}",
                    genre="primary epic poetry (prose translation)", register="narrative",
                    gutenberg_id=gid, source_url=f"https://www.gutenberg.org/ebooks/{gid}",
                    book_roman=roman, book_number=bi + 1,
                    chunk_strategy=f"{id_prefix}-book: one passage per Book (the poem's own traditional division), including its prefatory argument line.",
                    pulled_via=f"scripts-resilience/build_greek_corpus.py:{id_prefix}",
                ),
            )
        )
    return entries


def build_iliad() -> list[dict]:
    return _build_homer_book_poem(3059, "gutenberg_iliad_lang_leaf_myers_3059.txt", "The Iliad (trans. Andrew Lang, Walter Leaf, and Ernest Myers, prose, 1883)", "Andrew Lang, Walter Leaf, and Ernest Myers", 1883, "iliad", "Iliad")


def build_odyssey() -> list[dict]:
    return _build_homer_book_poem(1728, "gutenberg_odyssey_butcher_lang_1728.txt", "The Odyssey of Homer (trans. S. H. Butcher and Andrew Lang, prose, 1879)", "S. H. Butcher and Andrew Lang", 1879, "odyssey", "Odyssey")


# ==================================================================== kingsley_heroes
def build_kingsley_heroes() -> list[dict]:
    GID, CACHE = 677, "gutenberg_kingsley_heroes_677.txt"
    SRC = "The Heroes; Or, Greek Fairy Tales for My Children (Charles Kingsley, 1856)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    story_re = re.compile(r"^STORY ([IVX]+)\.—(.+)$")
    all_story_starts = [(i, m.group(1), m.group(2).strip()) for i, ln in enumerate(lines) if (m := story_re.match(ln.strip()))]
    # TOC lists all 3 'STORY <roman>.—TITLE' lines before the real body
    # occurrences, same pattern as the Iliad/Odyssey BOOK headers.
    story_starts = all_story_starts[len(all_story_starts) // 2 :] if len(all_story_starts) == 6 else all_story_starts
    if len(story_starts) != 3:
        raise SystemExit(f"expected 3 Kingsley stories, found {len(story_starts)} (raw {len(all_story_starts)})")

    part_re = re.compile(r"^PART ([IVX]+)\s*$")

    entries: list[dict] = []
    for si, (sidx, sroman, stitle) in enumerate(story_starts):
        send = story_starts[si + 1][0] if si + 1 < len(story_starts) else find_pg_end(lines)
        story_lines = lines[sidx + 1 : send]
        part_starts = [(i, m.group(1)) for i, ln in enumerate(story_lines) if (m := part_re.match(ln.strip()))]

        def part_title(idx: int) -> tuple[str, int]:
            i = idx + 1
            while i < len(story_lines) and not story_lines[i].strip():
                i += 1
            t = story_lines[i].strip() if i < len(story_lines) else ""
            return t, i + 1

        for pi, (pidx, proman) in enumerate(part_starts):
            pend = part_starts[pi + 1][0] if pi + 1 < len(part_starts) else len(story_lines)
            ptitle, body_start = part_title(pidx)
            body = "\n\n".join(split_paragraphs(story_lines[body_start:pend])).strip()
            pid = f"greek-kingsleyheroes-{si+1}-{pi+1:02d}-{slugify(ptitle)}"
            entries.append(
                make_entry(
                    pid, SRC, f"Story {sroman}—{stitle.title()} — Part {proman}. {ptitle.title()}", body,
                    prov(
                        source_title="The Heroes; Or, Greek Fairy Tales for My Children",
                        translator_or_author="Charles Kingsley", publication_year=1856,
                        public_domain_basis="US publication pre-1929; Project Gutenberg eBook #677",
                        genre="retelling", register="narrative",
                        gutenberg_id=GID, source_url=f"https://www.gutenberg.org/ebooks/{GID}",
                        story_title=stitle.title(), part_roman=proman, part_title=ptitle.title(),
                        chunk_strategy="kingsleyheroes-story-part: 3 stories (Perseus, The Argonauts, Theseus), each split into its own PART subdivisions.",
                        pulled_via="scripts-resilience/build_greek_corpus.py:kingsley_heroes",
                    ),
                )
            )
    return entries


# ==================================================================== hawthorne
_HAWTHORNE_TITLES = [
    ("wonderbook", "The Gorgon's Head"), ("wonderbook", "The Golden Touch"),
    ("wonderbook", "The Paradise of Children"), ("wonderbook", "The Three Golden Apples"),
    ("wonderbook", "The Miraculous Pitcher"), ("wonderbook", "The Chimaera"),
    ("tanglewoodtales", "The Minotaur"), ("tanglewoodtales", "The Pygmies"),
    ("tanglewoodtales", "The Dragon's Teeth"), ("tanglewoodtales", "Circe's Palace"),
    ("tanglewoodtales", "The Pomegranate Seeds"), ("tanglewoodtales", "The Golden Fleece"),
]


def build_hawthorne() -> list[dict]:
    GID, CACHE = 35377, "gutenberg_hawthorne_wonderbook_tanglewood_35377.txt"
    SRC = "A Wonder Book and Tanglewood Tales, for Girls and Boys (Nathaniel Hawthorne, 1851/1853)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    def norm(s: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]", " ", s.upper())).strip()

    tanglewood_marker = next(i for i, ln in enumerate(lines) if ln.strip() == "TANGLEWOOD TALES" and i > 1000)

    starts: list[tuple[int, str, str]] = []
    for part, title in _HAWTHORNE_TITLES:
        target = norm(title)
        lo = 0 if part == "wonderbook" else tanglewood_marker
        hi = tanglewood_marker if part == "wonderbook" else find_pg_end(lines)
        # a mid-sentence dialogue reference ('...do you succeed with the
        # Golden Touch?"') normalizes identically to the real heading but
        # always starts lower-case (mid-clause) where a real standalone
        # heading always starts upper-case -- filter on that.
        occ = [i for i in range(lo, hi) if lines[i].strip() and norm(lines[i].strip()) == target and lines[i].strip()[0].isupper()]
        if not occ:
            raise SystemExit(f"no body heading found for Hawthorne story '{title}'")
        starts.append((occ[-1], part, title))
    starts.sort()

    entries: list[dict] = []
    for si, (idx, part, title) in enumerate(starts):
        send = starts[si + 1][0] if si + 1 < len(starts) else find_pg_end(lines)
        body = "\n\n".join(split_paragraphs(lines[idx + 1 : send])).strip()
        pid = f"greek-hawthorne-{si+1:02d}-{slugify(title)}"
        entries.append(
            make_entry(
                pid, SRC, title, body,
                prov(
                    source_title="A Wonder Book and Tanglewood Tales, for Girls and Boys",
                    translator_or_author="Nathaniel Hawthorne", publication_year=1851 if part == "wonderbook" else 1853,
                    public_domain_basis="US publication pre-1929; Project Gutenberg eBook #35377",
                    genre="retelling (children's, framed narrative)", register="narrative",
                    gutenberg_id=GID, source_url=f"https://www.gutenberg.org/ebooks/{GID}",
                    collection="A Wonder Book" if part == "wonderbook" else "Tanglewood Tales",
                    story_title=title,
                    chunk_strategy="hawthorne-story: one passage per story, INCLUDING Hawthorne's framing narrative (the Tanglewood children's-porch device) around the myth retelling -- not split out, since the frame is itself the book's structuring device, not off-topic content.",
                    pulled_via="scripts-resilience/build_greek_corpus.py:hawthorne",
                ),
            )
        )
    return entries


# ==================================================================== church_iliad / church_odyssey
def _build_church(gid: int, cache: str, src: str, title: str, expected: int, id_prefix: str) -> list[dict]:
    raw = fetch_raw(gid, cache)
    lines = raw.splitlines()
    chap_re = re.compile(r"^CHAPTER ([IVXLC]+)\s*$")
    starts = [(i, m.group(1)) for i, ln in enumerate(lines) if (m := chap_re.match(ln.strip()))]
    if len(starts) != expected:
        raise SystemExit(f"{id_prefix}: expected {expected} chapters, found {len(starts)}")

    def chapter_title(idx: int) -> tuple[str, int]:
        i = idx + 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        title_lines = []
        while i < len(lines) and lines[i].strip() and lines[i].strip() == lines[i].strip().upper():
            title_lines.append(lines[i].strip())
            i += 1
        return re.sub(r"\s+", " ", " ".join(title_lines)).strip(), i

    entries: list[dict] = []
    for ci, (idx, roman) in enumerate(starts):
        ctitle, body_start = chapter_title(idx)
        cend = starts[ci + 1][0] if ci + 1 < len(starts) else find_pg_end(lines)
        body = "\n\n".join(split_paragraphs(lines[body_start:cend])).strip()
        pid = f"greek-{id_prefix}-{ci+1:02d}-{slugify(ctitle or 'chapter')}"
        entries.append(
            make_entry(
                pid, src, f"Chapter {roman}. {ctitle.title()}", body,
                prov(
                    source_title=title, translator_or_author="Alfred J. Church", publication_year=1892,
                    public_domain_basis=f"US publication pre-1929; Project Gutenberg eBook #{gid}",
                    genre="retelling (children's, condensed prose)", register="narrative",
                    gutenberg_id=gid, source_url=f"https://www.gutenberg.org/ebooks/{gid}",
                    chapter_roman=roman, chapter_title=ctitle.title(),
                    chunk_strategy=f"{id_prefix}-chapter: one passage per CHAPTER anchor.",
                    pulled_via=f"scripts-resilience/build_greek_corpus.py:{id_prefix}",
                ),
            )
        )
    return entries


def build_church_iliad() -> list[dict]:
    return _build_church(74231, "gutenberg_church_story_of_iliad_74231.txt", "The Story of the Iliad (Alfred J. Church, 1892)", "The Story of the Iliad", 23, "churchiliad")


def build_church_odyssey() -> list[dict]:
    return _build_church(6370, "gutenberg_church_story_of_odyssey_6370.txt", "The Story of the Odyssey (Alfred J. Church, 1892)", "The Story of the Odyssey", 24, "churchodyssey")


# ==================================================================== pausanias
def _pausanias_books(gid: int, cache: str, expected_books: list[str]) -> tuple[list[str], list[tuple[int, str, str]]]:
    raw = fetch_raw(gid, cache)
    lines = raw.splitlines()
    book_re = re.compile(r"^BOOK ([IVXLC]+)\.--(.+)$")
    starts = [(i, m.group(1), m.group(2).strip()) for i, ln in enumerate(lines) if (m := book_re.match(ln.strip()))]
    if [r for _, r, _ in starts] != expected_books:
        raise SystemExit(f"pausanias book romans mismatch: found {[r for _, r, _ in starts]}, expected {expected_books}")
    return lines, starts


def build_pausanias(vol: int) -> list[dict]:
    if vol == 1:
        gid, cache = 68946, "gutenberg_pausanias_v1_shilleto_68946.txt"
        expected = ["I", "II", "III", "IV", "V", "VI"]
    else:
        gid, cache = 68680, "gutenberg_pausanias_v2_shilleto_68680.txt"
        expected = ["VII", "VIII", "IX", "X"]
    SRC = f"Pausanias' Description of Greece, Vol. {'I' if vol == 1 else 'II'} (trans. A. R. Shilleto, 1886)"

    lines, book_starts = _pausanias_books(gid, cache, expected)

    body_end = find_pg_end(lines)
    for i, ln in enumerate(lines):
        if ln.strip().rstrip(".") == "INDEX":
            body_end = min(body_end, i)
            break

    chap_re = re.compile(r"^CHAPTER ([IVXLC]+)\.\s*$")
    roman_to_int = {}
    # build a roman->int table on demand via a small local converter
    def roman_int(s: str) -> int:
        vals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
        total = 0
        prev = 0
        for ch in reversed(s):
            v = vals[ch]
            total += -v if v < prev else v
            prev = v
        return total

    entries: list[dict] = []
    for bi, (bidx, broman, bname) in enumerate(book_starts):
        bend = book_starts[bi + 1][0] if bi + 1 < len(book_starts) else body_end
        book_lines = lines[bidx + 1 : bend]
        candidates = [(i, roman_int(m.group(1))) for i, ln in enumerate(book_lines) if (m := chap_re.match(ln.strip()))]
        chapters = longest_ascending_run(candidates, tolerance=3)
        if len(chapters) < 3:
            body = "\n\n".join(split_paragraphs(book_lines)).strip()
            pid = f"greek-pausanias-v{vol}-{bi+1:02d}-{slugify(bname)}"
            entries.append(
                make_entry(
                    pid, SRC, f"Book {broman}. {bname.title()}", body,
                    prov(
                        source_title="Pausanias' Description of Greece", volume=vol,
                        translator_or_author="A. R. Shilleto", publication_year=1886,
                        public_domain_basis=f"US publication pre-1929; Project Gutenberg eBook #{gid}",
                        genre="periegesis (travelogue with embedded myth/cult material)", register="exposition",
                        gutenberg_id=gid, source_url=f"https://www.gutenberg.org/ebooks/{gid}",
                        book_roman=broman, book_name=bname.title(),
                        chunk_strategy="pausanias-book-whole: fewer than 3 numbered-chapter anchors reliably detected, staged whole.",
                        pulled_via="scripts-resilience/build_greek_corpus.py:pausanias",
                    ),
                )
            )
            continue
        for ci, (cidx, cnum) in enumerate(chapters):
            cend = chapters[ci + 1][0] if ci + 1 < len(chapters) else len(book_lines)
            body = "\n\n".join(split_paragraphs(book_lines[cidx + 1 : cend])).strip()
            if not body:
                continue
            pid = f"greek-pausanias-v{vol}-{bi+1:02d}-{cnum:03d}"
            entries.append(
                make_entry(
                    pid, SRC, f"Book {broman} ({bname.title()}) — Chapter {cnum}", body,
                    prov(
                        source_title="Pausanias' Description of Greece", volume=vol,
                        translator_or_author="A. R. Shilleto", publication_year=1886,
                        public_domain_basis=f"US publication pre-1929; Project Gutenberg eBook #{gid}",
                        genre="periegesis (travelogue with embedded myth/cult material)", register="exposition",
                        gutenberg_id=gid, source_url=f"https://www.gutenberg.org/ebooks/{gid}",
                        book_roman=broman, book_name=bname.title(), chapter_number=cnum,
                        chunk_strategy="pausanias-book-chapter: two-level segmentation -- books (TOC-confirmed), each book's own numbered chapters (resets to 1 per book) via longest-ascending-run detection, same technique as the Heimskringla Norse pass.",
                        pulled_via="scripts-resilience/build_greek_corpus.py:pausanias",
                    ),
                )
            )
    return entries


# ==================================================================== apollodorus
# Frazer's 1921 Loeb translation (archive.org OCR, NOT a clean proofread
# Gutenberg text -- this is a bilingual facing-page edition, so the scan
# interleaves full pages of Greek original script into the English
# translation stream) plus a systematic Latin/anglicized hero-name
# normalization applied on user instruction, matching the stricter Greek
# standard the Iliad (Lang/Leaf/Myers, 'Aias' not 'Ajax') already sets in
# this corpus:
_HERO_NAME_FIXES = [
    (re.compile(r"\bHercules\b"), "Heracles"),
    (re.compile(r"\bUlysses\b"), "Odysseus"),
    (re.compile(r"\bAjax\b"), "Aias"),
    (re.compile(r"\bAesculapius\b"), "Asclepius"),
    (re.compile(r"\bMinerva\b"), "Athena"),
]


def _normalize_hero_names(text: str) -> str:
    for pat, repl in _HERO_NAME_FIXES:
        text = pat.sub(repl, text)
    return text


def _fetch_cached(cache_name: str) -> str:
    path = os.path.join(CACHE_DIR, cache_name)
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


_GREEK_RANGE = re.compile(r"[Ͱ-Ͽἀ-῿]")
_LATIN_RANGE = re.compile(r"[A-Za-z]")


def _is_greek_line(line: str) -> bool:
    """A line is a facing-page Greek-original line (to be dropped, not
    English translation) if Greek-script letters outnumber Latin ones."""
    g = len(_GREEK_RANGE.findall(line))
    l = len(_LATIN_RANGE.findall(line))
    return g > 0 and g >= l


_RUNNING_HEAD_RE = re.compile(r"^(APOLLODORUS|THE LIBRARY|INTRODUCTION|APPENDIX|INDEX|EPITOME,.*|EPITOMEB,.*)\s*$")
_BARE_PAGENUM_RE = re.compile(r"^\d{1,4}\s*$")
# a footnote paragraph starts with a bare arabic number (real narrative
# never does) -- the '[A-Z]' that used to follow was dropped because many
# footnotes quote a Greek word immediately after the number ('1 τῶν ἀστῶν
# A, Westermann...'), which this stricter version still catches via the
# digit-start alone.
_FOOTNOTE_PARA_RE = re.compile(r"^\d{1,3}[.,]?\s")
_CHAPTER_RE = re.compile(r"^([IVXL]+)[,.]?\s+[A-Z]")


def _roman_to_int(s: str) -> int:
    vals = {"I": 1, "V": 5, "X": 10, "L": 50}
    total, prev = 0, 0
    for ch in reversed(s):
        v = vals[ch]
        total += -v if v < prev else v
        prev = v
    return total


def _apollodorus_clean_lines(raw_lines: list[str]) -> list[str]:
    out = []
    for ln in raw_lines:
        s = ln.strip()
        if not s:
            out.append(ln)
            continue
        if _is_greek_line(s) or _RUNNING_HEAD_RE.match(s) or _BARE_PAGENUM_RE.match(s):
            continue
        out.append(ln)
    return out


def _apollodorus_chapters(lines: list[str]) -> list[dict]:
    """Detect inline roman-numeral chapter markers ('I, Sky was the
    first...', 'II. But when Zeus...') at paragraph starts, tolerant of a
    handful of false positives from footnote citations that happen to
    start with a roman-numeral-shaped abbreviation ('L. Dindorf; ...') --
    filtered out by the same longest-ascending-run detection used for the
    Rydberg/Heimskringla/Pausanias per-unit numbering, since a citation
    stub never continues the real sequence."""
    candidates = [(i, _roman_to_int(m.group(1))) for i, ln in enumerate(lines) if (m := _CHAPTER_RE.match(ln.strip())) and all(c in "IVXL" for c in m.group(1))]
    chapters = longest_ascending_run(candidates, tolerance=2)
    return [{"idx": i, "num": n} for i, n in chapters]


def build_apollodorus() -> list[dict]:
    SRC1 = "Apollodorus, The Library, Vol. I (trans. Sir James George Frazer, Loeb Classical Library, 1921)"
    SRC2 = "Apollodorus, The Library, Vol. II (trans. Sir James George Frazer, Loeb Classical Library, 1921)"
    raw1_lines = _fetch_cached("apollodorus_v1_djvu.txt").splitlines()
    raw2_lines = _fetch_cached("apollodorus_v2_djvu.txt").splitlines()

    def find(lines: list[str], text: str, start: int = 0) -> int:
        for i in range(start, len(lines)):
            if lines[i].strip() == text:
                return i
        raise SystemExit(f"apollodorus: could not find {text!r} from line {start}")

    # locate section boundaries on the RAW (uncleaned) lines -- the cleaning
    # pass strips 'APPENDIX'/'EPITOME...' as running heads, so those marker
    # strings are gone by the time cleaning has run.
    book1_start = find(raw1_lines, "BOOK I", 500)
    book2_start = find(raw1_lines, "BOOK II", book1_start + 1)
    book3_start = None
    for i in range(book2_start + 1, len(raw1_lines)):
        if raw1_lines[i].strip().startswith("BOOK II"):
            book3_start = i
            break
    if book3_start is None:
        raise SystemExit("apollodorus: could not find Book III start in vol 1")

    book3b_end = find(raw2_lines, "EPITOME OF THE LIBRARY OF", 100)
    epitome_end = None
    for i in range(book3b_end + 1, len(raw2_lines)):
        if raw2_lines[i].strip() == "APPENDIX":
            epitome_end = i
            break
    if epitome_end is None:
        raise SystemExit("apollodorus: could not find APPENDIX boundary in vol 2")

    # NOW clean each raw slice independently (cleaning is boundary-agnostic
    # -- Greek-line/running-head/page-number stripping -- so slicing first
    # then cleaning each piece is equivalent to cleaning-then-slicing for
    # everything except the marker lines themselves, which are only ever
    # used as boundaries, never as body content).
    lines1 = _apollodorus_clean_lines(raw1_lines)
    lines2 = _apollodorus_clean_lines(raw2_lines)

    def remap(raw_idx: int, raw_lines: list[str], cleaned_lines: list[str]) -> int:
        """Map a raw-line index to the corresponding index in the cleaned
        list by counting how many of the raw lines before it survived
        cleaning (cleaning only ever removes lines, never reorders)."""
        raw_prefix = raw_lines[:raw_idx]
        cleaned_prefix = _apollodorus_clean_lines(raw_prefix)
        return len(cleaned_prefix)

    book1_start = remap(book1_start, raw1_lines, lines1)
    book2_start = remap(book2_start, raw1_lines, lines1)
    book3_start = remap(book3_start, raw1_lines, lines1)
    book3b_end = remap(book3b_end, raw2_lines, lines2)
    epitome_end = remap(epitome_end, raw2_lines, lines2)

    entries: list[dict] = []

    def emit(book_lines: list[str], book_label: str, src: str, vol: int, chapter_offset: int) -> None:
        chapters = _apollodorus_chapters(book_lines)
        if len(chapters) < 3:
            raise SystemExit(f"apollodorus {book_label}: too few chapters detected ({len(chapters)})")
        for ci, ch in enumerate(chapters):
            cend = chapters[ci + 1]["idx"] if ci + 1 < len(chapters) else len(book_lines)
            body_lines = book_lines[ch["idx"] : cend]
            # the chapter marker itself is the first token(s) of the first
            # line ('I, Sky was...') -- strip just the marker, keep the text
            first = body_lines[0].strip()
            m = _CHAPTER_RE.match(first)
            body_lines = [first[m.end() - 1 :].lstrip(" ,.")] + body_lines[1:] if m else body_lines
            body = "\n\n".join(split_paragraphs(body_lines)).strip()
            # any paragraph containing Greek-script characters at all is
            # footnote/citation apparatus, not narrative -- Frazer's ENGLISH
            # translation itself is pure Latin script; only his footnotes
            # quote the Greek original inline. This catches footnote
            # paragraphs the digit-start check misses (a citation that
            # continues onto a wrapped line without repeating the number,
            # or an editorial note like 'Στερόπῃ EA: Αερόπῃ Pausanias...'
            # that opens with the Greek word itself, no leading digit).
            body = "\n\n".join(
                p for p in body.split("\n\n")
                if not _FOOTNOTE_PARA_RE.match(p) and not _GREEK_RANGE.search(p)
            )
            body = _normalize_hero_names(body)
            if not body:
                continue
            cnum = ch["num"] + chapter_offset
            pid = f"greek-apollodorus-v{vol}-{slugify(book_label)}-{cnum:02d}"
            entries.append(
                make_entry(
                    pid, src, f"{book_label}, Chapter {cnum}", body,
                    prov(
                        source_title="Apollodorus, The Library", volume=vol,
                        translator_or_author="Sir James George Frazer", publication_year=1921,
                        public_domain_basis=f"US publication pre-1929; archive.org scan of the Loeb Classical Library edition",
                        genre="mythographic compendium (primary source)", register="exposition",
                        source_url="https://archive.org/details/apollodoruslibra01apol" if vol == 1 else "https://archive.org/details/apollodoruslibra02apol",
                        book_label=book_label, chapter_number=cnum,
                        chunk_strategy="apollodorus-inline-chapter: chapter boundaries are Frazer's own inline roman-numeral paragraph markers (not standalone headings), detected via longest-ascending-run to reject footnote-citation false positives (e.g. 'L. Dindorf; Appian...').",
                        cleaning_applied=(
                            "This is a bilingual Loeb facing-page OCR scan (archive.org), unlike "
                            "every other text in this corpus (all clean proofread Gutenberg "
                            "transcriptions) -- lines where Greek-script characters outnumber Latin "
                            "ones (the facing original-language pages) were dropped entirely; "
                            "running heads ('APOLLODORUS', 'THE LIBRARY', 'EPITOME, <citation>') "
                            "and bare page-number lines stripped; paragraphs opening with a bare "
                            "arabic number (Frazer's extremely dense footnote apparatus, often "
                            "longer than the text itself) dropped as footnotes, distinguished from "
                            "real chapter markers by roman vs arabic numeral."
                        ),
                        hero_name_normalization=(
                            "Per explicit user instruction: Frazer's translation systematically "
                            "uses Latin/anglicized hero names (Hercules 380x vs Heracles 1x in vol "
                            "1; Ulysses 21x vs Odysseus 2x) even though deity names stay Greek "
                            "(Zeus). Normalized post-cleaning: Hercules->Heracles, Ulysses->Odysseus, "
                            "Ajax->Aias, Aesculapius->Asclepius, Minerva->Athena -- matching the "
                            "stricter standard already set by this corpus's Iliad (Lang/Leaf/Myers "
                            "use 'Aias' 149x, 'Ajax' 0x). This is an EDITORIAL normalization, NOT "
                            "Frazer's original wording -- flagged here for any future audit."
                        ),
                        voice_authorization_note=VOICE_AUTH_NOTE
                        + " OCR/bilingual-source caveat: unlike this corpus's other Greek texts, "
                        "this is an uncorrected archive.org OCR scan of a bilingual edition, not a "
                        "proofread Gutenberg transcription -- residual Greek-script fragments or "
                        "footnote leakage may remain despite the cleaning pass; flag for closer "
                        "human review than the rest of this lineage.",
                        pulled_via="scripts-resilience/build_greek_corpus.py:apollodorus",
                    ),
                )
            )

    emit(lines1[book1_start + 1 : book2_start], "Book I", SRC1, 1, 0)
    emit(lines1[book2_start + 1 : book3_start], "Book II", SRC1, 1, 0)
    emit(lines1[book3_start + 1 :], "Book III", SRC1, 1, 0)
    emit(lines2[100:book3b_end], "Book III (continued)", SRC2, 2, 0)
    emit(lines2[book3b_end + 1 : epitome_end], "Epitome", SRC2, 2, 0)
    return entries


BOOKS = {
    "hesiod_hymns": build_hesiod_hymns,
    "iliad": build_iliad,
    "odyssey": build_odyssey,
    "kingsley_heroes": build_kingsley_heroes,
    "hawthorne": build_hawthorne,
    "church_iliad": build_church_iliad,
    "church_odyssey": build_church_odyssey,
    "pausanias_v1": lambda: build_pausanias(1),
    "pausanias_v2": lambda: build_pausanias(2),
    "apollodorus": build_apollodorus,
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
        out_path = os.path.join(args.out_dir, f"greek-{name.replace('_', '')}-passages-STAGED.json")
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
