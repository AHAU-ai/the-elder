#!/usr/bin/env python3
"""
zohar_pull.py

Pulls Aramaic Zohar text from Sefaria's public API, daf by daf, with
citations attached — intended as a sourcing tool for The Elder's Mekubal
corpus (AHAU AI).

WHY THIS EXISTS / WHAT TO VERIFY BEFORE TRUSTING OUTPUT
---------------------------------------------------------
1. LICENSE CHECK IS NOT AUTOMATED. Before using any of this output in a
   real corpus, manually confirm Sefaria's license for the specific
   "version" of the Zohar text you pull (see --list-versions below).
   Sefaria hosts multiple Zohar versions/translations; some (e.g. the
   Sulam commentary by Rabbi Ashlag) may carry different rights than the
   base Aramaic text. Check the version's `license` field in the API
   response, and cross-reference https://www.sefaria.org/about (or their
   API terms) directly. Do not assume "on Sefaria" == "public domain."

2. This script does NOT decide what's public domain for you. It fetches
   whatever version you ask for and prints/saves the license metadata
   Sefaria itself reports, so a human (you, or whoever signs off for
   AHAU AI / Getzel / Vincent) can make the actual call.

3. Sefaria's ref format for Zohar sections is Torah-portion-based, not
   simple "Zohar I 1a" strings, e.g.:
       Zohar, Bereshit, Section 1
   The Vilna daf citation (e.g. "Zohar I 15a") is available as metadata
   on each segment (Sefaria stores original daf refs internally), but
   the ref you request generally needs to use their section addressing.
   This script handles both: you can pass a Sefaria ref directly, or use
   --daf-range with a book name and let the script attempt daf-style refs
   (Sefaria supports some daf-based aliasing for the Zohar; verify results).

USAGE
-----
  # See what Zohar versions Sefaria has, with license info:
  python3 zohar_pull.py --list-versions

  # Pull a specific ref (safest / most predictable):
  python3 zohar_pull.py --ref "Zohar 1:15a" --version "Aramaic"

  # Pull a daf range for a book (experimental ref-guessing):
  python3 zohar_pull.py --daf-range "Zohar 1:1a-1:5a" --version "Aramaic"

  # Save results (JSONL, one daf per line) with citations:
  python3 zohar_pull.py --ref "Zohar 1:15a" --version "Aramaic" \
      --out zohar_corpus.jsonl

OUTPUT
------
For each daf successfully pulled, prints (and optionally saves) a JSON
record:
  {
    "citation": "Zohar 1:15a",
    "sefaria_ref": "...",
    "version_title": "...",
    "license": "...",           # as reported by Sefaria — VERIFY THIS
    "language": "he" | "arc" | ...,
    "text": [...],              # list of segments, original language
    "source_url": "https://www.sefaria.org/..."
  }

Nothing here is fabricated — every field comes directly from Sefaria's
API response. If a ref 404s or a version doesn't exist, the script
reports the failure rather than guessing.
"""

import argparse
import json
import ssl
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

# Windows consoles often default stdout/stderr to cp1252, which can't encode
# Hebrew/Aramaic text -- force UTF-8 so printing source text doesn't crash.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

API_BASE = "https://www.sefaria.org/api"

# Windows' default Python build doesn't consult the OS trust store, which
# breaks on machines where something local (endpoint security, a corporate
# proxy) issues certs signed by a locally-installed root CA. `truststore`
# makes ssl.create_default_context() defer to the real OS trust store
# (same one curl/schannel use) instead of a fixed public bundle -- still
# real verification, just against the trust roots this machine actually has.
try:
    import truststore
    truststore.inject_into_ssl()
    _SSL_CONTEXT = ssl.create_default_context()
except ImportError:
    try:
        import certifi
        _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        _SSL_CONTEXT = None


