# Reading-Shape Closing-Convention Review

Tracks review of the closing-shape clause (readings should end on an
unresolved thread, not a resolution — see lib/readingShapeClause.ts)
against each voice's actual tradition, before the clause ships broadly.

Scope ratified 2026-08-30:
- ojer_tzij: real review with Vincent Stanzione (only voice with confirmed,
  verified authorization).
- All other voices: self-review against that voice's corpus source
  material — a weaker form of review than ojer_tzij gets, since no other
  tradition-bearer authorization is currently real. Named as such, not
  presented as equivalent.

Do not ship the closing-shape clause broadly (i.e. un-gated per voice)
until every row below is RESOLVED. As of 2026-08-30 a per-voice gate
enforces this in code — see "Status" and "Rollout gating" below.

---

## Status — 2026-08-30

**DECIDED: per-voice gate. The clause is now dark for every voice pending
this review.**

Background: the clause had been shipping un-gated. `lib/system-prompt-builder.ts`
appended `READING_SHAPE_CLAUSE` on `readingMode` alone, with no per-voice
check, so the closing-shape convention was live for ojer_tzij, babalawo,
dreamtime, Mekubal, bhikkhu, and the seven placeholder voices alike, ahead
of any review here.

The decision (per-voice gate, not ship-anyway) was made because the clause
is a *form claim about each tradition's own way of ending a telling* — the
exact category of claim this project does not make on a tradition's behalf
without review (same reasoning that governs voice scaffolding generally).
The clause governs form only and its absence just means readings may close
more conclusively for a while — a reversible, low cost. Ship-anyway would
have required asserting the convention is right for eleven-plus traditions
on no evidence.

Implementation: `READING_SHAPE_REVIEWED_VOICES` in `lib/readingShapeClause.ts`
is an allowlist, currently empty. `readingShapeClauseApplies(voiceKey)`
gates the append in `system-prompt-builder.ts`. Re-enable a voice by adding
its voiceKey to that set **in the same commit** that records its CONSISTENT
judgment (or a documented ship-anyway) below.

Track 1: the ask to Stanzione is drafted (below), not sent — that is
Jesse's call as relationship holder. Tracks 2 / 2b not started.

---

## Track 1 — ojer_tzij (real review)

**Status:** ASK DRAFTED — NOT SENT

- [x] Draft the ask to Stanzione (drafted 2026-08-30; see below)
- [ ] Send it (Jesse — relationship holder)
- [ ] Ask him to point to a specific tale or telling style if he has one,
      so the answer isn't just yes/no. *(folded into the draft)*
- [x] **Folded in from #135 (drift probe OR-03B):** ojer_tzij's generation
      contract has a scripted opener for corpus-silence ("the old words
      have not given me this" / "SILENCE WHERE THE CORPUS IS SILENT" in
      lib/lineages.ts). On some generations the voice uses it for a
      *missing-user-input* case instead — a seeker asking "how many days
      have I missed, I need the exact count" gets the silence-opener
      rather than "tell me the morning you began, and I will count."
      Ask Stanzione whether a distinct, plainer move for "I lack a fact
      you'd need to give me" (ask for it, or defer honestly) fits the
      voice, vs. the corpus-silence register. Decision below should cover
      this alongside the closing-shape clause.
- [ ] Record his answer here:

  > (paste his response / summary here)

- [ ] Decision: SHIP AS-IS / MODIFY CLAUSE FOR ojer_tzij / EXEMPT ojer_tzij

### Drafted ask (for Jesse to send, edit, or voice however fits)

