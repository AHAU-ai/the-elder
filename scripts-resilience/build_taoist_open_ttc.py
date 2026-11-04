#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_taoist_open_ttc.py -- Taoist lineage corpus, "The Open Tao Te Ching"
(Shalom Ormsby, CC0 / public domain; https://github.com/opencosmos-ai/taoteching).

Same contract as the other staged passes: this script reads a LOCAL checkout of
the source repo, segments and stages a JSON file ONLY. It never touches the
database and never embeds. The real gate is the shared CLI:

    git clone --depth 1 https://github.com/opencosmos-ai/taoteching /tmp/taoteching
    python3 scripts-resilience/build_taoist_open_ttc.py --src /tmp/taoteching
    python3 scripts-resilience/ingest.py corpus/taoist-open-ttc-passages-STAGED.json --dry-run
    python3 scripts-resilience/ingest.py corpus/taoist-open-ttc-passages-STAGED.json "$DEV_DATABASE_URL"

STRUCTURE: one passage per chapter (81), the chapter being the book's own unit.
`body` is the English verse of the chapter's "## Translation" section only -- that
is what is embedded and retrieved. The classical Chinese, pinyin and the
translator's notes are NOT in body; the Chinese is carried in _provenance for
human audit (ingest.py neither reads nor stores _provenance).

REVIEW STATUS: staged "approved" under the same meaning used by the Greek and
Norse passes -- TRANSCRIPTION STRUCTURE ONLY. It is not tradition-bearer sign-off,
and the source itself is a first draft (every chapter `status: drafted`; the
editing pass is ongoing). Re-run this script against a newer source commit and
re-ingest to pick up revisions; the source commit SHA is recorded per passage.

voice_key is "sage_of_the_way" (lib/lineageToVoiceKey.ts: taoist).
No "_comment" key on any entry (ingest.py --dry-run rejects it).
"""
import argparse
import json
import os
import re
import subprocess
import sys
import unicodedata

DEFAULT_OUT = "corpus/taoist-open-ttc-passages-STAGED.json"
SOURCE_TITLE = "The Open Tao Te Ching"
SOURCE = "The Open Tao Te Ching (Shalom Ormsby, CC0 public domain, 2026 first draft)"
REPO_URL = "https://github.com/opencosmos-ai/taoteching"


def sha(src):
    try:
        return subprocess.check_output(["git", "-C", src, "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        return None


def section(text, heading):
    m = re.search(r"^## %s\s*\n(.*?)(?=^## |\Z)" % re.escape(heading), text, re.S | re.M)
    return m.group(1).strip() if m else ""


def clean_verse(raw):
    lines = [l.rstrip() for l in raw.splitlines()]
    out = "\n".join(lines)
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    return unicodedata.normalize("NFC", out)


def chinese(src_block):
    rows = []
    for l in src_block.splitlines():
        if l.startswith("|") and not l.startswith("| 原文") and not l.startswith("| :"):
            cells = [c.strip() for c in l.strip("|").split("|")]
            if cells and cells[0]:
                rows.append(cells[0])
    return "".join(rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True, help="path to a local checkout of opencosmos-ai/taoteching")
    ap.add_argument("--out", default=DEFAULT_OUT)
    a = ap.parse_args()

    commit = sha(a.src)
    passages = []
    for n in range(1, 82):
        path = os.path.join(a.src, "chapters", "%03d.md" % n)
        text = open(path, encoding="utf-8").read()
        body = clean_verse(section(text, "Translation"))
        if not body:
            sys.exit("chapter %d: empty translation" % n)
        zh = chinese(section(text, "Source"))
        passages.append({
            "passage_id": "tao-otc-%03d" % n,
            "source": SOURCE,
            "section": "Chapter %d" % n,
            "body": body,
            "themes": [],
            "nahuales": [],
            "cruz_positions": [],
            "signal_affinity": [],
            "register": "exposition",
            "ceremonial_sensitivity": "open",
            "review_status": "approved",
            "reviewed_by": None,
            "review_date": None,
            "_provenance": {
                "lineage_id": "taoist",
                "public_domain": True,
                "public_domain_basis": "CC0 1.0 dedication by the translator (LICENSE in source repo)",
                "source_title": SOURCE_TITLE,
                "translator_or_author": "Shalom Ormsby",
                "publication_year": 2026,
                "source_url": "%s/blob/main/chapters/%03d.md" % (REPO_URL, n),
                "source_commit": commit,
                "source_status": "first draft; chapter frontmatter status: drafted",
                "source_text_zh": zh,
                "voice_authorization_note": "voice_key 'sage_of_the_way': institutional-placeholder consent_grant, not a named tradition-bearer review. review_status 'approved' means TRANSCRIPTION STRUCTURE ONLY; signal_affinity/themes intentionally left empty pending human marker review.",
                "chunk_strategy": "one passage per chapter; English verse only (Translation section); Chinese, pinyin and notes excluded from body",
                "pulled_via": "scripts-resilience/build_taoist_open_ttc.py",
            },
            "voice_key": "sage_of_the_way",
        })

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(passages, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("wrote %d passages -> %s (source %s)" % (len(passages), a.out, commit))


if __name__ == "__main__":
    main()
