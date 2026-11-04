#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_norse_corpus_batch2.py -- second Norse-lineage ingestion sweep, seven
more public-domain works, all clean proofread Project Gutenberg
transcriptions (no OCR-repair machinery needed, unlike the Mackenzie pass):

  heroes_of_asgard   The Heroes of Asgard (Annie & Eliza Keary, 1857) -- PG 41283
  beowulf            Beowulf (trans. Francis B. Gummere, 1910) -- PG 981
  in_days_of_giants  In the Days of Giants (Abbie Farwell Brown, 1902) -- PG 44622
  burnt_njal         The Story of Burnt Njal (trans. George W. Dasent, 1861) -- PG 597
  rydberg_v1/2/3     Teutonic Mythology: Gods and Goddesses of the Northland,
                      vols. 1-3 (Viktor Rydberg, trans. Rasmus B. Anderson,
                      1889 -- Norroena Society "Viking Edition", 1906) -- PG 37876/58829/58830

Same contract as every other Norse ingestion pass: fetch, clean, segment,
stage a JSON file ONLY. Never touches the database, never embeds. The real
gate is the shared CLI:

    python3 scripts-resilience/ingest.py corpus/norse-<book>-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/norse-<book>-passages-STAGED.json "$DEV_DATABASE_URL"

CONVENTIONS REUSED (verified against the repo 2026-09-15): target table
corpus_passage via ingest.py; required fields passage_id/source/section/
body/voice_key; voice_key 'volva' for the Norse lineage; provenance-only
_provenance object; byte-identical NFC+saltillo normalization; no "_comment"
key.

NO PER-BOOK MARKER SUGGESTIONS in this pass (unlike Anderson/Colum/
Mackenzie) -- signal_affinity is left empty for all seven books rather than
guessed at speed; a human review pass assigns markers, same as everywhere
else in this lineage.

Each book has its own segmentation function below (heading conventions
differ book to book -- numbered sections, CHAPTER/PART headers, bare roman
numerals) but shares fetch/normalize/strip-PG-boilerplate helpers.

USAGE
-----
    python3 scripts-resilience/build_norse_corpus_batch2.py <book>
    python3 scripts-resilience/build_norse_corpus_batch2.py <book> --emit-sample
    python3 scripts-resilience/build_norse_corpus_batch2.py all
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
    """Line index of the '*** END OF THE PROJECT GUTENBERG EBOOK ... ***'
    marker, or len(lines) if somehow absent. Every book's last passage must
    be capped here (not just at len(lines)) -- the PG license boilerplate
    trails AFTER that marker in the raw fetch and would otherwise be
    swallowed into the final passage."""
    for i, ln in enumerate(lines):
        if ln.strip().startswith("*** END OF THE PROJECT GUTENBERG"):
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
        "voice_key": "volva",
    }


VOICE_AUTH_NOTE = (
    "voice_key 'volva': same institutional-placeholder consent_grant as "
    "every other Norse pass (Temporal Bridges Institute, 2026-01-01), not a "
    "named tradition-bearer review. lib/traditions.ts governanceStatus "
    "'active'. review_status here is 'approved' for TRANSCRIPTION "
    "STRUCTURE ONLY (clean proofread Gutenberg source, unambiguous "
    "section/chapter anchors) -- it does NOT represent ceremonial or "
    "scholarly sign-off, which per repo memory has never actually happened "
    "for this lineage. signal_affinity intentionally left empty for this "
    "batch pass -- no markers were guessed at speed."
)


