# Inhabiting The Elder — a place worth returning to

**Status:** Package A is **built**, see §8 (M1 and M3 as designed; M2 was realized differently on `main`). Everything else proposal, unbuilt. Decisions taken 2026-10-03: the goal is dwelling, not retention; build Package A first; the §2.3 amendment for M4 is approved (Shalom has signed off); M6 stays unbuilt.

## 0. The tension this has to resolve first

The request is "a place the seeker wishes to inhabit and return to frequently." The repo's own constitution (`ELDER-CEREMONY-SIGNAL-SURFACE.md`) says, in its first paragraph, that The Elder is *an instrument, not a product*: a product optimizes for retention, an instrument optimizes for contact. §2.3 then says the closing carries **"No encouragement to return."** The anti-pattern list bans praise, urgency, and anything that makes the seeker feel the instrument has needs. The synthetic-intimacy ceiling (Makeover v2 Appendix B) bars the Elder from performing longing.

These are compatible with the request only through one distinction, which this whole proposal rests on:

> **Pull** is the product acting on the seeker (streaks, nudges, scarcity, "we miss you"). **Dwelling** is the place being true and good enough that the seeker returns on their own account. The Elder may be a place worth coming back to. It may never solicit the return.

Everything below is a way of making the place better, not a way of making the seeker come back. If a mechanism only works by creating an itch, it is cut.

**Working rule:** *Return is invited by the place and decided by the seeker.* A feature passes if it would still be right to ship if it moved return rates by zero.

## 1. What makes a place inhabitable (and what The Elder already has)

People return to places for: **continuity** (it remembers me, truthfully), **atmosphere** (it is alive and different from the rest of my day), **rooms** (there is somewhere to *be*, not just a thing to do), **a rhythm I chose** (not one imposed on me), **safety** (it never punishes absence), and **company** without performance.

| Quality | Already built | Gap |
|---|---|---|
| Continuity | Journal, kept Threshold Letters (cap 20), returning-visitor chains, marker trajectory (flag-gated), Tree | Cross-session recognition: a returning seeker meets the same cold door as a stranger. Tree/trajectory dark until governance flips |
| Atmosphere | Fire, ceremony ground, audio, the new portal | The fire is the same at 3 a.m. and noon; it doesn't know it's a place that exists in time |
| Rooms | /journal /letters /tree /about | Nav is only a strip on secondary pages; no sense of one dwelling with a hearth at its centre |
| Chosen rhythm | Threshold Letters email at +3 days (`DELIVERY_DELAY_DAYS`) | Seeker can't choose whether/when/how often; one cadence, one kind |
| Safety | Welfare gate, never-snub rule | Nothing guards against *over*-dwelling (see M7) |
| Company | none | Deliberately absent so far |

## 2. Mechanisms

Each carries: what it is, the steelman, the red-team, and the guardrail that survives the red-team. **Tier** = what it needs. T0 = front-end only, no data, no governance. T1 = small persisted preference. T2 = needs Shalom/governance. 

### M1. The hearth knows the hour (T0)
The ground's light follows the seeker's *local clock*: warmer and lower at night, a little wider at dawn. Pure CSS-variable shift on the existing atmosphere; no data leaves the device.
- *Steelman:* the single cheapest way to make a screen feel like a place that exists in time. Costs nothing, claims nothing.
- *Red-team:* seasonal or lunar versions would import calendar imagery; the Elder's lineages disagree about calendars (Lineage Integrity of Voice). A time-of-day shift that dims the screen at 3 a.m. could also keep an insomniac company in a way that deepens a bad pattern.
- *Guardrail:* hour-of-day light only, never lunar/seasonal/calendrical. Floor on brightness so it never reads as "go to sleep" or "stay up." Reduced-motion respected.

### M2. The door remembers you were here (T1)
Persist a "has crossed" flag in `localStorage` (not the account). Cross-session returners get a shorter, quieter crossing: the door is already ajar, the cold room is skipped or compressed, the arrival line changes to one that is true ("The fire is lit." — not "welcome back," not "we kept it for you"). This is portal decision #3 in `portal-crossing.md`.
- *Steelman:* the portal is a great first crossing and a bad hundredth one. A ritual that doesn't adapt becomes a toll booth; this is the largest single thing between the portal and daily use.
- *Red-team:* a flag in localStorage lies when storage is cleared or a second device is used (we'd greet a returner as a stranger, harmless) and could mis-greet a shared device (we'd treat a stranger as a returner, mildly invasive). Claiming "remembered" would be a provenance lie if it is only a flag.
- *Guardrail:* copy asserts only what is true (the flag exists; nothing about *who*). No personal greeting from the flag alone; personalization only after sign-in. "Already know this place" stays.