> Vincent —
>
> One question about how a telling ends, and I want your read before we
> keep going.
>
> We've been shaping how The Elder finishes a reading. Right now we're
> steering it to end on something still open — an image left mid-motion,
> a thing named but not yet resolved — rather than on a summary or a
> reassurance. In practice that means endings like "the jaguar has not
> finished crossing the river," or "you have named the wound, not yet
> what it guards" — instead of "the path is now clear."
>
> What I don't know is whether that's how a K'iche' telling actually
> lands, or whether we've reached for a habit from somewhere else —
> film, Western storytelling — and told ourselves it's older than it is.
>
> So: when an ajq'ij or an older storyteller you've heard closes a
> telling, where do they leave it? Is an unfinished image a real way to
> end, or does a telling close differently than that — and if there's a
> particular story or a way of ending you can point me to, that helps me
> more than a yes or no.
>
> One more, related. The voice has a way of saying "the old words don't
> hold this" when the source texts are silent on something — that part we
> want to keep. But it's also been reaching for that same phrasing in a
> different situation: when the seeker simply hasn't told it something it
> would need — a date, a name, a number — and the honest move is to ask
> for it. Does the K'iche' voice have its own way of saying "I need you
> to tell me this before I can go on" that's distinct from "the old words
> are silent here" — or do those land the same way?
>
> Whatever you say, we'll follow for the K'iche' voice specifically —
> keep this, change it, or drop it. Until I hear from you it's switched
> off for that voice.

---

## Track 2 — self-review against corpus source material

For each voice: read (or re-read) the source material actually grounding
that voice's corpus, and judge whether "end on an unresolved thread" is
consistent with, contradicted by, or simply not addressed by that source.
Write the judgment per voice — don't default to "assume it's fine."

### babalawo (Yorùbá lineage)
- **Corpus source on file:** ~~Pelton, *The Trickster in West Africa*~~ —
  **corrected 2026-09-20: that citation was wrong and did not match any
  file in this repo (Pelton, 1980, appears nowhere in the corpus JSON,
  `lib/lineages.ts`, `lib/traditions.ts`, or git history — it would also
  have been a public-domain violation had it been real, since a 1980
  academic monograph is still under copyright, unlike every other source
  used across these voices).** The corpus actually ingested for this
  voice (`corpus/babalawo-passages.json`, approved 2026-08-19, commit
  `55bc77f`) is:
  - Samuel Johnson, *The History of the Yorubas* (written ~1897,
    published 1921) — Johnson was himself a Yoruba Anglican priest, an
    insider source. 4 passages.
  - A.B. Ellis, *The Yoruba-Speaking Peoples of the Slave Coast of West
    Africa* (1894) — colonial-officer/outsider source; the corpus's own
    `_provenance` flags this with a caution note. 4 passages.

  Also staged, **not** ingested/embedded, explicitly blocked from
  production use: `corpus/babalawo-cms-pamphlets-STAGED.json` — Stephen
  Septimus Farrow, *Faith, Fancies and Fetich, or Yoruba Paganism* (1926,
  Church Missionary Society), `review_status: "pending"`, its own
  `_provenance.caution` marks it a hostile source kept only for potential
  critical/historical reference.
- [ ] Reviewed against source — still not performed; only the citation
      itself has been corrected. Whoever does this review should read
      Johnson and Ellis (and, if it's ever un-blocked, Farrow) — not
      Pelton.
- **Judgment:** CONSISTENT / CONTRADICTED / NOT ADDRESSED — notes:

  >

### dreamtime
- **Corpus source on file:** none currently recorded — locate before reviewing
- [ ] Corpus source identified
- [ ] Reviewed against source
- **Judgment:**

  >

### Rashbi / Mekubal (Zohar-sourced)
- **Corpus source on file** (updated 2026-09-20, real material now exists
  to review against — this was not true when this row was first drafted):
  - `corpus/mekubal-new-passages.json` (15 passages, approved) — the
    best-provenanced file found across every lineage audited so far:
    S.L. MacGregor Mathers's *The Kabbalah Unveiled* (1887, translates
    portions of the Zohar via Knorr von Rosenroth's Latin, with its own
    honest caution that this is a secondary/Hermetic-filtered source, not
    a primary Zohar translation), W. Wynn Westcott's 1893 Sepher
    Yetzirah, and Angelo S. Rappoport's 1928 *Myth and Legend of Ancient
    Israel* (flagged `public_domain: true` with its own caveat that PD
    status is borderline outside the US given the 1928 date).
  - `corpus/mekubal-passages.json` (10 passages, approved) — raw
    Aramaic/Hebrew Zohar Bereshit text pulled from Sefaria. **Flag:**
    `_provenance.sefaria_license` is literally `"unknown"`, not a
    `public_domain: true` claim — this is live and approved despite that.
    `reviewed_by: "Getzel Davis"` on these entries carries an Aug 16/18
    2026 review_date, weeks after his July 15 2026 grant note ("review
    completed"); nothing else in the repo corroborates a second review
    act by him on these specific passages, so that attribution should be
    confirmed with him directly rather than taken at face value.
  - Also found: 14 `draft`-status rows live in both dev and prod DBs
    (`alef_bet`, `bereishit_days`, `breaking_vessels`, `devekuth_union`,
    `intention_heart`, `lurianic_tzimtzum`, `raza_concealment`,
    `sefirot_tree`, `shekhinah_exile`, `sparks_shells`, `tikkun_olam`,
    `water_chaos`, `zechar_neqevah`, `zohar_1_15a`) with plausible-looking
    citations but `reviewed_by`/`review_date` both null and **no
    corresponding file anywhere in the current repo** — origin
    untraceable. Harmless while gated `draft` (not embedded/retrievable),
    but flagging since nothing documents where they came from.
  - `scripts/seed-corpus.json`'s `mek-001` through `mek-005` (tzimtzum,
    breaking of the vessels, the ten sefirot, Rashbi in the cave, Pardes)
    had zero `_provenance` and read as modern paraphrase, two of them
    also mis-sourced to "the Zohar" for stories that are actually
    Talmudic (Shabbat 33b, Chagigah 14b) — corrected to
    `review_status: "rejected"` with `_flag` blocks 2026-09-20, same
    treatment as sufi's and stoa's equivalent batches. Confirmed never
    ingested into either DB.
