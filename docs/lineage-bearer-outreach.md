# Lineage-Bearer Outreach — Templates

## Why this exists

Of the twelve voices in `lib/traditions.ts`, only two have a real, named,
identifiable tradition-bearer who has actually reviewed and attested the
voice: `kiche` (Vincent James Stanzione — see
`governance/signoffs/2026-06-28-lineage-gate-trajectory-stanzione.md`) and
`yoruba` (Fama Aina Udoyi — see the `governanceNote` on the `yoruba` entry
in `lib/traditions.ts`). `mekubal` and `buddhist` also have real named-holder
grants in the `consent_grant` table (Getzel Davis, Shalom Ormsby).

Seven voices do not: **greek (Pythia), sufi, norse (Völva), taoist (Sage of
the Way), vedic (Rishi), egyptian (Hem-netjer), stoic**. Each is live with
`governanceStatus: "active"` on a `consent_grant` row that is only a
Temporal Bridges Institute placeholder — a generalist's operational
judgment call, not a tradition-bearer's consent. `governance/checklist.yaml`
row `F15-AUTH` names this same gap; its "AuthorizationStatus" code-level
tracking was later removed (2026-08-20, explicit project-owner decision —
see commit `bfbdcce`) as a *blocking gate*, but the underlying credibility
gap it was tracking was never actually closed, only unblocked from stopping
generation. This doc is the "reach" half of closing it for real: outreach
material to actually go get a named bearer's review, not more code.

**What "closing" a voice looks like, concretely:** a bearer reviews the
voice's `tradition` boundary text (and ideally a sample reading or two,
once one exists) and either ratifies it, asks for revisions, or declines.
Whatever they decide gets written up as a
`governance/signoffs/YYYY-MM-DD-<slug>-<surname>.md` file following
`governance/signoffs/TEMPLATE.md` — the same artifact format used for
Stanzione and Udoyi. A decline or a request for revisions is not a failure
of this process; it's the process working. Do not chase a "yes."

**Do not send these as-is.** Each is a starting draft — you know which real
people or institutions to actually approach; the bracketed fields need a
real name, and the tone should be adjusted to however you'd actually reach
that person (cold email, a mutual introduction, a community/institution's
contact form). Nothing here should be sent to anyone before you've reviewed
and personalized it.

---

## General template (email or message)

```
Subject: Reviewing an AI voice speaking from [tradition] — asking for your read

Hi [Name],

I'm building The Elder, an AI myth-and-divination instrument that includes
a voice speaking from within [tradition name] — [role/title, e.g. "a
Sheikh," "a Rishi," "a Völva"]. I'd like to ask you, as someone with real
standing in this tradition, to review what that voice is built to say and
tell me honestly whether it's faithful or whether it's appropriative,
flattened, or wrong.

Right now this voice runs on my own generalist reading of the tradition —
not on anyone's actual authorization. I don't want to keep presenting it
as legitimate without someone who actually holds this knowledge telling me
so. If your answer is "this shouldn't exist" or "this needs to change
significantly before it's acceptable," that is a completely fine answer
and I will act on it — including turning the voice off if that's the right
call.

What I'm asking, concretely:
  1. Review the attached boundary description — what the voice draws from,
     what it's told never to touch, and its language register [attach the
     tradition/canonAnchors/forbidden text from lib/traditions.ts for this
     voice].
  2. Tell me what's wrong, missing, or offensive in it.
  3. If you're willing, tell me whether you'd be comfortable being named as
     having reviewed it — with exactly what scope you're comfortable
     attesting to (the whole voice, just this text, a revised version,
     etc.). I keep a written record of exactly what was approved, by whom,
     and when — nothing broader than what you actually agreed to.

There's no obligation here and no pressure toward a "yes" — I'd rather
have an honest "no" or "not like this" than a courtesy approval.

Thank you for considering it,
[Your name]
```

---

## Per-voice packets

Each of these is the material to attach/quote alongside the general
template above — pulled directly from the voice's current
`tradition`/`canonAnchors`/`forbidden` fields in `lib/traditions.ts`, so
the reviewer is looking at exactly what's live, not a paraphrase.

### Pythia (Greek oracular) — `greek`
**Who to look for:** a scholar of ancient Greek religion specializing in
oracular/Delphic tradition, or a practicing Hellenic polytheist with
standing in that community.
**What's live:** the Delphic oracle, Apollo's prophetic mantle, the pneuma
at the omphalos, chresmoi (oracular verses), Homeric/Hesiodic cosmology.
Explicitly forbidden: Roman deity names for Greek gods, mixing in Stoic
philosophy as if the same tradition.

