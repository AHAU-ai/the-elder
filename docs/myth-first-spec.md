# Myth-first readings for new seekers

Status: DRAFT v1.1 (reconciled with figure continuity and the segment rate-limit branch), not implemented
Date: 2026-10-04
Owner: Jesse Barber
Written against: `main` @ 5e8ecd1. Reconciled in v1.1 against `main` @ 984a4c0 and these branches: `docs/figure-continuity-recon` (a14b239; spec v0.2, build plan, recon), `feat/fc-b-mapping-routes` (0d5f68f), `feat/fc-c-prompt-clause` (a6304f4), `fix/segment-rate-limit` (36fbf04). Changes from v1 are marked **[v1.1]**.
Related: `docs/segmented-delivery.md`, `docs/reading-shape-voice-review.md`, `docs/figure-continuity-spec.md` and `docs/figure-continuity-build-plan.md` (on `docs/figure-continuity-recon`, not yet on `main`). Section 10 reconciles this spec with figure continuity.

---

## 1. Decision

A new seeker's first Reading is told myth-first, in three short segments:

1. **The Myth.** The figure's myth is told, from within the lineage's own field, without the seeker's story.
2. **The Figure.** What this figure carries and risks, as the myth shows it.
3. **The Return.** The seeker's own story, seen through the figure, closing on the Ceremonial Charge.

A returning seeker keeps today's story-first Reading, unchanged.

This document specifies the design (sections 3 to 5), lists the decisions still open (section 6), and gives a PR-sized build plan (section 7). PRs are named MF-0 to MF-11.

## 2. Why

- **Hold it lightly.** A reviewer (2026-08-08) valued the archetypal threads but warned that stories must be held very lightly or they turn prescriptive. Myth-first lets the seeker draw the parallel themselves before the Elder offers one.
- **Short segments, each with a question.** Decided 2026-10-02. The segmented-delivery machinery is already on `main`; what it lacks is an arc built for this order.
- **Lineage Integrity of Voice.** One myth, one lineage, one figure per Reading. The seeker's story selects the myth; it does not get blended into it.
- **The myth-telling direction.** Stanzione's 2026-08-25 proposal was myth-telling rather than consultation. This is a first step toward it, for the lineages that can carry it today.
- **Figure continuity.** A returning seeker should be able to continue as their figure. Myth-first is how a new seeker meets that figure in the first place.

## 3. Ground truth at 5e8ecd1

Everything in this table was read in the repository. Line numbers are approximate and will drift.