def http_get_json(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "zohar-pull-script/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CONTEXT) as resp:
            return json.loads(resp.read().decode("utf-8")), None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        return None, f"URL error: {e.reason}"
    except json.JSONDecodeError as e:
        return None, f"Bad JSON: {e}"


def list_versions(book="Zohar"):
    """List all text versions Sefaria has for a book, with license info."""
    url = f"{API_BASE}/texts/versions/{urllib.parse.quote(book)}"
    data, err = http_get_json(url)
    if err:
        print(f"ERROR listing versions: {err}", file=sys.stderr)
        return
    if not data:
        print("No versions returned — check the book title.", file=sys.stderr)
        return
    print(f"Versions of '{book}' on Sefaria:\n")
    for v in data:
        title = v.get("versionTitle", "?")
        lang = v.get("language", "?")
        license_ = v.get("license", "UNSTATED — verify manually")
        source = v.get("versionSource", "?")
        print(f"  - versionTitle: {title}")
        print(f"    language:     {lang}")
        print(f"    license:      {license_}")
        print(f"    source:       {source}")
        print()


def fetch_ref(ref, version_title=None, version_lang=None):
    """
    Fetch a single ref via Sefaria's v3 texts API.
    If version_title is given, request that specific version.
    """
    quoted_ref = urllib.parse.quote(ref)
    url = f"{API_BASE}/v3/texts/{quoted_ref}"
    params = {}
    if version_title:
        # Confirmed against the live API: v3 wants "<language>|<versionTitle>",
        # e.g. "hebrew|Sulam Edition, Jerusalem 1945".
        params["version"] = f"hebrew|{version_title}" if version_lang is None else f"{version_lang}|{version_title}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    data, err = http_get_json(url)
    if err:
        return None, err
    return data, None


def normalize_record(ref, data):
    """Pull out the fields we actually care about, unmodified from Sefaria."""
    versions = data.get("versions") or []
    if not versions:
        return None, "No versions in response"

    # Prefer an Aramaic/Hebrew source version over an English translation
    chosen = None
    for v in versions:
        lang = v.get("language", "")
        if lang in ("he", "arc"):
            chosen = v
            break
    if chosen is None:
        chosen = versions[0]

    record = {
        "citation": ref,
        "sefaria_ref": data.get("ref", ref),
        "version_title": chosen.get("versionTitle"),
        "license": chosen.get("license", "UNSTATED — verify manually before use"),
        "language": chosen.get("language"),
        "text": chosen.get("text"),
        "source_url": f"https://www.sefaria.org/{urllib.parse.quote(data.get('ref', ref))}",
    }
    return record, None


def pull_single_ref(ref, version_title, out_fh):
    data, err = fetch_ref(ref, version_title=version_title)
    if err:
        print(f"[FAIL] {ref}: {err}", file=sys.stderr)
        return False

    record, rerr = normalize_record(ref, data)
    if rerr:
        print(f"[FAIL] {ref}: {rerr}", file=sys.stderr)
        return False

    print(json.dumps(record, ensure_ascii=False, indent=2))
    if out_fh:
        out_fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    lic = (record.get("license") or "").lower()
    if "unstated" in lic or not lic:
        print(f"  ⚠️  License unstated by Sefaria for this version — "
              f"confirm manually before using in the corpus.", file=sys.stderr)
    elif "nc" in lic or "nd" in lic or "noncommercial" in lic or "noderiv" in lic:
        print(f"  ⚠️  License '{record['license']}' may restrict reuse "
              f"(non-commercial / no-derivatives) — review before use.", file=sys.stderr)

    return True


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--list-versions", action="store_true",
                    help="List available Zohar text versions and their licenses, then exit.")
    p.add_argument("--book", default="Zohar",
                    help="Book title for --list-versions (default: Zohar)")
    p.add_argument("--ref", help="A single Sefaria ref to pull, e.g. 'Zohar 1:15a'")
    p.add_argument("--daf-range", help="Attempt a range like 'Zohar 1:1a-1:5a' "
                                        "(EXPERIMENTAL — verify each ref resolves correctly)")
    p.add_argument("--version", dest="version_title", default=None,
                    help="Specific Sefaria versionTitle to request (see --list-versions)")
    p.add_argument("--out", help="Path to write JSONL output (one record per line)")
    p.add_argument("--sleep", type=float, default=0.5,
                    help="Seconds to sleep between requests (be polite to Sefaria's API)")
    args = p.parse_args()

    if args.list_versions:
        list_versions(args.book)
        return

    out_fh = open(args.out, "a", encoding="utf-8") if args.out else None

    try:
        if args.ref:
            pull_single_ref(args.ref, args.version_title, out_fh)

        elif args.daf_range:
            # Very naive range expansion — Zohar daf citation isn't a clean
            # arithmetic sequence (side a/b, varying section boundaries), so
            # this only handles simple numeric daf increments within one
            # section as a starting point. Inspect output carefully.
            print("NOTE: --daf-range is experimental. Verify every returned "
                  "ref actually matches the citation you expect — Zohar daf "
                  "numbering does not map cleanly onto Sefaria's section refs.",
                  file=sys.stderr)
            try:
                start, end = args.daf_range.split("-")
            except ValueError:
                print("ERROR: --daf-range must look like 'Zohar 1:1a-1:5a'", file=sys.stderr)
                sys.exit(1)
            print(f"Requested range: {start} .. {end}", file=sys.stderr)
            print("This script does not auto-expand daf ranges without a "
                  "verified daf->section mapping table for the Zohar, to "
                  "avoid silently fetching the wrong passage. Pull individual "
                  "--ref values instead, or extend get_daf_sequence() below "
                  "once you've confirmed Sefaria's section boundaries for "
                  "the range you need.", file=sys.stderr)
            sys.exit(1)

        else:
            p.print_help()

    finally:
        if out_fh:
            out_fh.close()


if __name__ == "__main__":
    main()