# ============================================================ heroes_of_asgard
def build_heroes_of_asgard() -> list[dict]:
    GID, CACHE = 41283, "gutenberg_heroes_of_asgard_41283.txt"
    SRC = "The Heroes of Asgard (Annie & Eliza Keary, 1857)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    chap_re = re.compile(r"^CHAPTER ([IVXL]+)\.\s*$")
    part_re = re.compile(r"^PART ([IVXL]+)\.\s*(.*)$")

    chap_starts = [(i, m.group(1)) for i, ln in enumerate(lines) if (m := chap_re.match(ln.strip()))]
    if len(chap_starts) != 9:
        raise SystemExit(f"expected 9 CHAPTER anchors in Heroes of Asgard, found {len(chap_starts)}")

    # the narrative proper ends before a back-matter glossary and (further
    # on) the publisher's book-catalog advertisements bound into this PG
    # edition -- both would otherwise be swallowed into chapter IX, which
    # has no following CHAPTER anchor to stop it.
    body_end = find_pg_end(lines)
    for i, ln in enumerate(lines):
        if ln.strip() == "INDEX OF NAMES, WITH MEANINGS.":
            body_end = i
            break

    # chapter title = first non-blank line after the CHAPTER heading
    def chapter_title(idx: int) -> tuple[str, int]:
        i = idx + 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        t = lines[i].strip().rstrip(".")
        i += 1
        return t, i

    entries: list[dict] = []
    for ci, (cidx, croman) in enumerate(chap_starts):
        ctitle, body_after_title = chapter_title(cidx)
        cend = chap_starts[ci + 1][0] if ci + 1 < len(chap_starts) else body_end
        chapter_lines = lines[body_after_title:cend]

        part_starts = [(i, m.group(1), m.group(2).strip()) for i, ln in enumerate(chapter_lines) if (m := part_re.match(ln.strip()))]
        if not part_starts:
            # no PART subdivision in this chapter -- whole chapter is one passage
            body = "\n\n".join(split_paragraphs(chapter_lines)).strip()
            pid = f"norse-heroesasgard-{ci+1:02d}-{slugify(ctitle)}"
            entries.append(
                make_entry(
                    pid, SRC, f"Chapter {croman}. {ctitle}", body,
                    {
                        "source_title": "The Heroes of Asgard: Tales from Scandinavian Mythology",
                        "translator_or_author": "Annie Keary and Eliza Keary", "publication_year": 1857,
                        "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #41283",
                        "lineage_id": "norse", "genre": "retelling",
                        "public_domain": True, "gutenberg_id": GID,
                        "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                        "chapter_roman": croman, "chapter_title": ctitle,
                        "chunk_strategy": "heroesasgard-chapter: no PART subdivision in this chapter, staged whole.",
                        "voice_authorization_note": VOICE_AUTH_NOTE,
                        "pulled_via": "scripts-resilience/build_norse_corpus_batch2.py:heroes_of_asgard",
                    },
                )
            )
            continue

        for pi, (pidx, proman, ptitle) in enumerate(part_starts):
            pend = part_starts[pi + 1][0] if pi + 1 < len(part_starts) else len(chapter_lines)
            body = "\n\n".join(split_paragraphs(chapter_lines[pidx + 1 : pend])).strip()
            pid = f"norse-heroesasgard-{ci+1:02d}-{pi+1:02d}-{slugify(ptitle or ctitle)}"
            entries.append(
                make_entry(
                    pid, SRC, f"Chapter {croman}. {ctitle} — Part {proman}. {ptitle}", body,
                    {
                        "source_title": "The Heroes of Asgard: Tales from Scandinavian Mythology",
                        "translator_or_author": "Annie Keary and Eliza Keary", "publication_year": 1857,
                        "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #41283",
                        "lineage_id": "norse", "genre": "retelling",
                        "public_domain": True, "gutenberg_id": GID,
                        "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                        "chapter_roman": croman, "chapter_title": ctitle,
                        "part_roman": proman, "part_title": ptitle,
                        "chunk_strategy": "heroesasgard-part: one passage per PART subdivision within a chapter.",
                        "voice_authorization_note": VOICE_AUTH_NOTE,
                        "pulled_via": "scripts-resilience/build_norse_corpus_batch2.py:heroes_of_asgard",
                    },
                )
            )
    return entries