### Sufi — `sufi`
**Who to look for:** a Sufi teacher (murshid) or scholar of Islamic
mysticism able to speak to whether fana/baqa/dhikr and the Rumi/Ibn Arabi
canon are being represented faithfully. Note for credibility: the code
previously carried a fabricated claim of authorization by a named
"El Atigh Abba" that turned out not to correspond to any real record —
see PR #126. Any real outreach for this voice should not reference that
name.
**What's live:** fana, baqa, dhikr, the maqamat, Rumi's Masnavi, Ibn
Arabi's fusus al-hikam, the silsila. Explicitly forbidden: borrowing from
any non-Islamic mystical tradition.

### Völva (Norse/Germanic) — `norse`
**Who to look for:** a scholar of Old Norse religion/seiðr practice, or a
practitioner within a Heathen/Norse pagan reconstructionist community with
relevant standing.
**What's live:** seiðr, the Poetic and Prose Eddas, runes, Yggdrasil and
the Nine Worlds, the Norns. Explicitly forbidden: mixing in Greek, Sufi,
Vedic, Egyptian, Stoic, or Taoist material.

### Sage of the Way (Taoist) — `taoist`
**Who to look for:** a scholar of classical Taoism or a Taoist practitioner
who can distinguish the Tao Te Ching/Zhuangzi textual tradition from later
religious Taoism or from popular "Eastern wisdom" flattening.
**What's live:** the Tao Te Ching, Zhuangzi's inner chapters, wu wei, te,
yin/yang. Explicitly forbidden: conflating with Buddhism or Confucianism.

### Rishi (Vedic) — `vedic`
**Who to look for:** a scholar of Vedic/Upanishadic literature, or a
practitioner with standing in a Vedic/Vedantic tradition. Note for
credibility: the code previously claimed this voice was "lineage-reviewed"
with no reviewer ever named anywhere — see PR #126. Treat this as
genuinely unreviewed, not as "just needs the review written down."
**What's live:** the four Vedas, principal Upanishads, Brahman/Atman,
dharma, mantra. Explicitly forbidden: conflating with Buddhism or Taoism.

### Hem-netjer (Egyptian) — `egyptian`
**Who to look for:** an Egyptologist specializing in ancient Egyptian
religion, or a practitioner of Kemetic reconstructionism with relevant
standing.
**What's live:** the Ennead, Ma'at, the Duat, the Book of Coming Forth by
Day, Thoth, the ba/ka/akh. Explicitly forbidden: Greek, Roman, or other
tradition bleed (including Roman-syncretism framings of Isis).

### Philosopher of the Stoa (Stoic) — `stoic`
**Who to look for:** a scholar of ancient Stoicism, or someone active in
contemporary Stoic practice communities (e.g. Modern Stoicism) with real
depth in the primary texts, not just popular self-help Stoicism.
**What's live:** logos, the dichotomy of control, the four cardinal
virtues, Epictetus/Marcus Aurelius/Seneca/Zeno/Chrysippus. Explicitly
forbidden: conflating with the (separate) Greek oracular voice, or with
Platonic/Epicurean philosophy.

---

## After a bearer responds

- **Ratifies as-is or with minor notes:** write up
  `governance/signoffs/YYYY-MM-DD-<voice-slug>-<surname>.md` per
  `governance/signoffs/TEMPLATE.md`, quoting the exact text they reviewed
  and hashing it. Insert a real `consent_grant` row for them (see
  `scripts/seed-mekubal-grant.mjs` / `scripts/seed-bhikkhu-grant.mjs` for
  the pattern), replacing the Temporal Bridges Institute placeholder row.
  Update the voice's `governanceNote` in `lib/traditions.ts` to cite the
  real bearer, the way `yoruba`'s does.
- **Asks for revisions:** make the revisions, then send the revised text
  back for a second look before writing a signoff — don't write "ratified"
  against text they haven't actually seen.
- **Declines, or doesn't respond:** the voice stays exactly as it is now —
  live, but honestly commented as un-reviewed (per PR #126's fix), not
  flipped off unilaterally. Whether to keep an unreviewed voice live is a
  product decision, not something this doc resolves.
