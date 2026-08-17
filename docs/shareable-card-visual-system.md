# Shareable Card — Visual System

Status: implemented.
Decided: 2026-08-15 (AI-art question first raised in an earlier session;
settled here). Last updated: 2026-08-16 (CardQuote branded type added).

This is a decision record. It documents what was chosen and why, so the
reasoning survives outside a chat thread. It is not a spec — where this
document and the code disagree, the code is what ships, and this file
should be corrected.

## No AI-generated imagery, ever

The card (`app/components/ShareableCard.tsx`) needed a visual field beyond
plain text. A diffusion model was considered and rejected: asked for
K'iche'/Ifá/Theravada-adjacent visuals, it produces ceremonial-looking
fabrication trained on scraped, unauthorized source imagery — the same
integrity violation Lineage Integrity of Voice exists to prevent, just in
a picture instead of a sentence. A fabricated image is indistinguishable
to the seeker from an authentic one, which makes it worse than a
fabricated sentence, not better.

The fix that fits: a **templated visual system**, not a generated one.
Every marker (wound / threshold / pattern / exile / figure) has a fixed
glyph, and every authorized voice has a fixed accent color
(`lib/mythopoetics/cardConfig.ts`, `MARKER_GLYPHS` / `accentForVoice`).
The glyph *is* the card's art. This is the same authorization-artifact
logic as the rest of the card: nothing appears that wasn't deliberately
placed there by someone accountable for it.

Per-voice accent overrides are gated by `AUTHORIZED_ACCENTS` — a voice
only gets its own color once its tradition-bearer has reviewed it,
independent of whether the voice itself is authorized to speak. Everything
unreviewed renders with the shared default gold.

**If a future pass wants a richer background:** it has to stay inside
this templated system (more glyph variants, palette refinement, layered
SVG ornament like the existing rings/corner brackets) — not a generated
image. This is a hold-the-line note for future sessions, not an
invitation to revisit the tradeoff.

## Layout: content-sized, not fixed-aspect

The card was originally `aspectRatio: '4 / 5'` with `overflow: hidden`. That
produced two visible bugs:

- Short quoted lines left a large dead margin (empty space).
- Long quoted lines pushed the dedication line and footer past the fixed
  height, and `overflow: hidden` clipped them silently (disappearing text).

Fixed by dropping the fixed aspect ratio for a `minHeight` floor — the card
now sizes to its actual content. This only works if content has a real
ceiling, so a length cap was added on the display side
(`MAX_LINE_CHARS = 170` in `ShareableCard.tsx`).

## Line selection: last-sentence pull, only past the cap

`line` reaches `ShareableCard.tsx` two ways, from two call sites:
`CouncilTabs.tsx`'s "Keep This Gift" → `onKeepAsCard` passes
`content.returnGift` from `lib/psychopompLayer.ts` unedited — a full
paragraph (~250-315 characters), not a short line; `Threshold.tsx`'s
"Make this your card" (a text-selection popover over the reading) passes
whatever the seeker deliberately highlighted, usually already short but
not guaranteed to be.

If the text already fits under the cap, it's shown exactly as given —
untouched. That matters even for the auto-populated case: some
`returnGift` paragraphs are themselves short and multi-sentence (*"What is
in your prohairesis... And the duty you now return to, undistorted."*,
142 chars), and always extracting "the last sentence" would silently drop
the first sentence even though nothing needed cutting.

Only past the cap does extraction kick in, and it takes the *last*
sentence rather than truncating from the front. That prose is
consistently written to close on a short, aphoristic final sentence —
*"Delphi gives the question, not the answer."*, *"The return gift must be
given, not kept."* — so the last sentence beats keeping the setup and
cutting the payoff.

If `returnGift` copy is ever rewritten, keep ending each one on a short,
self-contained closing clause — the over-cap path depends on that
convention, not just on length.

## Share-link content mismatch (fixed)

`createShareLink()` used to POST the raw `line` prop to `/api/share`,
not `displayLine` (the `pullQuote()` output actually rasterized into the
PNG via `html-to-image`). `shareLedger.ts` stores up to 500 characters
and `SharedCardView.tsx` (the public `/share/[id]` page) renders whatever
was stored — so a signed-in seeker's downloaded/shared image could show
the short pulled quote while the public link and Journal entry
(`MythicJournal.tsx`) showed the full uncut paragraph. Fixed by sending
`displayLine` instead: what's rasterized is now what's persisted and
what's public.

## CardQuote: making the mismatch impossible to reintroduce, not just fixed

The bug above was found by manually tracing every consumer of `line` —
that guarantee decays the moment a new consumer is added and nobody
re-traces. `CardQuote` (`lib/mythopoetics/cardConfig.ts`) turns it into a
type: `type CardQuote = string & { readonly __brand: 'CardQuote' }`,
producible only by `pullQuote()`.

`ShareableCard`'s `line` prop, `shareLedger.createShareCard`'s `line`
param, and `ShareCardEntry.line` all require `CardQuote`, not `string`.
`ShareableCard.tsx` no longer calls `pullQuote()` internally — callers
(`CouncilTabs.tsx`, `Threshold.tsx`) call it before setting `cardLine`
state, so the exact same value is what's rasterized into the PNG and
what's sent to `/api/share`; there is no second "raw line" anywhere in
the render path for a future edit to send to only one of them.

Two sanctioned casts re-establish the brand where compile-time checking
can't reach:

- `app/api/share/route.ts` — the request body arrives over the wire as an
  unchecked string, so the brand can't be trusted by construction here.
  The route now validates against the real ceiling (`MAX_LINE_CHARS`,
  exported from `cardConfig.ts` — previously a looser, separate `500`)
  before casting, so a modified or hostile client can't bypass the
  branding client-side and post a full paragraph anyway.
- `shareLedger.ts`'s `rowToEntry` — casts `row.line` back to `CardQuote`
  on the strength of `createShareCard` being the only writer.

What this doesn't cover: any future code that reads `share_card.line`
outside this type graph (a raw SQL query in a new script, a hand-rolled
admin view) bypasses the brand entirely — it's a compile-time guarantee
for TypeScript callers, not a database-level constraint.