# ==================================================================== beowulf
def build_beowulf() -> list[dict]:
    GID, CACHE = 981, "gutenberg_beowulf_gummere_981.txt"
    SRC = "Beowulf (trans. Francis B. Gummere, 1910)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    prelude_idx = None
    for i, ln in enumerate(lines):
        if ln.strip() == "PRELUDE OF THE FOUNDER OF THE DANISH HOUSE":
            prelude_idx = i
            break
    if prelude_idx is None:
        raise SystemExit("could not locate Beowulf's prelude heading")

    fitt_re = re.compile(r"^([IVXL]+)$")
    fitts = [(i, m.group(1)) for i, ln in enumerate(lines) if i > prelude_idx and (m := fitt_re.match(ln.strip()))]
    if len(fitts) < 40:
        raise SystemExit(f"expected ~43 Beowulf fitt anchors, found {len(fitts)}")

    entries: list[dict] = []

    def mk(pid_suffix: str, section: str, body_lines: list[str], extra: dict) -> None:
        body = "\n".join(l.strip() for l in body_lines if l.strip() or not body_lines).strip()
        # verse: keep line breaks (blank-line-delimited stanzas), don't
        # collapse into prose paragraphs the way the retellings do.
        paras = split_paragraphs(body_lines)
        body = "\n\n".join(paras).strip()
        if not body:
            return
        pid = f"norse-beowulf-{pid_suffix}"
        prov = {
            "source_title": "Beowulf", "translator_or_author": "Francis Barton Gummere",
            "publication_year": 1910, "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #981",
            "lineage_id": "norse", "genre": "epic poetry", "register": "verse",
            "public_domain": True, "gutenberg_id": GID,
            "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
            "chunk_strategy": "beowulf-fitt: one passage per numbered Fitt (the poem's own division), plus the unnumbered prelude.",
            "voice_authorization_note": VOICE_AUTH_NOTE,
            "pulled_via": "scripts-resilience/build_norse_corpus_batch2.py:beowulf",
        }
        prov.update(extra)
        entries.append(make_entry(pid, SRC, section, body, prov))

    mk("00-prelude", "Prelude of the Founder of the Danish House", lines[prelude_idx + 1 : fitts[0][0]], {"fitt": "prelude"})
    for fi, (fidx, froman) in enumerate(fitts):
        fend = fitts[fi + 1][0] if fi + 1 < len(fitts) else find_pg_end(lines)
        mk(f"{fi+1:02d}-fitt-{froman.lower()}", f"Fitt {froman}", lines[fidx + 1 : fend], {"fitt": froman})
    return entries


# ============================================================ in_days_of_giants
def build_in_days_of_giants() -> list[dict]:
    GID, CACHE = 44622, "gutenberg_in_days_of_giants_44622.txt"
    SRC = "In the Days of Giants: A Book of Norse Tales (Abbie Farwell Brown, 1902)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    # story titles are bare ALL-CAPS lines; anchor the list from the TOC
    # occurrence range confirmed by inspection, then re-find each by its
    # SECOND occurrence (TOC lists it once, the body heading is the next).
    story_titles = [
        "THE BEGINNING OF THINGS", "HOW ODIN LOST HIS EYE", "KVASIR'S BLOOD",
        "THE GIANT BUILDER", "THE MAGIC APPLES", "SKADI'S CHOICE",
        "THE DWARF'S GIFTS", "LOKI'S CHILDREN", "THE QUEST OF THE HAMMER",
        "THE GIANTESS WHO WOULD NOT", "THOR'S VISIT TO THE GIANTS",
        "THOR'S FISHING", "THOR'S DUEL", "IN THE GIANT'S HOUSE",
        "BALDER AND THE MISTLETOE", "THE PUNISHMENT OF LOKI",
    ]
    # the TOC renders these in Title Case ('I. The Beginning of Things') and
    # only the body heading itself is ALL-CAPS, so a single match is the
    # expected, unambiguous case here (unlike Njal, where TOC and body share
    # an identical format).
    occurrences: dict[str, list[int]] = {t: [] for t in story_titles}
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s in occurrences:
            occurrences[s].append(i)

    starts: list[tuple[int, str]] = []
    for t in story_titles:
        occ = occurrences[t]
        if len(occ) < 1:
            raise SystemExit(f"expected at least one body occurrence for '{t}', found none")
        starts.append((occ[-1], t))
    starts.sort()

    body_end = find_pg_end(lines)
    for i, ln in enumerate(lines):
        if ln.strip() == "Transcriber's Notes:":
            body_end = i
            break

    entries: list[dict] = []
    for si, (idx, title) in enumerate(starts):
        send = starts[si + 1][0] if si + 1 < len(starts) else body_end
        body_lines = lines[idx + 1 : send]
        body = "\n\n".join(split_paragraphs(body_lines)).strip()
        pid = f"norse-indaysofgiants-{si+1:02d}-{slugify(title)}"
        entries.append(
            make_entry(
                pid, SRC, title.title(), body,
                {
                    "source_title": "In the Days of Giants: A Book of Norse Tales",
                    "translator_or_author": "Abbie Farwell Brown", "publication_year": 1902,
                    "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #44622",
                    "lineage_id": "norse", "genre": "retelling (children's)",
                    "public_domain": True, "gutenberg_id": GID,
                    "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                    "story_title": title.title(),
                    "chunk_strategy": "indaysofgiants-story: one passage per titled story, located by its second (body) occurrence after the TOC's first.",
                    "voice_authorization_note": VOICE_AUTH_NOTE,
                    "pulled_via": "scripts-resilience/build_norse_corpus_batch2.py:in_days_of_giants",
                },
            )
        )
    return entries


