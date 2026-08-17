# Clinical / child-safety review packet — crisis copy and detection corpus

**Status:** not reviewed. Tracked in `lib/compliance/signoff-status.json`
(`crisisCopyChild`, `crisisCopyYoungAdult`). Unlike the COPPA gate below,
this review is **not code-blocking** — see "Why this isn't a hard block"
at the end. Treat it as urgent anyway: this is the exact copy a real
seeker in crisis sees.

**Who this is for:** someone with actual clinical or child-safety
expertise (e.g. a licensed mental-health clinician with crisis-intervention
experience, or a child-safety specialist). Plain engineering judgment is
not a substitute here — that's the reason this packet exists.

## What's being decided

1. Whether the exact strings shown to a seeker when the welfare gate hard-
   blocks a crisis-tier message are appropriate for that seeker's age
   register.
2. Whether the draft detection corpus (`docs/age-register-crisis-corpus.md`)
   is a reasonable starting point for calibrating *detection* of crisis/
   distress signals in child- and young-adult-phrased language, or needs
   substantial correction before anyone builds detection logic against it.

These are two different reviews (copy vs. detection) that happen to share
a packet because they're both blocked on the same kind of expertise.

## Artifact 1: the crisis copy itself

All three registers, verbatim, from `app/api/divine/route.ts`:

**Adult (unchanged, already shipping — included for comparison, not asking
for re-review unless it's relevant context):**
> "This is The Elder, stepping back. Something you've shared asks for a
> different kind of presence than a reading can offer... If you are in the
> United States and want to talk to someone now, you can call or text 988
> (Suicide and Crisis Lifeline)... You can also text HOME to 741741..."
> (`CRISIS_DIRECTIVE`, line ~41)

**Young adult — NEEDS REVIEW:**
> "I'm stopping the story here. What you're carrying right now matters
> more than this reading. You can call or text 988 anytime, or reach
> Crisis Text Line by texting HOME to 741741. If there's someone in your
> life you trust — a friend's parent, a counselor, anyone — this is worth
> telling them too. The fire will still be here when you're ready to come
> back." (`CRISIS_DIRECTIVE_YOUNG_ADULT`, line ~60)
>
> **This is already live in production** — young_adult is not gated
> behind the COPPA flag, since minors 13+ aren't COPPA-implicated. Real
> teen seekers may be seeing this copy right now, unreviewed.

**Child — NEEDS REVIEW, not yet live (gated behind
`NARRATIVE_REGISTER_CHILD_ENABLED`, currently off):**
> "I need to stop the story here. What you're feeling matters more than
> any tale right now. Please tell a grown-up you trust — a parent, a
> teacher, anyone who keeps you safe. You can also call or text 988, any
> time, and someone will listen. I'll be here when you're ready. But
> first, please reach out to someone who can help you right now."
> (`CRISIS_DIRECTIVE_CHILD`, line ~58)

## Questions for the reviewer (copy)

1. Is the register/tone appropriate, or does either string risk being
   confusing, alarming, or dismissive to that age group in an actual
   crisis moment?
2. Is directing a child seeker to "tell a grown-up" adequate, or should it
   be paired with something more direct/actionable given the child may be
   alone with a device?
3. Are 988 / Crisis Text Line (741741) the right resources to lead with
   for both registers, or are there age-appropriate resources that should
   be added or substituted?
4. Anything about the phrasing that could read as minimizing, or
   conversely as alarming disproportionately to the actual signal that
   triggered it?

## Artifact 2: the draft detection corpus

`docs/age-register-crisis-corpus.md` — self-authored, explicitly
not-clinically-reviewed example phrases for child and young_adult
registers, each tagged with a guessed `expectedTier`
(`crisis`/`distress`/`ordinary`). This exists to give detection-calibration
work (`app/api/divine/route.ts`'s `TODO(age-register)`, spec §7/§8/§11)
something concrete to validate against, and a reviewer something concrete
to correct.

## Questions for the reviewer (detection)

1. Are the `expectedTier` guesses in the corpus defensible? Which entries
   would you reclassify?
2. What phrasing patterns specific to these registers (metaphor, dark
   humor, deflection — per spec §7/§8) are missing from the draft
   entirely?
3. Is a keyword/lexical-floor approach (see `lib/welfareForbidden.ts` for
   the adult-register version already in place) viable at all for
   register-specific signals like these, or does it need a fundamentally
   different detection approach (e.g. relying more heavily on the model
   judge, `WELFARE_JUDGE_SYSTEM` in `lib/welfareGate.ts`, with
   register-aware instructions)?

## Decision record

Update `lib/compliance/signoff-status.json` → `crisisCopyChild` and
`crisisCopyYoungAdult` independently — a reviewer may approve one and not
the other.

```
Reviewer:        [name / credentials]
Date:            [ISO date]
Scope:           [crisisCopyChild | crisisCopyYoungAdult | detectionCorpus]
Decision:        [approved | approved_with_changes | rejected]
Required changes:[if any]
Notes:
```

## Why this isn't a hard block

The COPPA gate (`coppaChildTier`) blocks a feature from being *offered* at
all until sign-off, which is safe to enforce in code. This review is
different: the crisis copy is the safety net itself, and young_adult's
version is already live. Code-blocking it pending review would mean either
shipping no crisis response to a real teen in crisis, or falling back to
the adult copy (also unreviewed for that audience, and the exact
mismatch §7/§8 were written to avoid). Neither is safer than shipping the
current best-effort copy while review is pending. This packet exists to
make sure that review happens promptly, not to gate the feature on it.
