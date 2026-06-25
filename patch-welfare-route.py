import pathlib, sys

p = pathlib.Path("app/api/divine/route.ts")
text = p.read_text()
if "assessWelfare" in text:
    print("• already wired — no change"); sys.exit(0)

# 1. imports
imp = "import { PRIMARY_MODEL } from '@/lib/model.config';"
assert imp in text, "import anchor missing"
text = text.replace(imp,
    "import { PRIMARY_MODEL, WELFARE_MODEL } from '@/lib/model.config';\n"
    "import { assessWelfare } from '@/lib/welfareGate';\n"
    "import type { ModelJudge } from '@/lib/welfareGate';", 1)

# 2. crisis preamble constant — TEXT IS A PLACEHOLDER. Author + review before shipping.
const_anchor = "type Message = { role: 'user' | 'assistant'; content: string };"
assert const_anchor in text, "Message type anchor missing"
text = text.replace(const_anchor,
    "type Message = { role: 'user' | 'assistant'; content: string };\n\n"
    "// CRISIS DIRECTIVE — prepended to the system prompt when the welfare gate returns\n"
    "// surfaceResources=true (crisis tier). This OVERRIDES the divinatory register.\n"
    "// PLACEHOLDER TEXT — must be authored and reviewed by welfare-design accountability\n"
    "// before production. Do not ship the placeholder.\n"
    "const CRISIS_DIRECTIVE = `___AUTHOR_THIS___`;", 1)

# 3. hoist client + run gate before systemPrompt is assembled
sp = "  const systemPrompt = (() => {"
assert sp in text, "systemPrompt anchor missing"
gate = (
    "  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });\n\n"
    "  // Welfare gate — synchronous, before prompt assembly. assessWelfare owns the\n"
    "  // failsafe (lexical floor + model judge, more-severe-wins, fails up on model error).\n"
    "  const welfareJudge: ModelJudge = async (judgeSystem, judgeUser) => {\n"
    "    const res = await client.messages.create({\n"
    "      model: WELFARE_MODEL, max_tokens: 64,\n"
    "      system: judgeSystem,\n"
    "      messages: [{ role: 'user', content: judgeUser }],\n"
    "    });\n"
    "    const b = res.content.find((x) => x.type === 'text');\n"
    "    return b && 'text' in b ? b.text : '';\n"
    "  };\n"
    "  const latestUser = [...(body.messages as Message[])].reverse().find(m => m.role === 'user');\n"
    "  const welfare = await assessWelfare(latestUser?.content ?? '', welfareJudge);\n\n"
)
text = text.replace(sp, gate + sp, 1)

# 4. prepend crisis directive to the assembled systemPrompt
close = "    } catch {\n      return base;\n    }\n  })();"
assert close in text, "systemPrompt closing anchor missing"
text = text.replace(close,
    close + "\n\n"
    "  const finalSystemPrompt = welfare.surfaceResources\n"
    "    ? CRISIS_DIRECTIVE + '\\n\\n' + systemPrompt\n"
    "    : systemPrompt;", 1)

# 5. generation uses the gated prompt
gen = "        system: systemPrompt,\n        messages: body.messages as Message[],"
assert gen in text, "generation system: anchor missing"
text = text.replace(gen,
    "        system: finalSystemPrompt,\n        messages: body.messages as Message[],", 1)

# 6. remove the now-duplicate client at the old site
dup = "  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });\n\n  const guarded"
assert dup in text, "original client/guarded anchor missing"
text = text.replace(dup, "  const guarded", 1)

p.write_text(text)
print("✓ gate wired; crisis directive prepended on surfaceResources")
print("  ⚠ CRISIS_DIRECTIVE is placeholder text (___AUTHOR_THIS___). Author + review before shipping.")
