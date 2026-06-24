import pathlib, sys

p = pathlib.Path("package.json")
text = p.read_text()

if "check:crisis-directive" in text:
    print("• already present — no change"); sys.exit(0)

anchor = '    "probe:matrix": "node scripts/generative-probe.mjs --matrix --limit 5"\n  },'
if anchor not in text:
    print("✗ anchor not found — paste the error and re-anchor"); sys.exit(1)

text = text.replace(anchor,
    '    "probe:matrix": "node scripts/generative-probe.mjs --matrix --limit 5",\n'
    '    "check:crisis-directive": "node scripts/check-crisis-directive.mjs"\n  },', 1)

p.write_text(text)
print("✓ added check:crisis-directive to package.json scripts")
