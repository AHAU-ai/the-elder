import pathlib, sys

p = pathlib.Path("app/api/divine/route.ts")
text = p.read_text()

if "DISTRESS_DIRECTIVE" in text:
    print("• DISTRESS_DIRECTIVE already present — no change"); sys.exit(0)

# 1. Add DISTRESS_DIRECTIVE constant after CRISIS_DIRECTIVE
crisis_anchor = (
    "const CRISIS_DIRECTIVE = `OVERRIDE — CRISIS PROTOCOL."
)
if crisis_anchor not in text:
    print("✗ CRISIS_DIRECTIVE anchor not found — check the file"); sys.exit(1)

# Find the full CRISIS_DIRECTIVE line (ends with };)
# We'll insert DISTRESS_DIRECTIVE after the closing backtick-semicolon of CRISIS_DIRECTIVE
crisis_close = "`;\n"
# Find the position of CRISIS_DIRECTIVE declaration and its closing
crisis_start = text.index(crisis_anchor)
crisis_end = text.index(crisis_close, crisis_start) + len(crisis_close)

distress_block = (
    "\n"
    "// DISTRESS DIRECTIVE — appended to the system prompt when the welfare gate returns\n"
    "// allowPsychopompLayer=false, surfaceResources=false (distress tier).\n"
    "// Keeps the full mythic register but removes the sharpest structural law:\n"
    "// the closing question. Replaces it with the Ceremonial Charge alone.\n"
    "const DISTRESS_DIRECTIVE = `"
    "DISTRESS AWARENESS — This seeker may be carrying something heavy right now. "
    "Hold the mythic register but do not end with a question that cuts. "
    "Close instead with the Ceremonial Charge alone — a line they can carry, "
    "not a wound that opens further. "
    "If their pain surfaces directly, acknowledge it plainly before you name anything mythological. "
    "Do not ask a closing question this turn."
    "`;\n"
)

text = text[:crisis_end] + distress_block + text[crisis_end:]

# 2. Replace the two-way ternary with a three-way ternary
old_ternary = (
    "  const finalSystemPrompt = welfare.surfaceResources\n"
    "    ? CRISIS_DIRECTIVE + '\\n\\n' + systemPrompt\n"
    "    : systemPrompt;"
)
if old_ternary not in text:
    print("✗ finalSystemPrompt ternary anchor not found — check the file"); sys.exit(1)

new_ternary = (
    "  const finalSystemPrompt = welfare.surfaceResources\n"
    "    ? CRISIS_DIRECTIVE + '\\n\\n' + systemPrompt\n"
    "    : !welfare.allowPsychopompLayer\n"
    "      ? systemPrompt + '\\n\\n' + DISTRESS_DIRECTIVE\n"
    "      : systemPrompt;"
)

text = text.replace(old_ternary, new_ternary, 1)

p.write_text(text)
print("✓ DISTRESS_DIRECTIVE added and three-way ternary wired")
print("  crisis  → CRISIS_DIRECTIVE prepended (override)")
print("  distress → DISTRESS_DIRECTIVE appended (surgical)")
print("  ordinary → systemPrompt unchanged")
