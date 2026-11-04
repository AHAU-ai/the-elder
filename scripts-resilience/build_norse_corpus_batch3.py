#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_norse_corpus_batch3.py -- third Norse-lineage ingestion sweep, four
more public-domain works, all clean proofread Project Gutenberg
transcriptions:

  grettir             The Story of Grettir the Strong (trans. Eirikr
                       Magnusson and William Morris, 1869) -- PG 12747
  popular_tales_norse Popular Tales from the Norse (Asbjornsen & Moe,
                       trans. George W. Dasent, 1859) -- PG 8933
  elder_younger_thorpe The Elder Eddas of Saemund Sigfusson (trans.
                       Benjamin Thorpe) and the Younger Eddas of Snorre
                       Sturleson (trans. I. A. Blackwell) -- PG 14726
  heimskringla        Heimskringla; Or, The Chronicle of the Kings of
                       Norway (Snorri Sturluson, trans. Samuel Laing,
                       1844) -- PG 598

Same contract as every other Norse ingestion pass -- fetch, clean, segment,
stage a JSON file ONLY, never touch the database or embed. Reuses the
shared helpers from build_norse_corpus_batch2.py (same directory) rather
than redefining them. Real gate is the shared CLI:

    python3 scripts-resilience/ingest.py corpus/norse-<book>-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/norse-<book>-passages-STAGED.json "$DEV_DATABASE_URL"