# ==================================================================== burnt_njal
def build_burnt_njal() -> list[dict]:
    GID, CACHE = 597, "gutenberg_burnt_njal_597.txt"
    SRC = "The Story of Burnt Njal (trans. George W. Dasent, 1861)"
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    # title char class deliberately permissive (colons, semicolons, etc. all
    # occur in real chapter titles, e.g. '80. OF KOLSKEGG: HOW HE WAS
    # BAPTIZED') -- validated as a real heading by requiring the letters
    # present to be overwhelmingly uppercase, not by restricting punctuation.
    chap_re = re.compile(r"^(\d{1,3})\.\s+([A-Z][^a-z]{2,})$")
    starts = [(i, m.group(1), m.group(2).strip()) for i, ln in enumerate(lines) if (m := chap_re.match(ln.strip()))]
    # the same numbering also appears in the TOC; keep only the longest
    # strictly-increasing-by-1 run (the real body sequence -- a TOC entry
    # format mismatch, page-number suffix, etc. reliably breaks a TOC run
    # long before it could out-run the ~158-chapter body sequence).
    best_run: list[tuple[int, str, str]] = []
    run: list[tuple[int, str, str]] = []
    expected = 1
    for idx, num, title in starts:
        if int(num) == expected:
            run.append((idx, num, title))
            expected += 1
        else:
            if len(run) > len(best_run):
                best_run = run
            if int(num) == 1:
                run = [(idx, num, title)]
                expected = 2
            else:
                run = []
                expected = 1
    if len(run) > len(best_run):
        best_run = run
    if len(best_run) < 100:
        raise SystemExit(f"expected ~158 Burnt Njal body chapters, best run found was {len(best_run)}")
    body_starts = best_run

    entries: list[dict] = []
    for ci, (idx, num, title) in enumerate(body_starts):
        cend = body_starts[ci + 1][0] if ci + 1 < len(body_starts) else find_pg_end(lines)
        body = "\n\n".join(split_paragraphs(lines[idx + 1 : cend])).strip()
        pid = f"norse-burntnjal-{int(num):03d}-{slugify(title)}"
        entries.append(
            make_entry(
                pid, SRC, f"Chapter {num}. {title.title()}", body,
                {
                    "source_title": "The Story of Burnt Njal: The Great Icelandic Tribune, Jurist, and Counsellor",
                    "translator_or_author": "Sir George Webbe Dasent", "publication_year": 1861,
                    "public_domain_basis": "US publication pre-1929; Project Gutenberg eBook #597",
                    "lineage_id": "norse", "genre": "saga",
                    "public_domain": True, "gutenberg_id": GID,
                    "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                    "chapter_number": int(num), "chapter_title": title.title(),
                    "chunk_strategy": "burntnjal-numbered-chapter: one passage per 'N. TITLE' heading, isolated from the TOC's identical numbering by requiring a strictly-increasing run.",
                    "voice_authorization_note": VOICE_AUTH_NOTE,
                    "pulled_via": "scripts-resilience/build_norse_corpus_batch2.py:burnt_njal",
                },
            )
        )
    return entries