| # | Fact | Where |
|---|------|-------|
| 1 | Segmented delivery is live on `main`: `SEGMENT_MAX = 3`, the `⧁⧁MORE⧁⧁` token, per-voice exclusions. The route computes `segmentIndex` (about line 352). `CouncilTabs` sends `segmented: true` only while no first Reading exists (about line 616). | `lib/segmentedDelivery.ts`, `app/api/divine/route.ts`, `app/components/CouncilTabs.tsx` |
| 2 | `docs/segmented-delivery.md` still says "on branch `feat/segmented-reading`, not merged". That is stale. | `docs/segmented-delivery.md` |
| 3 | Today's arc is one continuous arc of six angles that opens on the seeker's situation. The segment clause says the arc itself does not change; only how much arrives per turn. | `lib/system-prompt-builder.ts` ("THE ARC OF THE READING", about line 454) |
| 4 | Segment clause per index: about 70 to 110 words per segment, the final up to about 130, one follow-up question, `MORE` on non-final segments. The final segment carries the Ceremonial Charge and the `⧁MYTH:...⧁` token. | `segmentedDeliveryClause()` |
| 5 | Voices excluded from segmenting: `ojer_tzij`, `pythia`, `sufi`. Through `lineageToVoiceKey` these are the lineages **maya, greek, sufi**. That is 3 of the 11 selectable lineages (maya, norse, greek, egyptian, taoist, vedic, yoruba, sufi, stoic, mekubal, buddhist). | `SEGMENTED_DELIVERY_EXCLUDED_VOICES`, `lib/lineageToVoiceKey.ts` |
| 6 | The figure catalog already exists: `LINEAGE_ARCHETYPES`, with cards carrying `name`, `role`, `existentialField`, `gift`, `shadow`, `elderQuestion`, `canonicalAnchor`. Cards per lineage: default 3, maya 6, norse 5, greek 5, egyptian 5, taoist 5, vedic 5, yoruba 5, sufi 5, stoic 5, mekubal 4, buddhist 4, dreamtime 3, chukchi 0. | `lib/archetypes.ts` |
| 7 | Hidden lineages: `chukchi` and `dreamtime`. | `HIDDEN_LINEAGE_KEYS` in `app/LineageSelector.tsx` |
| 8 | Today the figure is named **after** the telling, by the model, via `⧁MYTH:name⧁`. The server validates it against the lineage catalog. An off-catalog name is logged as the near-miss `myth_token_off_catalog` and treated as absent. | `route.ts` (about line 941) |
| 9 | Persistence (myth ledger, visit record, markers) runs once, on the final segment, over the text assembled from server-validated history. | `assembleSegmentedReading()`, `route.ts` (about lines 1174 to 1250) |
| 10 | There is no label `INQUIRY-01` in the code. The free-text entry is `NameItYourself` (about line 413) → `routeInquiry()` → `LineageConfirm`. It routes to a **lineage** by keyword matching and always needs the seeker's confirmation. The index file's header forbids the generation path from importing it. | `app/LineageSelector.tsx`, `lib/mythRoutingIndex.ts`, `app/components/LineageConfirm.tsx` |
| 11 | There is no `myth_entry` table. The corpus table is `corpus_passage`. `retrieveForVoice` is keyed to a query string. The module header says only mekubal had approved content. `corpus/` holds JSON files for many lineages, several marked `-STAGED`. **The live database was not inspected**, so which lineages are actually grounded today is unknown. | `lib/corpusRetrieval.ts`, `scripts-resilience/`, `corpus/` |
| 12 | The reading-shape clause (150 to 220 words, open-thread closing) is an allowlist (`READING_SHAPE_REVIEWED_VOICES`, currently `norse` only) and is appended only when `segmentIndex === null`. It never applies during segmented delivery. | `lib/readingShapeClause.ts`, `system-prompt-builder.ts` (about line 291) |
| 13 | New vs returning on the client: a signed-in seeker with saved myths goes to `myth-choice`; one with a core myth statement goes to `myth-home`; everyone else to `lineage-select`. | `app/components/Threshold.tsx` |
| 14 | New vs returning on the server: `getLineageArchetype(user, lineage)` runs only for a signed-in seeker on a paid tier (Kept or above), in reading mode, with no crisis. A Seeker-tier or anonymous seeker never has a stored archetype, because the free tier persists nothing. | `route.ts` (about line 559) |
| 15 | The welfare gate runs on every turn on the latest seeker message. The dual guardian runs on every portion. A crisis notice ends a segmented Reading on the client. | `route.ts`, `CouncilTabs.tsx` (about line 642) |
| 16 | On `main`, the daily rate limit counts every request, so one segmented Reading costs up to three. `fix/segment-rate-limit` changes this (row 21). | `route.ts`, `docs/segmented-delivery.md` open decision 1 |
| 17 | Feature gating pattern: environment-driven config modules (`config/returning-features.ts`). | `config/` |
| 18 | `AGENTS.md` / `CLAUDE.md` in the repo state that this Next.js version has breaking changes and that the guides in `node_modules/next/dist/docs/` should be read before writing code. Relevant to MF-5. | `AGENTS.md` |
| 19 **[v1.1]** | FC-A is merged on `main` (#212): `migrations/030_figure_mapping.sql` and `lib/returning/figureMapping.ts`. FC-B and FC-C exist only as unmerged branches, each one commit ahead of `main` and dark behind a flag. FC-D to FC-G are not started. | `main` @ 984a4c0, branch comparisons |
| 20 **[v1.1]** | Figure continuity's "figure" is a seeker-confirmed **marker**: `visit_record.markers_confirmed.figure`, confirmed through `app/api/elder/confirm-marker`. A "home chain" is derived (a chain with a visit holding a confirmed figure). It is **not** the `ArchetypeCard` that myth-first stores as the archetype. | `docs/figure-continuity-spec.md` §2, recon item 3 |
| 21 **[v1.1]** | `fix/segment-rate-limit` (unmerged, 1 commit ahead of and 4 behind `main`): the first segment is charged to the ordinary per-IP bucket; continuations go to a separate `divine-cont:<ip>` bucket with limit `RATE_LIMIT_PER_DAY × (SEGMENT_MAX − 1)`. A Reading therefore costs one divination. It moves the `segmentIndex` computation above the limiter and moves the limiter after body parsing. Worst case with a forged `segment` is `dailyLimit × SEGMENT_MAX` model calls per IP per day. | `lib/segmentedDelivery.ts` (`divineRateBucket`), `route.ts` on that branch |
| 22 **[v1.1]** | FC-C adds a trailing optional positional parameter `figureContinuity: string = ''` to `buildSystemPrompt`, appended last, and `figureContinuityEnabled()` to `config/returning-features.ts` (three env gates, read at call time, a governance flip). | `feat/fc-c-prompt-clause` |
| 23 **[v1.1]** | `check:unwired-exports` fails any exported function in `lib/` or `src/` that has no real caller, unless it is allowlisted with a reason. | `scripts/check-unwired-exports.mjs` |
| 24 **[v1.1]** | The only required status check is `gk-007-static` (ruleset 19156061, per the figure-continuity recon). Model-facing probes are entries in the in-file `PROBES` array of `scripts/drift-detect.mjs` (24 at the time of the recon). | recon items 11 and 12 |
| 25 **[v1.1]** | FC-A took migration 030. The next free migration number is 031 (check again when writing it). | `migrations/` on `main` |

## 4. Design

### 4.1 Terms

- **Form.** `myth_first` or `story_first`. Story-first is exactly today's behavior.
- **Figure.** One `ArchetypeCard` from `LINEAGE_ARCHETYPES[lineage]`. The card's `canonicalAnchor` is the myth that gets told. **[v1.1]** In this document "figure" means this card unless the text says "figure marker".
- **Figure marker.** Figure continuity's term: the seeker-confirmed `figure` marker on a visit (fact 20). A different thing from the card. A seeker can have one without the other (section 4.9).
- **New seeker (for this feature).** No stored archetype for this user in this lineage, and no live chain. Anonymous and Seeker-tier seekers are always new (fact 14). This is per lineage, not per user (decision D2).

### 4.2 Eligibility (server-authoritative)

The client may ask for `myth_first`. The server decides. All of the following must hold, otherwise the request proceeds story-first with no other change:

1. The myth-first flag is on (section 7, MF-4).
2. `body.readingForm === 'myth_first'`.
3. `segmentIndex !== null`. That means `segmented: true`, a voice not in the exclusion set, mode `reading` or `council`, and not a deepen.
4. The lineage catalog is non-empty (this excludes chukchi).
5. **[v1.1]** Welfare allows it: `!welfare.surfaceResources` and `welfare.allowPsychopompLayer`. That is off at the distress tier as well as at crisis, matching figure continuity's decision D8 (decision D14 here). On a distress turn the seeker gets today's story-first behavior, which is already tuned for distress.
6. No `lineageArchetype` for this user and lineage, and no `chainGraft`.
7. The figure is valid: on segment 0 the selector returned a catalog name; on segments 1 and 2 the figure sent by the client matches the catalog.

A client cannot force myth-first onto a returning seeker, and cannot choose a figure from another lineage.

### 4.3 Figure selection

A small pre-pass at segment 0 only.

```ts
selectFigure({ lineageKey, seekerText, judge }): Promise<{ figure: string } | null>
```

- **Input to the model:** for each card, its `name`, `role`, and `existentialField` (not the anchors), plus the seeker's text. The seeker's text is all user turns joined and capped (about 1,500 characters), because by segment 0 the story may span an opening message and the answer to the clarifying question. The seeker text is delimited and labeled as data.
- **Output:** exactly one card name, or `NONE`. It is validated by exact match against the catalog. Anything else returns `null`. The output is never shown to the seeker.
- **Model:** Haiku-class, pinned by a new constant `FIGURE_SELECTOR_MODEL` in `lib/model.config.ts`, following how `WELFARE_MODEL` is pinned. Short timeout (about 4 seconds); a timeout returns `null`.
- **Concurrency:** start the call with the existing pre-generation batch, since it depends only on lineage and seeker text. Await it once eligibility is known. Discard it if the seeker is ineligible. A wasted call on a crisis turn is acceptable.
- **Failure:** `null` means story-first for this Reading, with a near-miss logged (`myth_first:selector_*`). Fail toward honesty: the seeker still gets a Reading.
- **"Why this myth" line:** written by the segment 0 generation itself (guardian-reviewed), not by the selector. The selector never produces seeker-facing text.

### 4.4 The three segments

Never labeled, numbered, or announced to the seeker. Same-lineage field throughout. Never a second myth.

| | Segment 0: The Myth | Segment 1: The Figure | Segment 2: The Return |
|---|---|---|---|
| `segmentIndex` | 0 | 1 | 2 (must finish) |
| Source | `canonicalAnchor`, plus passages retrieved for the figure | `role`, `existentialField`, `gift`, `shadow`, `elderQuestion` | The seeker's story (all user turns), their answers to the two earlier questions, optionally `elderQuestion` |
| Content | Tell the myth. Stay inside the anchor and any retrieved passages: add no episodes, names, or details that are not in them. One opening line says why this figure came to the fire, using at most a phrase of the seeker's own words and no interpretation of their life. | Name what the figure carries (`gift`) and what it risks (`shadow`) as properties of the figure in the myth, not as diagnoses of the seeker. May echo the seeker's answer to segment 0. | Offer the story as seen through the figure. Use the seeker's own words from their answers. No prescriptions, no predictions, no verdicts. Close on the Ceremonial Charge, one sentence. |
| Closes with | One question drawn from the telling, not "shall I continue?" | One question asking where the seeker feels this. It offers; it does not tell. | No question and no MORE token. Emits `⧁MYTH:<figure name>⧁`. |
| Length | About 70 to 110 words | About 70 to 110 words | About 130 words at most |
| MORE | Required | Required | Forbidden |

Between segments: a bare "yes" or "go on" means continue; a real answer shapes the next portion but never changes the myth being told.

### 4.5 Pipeline mapping

| Step | Today | Myth-first change |
|------|-------|-------------------|
| Client decides form | n/a | `Threshold.tsx` computes `isNewSeeker` (no saved myths, no core myth statement) and passes it to `CouncilTabs`. |
| Request | `{ messages, lineageKey, mode, segmented, segment, ... }` | Adds `readingForm?: 'myth_first'` and `figure?: string`. |
| Parse and flags | `route.ts` | Reads the two new fields. Both are advisory. |
| `segmentIndex` | `null` or clamped count | Unchanged. Myth-first requires it non-null. |
| `retrievalQuery` | Seeker text, or the opening offering on continuations | For myth-first, the figure's name plus anchor, on all three segments. |
| Pre-generation batch | consent, corpus, welfare, feedback steer, register | Selector call starts here at segment 0 (section 4.3). |
| Chain graft / lineage archetype | Computed after welfare | Used for eligibility rule 6. |
| Tier gate / rate limit | Unchanged | Unchanged. **[v1.1]** What a Reading costs against the cap is settled by `fix/segment-rate-limit` if it merges (D5). |
| Prompt build | `buildSystemPrompt(...)` | New optional trailing parameter (the figure card). See 4.7. |
| Model call, guardian | Unchanged | Unchanged. The guardian reviews each portion. |
| `moreToCome` | Honored only if the model emitted MORE | For myth-first: `segmentIndex < SEGMENT_MAX - 1`, whatever the model emitted. The token is still stripped. |
| `⧁MYTH:` token | Validated against the catalog | Expected to equal the chosen figure. On mismatch, trust the chosen figure and log a near-miss. |
| Persistence | Final segment, assembled text | Unchanged. `archetypeName` is the chosen figure. |
| Response | `text`, `moreToCome`, `archetypeName`, ... | Adds `form` and, on segment 0, `figure`. |

### 4.6 Contract

```ts
// request additions
readingForm?: 'myth_first';
figure?: string;            // card name; sent back on segments 1 and 2

// response additions
form: 'myth_first' | 'story_first';
figure?: string;            // present when form === 'myth_first'
```

If segment 0 returns `form: 'story_first'`, the client sends no `figure` afterward.

### 4.7 Prompt composition (myth-first)

- **Keep:** voice axes, ceiling protocol, language clause, age-register directives, out-of-scope handoff.
- **Replace:** the arc block, `readingModeClause`, and `segmentedDeliveryClause` become one myth-first block keyed by `segmentIndex` and the figure.
- **Seeker-derived blocks** (`psychopompAnnotationBlock`, `feedbackSteer`, `trajectoryClause`, `priorMythClause`): omitted on segments 0 and 1, applied on segment 2 only. They describe the seeker, and segments 0 and 1 are not about the seeker.
- **Reading-shape clause:** unchanged behavior. It is not appended in segmented mode.
- **Corpus grounding block:** keyed to the figure (section 4.5).
- **Default path:** when the figure parameter is null, the prompt must be byte-identical to today's for every lineage and mode. This is a tested invariant (MF-2).

### 4.8 New vs returning

| Seeker | Form |
|--------|------|
| Anonymous | myth_first, every first Reading (no memory, so see D8) |
| Signed in, Seeker tier | myth_first, every first Reading (nothing persists, so see D8) |
| Signed in, Kept or above, no archetype in this lineage | myth_first |
| Signed in, Kept or above, archetype stored in this lineage | story_first |
| Deepen continuation | Not segmented, unchanged |
| Voice in the exclusion set (maya, greek, sufi lineages) | story_first (D1) |

### 4.9 Persistence and the handoff to figure continuity

Persistence is unchanged. At the final segment the stored `archetypeName` is the chosen figure, so `upsertMythArchetype` records it. On the seeker's next visit in that lineage, `getLineageArchetype` finds it, the seeker is returning, and the story-first path runs with `renderLineageArchetypeContext`.

**[v1.1] Correction to v1.** v1 said myth-first "produces the figure that figure-continuity later picks up". That was wrong. Figure continuity continues a seeker as their confirmed **figure marker** (fact 20), and its eligibility requires a visit in the chain with `markers_confirmed.figure`. Myth-first stores a **card** as the archetype, not a marker. A new seeker who finishes a myth-first Reading is therefore a returning seeker for story-first purposes but is **not** eligible for "continue as" until they confirm a figure marker through the existing marker flow.

Whether the card should seed that marker offer is open (D15). v1 keeps them separate.

**The two forms never apply to one request.** Figure continuity needs a chain continuation (signed in, paid tier, adult, a home chain, the seeker's "continue as" choice). Myth-first needs `segmentIndex !== null` (which excludes deepen), no stored archetype in the lineage, and no chain graft. MF-2 and MF-4 add a test that the myth-first block and the figure-continuity clause never appear in the same prompt.

### 4.10 Safety and governance

- **Welfare.** Unchanged and runs every turn on the latest seeker message. **[v1.1]** Selector output is discarded on a crisis or distress turn (eligibility rule 5, D14). A crisis ends the segmented Reading as it does today.
- **Dual guardian.** Runs on every portion, including the "why this myth" line.
- **Lineage integrity.** One figure, one lineage. The selector cannot choose across lineages. Static and live checks in MF-6 enforce it.
- **Provenance honesty.** The provenance block already states whether a Reading was grounded in retrieved passages. Telling a myth is a stronger fidelity claim than a reading, so ungrounded lineages need a decision (D3).
- **Form is a per-voice claim.** Segment order is a form claim of the same class as the closing-shape clause. Voices whose written rules forbid it stay excluded (D1, MF-7).
- **Age register and COPPA.** No new persistence for the child tier. Selector input is the same text the Reading call already receives. The child tier remains blocked as today.
- **Classroom mode.** Telemetry gating is unchanged. The selector adds no new logging of seeker text.

### 4.11 Failure modes

| Failure | Behavior |
|---------|----------|
| Selector error, timeout, `NONE`, or off-catalog output | Story-first for this Reading. Near-miss logged. |
| Model omits MORE on segment 0 or 1 | Server still treats it as non-final. |
| Model emits MORE on segment 2 | Ignored and stripped (already true today at the last allowed segment). |
| `⧁MYTH:` token differs from the chosen figure | Chosen figure wins. Near-miss logged. |
| Client drops or corrupts `figure` on segment 1 or 2 | Re-run the selector against the opening offering and log a near-miss. Small drift risk accepted because the catalog is small. |
| Seeker reloads mid-Reading | Client state is lost and nothing was persisted yet. The Reading starts over. |
| Crisis signal mid-Reading | Crisis path governs and the segmented Reading ends (existing). |
| Flag off | Story-first for everyone, exactly as today. |
| Figure names in a non-English language | The catalog and token validation use English names today; this is an existing limitation, not a new one. Check in MF-6. |

## 5. Steelman: the case against, and the answers

1. **The detour.** Segment 0 tells a myth with no visible connection to the seeker, which could read as a detour. *Answer:* the "why this myth" opening line. Measure how many seekers reach segment 2 (MF-8, MF-9).
2. **Hidden interpretation.** Choosing the myth is itself a reading of the seeker's story, and they never see it. *Answer:* the in-voice reason line. Add "another myth" (MF-10, D6).
3. **Fidelity.** Telling a myth invites invented detail. *Answer:* the anchor-bound rule, retrieval keyed to the figure, and D3 for lineages without approved corpus.
4. **Cost.** One extra small model call at segment 0, and three requests per Reading. *Answer:* the selector overlaps the existing batch. **[v1.1]** On `main` the three requests all count against the daily cap; `fix/segment-rate-limit` makes a Reading cost one (D5).
5. **Free-tier repetition.** Anonymous and Seeker-tier seekers have no memory, so they can meet the same figure again. *Answer:* D8.
6. **The lineages that skip it.** Maya, greek, and sufi are excluded. Maya is the lineage with the most cards and the one closest to Stanzione's myth-telling direction. *Answer:* D1 and MF-7. The exclusion is kept until the voice owner decides.
7. **A wrong figure becomes sticky.** The selector's pick is stored as the seeker's figure at the end. *Answer:* D7. At minimum, segment 2 must handle a seeker who said the figure does not fit.
8. **It pre-empts figure continuity.** The figure is assigned by a model before the seeker has agreed to it. *Answer:* **[v1.1]** it does not pre-empt it, because figure continuity runs on a separate, seeker-confirmed figure marker (section 4.9). The stored card is only the myth-first form's own memory. The seeker's answer to the segment 1 question is still the only agreement signal for the card in v1; D7 decides whether a "no" blocks storing it.

## 6. Decisions

| ID | Question | Recommendation | Blocks |
|----|----------|----------------|--------|
| D1 | Excluded voices (maya, greek, sufi): story-first, or a whole-delivery variant? | Story-first in v1. Ask Stanzione about `ojer_tzij`. | MF-4, MF-7 |
| D2 | "Returning" per lineage or per user? | Per lineage. A seeker new to a lineage has never met one of its figures. | MF-4 |
| D3 | Lineages with no approved corpus: tell from the anchor only, or hold myth-first until grounded? | Anchor only, and keep the provenance block honest. | MF-2, MF-11 |
| D4 | The default lineage's cards use cross-tradition anchors (Chiron, Inanna, the cave fire). Allow myth-first there? | Yes. Each telling is a single myth. | MF-4 |
| D5 | Rate limit: count a Reading as one request or three? | **[v1.1] Resolved by `fix/segment-rate-limit` (36fbf04), if it merges: a Reading costs one divination.** Adopt it. MF-4 rebases onto it and MF-8 waits for it. | MF-4, MF-8 |
| D6 | "Another myth" button after segment 0: v1 or later? | Later (MF-10). | MF-10 |
| D7 | Does a seeker saying the figure does not fit block storing it as their archetype? | Yes, as a fast follow. In v1 segment 2 must at least handle it in the text. | MF-4, MF-10 |
| D8 | Seekers with no memory (anonymous, Seeker tier) get myth-first every time. Accept repetition, or alternate? | Accept in v1. Revisit with data. | MF-8 |
| D9 | Selector design: separate pre-pass (this spec), or the model picks via a `⧁FIGURE:⧁` token? | Pre-pass. The token saves a call but puts every anchor in the first prompt. | MF-3 |
| D10 | Rollout gate: global flag, or testers first? | Testers first (MF-8). | MF-8 |
| D11 | Record the form on the visit so feedback can be compared by form? | Yes (MF-9). | MF-9 |
| D12 | Exclusion mechanism: reuse `SEGMENTED_DELIVERY_EXCLUDED_VOICES`, or a separate myth-first allowlist like `READING_SHAPE_REVIEWED_VOICES`? | Reuse for v1. A separate allowlist if voice review produces different answers. | MF-1 |
| D13 **[v1.1]** | Governance review: does myth-first need Shalom's review, as figure continuity's D7 asks of its clause? | Covered by your standing decision on form-only changes (the age-register precedent). Segment order is still a per-voice form claim, handled in MF-7. Your call. | MF-8 |
| D14 **[v1.1]** | Welfare: myth-first off at the distress tier as well as crisis, matching figure continuity's D8? | Yes. Story-first is already tuned for distress, and myth-first is a story-forward move like mapping. This is welfare-adjacent gating, so it needs your explicit call. | MF-4 |
| D15 **[v1.1]** | Hand-off to figure continuity: keep the stored card and the figure marker separate, or seed the marker offer with the card name (the seeker still confirms)? | Separate in v1. Seeding needs a read of marker extraction (`lib/returning/markers.ts`, `markerExtractor.ts`) and the confirm-marker route, which this spec has not done. | none in v1 |
| D16 **[v1.1]** | Where does the myth-first flag live? | In `config/returning-features.ts` beside the others, one env var `MYTH_FIRST_ENABLED`, read at call time as `figureContinuityEnabled()` is. Not a governance flip. | MF-4 |

Figure continuity's own decisions D1 to D9 are mapped to these in section 10.

## 7. Build plan

Each PR is meant to be reviewable on its own. Main is protected, so every one goes through a feature branch and a PR. Sizes are relative (S, M, L).

### MF-0: Docs and ground truth (S)

- **Scope:** commit this spec. Fix `docs/segmented-delivery.md` (status is stale; fact 2). Add a pointer from it to this document.
- **Files:** `docs/myth-first-spec.md`, `docs/segmented-delivery.md`.
- **Done when:** both merged. No code.
- **Depends on:** nothing. **[v1.1]** `fix/segment-rate-limit` also edits two rows of `docs/segmented-delivery.md`; the status-line fix is a separate hunk, so either order works, but rebase whichever lands second.
- **Rollback:** revert.

### MF-1: Core module, pure (S to M)

- **Scope:** `lib/mythFirst.ts`, with no SDK or database imports. Contains: types; `getCatalog(lineageKey)`; `findCard(lineageKey, name)`; `mythFirstEligibility(input)`, pure, covering rules 1 to 7 of section 4.2; `mythFirstClause(segmentIndex, card)`; the myth-first arc block.
- **Tests:** `lib/mythFirst.test.ts`, added to the `test:unit` chain in `package.json`. Cover: the eligibility matrix (each rule failing alone); the clause for segments 0, 1, 2 (MORE allowed on 0 and 1, forbidden on 2); no labeling words ("part one", "next"); length targets match the constants in `segmentedDelivery.ts`; every card in every lineage renders a clause with no `undefined`.
- **Done when:** `npm run test:unit` green. No behavior change anywhere.
- **[v1.1] Unwired exports.** `check:unwired-exports` (a `gk-007-static` step) fails exported `lib/` functions with no real caller. Pure functions that wait for MF-4 would fail it. Either land MF-1 and MF-3 together with their first caller, or allowlist each export in `scripts/check-unwired-exports.mjs` with a real reason and remove the entries in MF-4. FC-B and FC-C took the allowlist route.
- **Depends on:** MF-0. **Rollback:** revert.

### MF-2: Prompt builder (M)

- **Scope:** `buildSystemPrompt` gains an optional trailing parameter (the figure card, default null). **[v1.1]** FC-C already adds a trailing optional parameter, `figureContinuity: string = ''`. Whichever PR merges second rebases and appends its parameter last. FC-C appends its clause at the end of the prompt; myth-first swaps blocks inside `_buildPromptBody`, so the two do not collide in text. When present: swap the arc, reading-mode, and segmented blocks for the myth-first block; omit seeker-derived blocks on segments 0 and 1; include them on segment 2 (section 4.7). Add `scripts/check-myth-first-register.mjs`, a register guard modeled on `check-opening-register.mjs` (no instructive imperatives, no prescriptions or predictions, no higher-self or chosen-one language, no labeling words, required figure anchor). Add `npm run check:myth-first` and a step beside `check:purpose` in `.github/workflows/gk-007.yml`.
- **Tests:** a byte-identical-when-null check across every lineage and mode (hash the prompt before and after); with a figure, the "whole arc, unbroken" instruction is absent; seeker-derived blocks present only on segment 2; **[v1.1]** a prompt never contains both the myth-first block and the figure-continuity clause. Extend `system-prompt-builder.test.ts` and `segmentedDelivery.test.ts`.
- **Done when:** unit tests and the new register check green in CI. **[v1.1]** The new check step goes in the `gk-007-static` job, the only required check.
- **Depends on:** MF-1. **Rollback:** revert; default path untouched.

### MF-3: Figure selector (M)

- **Scope:** `lib/mythFirstSelector.ts` (kept separate from MF-1 so the pure module stays SDK-free). `FIGURE_SELECTOR_MODEL` in `lib/model.config.ts`, pinned. Judge injection in the same shape as `welfareJudge`. Input hardening and validation per section 4.3. Anomaly notes `myth_first:selector_*` through the existing `logAnomaly` path.
- **Tests:** with a fake judge: valid name; `NONE`; off-catalog name; seeker text that tries to instruct the selector; timeout; empty catalog; text over the cap.
- **Done when:** tests green. Not yet called by the route. **[v1.1]** Same unwired-export rule as MF-1.
- **Depends on:** MF-1. **Rollback:** revert.

### MF-4: Route wiring, behind a flag (L)

- **Scope:** **[v1.1]** `mythFirstEnabled()` in `config/returning-features.ts` (D16): one env var, `MYTH_FIRST_ENABLED`, default off, read at call time like `figureContinuityEnabled()`. In `app/api/divine/route.ts` (**[v1.1]** rebase onto `fix/segment-rate-limit` first; it moves the `segmentIndex` computation above the limiter, so the line numbers in this spec shift): read `readingForm` and `figure`; start the selector with the pre-generation batch at segment 0; evaluate eligibility; set the retrieval query from the figure; build the prompt with the figure; make `moreToCome` authoritative; set `archetypeName` from the chosen figure and log token mismatches; add `form` and `figure` to the response; skip all of it on crisis and distress turns (D14) and for excluded voices. Re-run the selector if `figure` is missing on segment 1 or 2. **[v1.1]** `readingForm` and `figure` are client-sent, and `segment` is already client-sent; a forged `segment` gains at most the continuation allowance (fact 21), and eligibility rule 6 stops a returning seeker from being moved to myth-first.
- **Tests:** follow the request-level assertions in `scripts/signal-system-test.mjs`, which CI already runs (check how it stubs the model before extending it). Cases: flag off gives an identical response shape; flag on, new seeker, segments 0 to 2; returning seeker gets story-first; crisis mid-Reading; **[v1.1]** distress turn gets story-first; excluded voice gets story-first; selector failure gets story-first; client sends a figure from another lineage; a deepen request is never myth-first.
- **Done when:** all of the above pass, and a flag-off run is indistinguishable from today. **[v1.1]** Remove any allowlist entries added in MF-1 and MF-3.
- **Depends on:** MF-2, MF-3, and (for rebase and the cap) `fix/segment-rate-limit`. **Rollback:** flag off; revert if needed.

### MF-5: Client wiring (M)

- **Scope:** `Threshold.tsx` computes `isNewSeeker` (no saved myths and no core myth statement) and passes it to `CouncilTabs`. `CouncilTabs.tsx` sends `readingForm: 'myth_first'` while there is no first Reading and the seeker is new; holds the figure in a ref like `segmentsRef`; sends it back on segment 1 and 2; reads `form` and `figure` from the response; resets with each new Reading. No change to `ReadingSegment` rendering or to the closing ritual. Read the Next.js guides named in `AGENTS.md` before writing code (fact 18).
- **[v1.1] Shared files.** FC-E also edits `Threshold.tsx` and `CouncilTabs.tsx` (the arrival choice and offer controls). Keep each edit small and flag-gated, and rebase whichever PR lands second. Figure continuity's own risk table names these two files and `route.ts` as its merge-conflict hot spots.
- **Tests:** type check and build; manual script in section 8. I did not find component unit tests in the repo, so do not assume any.
- **Done when:** with the flag on, a new seeker gets three segments end to end, with the closing ritual, card, journal, and letter firing once at the end.
- **Depends on:** MF-4. **Rollback:** revert; the server ignores a missing `readingForm`.

### MF-6: Probes and purity (M)

- **Scope:** extend `scripts/lineage-purity.mjs` with a static check, with no model: for every lineage and every card, the segment 0 prompt contains that card's anchor and no other lineage's anchor text, and the default lineage's anchors (Chiron, Inanna, the cave fire) appear only there. **[v1.1]** Add myth-first cases as entries in the in-file `PROBES` array of `scripts/drift-detect.mjs` (that is where figure continuity puts its probes), and wire any new static check into `gk-007-static`: cross-lineage leakage on each segment; the seeker's story leaking into segment 0; prescriptive language on segment 2; a seeker answering "this doesn't fit" on segment 1. Run `npm run verify` (gk-007 and drift-detect). Check a non-English `languageName` against figure-name validation.
- **Done when:** static checks green in CI; live probes reviewed.
- **Depends on:** MF-4. **Rollback:** revert.

### MF-7: Voice form review (S, process)

- **Scope:** add a "myth-first form" section to `docs/reading-shape-voice-review.md` or a sibling doc, in the same format (one row per voice, the form claim, who reviews, status). Keep the three exclusions. Draft the question for Stanzione on `ojer_tzij`; sending it is Jesse's call as the relationship holder. **[v1.1]** Figure continuity's pre-flip checklist also needs a review with Stanzione (counterpart choices for `ojer_tzij`), so one conversation can cover both. Record any decision in the same commit that changes the exclusion set, as that file already requires.
- **Done when:** the review doc is merged with each voice marked.
- **Depends on:** MF-0. Runs in parallel with the engineering PRs.

### MF-8: Rollout (S)

- **Scope:** stage 1, flag on for tester accounts only (the route already identifies tester accounts). Stage 2, on for everyone. Watch: how many seekers reach segment 2; selector near-miss rate; token-mismatch rate; daily-cap hits; guardian rejections on myth-first portions; "landed / did not land" signals once MF-9 records the form. Rollback is turning the flag off; environment changes need a redeploy on Vercel.
- **Done when:** stage 2 has run for an agreed period with no regression in the above.
- **Depends on:** MF-4, MF-5, MF-6, and **[v1.1]** `fix/segment-rate-limit` merged. Without it, every new seeker's Reading costs three divinations against the daily cap.

### MF-9: Record the form (M, recommended)

- **Scope:** **[v1.1]** a migration (031 or the next free number; FC-A already took 030) adding a coarse `reading_form` column to the visit record; write it at persistence; split the feedback tally by form so the two forms can be compared. Journal label optional.
- **Depends on:** MF-4. **Rollback:** the column is additive.

### MF-10: "Another myth" (M, optional, D6 and D7)

- **Scope:** after segment 0, a quiet control that asks for a different figure in the same lineage: request field `figureExclude`, selector excludes it, available only before segment 1. Also the D7 behavior: if the seeker says the figure does not fit, do not store it.
- **Depends on:** MF-4, MF-5.

### MF-11: Ungrounded lineages (S to M, depends on D3)

- **Scope:** implement the D3 decision: either an anchor-only rule plus honest provenance wording, or a per-lineage gate that holds myth-first until approved corpus exists.
- **Depends on:** D3, MF-4.

### Order

MF-0, then MF-1. Then MF-2 and MF-3 in parallel. Then MF-4, MF-5, MF-6. MF-7 runs alongside any of them. MF-8 after MF-6. MF-9, MF-10, MF-11 after MF-4.

**[v1.1] Relative to figure continuity and the rate-limit fix.** The two features are independent and can land in either order. Shared files are `lib/system-prompt-builder.ts` (MF-2 with FC-C), `app/api/divine/route.ts` (MF-4 with FC-D), `app/components/Threshold.tsx` and `CouncilTabs.tsx` (MF-5 with FC-E), and `config/returning-features.ts` (MF-4 with FC-C). Rebase whichever lands second. `fix/segment-rate-limit` should merge before MF-4.

## 8. Manual QA script

1. Anonymous seeker, norse lineage: three segments, a myth in the first, no mention of the story beyond the opening line, closing ritual once.
2. Same, in each other selectable lineage that is not excluded (egyptian, taoist, vedic, yoruba, stoic, mekubal, buddhist) and the default lineage.
3. Maya, greek, sufi: story-first, delivered as today.
4. Signed-in seeker with a stored archetype in the lineage: story-first.
5. Signed-in seeker with a stored archetype in a different lineage, entering a new one: myth-first (D2).
6. Seeker gives a thin first message: one clarifying question first, then myth-first.
7. Crisis phrasing on segment 1: crisis path, segmented Reading ends.
8. Selector made to fail (flag or fault injection): story-first, no error shown.
9. Model made to omit MORE on segment 0: still three segments.
10. Reload mid-Reading: starts over, nothing stored.
11. Child and young-adult registers (where enabled): shorter segments, same order.
12. Seeker answers "this doesn't fit" on segment 1: segment 2 handles it in the text without asserting the figure.

## 9. Not verified

- Live model behavior: whether segment 0 reliably stays inside the anchor, and whether segment 2 stays unprescriptive.
- Which lineages have approved rows in `corpus_passage` in production.
- **[v1.1]** Figure continuity code beyond what section 10 cites. The FC spec, build plan and recon were read in full, along with the FC-C and rate-limit patches. Not read: `lib/returning/markers.ts`, `markerExtractor.ts`, the confirm-marker route, the FC-C clause file and its tests, and the FC-B route code (only its file list). D15 depends on the marker files.
- How `scripts/signal-system-test.mjs` stubs the model (MF-4 depends on this).
- The exact line numbers above; they will drift. The unmerged branches will also move, so re-check section 10 against them before MF-2 and MF-4.

## 10. Reconciliation with figure continuity and the rate-limit branch **[v1.1]**

Sources: `docs/figure-continuity-spec.md` (v0.2), `-build-plan.md` and `-recon.md` on `docs/figure-continuity-recon` (a14b239); FC-B (0d5f68f) and FC-C (a6304f4) branches; `fix/segment-rate-limit` (36fbf04).

### 10.1 Summary

- **Different features that never meet in one request.** Figure continuity (FC) is for a returning, signed-in, paid seeker who continues as a confirmed figure marker. Myth-first (MF) is for a seeker with no stored archetype in the lineage, on a first Reading. Section 4.9 states the exclusion and MF-2 and MF-4 test it.
- **One real conflict, now fixed in this spec.** v1 said myth-first "produces the figure" FC picks up. It does not. FC's figure is a confirmed marker; MF stores a card. Section 4.9 and fact 20 are corrected, and the hand-off is a decision (D15).
- **D5 is resolved** by `fix/segment-rate-limit`, if it merges.
- **Four new decisions** (D13 to D16) come from FC decisions that apply to MF as well.
- **Numbering.** FC's D1 to D9 and MF's D1 to D16 are separate sequences and several numbers collide (FC D5 is about per-chain mappings; MF D5 is the rate limit). Cite them as "FC D5" and "MF D5".

### 10.2 FC decisions mapped to MF

| FC decision | Status in FC | Effect on MF | MF item |
|---|---|---|---|
| D1 Forget declined offers, or tombstone | open | None. MF stores no offers or declines. | none |
| D2 Cap of 30 confirmed mappings | open | None. MF adds no per-user rows. | none |
| D3 Stateless taste for the free Seeker tier | open | Related, not conflicting. FC is off on the Seeker tier. MF is on for it and for anonymous seekers, and they get myth-first every first Reading (MF D8). If FC D3 gives the tier a taste of mapping, that is a later deepen or thread turn, which MF never touches. | MF D8 |
| D4 Minors off (child, young_adult) | open, default off | **Differs.** FC is off for both minor registers. MF as written keeps the child tier blocked as today and applies the form to young_adult where that register is enabled (QA script item 11). Not a conflict, since MF stores nothing new, but the two features would differ for one seeker. Confirm that young_adult may get myth-first. | MF-4, QA 11 |
| D5 Mappings per chain, or carried across chains | open, default per chain | None. Neither feature crosses lineages. MF keeps one figure in one lineage. | none |
| D6 Mapping block on deepen and thread turns only | open, default yes | **Consistent.** MF requires `segmentIndex !== null`, which excludes deepen. The two forms occupy different turns, which is what section 4.9 relies on. If FC D6 changes to include first readings, the mutual-exclusion test in MF-2 and MF-4 is what catches the overlap. | MF-2, MF-4 |
| D7 Shalom review of the clause | open | Same question for MF. MF changes segment order and what each segment says, which is form. | MF D13 |
| D8 Off at distress as well as crisis | **decided 2026-10-04: yes** | Same reasoning applies to MF: the psychopomp layer is already suppressed at distress and myth-first is a story-forward move. Welfare-adjacent gating, so it needs the same explicit call. | MF D14 |
| D9 Delete mappings when a chain loses its last visit | **decided 2026-10-04: delete** | None for the mappings. MF-9's `reading_form` column lives on the visit row and goes with it through the existing release paths. No new release code. | MF-9 |

### 10.3 Structural touchpoints

| Area | Figure continuity (or the rate-limit branch) | Myth-first | Resolution |
|---|---|---|---|
| What "figure" means | A confirmed marker (`markers_confirmed.figure`), chain-scoped, seeker-confirmed | A card from `LINEAGE_ARCHETYPES`, chosen by the selector, stored via `upsertMythArchetype` | Terms table (4.1) now distinguishes the two. Hand-off is D15. |
| "Returning" | Has a home chain with a confirmed figure marker | Has a stored archetype in the lineage | A seeker can be MF-returning and not FC-eligible. That is expected (4.9). |
| `buildSystemPrompt` | FC-C appends `figureContinuity: string = ''` as the last positional parameter | MF-2 appends a figure-card parameter | MF-2 adds its parameter after `figureContinuity` and rebases if FC-C is not yet merged. Test that both blocks never appear together. |
| Feature flag | `figureContinuityEnabled()` in `config/returning-features.ts`, three env gates, governance flip | New `MYTH_FIRST_ENABLED` in the same file | D16. One env var, not a governance flip. |
| Welfare gate | `!surfaceResources` and distress off (FC D8) | Same two conditions, in eligibility rule 5 | D14. |
| Tiers | Signed in and Kept or above | All tiers, anonymous included | Different on purpose. Forms are chosen per request on the server. |
| Registers | Adult only | Adult, plus young_adult where enabled | See FC D4 row. |
| Segment length and shape | FC offers obey "short, one question" and the reading-shape band | Segments obey `segmentedDeliveryClause` and skip the shape clause | Compatible. The shape clause is already skipped when segmented. |
| Release paths | FC deletes mappings explicitly (no FK) | No new table | Nothing to add. |
| Counterpart check against `corpus_passage` | Keyed by `lineage_key` (the recon fixed the column name) | `retrieveForVoice` keyed by the figure's name and anchor | Same lineage key; MF-3 and MF-4 use the lineage key as FC does. |
| Migrations | FC-A took 030 | MF-9 needs the next free number | 031 or later; check at write time. |
| CI and probes | `check:unwired-exports`, required check `gk-007-static`, `PROBES` in `scripts/drift-detect.mjs` | MF-1 allowlists its unwired exports until MF-4 wires them, MF-6 adds probes | MF-1 and MF-6. |
| Client files | FC-E touches `Threshold.tsx` and `CouncilTabs.tsx` | MF-5 touches the same two | Whichever lands second rebases. |
| Rate limit | `fix/segment-rate-limit` charges segment 0 to the ordinary bucket and continuations to `divine-cont:<ip>` | MF-4 uses the same segment flow | MF D5. Merge the fix before MF-4, and before MF-8 rollout. |
| Governance review | FC D7 | MF D13 | One conversation can cover both (MF-7). |

### 10.4 Merge order and conflicts

1. `fix/segment-rate-limit` first (it is 4 commits behind `main` and needs a rebase).
2. MF-0 to MF-3 are independent of FC.
3. FC-C and MF-2 both edit `lib/system-prompt-builder.ts`. FC-D and MF-4 both edit `app/api/divine/route.ts`. FC-E and MF-5 both edit `Threshold.tsx` and `CouncilTabs.tsx`. Expect mechanical conflicts, not design conflicts.
4. MF-8 (rollout) waits for the rate-limit fix and for D14.

### 10.5 What needs your call

- **D14:** myth-first off at distress. Welfare-adjacent, so explicit.
- **D13:** whether myth-first needs Shalom's review or is covered by your standing form-only decision.
- **D15:** keep the card and the figure marker separate (recommended in v1), or seed the marker offer.
- **D16:** the flag location.
- **FC D4 row:** whether young_adult gets myth-first.

## Appendix: code anchors

| Area | File and symbol |
|------|-----------------|
| Segment constants and clause | `lib/segmentedDelivery.ts`: `SEGMENT_MAX`, `MORE_TOKEN`, `segmentedDeliveryClause`, `assembleSegmentedReading`, `SEGMENTED_DELIVERY_EXCLUDED_VOICES` |
| Prompt assembly | `lib/system-prompt-builder.ts`: `buildSystemPrompt`, `_buildPromptBody`, the arc block |
| Route | `app/api/divine/route.ts`: `segmentIndex`, `retrievalQuery`, the pre-generation batch, `chainGraft`, `lineageArchetype`, `moreToCome`, the `MYTH` token handling, persistence |
| Figure catalog | `lib/archetypes.ts`: `LINEAGE_ARCHETYPES` |
| Lineage to voice | `lib/lineageToVoiceKey.ts` |
| Archetype persistence | `lib/mythLedger.ts`: `getLineageArchetype`, `upsertMythArchetype`, `renderLineageArchetypeContext` |
| Inquiry entry | `app/LineageSelector.tsx` (`NameItYourself`, `HIDDEN_LINEAGE_KEYS`), `lib/mythRoutingIndex.ts`, `app/components/LineageConfirm.tsx` |
| Client flow | `app/components/Threshold.tsx`, `app/components/CouncilTabs.tsx`, `app/components/ReadingSegment.tsx` |
| Retrieval | `lib/corpusRetrieval.ts`: `retrieveForVoice` |
| Model pinning | `lib/model.config.ts`: `WELFARE_MODEL` |
| Feature config | `config/returning-features.ts` |
| CI | `.github/workflows/gk-007.yml`, `package.json` scripts |