NOTES ON SCOPE:
  - grettir: body chapters ('CHAP. <roman>.') carry NO title text at all
    (titles exist only in a TOC that groups many chapters under one shared
    descriptive phrase, e.g. 'I.-XIII. The Forefathers of Grettir' --
    unusable as a per-chapter title). Sections are therefore labeled
    'Chapter <roman>' only, body-only, same as every other pass's approach
    when no reliable per-unit title exists.
  - heimskringla: this specific Gutenberg edition (Laing translation, PG
    598) contains 15 of the traditional Heimskringla's ~16-17 sagas --
    notably NOT the Ynglinga Saga (the most overtly mythological one,
    covering the euhemerized Odin as a historical king). Segmented at TWO
    levels: the 15 sagas themselves, then each saga's own numbered chapters
    (numbering resets to 1 within each saga) via the same
    longest-ascending-run detection used for the Rydberg volumes in batch2,
    scoped per-saga rather than per-volume.
  - elder_younger_thorpe: the Elder Edda (poetic) portion is segmented by
    poem title (Thorpe's translation -- a different textual witness from
    the Bellows translation already in this corpus); the Younger Edda
    (prose) portion by its own short titled sections (Blackwell's
    translation -- a different witness from the Brodeur translation already
    in this corpus, and from Anderson's "Norse Mythology" gloss).

NO PER-BOOK MARKER SUGGESTIONS, same as batch2 -- signal_affinity left
empty pending human review.

USAGE
-----
    python3 scripts-resilience/build_norse_corpus_batch3.py <book>
    python3 scripts-resilience/build_norse_corpus_batch3.py all
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_norse_corpus_batch2 import (  # noqa: E402
    CORPUS_DIR,
    REPO_ROOT,
    VOICE_AUTH_NOTE,
    fetch_raw,
    find_pg_end,
    make_entry,
    slugify,
    split_paragraphs,
)


def longest_ascending_run(candidates: list[tuple[int, int]], tolerance: int = 3) -> list[tuple[int, int]]:
    """Shared with the Rydberg builders in batch2 (kept as a local copy
    here rather than a cross-import to keep each script's core algorithm
    self-contained and independently readable): the longest run of
    (line_index, number) candidates whose values increase by 1..tolerance
    in document order, skipping a single spurious in-between candidate
    when the one after it resumes the sequence."""
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


# ==================================================================== grettir
def build_grettir() -> list[dict]:
    GID, CACHE = 12747, "gutenberg_grettir_12747.txt"
    SRC = "The Story of Grettir the Strong (trans. Eirikr Magnusson and William Morris, 1869)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    chap_re = re.compile(r"^CHAP\.\s+([IVXLC]+)\.\s*$")
    starts = [(i, m.group(1)) for i, ln in enumerate(lines) if (m := chap_re.match(ln.strip()))]
    if len(starts) != 95:
        raise SystemExit(f"expected 95 Grettir CHAP anchors, found {len(starts)}")

    body_end = find_pg_end(lines)
    for i, ln in enumerate(lines):
        if ln.strip() == "NOTES AND CORRECTIONS.":
            body_end = i
            break

    entries: list[dict] = []
    for ci, (idx, roman) in enumerate(starts):
        cend = starts[ci + 1][0] if ci + 1 < len(starts) else body_end
        body = "\n\n".join(split_paragraphs(lines[idx + 1 : cend])).strip()
        pid = f"norse-grettir-{ci+1:03d}"
        entries.append(
            make_entry(
                pid, SRC, f"Chapter {roman}", body,
                {
                    "source_title": "The Story of Grettir the Strong",
                    "translator_or_author": "Eirikr Magnusson and William Morris", "publication_year": 1869,
                    "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #12747",
                    "lineage_id": "norse", "genre": "saga",
                    "public_domain": True, "gutenberg_id": GID,
                    "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                    "chapter_roman": roman, "chapter_number": ci + 1,
                    "chunk_strategy": "grettir-chapter: one passage per 'CHAP. <roman>.' anchor. No per-chapter title exists in the body (the TOC groups many chapters under one shared descriptive phrase, unusable as a title here), so section is 'Chapter <roman>' only.",
                    "voice_authorization_note": VOICE_AUTH_NOTE,
                    "pulled_via": "scripts-resilience/build_norse_corpus_batch3.py:grettir",
                },
            )
        )
    return entries


# ============================================================ popular_tales_norse
def build_popular_tales_norse() -> list[dict]:
    GID, CACHE = 8933, "gutenberg_popular_tales_norse_8933.txt"
    SRC = "Popular Tales from the Norse (Asbjornsen & Moe, trans. George W. Dasent, 1859)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    # TOC block: 'TALES' heading, then one 'ROMAN. TITLE' line per tale,
    # until the blank-line-delimited end of that block.
    toc_re = re.compile(r"^\s*[IVXLC]+\.\s+(.+?)\s*$")
    toc_start = None
    for i, ln in enumerate(lines):
        # 'TALES' appears twice (a front-matter series blurb, then the real
        # TOC heading) -- the real one is immediately followed by a
        # 'ROMAN. TITLE' line, the front-matter one by a blank line.
        if ln.strip() == "TALES" and i + 1 < len(lines) and toc_re.match(lines[i + 1]):
            toc_start = i
            break
    if toc_start is None:
        raise SystemExit("could not locate the 'TALES' TOC heading")
    titles: list[str] = []
    i = toc_start + 1
    while i < len(lines) and lines[i].strip():
        m = toc_re.match(lines[i])
        if m:
            titles.append(m.group(1).strip().rstrip("."))
        i += 1
    if len(titles) < 50:
        raise SystemExit(f"expected ~59 tale titles in the TOC, found {len(titles)}")

    def norm(s: str) -> str:
        # body headings occasionally differ from the TOC in punctuation
        # only (dropped comma: 'SUN, AND WEST' vs 'SUN AND WEST'; hyphen
        # vs space: 'GOOSE-GIRL' vs 'GOOSE GIRL') -- fold all punctuation
        # to a single space and compare.
        return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]", " ", s.upper())).strip()

    body_headings = {i: norm(ln.strip()) for i, ln in enumerate(lines) if i > toc_start and ln.strip() and ln.strip().upper() == ln.strip()}

    starts: list[tuple[int, str]] = []
    for t in titles:
        target = norm(t)
        occ = [i for i, s in body_headings.items() if s == target]
        if not occ:
            raise SystemExit(f"no body heading found for tale '{t}'")
        starts.append((occ[-1], t))
    starts.sort()

    # 'INTRODUCTION TO APPENDIX' also occurs once in the TOC (before any
    # real content) -- take the later occurrence, after the last tale.
    body_end = find_pg_end(lines)
    for i, ln in enumerate(lines):
        if ln.strip() == "INTRODUCTION TO APPENDIX" and i > starts[-1][0]:
            body_end = i
            break

    entries: list[dict] = []
    for si, (idx, title) in enumerate(starts):
        send = starts[si + 1][0] if si + 1 < len(starts) else body_end
        body = "\n\n".join(split_paragraphs(lines[idx + 1 : send])).strip()
        pid = f"norse-populartales-{si+1:03d}-{slugify(title)}"
        entries.append(
            make_entry(
                pid, SRC, title.title(), body,
                {
                    "source_title": "Popular Tales from the Norse",
                    "translator_or_author": "George Webbe Dasent (from Asbjornsen & Moe's Norwegian collection)",
                    "publication_year": 1859,
                    "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #8933",
                    "lineage_id": "norse", "genre": "folktale (not myth proper -- Norwegian oral folk tradition)",
                    "public_domain": True, "gutenberg_id": GID,
                    "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                    "tale_title": title.title(),
                    "chunk_strategy": "populartales-story: one passage per titled tale, title list parsed from the TOC's own 'ROMAN. TITLE' lines rather than hand-typed, matched to its body heading occurrence.",
                    "voice_authorization_note": VOICE_AUTH_NOTE
                    + " NOTE: this is folklore, not mythology proper -- flagged distinctly in genre for a reviewer's register/inclusion call.",
                    "pulled_via": "scripts-resilience/build_norse_corpus_batch3.py:popular_tales_norse",
                },
            )
        )
    return entries