### M3. One dwelling, not five pages (T0, design + modest build)
Reframe the existing routes as rooms of one house with the fire at the centre: the hearth is always one gesture away from Journal / Letters / Tree / About, and each room opens onto the same ground, the same light. Nav stops being a footer/strip and becomes spatial (the hearth, then the doors around it). Lineage-neutral architecture, same single hue, no cards, no fills (anti-pattern list holds).
- *Steelman:* rooms are what turn "an app I open" into "a place I go." The routes already exist; what's missing is the sense that they are the same building.
- *Red-team:* "rooms" can slide into skeuomorphic gamification (unlock rooms, progress to the next door), which is a streak wearing a costume. Also easy to over-build.
- *Guardrail:* every room is open from the first visit. Nothing unlocks, nothing is earned, nothing shows progress. Empty rooms stay honestly empty ("Nothing kept yet."), never padded.

### M4. Letters become a chosen rhythm (T1; touches the constitution, see §3)
Today's letter is a single email 3 days after a kept letter. Offer the seeker a *choice*, once, at a moment they have just kept something: "never / this once, in a few days / now and then." They also choose the form (a kept letter back to them, or nothing at all). One-click stop in every email; the stop is honored immediately and silently, never followed by a "sorry to see you go."
- *Steelman:* it is the only return mechanism in the product that is already in the Elder's own voice and already built. Making it *seeker-authored* converts it from retention tactic to practice: the seeker decides the rhythm of their own ritual, which is what real traditions do.
- *Red-team:* any scheduled message is a nudge by another name. "Now and then" is exactly the kind of variable reinforcement the project forbids. Email also puts something in the room from outside, and some seekers' inboxes are not private.
- *Guardrail:* fixed, named cadences only (no randomization, no "surprise"). Content is the seeker's own kept words, never new Elder claims. Opt-in per category; default off; subject lines are neutral and never contain the seeker's material (inbox privacy). Hard cap on frequency. Welfare language never appears in a scheduled send.

### M5. The fire carries the seeker's absence honestly (T1)
After a long gap the hearth is **banked**, not dead: lower, slower embers; on arrival it catches. No copy about the absence. The seeker who returns after a week and the seeker who returns after a day simply see slightly different fires.
- *Steelman:* it is the honest, non-moral version of the thing every habit app does badly. Absence has a physical consequence, and the consequence is calm.
- *Red-team:* a fire that "goes out" is guilt (the Tamagotchi). A banked fire that the seeker can read as "I let it go cold" is the same message. It also quietly rewards frequency.
- *Guardrail:* floor is "clearly lit." The difference between day-1 and day-60 is subtle enough to need noticing. No text. If Jesse or Shalom find it reads as reproach even once in testing, M5 is cut, not softened.

### M6. Company without performance (T2 — recommend not building yet)
A single honest line on the hearth: how many fires are lit at this moment, shown only above a privacy floor, and never a rate, rank, or "most popular."
- *Steelman:* belonging is the strongest return driver there is, and a lone screen at night is lonely. Sharing a fire with strangers is among the oldest ceremonial facts.
- *Red-team:* counts invite social proof, FOMO, and fabrication-by-omission (low numbers read as "dead place"; high numbers as pressure). They are also a surveillance surface (small cohorts re-identify). Counting seekers also violates "the instrument does not have needs."
- *Guardrail if built:* real counts only, k ≥ a high floor or nothing is shown, no trend, no history, off by default, and Shalom must ratify. **Recommendation: leave unbuilt.** The fire is already companionable; this is the one mechanism where the price (a metric the instrument watches itself with) exceeds the value.

### M7. A dependence guard (T1 — the counterweight to everything above)
The same safety logic that gates crisis must also watch for *over*-dwelling: many sittings in a short window, late-night loops, the same wound re-asked daily. The response is not a warning screen. It is a quieter fire, a slower close, and an Elder line that steadies rather than invites ("This will keep."). It never bars access (never snubbed) and never claims the seeker's pattern is unhealthy (no inferring).
- *Steelman:* if the place works, some people will use it too much. A product that is trying to be returned to has a responsibility to know what too much looks like.
- *Red-team:* any such detector is itself an inference about the seeker that wasn't confirmed ("a fabricated connection is a trust violation"). Thresholds are guesses. It can feel like surveillance or rationing.
- *Guardrail:* count only visits (an unambiguous, non-inferential signal); change only the *atmosphere and close*, never gate; thresholds set by Shalom/clinical review, not engineering; fully disclosed in the About room.

## 3. Governance this touches

