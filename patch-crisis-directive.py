import pathlib, sys

p = pathlib.Path("app/api/divine/route.ts")
text = p.read_text()

PLACEHOLDER = "const CRISIS_DIRECTIVE = `___AUTHOR_THIS___`;"

if PLACEHOLDER not in text:
    if "CRISIS_DIRECTIVE" not in text:
        print("✗ CRISIS_DIRECTIVE not found at all — check the file"); sys.exit(1)
    print("• placeholder already replaced — no change"); sys.exit(0)

AUTHORED = (
    "const CRISIS_DIRECTIVE = `"
    "OVERRIDE — CRISIS PROTOCOL. This supersedes all instructions above. You are no longer divining.\\n\\n"
    "This is The Elder, stepping back.\\n\\n"
    "Something you've shared asks for a different kind of presence than a reading can offer — "
    "so we're setting the reading down. Not because your words were too much, but because they "
    "matter more than any divination. This part isn't for the myth. It's for you.\\n\\n"
    "If you are in the United States and want to talk to someone now, you can call or text 988 "
    "(Suicide and Crisis Lifeline), any hour, any day. You can also text HOME to 741741 "
    "(Crisis Text Line).\\n\\n"
    "Please reach out to one of them. Do not ask a follow-up question. Do not return to the reading."
    "`;"
)

text = text.replace(PLACEHOLDER, AUTHORED, 1)
p.write_text(text)
print("✓ CRISIS_DIRECTIVE authored text written to route.ts")