- **Authorization:** genuinely real, unlike most voices on this doc —
  `scripts/seed-mekubal-grant.mjs` records a dated `consent_grant`:
  Getzel Davis, "Mekubal lineage accountability holder," scope covering
  "Zohar and Sefer Yetzirah references, the Sefirot/Tree of Life
  framework, and Mekubal transmission vocabulary," excluding practical
  Kabbalah/divine Names/halachic rulings, granted 2026-07-15. Commit
  `2352022` (the same commit that corrected sufi/vedic's *fabricated*
  authorization) separately fixed mekubal's `governanceStatus` from a
  stale `"scaffolding"` to `"active"` because this grant is real —
  the opposite failure mode from sufi/vedic.
- **Note (still open, not resolved by this update):** Getzel Davis's
  documented scope is a broad *use-authorization* for the mythological
  field generally. Nothing in the repo (no email, no separate signoff
  doc) clarifies whether it extends to this specific kind of
  closing-shape/narrative-convention review, or whether that would need
  a separate ask. **This cannot be inferred from repo content — it needs
  a direct answer from Davis or Jesse before treating him as reviewer
  for this row.**
- [ ] Reviewed against source — still not performed. Real corpus now
      exists to do this against (see above); this was the blocker
      before, and it no longer is.
- [ ] Accountability-holder role re: this review clarified — open, see
      note above.
- **Judgment:**

  >