# ============================================================ elder_younger_thorpe
def build_elder_younger_thorpe() -> list[dict]:
    GID, CACHE = 14726, "gutenberg_elder_younger_eddas_thorpe_14726.txt"
    SRC_ELDER = "The Elder Eddas of Saemund Sigfusson (trans. Benjamin Thorpe, 1866)"
    SRC_YOUNGER = "The Younger Edda of Snorre Sturleson (trans. I. A. Blackwell, 1847)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    # 'THE ELDER EDDAS OF SAEMUND.' occurs only once total (in the TOC) --
    # there is no distinct second body occurrence of that exact heading, so
    # the real start of the Elder Edda content is its first titled section,
    # 'INTRODUCTION TO THE VOLUSPA.', instead.
    elder_start = youngers_start = glossary_start = None
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s == "INTRODUCTION TO THE VOLUSPA." and elder_start is None:
            elder_start = i - 1
        elif s == "THE YOUNGER EDDAS OF STURLESON." and youngers_start is None and i > 200:
            youngers_start = i
        elif s == "GLOSSARY." and glossary_start is None and i > 9000:
            glossary_start = i
    if not (elder_start and youngers_start and glossary_start):
        raise SystemExit(f"boundary anchors not all found: elder={elder_start} younger={youngers_start} glossary={glossary_start}")

    heading_re = re.compile(r"^[A-Z][A-Z0-9 ',.’-]{2,70}\.$")

    def not_boilerplate(s: str) -> bool:
        return s not in {
            "THE ELDER EDDAS OF SAEMUND.", "THE YOUNGER EDDAS OF STURLESON.",
            "LIST OF PHOTOGRAVURES.", "CONTENTS.", "PREFACE.",
        }

    elder_starts = [
        (i, ln.strip()) for i, ln in enumerate(lines)
        if elder_start < i < youngers_start and heading_re.match(ln.strip()) and not_boilerplate(ln.strip())
    ]
    younger_starts = [
        (i, ln.strip()) for i, ln in enumerate(lines)
        if youngers_start < i < glossary_start and heading_re.match(ln.strip()) and not_boilerplate(ln.strip())
    ]
    if len(elder_starts) < 20 or len(younger_starts) < 20:
        raise SystemExit(f"expected ~38 Elder + ~40 Younger headings, found {len(elder_starts)} / {len(younger_starts)}")

    entries: list[dict] = []

    def emit(starts: list[tuple[int, str]], block_end: int, id_prefix: str, src: str, translator: str, year: int, genre: str) -> None:
        for si, (idx, title) in enumerate(starts):
            send = starts[si + 1][0] if si + 1 < len(starts) else block_end
            body = "\n\n".join(split_paragraphs(lines[idx + 1 : send])).strip()
            if not body:
                continue
            pid = f"norse-{id_prefix}-{si+1:03d}-{slugify(title)}"
            entries.append(
                make_entry(
                    pid, src, title.title(), body,
                    {
                        "source_title": src, "translator_or_author": translator, "publication_year": year,
                        "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #14726",
                        "lineage_id": "norse", "genre": genre,
                        "register": "verse" if genre == "eddic poetry" else "exposition",
                        "public_domain": True, "gutenberg_id": GID,
                        "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                        "section_title": title.title(),
                        "chunk_strategy": f"{id_prefix}-titled-section: one passage per ALL-CAPS titled section within this block, a different translation from the Bellows Poetic Edda / Brodeur Prose Edda already in this corpus.",
                        "voice_authorization_note": VOICE_AUTH_NOTE,
                        "pulled_via": "scripts-resilience/build_norse_corpus_batch3.py:elder_younger_thorpe",
                    },
                )
            )

    emit(elder_starts, youngers_start, "elderedda-thorpe", SRC_ELDER, "Benjamin Thorpe", 1866, "eddic poetry")
    emit(younger_starts, glossary_start, "youngeredda-blackwell", SRC_YOUNGER, "I. A. Blackwell", 1847, "prose mythography")
    return entries


