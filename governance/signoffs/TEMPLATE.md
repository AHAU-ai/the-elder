# Sign-Off — <Scope Title>

<!-- FILENAME: governance/signoffs/YYYY-MM-DD-<scope-slug>-<signer-surname>.md
     - Date = the date of the actual decision, not the date the file is written
     - scope-slug = short kebab-case description (e.g. appendix-b-synthetic-intimacy-ceiling)
     - signer-surname = lowercase surname of the person signing (e.g. ormsby, stanzione)
-->

**Signer:** <Full name (role)>
**Date:** <YYYY-MM-DD — date of the actual decision>
**Scope:** <One or two sentences: what exactly was decided, and why it matters. Should be specific enough that someone with no context understands what this gate controls.>

**Gate:** <What downstream condition this signoff satisfies or partially satisfies — e.g. "One of N conditions for `SOME_FLAG=true`" — plus what else is still required if this isn't the last piece.>

**Decision:** <Ratify | Ratify with revisions | Decline | Approve | Confirm — pick the verb that matches what was actually decided>

<!-- If "Ratify with revisions" or "Decline," add a **Revisions / Reasons:** section here
     spelling out exactly what changed or what's missing before this can close. -->

---

## Ratified text (exact scope)

<!-- Quote the EXACT text that was approved — verbatim, not paraphrased or summarized.
     This is what gets hashed. If the approved artifact is long (a full spec, a full
     ceiling document), quote it in full here or link to the exact committed file +
     commit SHA and hash that file's contents instead of pasting megabytes into this doc. -->

> <exact approved text>

**Content-hash (SHA-256):** `<sha256 of the quoted text above, computed verbatim — no trailing whitespace differences>`

<!-- Compute with: printf '%s' "<exact text>" | sha256sum -->

## Primary evidence

<!-- Prefer a git commit over a chat transcript wherever one exists — a commit SHA is
     independently verifiable by anyone with repo access; a chat log is not.
     Use whichever of the two blocks below actually applies, delete the other. -->

**If backed by a git commit:**
- **Commit:** `<full 40-char SHA>`
- **Author / committer:** <name> (`<email>`)
- **Date:** <commit date>
- **Message:** `<commit subject line>`
- **File:** `<path>`, <section/entry reference>

**If backed only by a conversation / message (no commit exists):**
- **Source:** <where — Slack thread, email, chat log link>
- **Date:** <date of that message>
- **Note:** <why no commit exists yet, and whether one should be created to upgrade this evidence pointer later>

## Countersignature

**Jesse Barber** — recorded this <backfilled | live-captured> artifact <YYYY-MM-DD>, per ARCH-03 (Sign-Off Artifact Standard + Backfill).

---

*<One line: is this a backfill of a prior chat-only decision, or a signoff captured at time of decision? State which, per ARCH-03's rule that future gates close only via artifact.>*