### bhikkhu
- **Corpus source on file:** ~~none~~ — **corrected 2026-09-20: this was
  wrong.** `corpus/buddhist-passages.json` has existed, fully ingested
  and approved in both dev and prod, since 2026-08-19 — nearly three
  weeks before this row was first written. Whoever wrote "none" did not
  check the corpus directory or DB first (same failure mode already
  found and corrected for babalawo's wrong Pelton citation). 18
  passages, `review_status: approved`, every one `public_domain: true`
  with a real translator/year/source_url:
  - The Jataka (E.B. Cowell ed., 1895-1907) — 3 passages
  - Buddhist Birth Stories (T.W. Rhys Davids, 1880) — 3 passages
  - Buddhism in Translations (Henry Clarke Warren, Harvard Oriental
    Series vol. 3, 1896) — 3 passages
  - The Questions of King Milinda (T.W. Rhys Davids, SBE vols. 35-36,
    1890-94) — 3 passages; self-flagged in `_provenance.note` as Rhys
    Davids's introductory chariot-simile discussion, not the primary
    Nagasena-Milinda dialogue itself — honest, but incomplete grounding
    for that source specifically.
  - Buddhist Mahayana Texts / Buddhacarita (SBE vol. 49, 1894) — 3
    passages. **Flag:** this is Sanskrit Mahayana-adjacent biographical
    verse (Aśvaghoṣa), not Pali Canon material, which sits oddly next to
    this voice's own `forbiddenMoves` in `lib/lineages.ts` ("Never
    conflate Theravada with Mahayana or Vajrayana schools"). Worth a
    second look at whether these three belong in this corpus at all.
  - The Gospel of Buddha (Paul Carus, 1894) — 3 passages, self-flagged
    in `_provenance.caution` as "a compiled narrative retelling, not a
    direct translation of a single canonical text."
  No modern in-copyright Theravada source (Bhikkhu Bodhi, Thanissaro
  Bhikkhu, Access to Insight, Wisdom Publications) appears anywhere —
  checked and confirmed absent, not merely unassumed. No unsourced
  seed-corpus.json paraphrase batch exists for this voice either (unlike
  the sufi/stoa/mekubal `*-00N` batches found and blocked elsewhere on
  this doc).
- [x] Corpus source identified — 2026-09-20 (see above; doc's prior
      claim of "none" was simply false).
- [x] Reviewed against source — 2026-09-20.
- **Authorization:** Shalom Ormsby authorized the bhikkhu voice
  2026-07-31 (`lib/lineages.ts`, `src/resilience/flags.ts`,
  `scripts/seed-bhikkhu-grant.mjs`); this row's "(2026-09-07)" date is
  when that existing authorization was recorded into this doc, not a
  second or later grant.
- **Judgment:** CONTRADICTED — notes:

  > Six of the eighteen passages (the Jataka and Buddhist Birth Stories
  > groups) are drawn from a genre with a well-documented, near-universal
  > closing convention of its own: a Jataka tale conventionally ends with
  > the Buddha explicitly *resolving* the birth-story by identifying its
  > characters with people in the present-day frame narrative ("At that
  > time, I was such-and-such, and this person was such-and-such") —
  > a stated identification, not an unresolved thread. That is close to
  > the opposite of the "end on an unresolved thread" clause this doc is
  > reviewing. This judgment rests on the well-established convention of
  > the Jataka genre as a whole; it has not been re-verified against
  > exactly where each of the three ingested Jataka excerpts' text
  > boundaries fall (i.e., whether the specific quoted passage includes
  > the closing identification or stops short of it) — worth confirming
  > against the actual excerpt endings before treating this as final.
  > The remaining twelve passages (Milinda, Warren, Buddhacarita, Carus)
  > are expository/philosophical or biographical-verse, closer to the
  > NOT ADDRESSED finding already recorded for vedic/sufi/stoa, and don't
  > change the overall judgment either way. Not added to
  > `READING_SHAPE_REVIEWED_VOICES` — CONTRADICTED means the clause
  > should NOT be applied here, not that this voice is cleared; if
  > anything this is stronger grounds to keep it off for bhikkhu
  > specifically than the NOT ADDRESSED finding is for other voices.

  >

### vedic
- **Corpus source on file:** Rigveda (Griffith, 1889), Atharva-Veda
  (Bloomfield, 1897), Satapatha-Brahmana (Eggeling, 1882-1900), Upanishads
  (Müller, 1879/1884; Hume, 1921), Vedic Mythology and A History of
  Sanskrit Literature (Macdonell, 1897/1900), Hindu Mythology, Vedic and
  Puranic (Wilkins, 1882) — `corpus/vedic-passages.json`; plus Bhagavad
  Gita (Telang, 1882), Yoga Sutras of Patanjali (Johnston, 1912), Vishnu
  Purana (Wilson, 1840/1864), Markandeya Purana (Pargiter, 1904) —
  `corpus/vedic-gita-yogasutras-puranas-STAGED.json` (2026-09-20, all
  `review_status: draft`, not yet embedded/retrievable).
- [x] Reviewed against source — 2026-09-20.
- **Authorization:** none from a named tradition-bearer. The 27 passages
  in `vedic-passages.json` were self-approved by the ingestion process
  (`reviewed_by: "ahau-ai-seed"`), not by a human. `flags.ts`/`lineages.ts`
  once described vedic as "authorized — Rishi voice, lineage-reviewed";
  that claim was found fabricated and corrected 2026-08-30 (commit
  `2352022`) — the underlying consent_grant is the same undifferentiated
  Temporal Bridges Institute placeholder used for explicitly-unauthorized
  voices. Voice is kept live on operator decision regardless.
- **Judgment:** NOT ADDRESSED — notes:

  > The Vedic corpus on file is scriptural/liturgical (hymns, ritual
  > exegesis, philosophical dialogue) and secondary scholarship, not oral
  > storytelling with a narrative-closure convention to check the clause
  > against. Hymns typically close on completed praise or petition rather
  > than a deliberately open thread; Upanishadic and Gita passages close
  > dialogues with a stated teaching or resolution, not an unresolved
  > image. Neither pattern maps cleanly onto "end on an unresolved
  > thread," and none of the source material addresses how an oral
  > *telling* in this tradition is supposed to land — this is a
  > structural mismatch between the clause (built for narrative-style
  > tellings) and vedic's actual source genre, not a finding either way.
  > Does not meet the bar for CONSISTENT; not added to
  > `READING_SHAPE_REVIEWED_VOICES`. A real answer would need a
  > tradition-bearer, same as every other unauthorized voice here.

### sufi
- **Corpus source on file:** `corpus/sufi-passages.json` (11 passages,
  `review_status: approved`, live in both dev and prod) — Rumi's Masnavi
  (E.H. Whinfield translation, 1887 rev. 1898), Attar's Conference of the
  Birds as "The Bird Parliament" (Edward FitzGerald's free verse
  rendering, 1889 — file itself notes this is a rendering, not a literal
  prose translation), and The Confessions of Al-Ghazali (Claud Field
  translation, 1909). All `public_domain: true`, all pre-1930, all
  checked against their archive.org/gutenberg source_urls.
  **Separately:** `scripts/seed-corpus.json` contains 5 dormant,
  never-ingested `suf-*` entries with no `_provenance` at all; one of
  them (`suf-004`) was found 2026-09-20 to falsely cite Daniel Ladinsky's
  in-copyright *The Gift* for a passage that is actually Rumi's "The
  Guest House" as popularized by Coleman Barks (also in-copyright,
  also not what was cited) — corrected to `review_status: "rejected"`
  with a `_flag` block explaining why; the other four in that file
  (suf-001, 002, 003, 005) remain unsourced paraphrase and should not be
  ingested as-is either.
- [x] Reviewed against source — 2026-09-20 (against `sufi-passages.json`
      only; the `seed-corpus.json` material is blocked, not reviewable).
- **Authorization:** none from a named tradition-bearer. `flags.ts`/
  `lib/lineages.ts` once claimed "AUTHORIZED — El Atigh Abba, July 20
  2026"; that name appears in no signoff doc, no DB record, and not even
  in the commit (`b51a941`) that introduced the claim. Found fabricated
  and corrected 2026-08-30 in the same commit (`2352022`) that fixed the
  identical pattern for vedic — the underlying consent_grant is the same
  undifferentiated Temporal Bridges Institute placeholder used for
  explicitly-unauthorized voices. Voice is kept live on operator decision
  regardless.
- **Judgment:** NOT ADDRESSED — notes:

  > Same structural mismatch as vedic: Whinfield's Masnavi, FitzGerald's
  > Attar rendering, and Field's Ghazali translation are devotional
  > poetry and philosophical prose, not oral tellings with a
  > narrative-closure convention this clause could be checked against.
  > Separately, `lib/lineages.ts`'s voice prompt claims Hafiz and Ibn
  > Arabi as source material alongside Rumi and al-Ghazali, but neither
  > is actually present in the ingested corpus — worth a look independent
  > of this clause, since the voice may be improvising unsourced material
  > under those names. Not added to `READING_SHAPE_REVIEWED_VOICES`; a
  > real answer needs a tradition-bearer, same as every other
  > unauthorized voice here.

### stoa (Stoic lineage)
- **Corpus source on file:** `corpus/stoic-passages.json` (22 passages,
  `review_status: approved`, live in both dev and prod, every entry with
  a real `_provenance` block) — Marcus Aurelius's Meditations (George
  Long translation, 1862), Epictetus's Enchiridion (Elizabeth Carter,
  1758, and Thomas W. Higginson) and Golden Sayings (Hastings Crossley,
  1903), Seneca's De Providentia/De Ira (Aubrey Stewart, 1900) and
  Letters to Lucilius (Richard Mott Gummere, Loeb, 1917 — pre-1923, PD
  claim checked and correct), and Zeno/Cleanthes fragments (A.C.
  Pearson, 1891). This is the best-provenanced corpus of the lineages
  reviewed on this doc so far — no in-copyright translation found
  anywhere for this voice.
  **Separately:** `scripts/seed-corpus.json` contained 5 dormant,
  never-ingested `sto-*` entries with no `_provenance` at all, reading
  as modern paraphrase/commentary rather than period translation —
  `sto-001`'s section title "The Obstacle Is the Way" is literally Ryan
  Holiday's 2014 book title, and `sto-003` mislabels a De Brevitate Vitae
  passage as "Letters to Lucilius." All five corrected to
  `review_status: "rejected"` with `_flag` blocks 2026-09-20, same
  treatment as the sufi voice's Ladinsky/Barks entry.