# ==================================================================== heimskringla
_HEIMSKRINGLA_SAGAS = [
    ("HALFDAN THE BLACK SAGA.", "Halfdan the Black's Saga"),
    ("HARALD HARFAGER'S SAGA.", "Harald Harfager's Saga"),
    ("HAKON THE GOOD'S SAGA.", "Hakon the Good's Saga"),
    ("SAGA OF KING HARALD GRAFELD AND OF EARL HAKON SON OF SIGURD.", "Saga of King Harald Grafeld and of Earl Hakon Son of Sigurd"),
    ("KING OLAF TRYGVASON'S SAGA.", "King Olaf Trygvason's Saga"),
    ("SAGA OF OLAF HARALDSON. (1)", "Saga of Olaf Haraldson (St. Olaf)"),
    ("SAGA OF MAGNUS THE GOOD.", "Saga of Magnus the Good"),
    ("SAGA OF HARALD HARDRADE.", "Saga of Harald Hardrade"),
    ("SAGA OF OLAF KYRRE.", "Saga of Olaf Kyrre"),
    ("MAGNUS BAREFOOT'S SAGA.", "Magnus Barefoot's Saga"),
    ("SAGA OF SIGURD THE CRUSADER AND HIS BROTHERS EYSTEIN AND OLAF.", "Saga of Sigurd the Crusader and His Brothers Eystein and Olaf"),
    ("SAGA OF MAGNUS THE BLIND AND OF HARALD GILLE.", "Saga of Magnus the Blind and of Harald Gille"),
    ("SAGA OF SIGURD, INGE, AND EYSTEIN, THE SONS OF HARALD", "Saga of Sigurd, Inge, and Eystein, the Sons of Harald"),
    ("SAGA OF HAKON HERDEBREID (HAKON THE BROAD-SHOULDERED) (1)", "Saga of Hakon Herdebreid (Hakon the Broad-Shouldered)"),
    ("MAGNUS ERLINGSON'S SAGA.", "Magnus Erlingson's Saga"),
]