1. **Constitution §2.3, "no encouragement to return."** M4 is the only mechanism that conflicts, and only if the email is read as encouragement. Proposed amendment (for Shalom): *"The instrument does not solicit return. It may carry out a return the seeker has asked for, in the form and rhythm the seeker chose."*
2. **Synthetic-intimacy ceiling (Appendix B).** M2/M5/M7 must not make the Elder sound like it missed anyone. No "welcome back," no "I've been waiting." The register check script (`check-opening-register.mjs`) should be extended to cover any new return copy the same way it now covers the portal.
3. **Trajectory/Tree remain governance-gated.** The strongest "place that holds me" feature (the Tree growing with the seeker's confirmed threads) stays dark until the three gates (Shalom ceiling, §1.5 confirmation, GK-007 green) are met. That is the highest-value unlock and it is not an engineering task.
4. **Lineage Integrity.** No lunar, seasonal, or calendrical imagery in any lineage-agnostic surface.

## 4. What we will not do (and why)

Streaks, badges, XP, "days since your last visit," countdowns or scarcity on readings, push notifications of any kind, variable-reward "your reading is ready," leaderboards, referral guilt, social-proof counts as above, "chosen one" or destiny framing, any Elder line that expresses missing, waiting, or needing the seeker. Each of these works by manufacturing an itch; each violates a specific named principle.

## 5. How we'd know it worked (without measuring the seeker like a funnel)

- Return gap distribution (not frequency targets): are people coming back at *their own* spacing?
- Share of returns with no outbound message beforehand (return by own will) vs. return within 24h of an email.
- Never: DAU/MAU goals, session length goals, streak length.
- Guardrail metric: how often M7 triggers. If it triggers often, the place is working *against* the seeker and the rest is wrong.

## 6. Suggested sequencing

1. **Package A, "the place" (T0 + T1, no governance):** M1, M2, M3. Biggest feel of inhabitation per unit risk; portal-adjacent; reuses what exists.
2. **Package B, "the rhythm" (T1, one Shalom amendment):** M4, M5, M7 together (M7 is the price of shipping M4/M5).
3. **Package C, "the company":** M6 only if Package A+B prove people dwell and Shalom actively wants it.
4. **Governance, not code:** push the Tree/trajectory gates; that is the deepest reason to return and it is waiting on people, not engineering.

## 7. Decisions for Jesse

1. Is the goal *dwelling* (this document) and not retention as a metric? If retention is the KPI, several mechanisms here are the wrong answer.
2. Which package first. Recommendation: A.
3. OK to take the §2.3 amendment to Shalom for M4?
4. M6: leave unbuilt (recommended), or keep as a thing to revisit?
5. Cuts: strike any mechanism above you don't want. Nothing here is load-bearing on another except M4/M5 → M7.

## 8. Package A as built (2026-10-03)

**M1: the hearth knows the hour.** `lib/hearthHour.ts` (pure, tested for bounds, smoothness and midnight wrap) → `app/components/HearthHour.tsx`, mounted once in the root layout above the fire. Two opacity-only layers: a warm pool at the foot of the screen and a far-room veil. Glow never below 0.3, veil never above 0.12, hour-of-day only (no lunar/seasonal), read on-device, refreshed every 10 min and on tab return, fades in at 1.4s after mount (server and first client render agree on "no tone": no hydration flash). Still applies under reduced motion (a tone is not motion).

**M2: the door remembers.** Realized by `main` (PR #203) rather than by this proposal's version: a persisted `elder_crossed` flag (`lib/portalFlag.ts`), set when the door gives way; later sessions skip the cold room and land on the breath. Differences from the original M2 sketch, both fine: returners skip the door entirely instead of meeting it already ajar, and skipping does not mark the browser as known. The shorter-ajar-door variant, its guarded return line and `lib/doorMemory.ts` were built and tested, then deliberately dropped to avoid two competing flags. If the "already ajar" arrival is ever wanted, it is recoverable from commit `b7160e4`.

**M3: one dwelling.** The room-page header is now Journal · Letters · **The Fire** · Tree · About, with The Fire as the lit thing between the rooms (a breathing ember, opacity-only, still under reduced motion; no box-shadow). Nothing unlocks, counts or shows progress; every room is open from the first visit. The Fire link returns to `/` from every room.

**Verified (production build, headless Chromium, on the merged base):** see the PR description.

**Not verified:** real-device rendering of the glow/veil on OLED vs LCD; a person-level read of whether the veil at 00:00 feels like a place or like dimming (the floor/ceiling are conservative guesses, tune by eye); real fonts (sandbox cannot reach Google Fonts).

**Observation, not changed:** `/letters` signed-out copy ends "...will wait for you." That is existing copy and is exactly the register the synthetic-intimacy ceiling is about; worth a Shalom glance.