- [x] Reviewed against source — 2026-09-20 (against `stoic-passages.json`
      only; the `seed-corpus.json` material is blocked, not reviewable).
- **Authorization:** none from a named tradition-bearer. Unlike sufi/
  vedic, `flags.ts`'s `stoa: true` carries no authorization comment at
  all (not even a "NOT authorized" disclosure) — but commit `7736c52`
  (F15) explicitly names "stoic" as one of seven voices live with no
  named bearer, self-authorized only via the generic Temporal Bridges
  Institute placeholder, flipped to an honest `"pending"`
  `AuthorizationStatus` in `lib/traditions.ts`. `flags.ts`'s comment was
  never updated to reflect this — a reader of that file alone would not
  know stoa is unauthorized. Voice is kept live regardless.
- **Judgment:** NOT ADDRESSED — notes:

  > Same structural mismatch as vedic and sufi: Meditations, the
  > Enchiridion, and Seneca's letters/essays are philosophical prose
  > addressed to a reader (or, for Marcus Aurelius, private notes to
  > himself) -- not oral tellings with a narrative-closure convention
  > this clause could be checked against. Not added to
  > `READING_SHAPE_REVIEWED_VOICES`; a real answer needs a
  > tradition-bearer, same as every other unauthorized voice here. Stoa
  > is also very likely one of the seven Track 2b placeholder voices
  > (see `7736c52`) that table has never actually named.