def build_heimskringla() -> list[dict]:
    GID, CACHE = 598, "gutenberg_heimskringla_598.txt"
    SRC = "Heimskringla; Or, The Chronicle of the Kings of Norway (Snorri Sturluson, trans. Samuel Laing, 1844)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    saga_starts: list[tuple[int, str, str]] = []
    for heading, display in _HEIMSKRINGLA_SAGAS:
        occ = [i for i, ln in enumerate(lines) if i > 100 and ln.strip() == heading]
        if not occ:
            raise SystemExit(f"saga heading not found in body: {heading!r}")
        saga_starts.append((occ[0], heading, display))
    saga_starts.sort()

    chap_re = re.compile(r"^\s*(\d{1,3})\.\s+([A-Z][^a-z]{2,})$")

    entries: list[dict] = []
    for sgi, (sidx, heading, display) in enumerate(saga_starts):
        send = saga_starts[sgi + 1][0] if sgi + 1 < len(saga_starts) else find_pg_end(lines)
        saga_lines = lines[sidx + 1 : send]

        candidates = [(i, int(m.group(1))) for i, ln in enumerate(saga_lines) if (m := chap_re.match(ln))]
        chapters = longest_ascending_run(candidates, tolerance=3)

        if len(chapters) < 3:
            # this saga's chapters weren't reliably detected -- stage the
            # whole saga as one passage rather than guess at a split.
            body = "\n\n".join(split_paragraphs(saga_lines)).strip()
            pid = f"norse-heimskringla-{sgi+1:02d}-{slugify(display)}"
            entries.append(
                make_entry(
                    pid, SRC, display, body,
                    {
                        "source_title": "Heimskringla; Or, The Chronicle of the Kings of Norway",
                        "translator_or_author": "Samuel Laing", "publication_year": 1844,
                        "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #598",
                        "lineage_id": "norse", "genre": "saga (royal chronicle)",
                        "public_domain": True, "gutenberg_id": GID,
                        "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                        "saga_title": display,
                        "chunk_strategy": "heimskringla-saga-whole: fewer than 3 numbered-chapter anchors reliably detected within this saga, staged whole rather than guessing a split.",
                        "voice_authorization_note": VOICE_AUTH_NOTE
                        + " This edition (PG 598) does NOT include the Ynglinga Saga, the most overtly mythological saga in the traditional Heimskringla collection -- absent from the source, not omitted by this script.",
                        "pulled_via": "scripts-resilience/build_norse_corpus_batch3.py:heimskringla",
                    },
                )
            )
            continue

        for ci, (cidx, cnum) in enumerate(chapters):
            cend = chapters[ci + 1][0] if ci + 1 < len(chapters) else len(saga_lines)
            title_line = saga_lines[cidx].strip()
            m = chap_re.match(title_line)
            ctitle = m.group(2).strip().rstrip(".") if m else ""
            body = "\n\n".join(split_paragraphs(saga_lines[cidx + 1 : cend])).strip()
            if not body:
                continue
            pid = f"norse-heimskringla-{sgi+1:02d}-{cnum:03d}-{slugify(ctitle or display)}"
            entries.append(
                make_entry(
                    pid, SRC, f"{display} — {cnum}. {ctitle.title()}", body,
                    {
                        "source_title": "Heimskringla; Or, The Chronicle of the Kings of Norway",
                        "translator_or_author": "Samuel Laing", "publication_year": 1844,
                        "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #598",
                        "lineage_id": "norse", "genre": "saga (royal chronicle)",
                        "public_domain": True, "gutenberg_id": GID,
                        "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                        "saga_title": display, "chapter_number": cnum, "chapter_title": ctitle.title(),
                        "chunk_strategy": "heimskringla-saga-chapter: two-level segmentation -- 15 sagas (TOC-confirmed list, hand-verified against the body), each saga's own numbered chapters (numbering resets to 1 per saga) found via the same longest-ascending-run detection used for the Rydberg volumes, scoped per-saga.",
                        "voice_authorization_note": VOICE_AUTH_NOTE
                        + " This edition (PG 598) does NOT include the Ynglinga Saga, the most overtly mythological saga in the traditional Heimskringla collection -- absent from the source, not omitted by this script.",
                        "pulled_via": "scripts-resilience/build_norse_corpus_batch3.py:heimskringla",
                    },
                )
            )
    return entries


BOOKS = {
    "grettir": build_grettir,
    "popular_tales_norse": build_popular_tales_norse,
    "elder_younger_thorpe": build_elder_younger_thorpe,
    "heimskringla": build_heimskringla,
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
        out_path = os.path.join(args.out_dir, f"norse-{name.replace('_', '')}-passages-STAGED.json")
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
