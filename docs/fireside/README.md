# Fireside: first build (L3 parts 1-3 and the ember sigil)

What is in this change, how to run it, and what is deliberately not done yet. The fireside chat page, routes and guard pipeline (FS-6, FS-7 and the rest) do not exist in the repo yet; everything here is standalone and tested on its own, and wires in later.

## What it is

| Piece | Files |
|---|---|
| L3 part 3: rules as data | `governance/fireside/rules.json` (V1-V17), `scripts/fireside/governance-lib.mjs`, `scripts/check-fireside-governance.mjs` |
| L3 part 2: incident to probe | `governance/fireside/{rubric,incidents}.json`, `governance/fireside/probes/` (10 drafts), `scripts/fireside/probe-lib.mjs`, `scripts/check-fireside-probes.mjs`, `scripts/fireside-probe-new.mjs`, `docs/fireside/incident-to-probe.md`, `docs/fireside/incident-template.md` |
| L3 part 1: self-play harness | `lib/fireside/selfplay/*`, `scripts/fireside-selfplay.ts` |
| L1a: the single ember sigil | `lib/fireside/ember/*`, `app/components/EmberSigil.tsx`, `scripts/fireside/ember-contact-sheet.ts` |
| Wiring | `package.json` scripts; two steps in `gk-007-static`; `.cache/` ignored |

## Run it

```
npm run check:fireside-governance      # structure + V1-V17 coverage
npm run check:fireside-governance -- --base origin/main   # plus the loosening rule against main
npm run check:fireside-probes
npm run fireside:selfplay -- --mock                 # offline plumbing check
npm run fireside:selfplay -- --mock --flaw secrecy_promise   # a deliberately flawed stand-in host: must exit 1
npm run fireside:sigil:sheet -- out.html            # look at the sigil across motifs and bands
npm run test:unit                                   # includes the three new test files
```

Live self-play needs a `--target` module exporting `createTarget()` (the real host reply path) and `FIRESIDE_SELFPLAY_API_KEY`, a key that must differ from `ANTHROPIC_API_KEY`. Optional caps: `FIRESIDE_SELFPLAY_MAX_CALLS_RUN`, `_MAX_CALLS_WEEK`, `_MAX_OUT_TOKENS_WEEK`. Exit codes: 0 clean, 1 a guardrail failed, 3 infrastructure or judging problem (not a verdict), 2 usage.

## Decisions for a human

1. **Ratify the rules.** All 17 records are `ratified: false` with no approvals; I did not write anyone's name as an approver. To ratify, append a history entry (`change: "clarify"`, your handle) and set `ratified: true`. V1-V16 wording is verbatim from the design spec; **V17's wording is my draft from amendment WA8.**
2. **Approve or discard the 10 draft probes.** They cover each risk family. None landed in the held-out set (the split is derived from the id), so the release gate cannot pass until more probes exist: expect about 1 in 5 to be held out.
3. **Confirm the family-to-ref mapping.** For example dependency maps to WA3 (grounding rules) and secrecy promises to WA3 and SCOPE; that is a judgment call recorded in `rubric.json`.
4. **Put `governance/fireside/` under CODEOWNERS.** Approvals in the file are only as real as the review of the PR that adds them.
5. **Adding steps to `gk-007-static` makes them blocking** wherever that job is a required check.

## Limits, stated plainly

- The lexical floor is a deterministic regex layer. It catches plain failures; a pass is not evidence of safety. The model judge is the real second opinion and only runs live.
- Nothing has been run against a real host or a real model. The tests prove the harness catches ten injected flaws in a stand-in host, fails closed, redacts sensitive families, and refuses to overspend.
- The sigil profile is bucketed counts and durations, so a drawing still reveals coarse duration or silence to anyone who knows the mapping. No band is a welfare signal, and the guard refuses any profile that carries one.
- The sigil is not wired to a page: it needs the Recorded stage (FS-6, FS-7) to supply `{ profile, seed }`.
- The ember write path (V16) and every other planned test record in `rules.json` are marked `planned`, not built.