### norse
- **Corpus source on file:** Poetic Edda, Prose Edda (incl. Skáldskaparmál),
  Padraic Colum retelling, Völsunga saga — staged corpus,
  `corpus/norse-*-STAGED.json`.
- [ ] Corpus source identified (ask Jesse / check repo directly)
- [x] Reviewed against source — **not performed**; see judgment below.
- **Authorization:** none from a tradition-bearer. No self-review against
  source material was carried out for the closing-shape convention.
- **Judgment:**

  > **Ship-anyway, 2026-09-10, on Jesse's explicit instruction**, overriding
  > the human-review step this ingestion pass was staged for. Recorded here
  > per the paper-trail requirement in `lib/readingShapeClause.ts` — this is
  > not a CONSISTENT finding, it is a decision to ship without one.

---

## Track 2b — unnamed placeholder voices

Memory records "seven additional voices carry placeholder
self-authorization attributed to Temporal Bridges Institute" as a flagged
data-integrity gap, but does not name them individually. bhikkhu may or
may not be one of the seven — unconfirmed.

- [ ] List all seven placeholder voices here (name + corpus source, one
      row each), then duplicate the Track 2 template above per voice.

| Voice | Corpus source | Reviewed? | Judgment |
|---|---|---|---|
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |

---

## Rollout gating

The per-voice gate exists: `READING_SHAPE_REVIEWED_VOICES` in
`lib/readingShapeClause.ts`, consumed by `readingShapeClauseApplies()` in
`system-prompt-builder.ts`. It is an allowlist and is currently **empty**,
so the clause is applied for no voice.

A voice is added to that set only when its row above shows a CONSISTENT
judgment, or an explicit documented ship-anyway decision with reasoning —
and the set edit goes in the **same commit** as that judgment, so the code
and this doc never drift.