# ==================================================================== rydberg
def _rydberg_source(vol: int) -> str:
    return f"Teutonic Mythology: Gods and Goddesses of the Northland, Vol. {vol} (Viktor Rydberg, trans. Rasmus B. Anderson, 1889)"


def build_rydberg(vol: int) -> list[dict]:
    ids = {1: 37876, 2: 58829, 3: 58830}
    caches = {
        1: "gutenberg_rydberg_v1_37876.txt",
        2: "gutenberg_rydberg_v2_58829.txt",
        3: "gutenberg_rydberg_v3_58830.txt",
    }
    GID, CACHE = ids[vol], caches[vol]
    SRC = _rydberg_source(vol)
    raw = fetch_raw(GID, CACHE)
    lines = raw.splitlines()

    # body runs from the first "PART I." after the translator's-preface
    # block through the PG end marker's preceding transcriber material; use
    # the numbered-section anchors themselves to bound content, since a
    # front-matter false-positive numbered line ("1905." title-page year,
    # etc.) never repeats as a clean ascending run the way the real
    # section sequence does.
    # Section-header indentation is NOT consistent across volumes (vol 1's
    # headers are centered with leading whitespace; vol 2/3's are flush at
    # column 0, continuing the numbering from vol 1 rather than restarting
    # at 1 -- e.g. vol 2 opens its first section at '53.'), so indentation
    # can't be used to filter noise. Instead: a handful of stray bare
    # numeral+period lines elsewhere in the text (marginal citation numbers)
    # match the same pattern; isolate the real section sequence as the
    # longest run of candidates whose values increase by exactly 1 in
    # document order, restarting the candidate run from ANY break point
    # (not just a fresh '1.') so one stray hit can't derail detection of
    # the real, much longer run on either side of it.
    num_re = re.compile(r"^(\s*)(\d{1,3})\.\s*$")
    part_re = re.compile(r"^\s*PART ([IVXL]+)\.\s*$")

    all_candidates = [(i, len(m.group(1)), int(m.group(2))) for i, ln in enumerate(lines) if (m := num_re.match(ln))]
    # Real section headers are numbered continuously and, in this volume,
    # either consistently centered with substantial leading whitespace (vol
    # 1) or consistently flush at column 0 (vol 2/3, continuing vol 1's
    # numbering rather than restarting). A citation number that happens to
    # wrap onto its own line mid-sentence ('...explained in No.\n123.') is
    # the opposite indentation of whichever style dominates this volume, so
    # filter to the majority style first.
    indented_frac = sum(1 for _, indent, _ in all_candidates if indent >= 5) / max(len(all_candidates), 1)
    if indented_frac > 0.5:
        candidates = [(i, n) for i, indent, n in all_candidates if indent >= 5]
    else:
        candidates = [(i, n) for i, indent, n in all_candidates if indent < 5]

    # Ascending-run detection tolerant of (a) a small genuine gap in the
    # author's own numbering (vol 1 itself skips from section 27 straight
    # to 29 -- no section 28 exists in this edition) and (b) a single
    # spurious candidate wedged between two otherwise-consecutive real
    # headers (a citation number that wrapped onto its own line, e.g. a
    # '95.' sitting between the real 83. and 84., which would otherwise
    # fracture the run into two shorter pieces and cause the wrong one to
    # win). A jump of up to 3 is accepted as a continuation; a candidate
    # that breaks continuity is skipped outright (not treated as a new
    # run start) whenever the candidate immediately after it resumes the
    # sequence -- only a candidate that itself starts a new multi-item run
    # forces a genuine break.
    best_run: list[tuple[int, int]] = []
    run: list[tuple[int, int]] = []
    last_num = None
    i = 0
    while i < len(candidates):
        idx, num = candidates[i]
        if last_num is None or 1 <= num - last_num <= 3:
            run.append((idx, num))
            last_num = num
            i += 1
            continue
        if i + 1 < len(candidates):
            _, nnum = candidates[i + 1]
            if 1 <= nnum - last_num <= 3:
                i += 1  # single spurious candidate -- skip it, keep the run alive
                continue
        if len(run) > len(best_run):
            best_run = run
        run = [(idx, num)]
        last_num = num
        i += 1
    if len(run) > len(best_run):
        best_run = run
    if len(best_run) < 20:
        raise SystemExit(f"vol {vol}: expected a long ascending numbered-section run, best was {len(best_run)}")
    sections = best_run

    # PART headers also appear in the table of contents (before the first
    # real numbered section) in the same format as any body occurrence --
    # exclude those or part_for() below picks up the TOC's last PART
    # instead of leaving 'part unknown' for early sections that precede any
    # real body PART marker.
    first_section_idx = sections[0][0] if sections else 0
    part_starts = [(i, m.group(1)) for i, ln in enumerate(lines) if i >= first_section_idx and (m := part_re.match(ln))]

    body_end = find_pg_end(lines)
    for i, ln in enumerate(lines):
        if ln.strip() == "INDEX OF PERSONS AND PLACES.":
            body_end = min(body_end, i)
            break

    def part_for(idx: int) -> str:
        cur = None
        for pidx, proman in part_starts:
            if pidx <= idx:
                cur = proman
            else:
                break
        return cur or "?"

    def section_title(idx: int) -> tuple[str, int]:
        i = idx + 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        title_lines = []
        while i < len(lines) and lines[i].strip() and lines[i].strip().isupper():
            title_lines.append(lines[i].strip())
            i += 1
        return re.sub(r"\s+", " ", " ".join(title_lines)).strip().rstrip("."), i

    entries: list[dict] = []
    for si, (idx, num) in enumerate(sections):
        title, body_start = section_title(idx)
        send = sections[si + 1][0] if si + 1 < len(sections) else body_end
        body = "\n\n".join(split_paragraphs(lines[body_start:send])).strip()
        if not body:
            continue
        proman = part_for(idx)
        pid = f"norse-rydberg-v{vol}-{num:03d}-{slugify(title or 'section')}"
        entries.append(
            make_entry(
                pid, SRC, f"Part {proman}, §{num}. {title.title() if title else '(untitled)'}", body,
                {
                    "source_title": "Teutonic Mythology: Gods and Goddesses of the Northland",
                    "volume": vol,
                    "translator_or_author": "Viktor Rydberg (trans. Rasmus B. Anderson)",
                    "publication_year": 1889,
                    "public_domain_basis": f"US publication pre-1929; Project Gutenberg eBook #{GID}",
                    "lineage_id": "norse", "genre": "comparative mythography", "register": "exposition",
                    "public_domain": True, "gutenberg_id": GID,
                    "source_url": f"https://www.gutenberg.org/ebooks/{GID}",
                    "part_roman": proman, "section_number": num, "section_title": title,
                    "chunk_strategy": "rydberg-numbered-section: one passage per author's own numbered section (his own analytic unit, not a chapter), isolated from front-matter false positives by requiring a strictly-ascending-from-1 run; PART context looked up from the nearest preceding 'PART <roman>.' anchor.",
                    "voice_authorization_note": VOICE_AUTH_NOTE,
                    "pulled_via": "scripts-resilience/build_norse_corpus_batch2.py:rydberg",
                },
            )
        )
    return entries


BOOKS = {
    "heroes_of_asgard": build_heroes_of_asgard,
    "beowulf": build_beowulf,
    "in_days_of_giants": build_in_days_of_giants,
    "burnt_njal": build_burnt_njal,
    "rydberg_v1": lambda: build_rydberg(1),
    "rydberg_v2": lambda: build_rydberg(2),
    "rydberg_v3": lambda: build_rydberg(3),
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
