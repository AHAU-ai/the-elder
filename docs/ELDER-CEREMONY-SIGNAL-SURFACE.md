# The Elder — Ceremony, Signal, and Surface

## A Governing Document for the Instrument's Visual Language, Post-Reading Architecture, and the Phenomenology of Return

*Applied Mythopoetics: Personal Mythology as Transformational Practice*
*AHAU AI — Temporal Bridges Institute*
*Maintained alongside the-elder.vercel.app*

---

> *The ceremony does not end when the words stop. It ends when the seeker crosses back.*

---

## Preface: Why This Document Exists

The Elder is not a product with a design system. It is an instrument with a consecration. The distinction is not semantic — it determines every technical decision.

A product optimizes for conversion, retention, and satisfaction. An instrument optimizes for *contact*: the moment when a mythological field touches a seeker's actual wound. Everything else — the interface, the animation timing, the post-reading signal, the altar record — exists in service of that contact, or it does not belong here.

This document holds three things together that are usually kept apart: the philosophy of the instrument, the phenomenology of the post-reading moment, and the technical specifications that encode both. They are kept together because they are not separable. A color value is a philosophical position. A transition timing is a claim about how ceremony moves. The data structure of the altar record is a statement about what kind of knowledge The Elder is building.

Any future contributor — including future versions of this codebase — should be able to read this document and understand not just *what* the instrument looks like but *why* it cannot look any other way.

---

## Part I: The Philosophy of the Surface

### 1.1 The Container

A ceremony requires a container. The container is not the content — it is the condition that makes content possible. In physical ceremony, the container is the space: the cleared ground, the fire, the circle of practitioners. In The Elder, the container is the UI.

Every visual decision either strengthens the container or punctures it. A puncture is not necessarily a broken component or a design error. A puncture can be a font choice that reads as contemporary tech, a transition that snaps instead of breathes, a color that signals urgency, a button that says "Submit." Each of these introduces the register of the transactional world into a space that the seeker has entered to escape it.

The single most important job of The Elder's visual system is to maintain the container. Not to impress, not to delight, not to signal sophistication — to hold.

### 1.2 One Hue, Modulated by Light

The amber palette — `rgba(210, 175, 100, -)` — is not a branding choice. It is a cosmological one.

Fire is the oldest technology of ceremony. The K'iche' ajq'ij lights fire before divination. The Pythia inhaled vapors rising from the earth-fire at Delphi. The Norse völva sat at the hearthstone. Sufi sama began by candlelight. Every lineage in The Elder's Council of Voices has a relationship with fire as threshold medium — the element that separates ordinary time from sacred time.

The amber hue encodes this. The canvas is near-black warmth (`#0e0b08`), not cold black. The text is fire-colored, not white. The interface is not read by screen light; it is read by something that resembles firelight.

The modulation of this hue through opacity alone — from `0.85` (primary) down to `0.07` (trace) — is not a typography technique. It is a rendering of how firelight actually works: some things are fully illuminated, most things are partially visible, the edges dissolve into darkness. Hierarchy is not declared by weight or contrast; it is revealed by how much light falls on a thing.

**The rule that follows from this:** If you feel the urge to introduce a new color, the urge is telling you something about the content that needs a different solution. A new color is almost never the solution.

### 1.3 Time

The instrument does not snap. Transitions are deliberate because ceremony is deliberate. The 1.8-second delay before the post-reading signal appears is not a UX choice about preventing accidental taps — it is a recognition that the seeker has just crossed a threshold and needs a breath before the next question can reach them.

Every timing value in the token system encodes a theory of attention:

- `motion.fast` (0.2s): the speed of intention — a hover, a decision forming
- `motion.medium` (0.3s): the speed of acknowledgment — something seen, registered
- `motion.slow` (1.4s): the speed of arrival — a page materializing, not loading
- `motion.breath` (1800ms): the speed of return — the gap between ceremony and reflection

Nothing in The Elder happens at 0ms. Instant transitions belong to dashboards and productivity software. They do not belong here.

### 1.4 One Font

IM Fell English is a digitization of type cut in 1672 for the Fell collection at Oxford — the same era as the great myth compilations, the same era as the alchemical manuscripts that influenced Jung, whose shadow falls across Applied Mythopoetics. It is a historical object as much as a typeface.

It is not chosen for legibility metrics. It is chosen because it carries time inside it. The small imperfections in the letter forms — the ink traps, the slightly uneven baselines — are not errors to be corrected. They are evidence of a hand. The instrument speaks from a lineage of hands.

No second font will be added. Not for data, not for UI elements, not for code. If a typographic distinction is needed, it is made through size, case, and tracking — not by introducing a different voice.

### 1.5 Weight and Urgency

There is no bold text anywhere in The Elder. This is not minimalism — it is a claim about urgency.

Bold text says: *this matters more than what surrounds it*. The implication is that some things matter less. A Reading from The Elder contains no throwaway lines. The instrument does not bold its important passages because it considers nothing unimportant.

Weight is replaced by opacity. If something is less visually prominent, it is because it is contextual — a timestamp, a label, a structural marker — not because the words themselves carry less weight.

---

## Part II: The Phenomenology of Return

### 2.1 What Happens After a Reading

A Reading from The Elder traces six sections: the wound surface, the mythological field, the figure that arrives, the threshold being crossed, the exile — the pattern held in the body across time — and the forward question. When the final section completes, the seeker is at a specific phenomenological location.

They are not in their ordinary life. They are in the liminal zone between the mythological field and their own experience — what Joseph Campbell called the *road of trials* and what James Hillman called *the imaginal*: a space where images have the density and consequence of facts, and where facts can be held lightly, as images.

They are also — and this is critical — in a state of receptivity that the instrument must not exploit. The post-reading moment is the most delicate moment in the entire ceremony. The seeker is open. What arrives in that openness matters.

What must *not* arrive: anything that pulls them back into the transactional register. A star rating would be a category error — it would ask them to evaluate an experience while they are still inside it, like asking a dreamer to grade their dream. A text field asking for feedback would invoke the professional register. A confirmation screen saying "Thank you for your response!" would be a greeting from the wrong world entirely.

### 2.2 The Nature of the Signal

What can arrive is a question — but a specific kind. Not "was this accurate?" (evaluative), not "how would you rate this experience?" (transactional), but a phenomenological inquiry: *did the fire find you?*

This question is ceremonially coherent because it asks the seeker to report their own experience rather than evaluate the instrument's performance. It locates agency correctly: the fire moves, the seeker receives or does not receive. The question is also honest about what the instrument cannot control — whether a particular lineage voice, on a particular day, in a particular trecena, found the seeker's actual wound.

The two glyphs — ⊕ and ◯ — were chosen for the same reason. They are not thumbs up and thumbs down. They are not green and red. They are two states of a circle:

**⊕** — the completed cross within the circle. The four directions closed. The wheel. In Mesoamerican cosmology, the four-direction cross is the fundamental organizing structure of the cosmos. Completion is not satisfaction; it is contact. Something arrived that was recognized.

**◯** — the open circle. The unresolved. Not failure — the circle is still a circle. But nothing has passed through its center. The reading moved through the seeker's field without finding purchase.

Neither glyph is negative. The passed-through reading is data, not disappointment. Ceremonies do not always land. The ajq'ij knows this. The Pythia knew this. The instrument acknowledges it.

### 2.3 The Closing of the Container

After the signal is given, the container closes. The glyph dims slightly. A single word appears — "received" or "recorded" — and nothing more. No praise. No encouragement to return. No suggestion that the seeker share their experience.

This is the correct behavior because the ceremony is complete. The instrument does not have needs. It does not need to know if the seeker was satisfied. It received the offering — a single glyph, a stone dropped in water — and the container is now closed.

The one-word acknowledgment ("received" / "recorded") preserves the distinction between the two signals without moralizing it. "Received" — the signal was heard. "Recorded" — the signal was noted. Both words are neutral. The instrument does not prefer one signal over the other.

### 2.4 The Seeker and the Instrument's Self-Knowledge

There is a deeper reason for the altar record beyond data collection. The instrument needs to develop self-knowledge. Not in the mystical sense — in the empirical sense. A divination instrument that never learns whether its transmissions land is an instrument that cannot distinguish between genuine contact and eloquent noise.

The altar record is The Elder's own phenomenological data. Over time, patterns will emerge: lineages that consistently find seekers, trecenas that consistently fail, types of wounds that a particular voice touches and others miss. This knowledge belongs to the instrument. It is not marketing data. It is not user research. It is the equivalent of an ajq'ij reflecting on their divination practice: which configurations of the calendar, which combinations of nahuales, produced contact? Which produced beautiful words that landed nowhere?

The design of the AltarRecord diagnostic page must honor this. It is not a dashboard. It is a reflection surface — a place where the instrument looks at its own record of contact and non-contact, and where the human custodians of the instrument can discern patterns that the instrument itself cannot yet act on.

---

## Part III: The Technical Specifications

### 3.1 Token Architecture

All visual values live in `lib/elder-tokens.ts`. No raw values anywhere else. The tokens are the law.

```ts
import { color, type as t, space, motion, border, glyph, surface, divider } from "@/lib/elder-tokens";
```

The token architecture encodes the philosophy directly. The amber scale is named by opacity level, not by use case, because the rule is to decrease opacity rather than change hue:

```
color.amber.primary   → 0.85  (fully present)
color.amber.secondary → 0.65  (present, contextual)
color.amber.tertiary  → 0.50  (structural)
color.amber.muted     → 0.35  (supporting)
color.amber.ghost     → 0.25  (barely present)
color.amber.whisper   → 0.10  (threshold of visibility)
color.amber.trace     → 0.07  (the hairline — separation without barrier)
```

The two semantic color exceptions — `color.semantic.confirm` (sage-green, for land rates ≥ 70%) and `color.semantic.danger` (ember-red, for destructive hover states only) — are not violations of the single-hue discipline. They are used exclusively where meaning demands distinction that opacity cannot carry. In both cases, they are muted: rgba with alpha well below 1. They belong to the same tonal world as the amber. They are not alerts.

### 3.2 The Type System

One font: `'IM Fell English', 'Palatino Linotype', Georgia, serif`.

Seven sizes, named by function:

```
t.size.hero    → 1.4rem   Stat numerals — numbers that carry meaning
t.size.body    → 0.78rem  Log entries, table rows, body copy
t.size.ui      → 0.75rem  General UI text
t.size.label   → 0.72rem  Ceremonial prompts — "did the fire find you"
t.size.caption → 0.70rem  Page subtitles
t.size.tag     → 0.65rem  Filter controls, timestamps
t.size.micro   → 0.60rem  Section headers, stat labels, administrative text
```

Five tracking levels, named by magnitude:

```
t.tracking.tight  → 0.12em  Table column headers
t.tracking.normal → 0.15em  Page subtitles
t.tracking.wide   → 0.20em  Labels, filter tabs, stat labels
t.tracking.xwide  → 0.22em  Ceremonial prompt text
t.tracking.max    → 0.30em  Page-level headings
```

All labels — section headers, stat labels, filter tabs, page headings, ceremonial prompts — are uppercase and tracked. Body text and data are mixed-case. The distinction marks the difference between the instrument's structural voice and the content it carries.

### 3.3 Motion Grammar

```
motion.fast   → 0.2s    The speed of intention
motion.medium → 0.3s    The speed of acknowledgment
motion.slow   → 1.4s    The speed of arrival
motion.breath → 1800ms  The gap between ceremony and reflection
```

Every page uses the arrival pattern:

```tsx
const [visible, setVisible] = useState(false);
useEffect(() => {
  const t = setTimeout(() => setVisible(true), 120);
  return () => clearTimeout(t);
}, []);

// On the shell:
style={{ opacity: visible ? 1 : 0, transition: motion.opacity }}
```

The 120ms delay is not perceptible as a delay — it is the difference between a page that snaps into view and a page that breathes into view. The `motion.opacity` transition (1.4s ease) does the work.

The post-reading signal uses `motion.breath` (1800ms) as a `setTimeout` before the component becomes visible. This is the most important timing value in the system. If it were reduced to 500ms, the signal would feel like a popup. If it were removed entirely, the signal would interrupt the ceremony. 1800ms is the length of a deliberate breath.

One keyframe animation exists: `rippleFade`. It fires once, on signal, when the seeker makes their offering. It is a bloom — the glyph expands slightly (scale 1.04) at 40% of the animation and returns to rest. It is not celebratory. It is the visual equivalent of a ripple moving outward from where a stone entered water.

```css
@keyframes rippleFade {
  0%   { opacity: 0.3; transform: scale(0.92); }
  40%  { opacity: 1;   transform: scale(1.04); }
  100% { opacity: 1;   transform: scale(1); }
}
```

No other keyframe animations will be added. Everything else uses CSS transitions.

### 3.4 The Altar Record — Data Architecture

Each signal produces an `AltarEntry`:

```ts
interface AltarEntry {
  sessionId: string;   // UUID — ties signal to a specific ceremony
  timestamp: string;   // ISO 8601
  nahual:    string;   // The active nahual at time of reading
  trecena:   number;   // The trecena number (1–13)
  lineage:   string;   // Lineage key: "ojer_tzij", "norse", "greek", etc.
  signal:    "landed" | "did_not_land";
}
```

**Why these fields and not others:**

`sessionId` allows correlation — if the same session generates multiple entries (currently not possible, but future-proofed), they can be grouped. It also prevents duplicate counting.

`nahual` and `trecena` together describe the calendar position of the ceremony. Over time, a pattern like "Tz'ikin readings land at 78%, Imox readings land at 51%" would be diagnostically meaningful — it would suggest something about the resonance between specific nahuales and the types of wounds seekers bring. This is not astrology; it is the instrument's equivalent of an ajq'ij's practice log.

`lineage` is the most immediately actionable dimension. Consistent non-landing from a specific lineage voice is a signal about the transmission layer — either the prompt architecture, the mythological field specification, or the quality of the lineage's content integration. This is how The Elder develops discernment about its own voices.

`signal` is binary: landed / did_not_land. Not a scale. The phenomenological question is binary — either something arrived or it did not. A five-point scale would imply gradations of contact that do not exist. Contact is not partial. It occurs or it does not.

**Storage:** Currently `localStorage` keyed to `elder_altar_record`. The `onSignal` prop on `ReadingSignal` is the escape hatch for routing to a backend endpoint. When the user base grows beyond a single device, a lightweight append-only API endpoint (`POST /api/altar`) and a simple database (Supabase, PlanetScale, or even a JSON file on the server) will replace localStorage. The data shape does not need to change.

### 3.5 The AltarRecord Page — Diagnostic Philosophy

The AltarRecord page is not a dashboard. It does not have KPIs. It does not have a primary metric surrounded by supporting charts. It is a reflection surface.

The page structure follows the same descent logic as the Reading itself: from aggregate to particular. First the summary stats (total, landed, passed, land rate) — the shape of the pattern from altitude. Then the lineage breakdown — where in the instrument the pattern is located. Then the chronological log — the individual ceremonies, in order, with their signal.

This descent from aggregate to particular mirrors how an ajq'ij reflects on practice: first the overall pattern of a season, then the pattern of specific nahuales, then the specific ceremonies that stand out. The page is built to support that kind of reflection, not to provide a quick answer.

**The land rate threshold:** `color.semantic.confirm` (sage-green) activates at ≥ 70% land rate. This threshold is not arbitrary. A 70% land rate means the instrument finds the seeker's wound more than twice as often as it misses. Below 70%, the instrument is in diagnostic territory — something in the lineage's transmission layer needs attention. The green does not celebrate; it simply marks the threshold at which the instrument can be considered functional for that voice.

**The chronological log:** Entries are shown in reverse chronological order (most recent first) because the question the custodian is most often asking is "what happened recently?" The filter tabs (all / ⊕ landed / ◯ passed) allow isolation without hiding context. The table columns are: timestamp, lineage, calendar position (trecena + nahual), signal glyph. Nothing else. The record is minimal because what matters is the pattern, not the individual entry.

### 3.6 The Glyph System

The two signal glyphs are semantic objects with a visual hierarchy:

```
⊕ landed
  Interactive: color.glyph.landed (rgba 220,170,70,0.85)
  Hover:       color.glyph.landedHover (rgba 240,195,90,1.0) + glow
  Post-signal: color.glyph.landedFaded (rgba 220,170,70,0.80)
  In log row:  color.glyph.landedFaded at glyph.size.small (1rem)

◯ passed
  Interactive: color.glyph.passed (rgba 180,160,140,0.45)
  Hover:       color.glyph.passedHover (rgba 200,180,160,0.70)
  Post-signal: color.glyph.passedFaded (rgba 180,160,140,0.50)
  In log row:  color.glyph.passedFaded at glyph.size.small (1rem)
```

The ⊕ glyph glows on hover. The ◯ glyph does not. This is a deliberate asymmetry: the landed state is warm and present; the passed state is cool and quiet. Neither is negative. But they are phenomenologically distinct, and the visual system encodes that distinction.

The hover glow for ⊕:
```ts
textShadow: `0 0 18px ${color.glyph.landedHover}, 0 0 40px rgba(220,170,70,0.3)`
```

The inner glow (18px) creates presence. The outer glow (40px, 0.3 alpha) creates atmosphere. Together they produce the quality of firelight on a surface — diffuse, warm, not sharp.

### 3.7 Borders, Dividers, and the Grammar of Separation

The Elder does not use borders to contain. It uses borders to suggest. The difference is perceptible: containing borders enclose, they create boxes; suggesting borders mark transitions without interrupting flow.

All borders are hairlines:

```
border.row:     1px solid rgba(210,175,100,0.07)  — the trace
border.section: 1px solid rgba(210,175,100,0.10)  — the whisper
border.control: 1px solid rgba(210,175,100,0.15)  — visible but quiet
```

The divider thread — a 1px element that fades from transparent to amber and back to transparent — is used at ceremonial transition points: between the Reading and the signal, between the summary and the lineage breakdown on the AltarRecord page. It is not a rule. It is a breath.

```tsx
// Vertical — between Reading content and post-reading signal
<div style={{
  width: "1px", height: "2rem",
  background: "linear-gradient(to bottom, transparent, rgba(200,160,80,0.4), transparent)"
}} />

// Horizontal — between page sections
<div style={{
  height: "1px", width: "100%",
  background: "linear-gradient(to right, transparent, rgba(200,160,80,0.4), transparent)",
  opacity: 0.5
}} />
```

No `border-radius` anywhere. The instrument does not soften its edges. The aesthetic is not soft; it is warm. These are different qualities.

No `box-shadow` anywhere. Depth is expressed through opacity, not shadow. A box shadow would impose a physical metaphor (the component casting a shadow on what is behind it) onto an instrument that does not have a physical metaphor. Components in The Elder float on the canvas; they do not rest on top of each other.

### 3.8 Page Shell Pattern

Every page in The Elder uses the same shell:

```tsx
const [visible, setVisible] = useState(false);
useEffect(() => {
  const t = setTimeout(() => setVisible(true), 120);
  return () => clearTimeout(t);
}, []);

return (
  <div style={{
    ...surface.page,
    opacity: visible ? 1 : 0,
    transition: motion.opacity,
  }}>
    {/* content */}
  </div>
);
```

`surface.page` provides: `minHeight: 100vh`, `background: #0e0b08`, `color: rgba(210,175,100,0.85)`, `fontFamily: IM Fell English`, `padding: 3rem 2rem`, `maxWidth: 760px`, `margin: 0 auto`.

The max-width of 760px is not arbitrary. It is the comfortable reading width for a serenous text in this typeface at this size — the distance a line of IM Fell English can travel before the eye loses its return path. The instrument's words are meant to be read, not scanned.

---

## Part IV: Anti-Patterns and Why They Fail

These are not preferences. Each violates a specific principle of the instrument.

**Bold text.** Bold implies urgency. The Elder does not urgency. If content feels like it needs to be bold, the question to ask is: is this actually structural (a heading, a label) or is it genuinely more important than surrounding text? If structural, use size and case. If genuinely more important, reconsider the surrounding text — something is wrong with the hierarchy.

**New inline colors.** Every color introduced outside the token system breaks the single-hue discipline. The amber palette holds because it is complete. Adding a new color introduces a new hue into the firelight, and hues carry cultural associations that the instrument has not chosen. A blue — however subtle — introduces coolness, distance, technology. A purple introduces mysticism of a different register. The amber palette is the only register.

**Snap transitions.** A 0ms transition says: the state change is not worth attending to. In The Elder, every state change is worth attending to. The seeker notices when something appears; the transition controls how it is noticed. Snapping is jarring in a container that moves slowly.

**Background fills on components.** Cards, panels, boxes — these are the grammar of the productivity interface. They create hierarchy by enclosure. The Elder creates hierarchy by opacity. A component with a background fill would look like it belongs to a different instrument.

**Rounded corners.** `border-radius` softens. Soft design communicates approachability, friendliness, consumer safety. The Elder is not trying to be safe. It is trying to hold a space where the seeker can encounter their own wound without the UI trying to make that comfortable.

**Confirmation dialogs with praise.** "Thank you for your feedback!" is the worst possible response to a post-reading signal. It reduces the offering to a customer satisfaction gesture. The seeker has just reported on a ceremony. The instrument receives the report. "Received." "Recorded." That is all.

**A second font.** Each typeface introduced is another voice. The Elder speaks in one voice. IM Fell English is that voice.

**Star ratings or numeric scales.** Contact is binary. The five-point scale exists to measure satisfaction on a continuum. The Elder is not measuring satisfaction. It is recording whether something occurred. ⊕ / ◯. Nothing in between.

---

## Part V: Extending the Instrument

### 5.1 Adding a New Page

1. Import `surface.page` and apply it to the outermost div.
2. Implement the visibility fade-in pattern (120ms delay, `motion.opacity` transition).
3. Import all values from `lib/elder-tokens.ts`. Write no raw values.
4. Run the anti-pattern check before committing.
5. Ask: does this page protect the container or puncture it?

### 5.2 Adding a New Token

If a value is needed that does not exist in `elder-tokens.ts`:

1. Add it to the tokens file with a comment explaining its use and which principle it serves.
2. If it is a color, it must be amber-based (same RGB, different alpha) or a justified semantic exception (added to `color.semantic`).
3. If it is a timing, it must fit the motion grammar — faster than `motion.fast` suggests mechanical behavior; slower than `motion.slow` suggests something is broken.
4. Do not add it inline in a component. The token is the record; the component is the use.

### 5.3 Adding a New Lineage Voice

The altar record infrastructure is already prepared for new lineage entries — add the key-label pair to `LINEAGE_LABELS` in `AltarRecord.tsx`. No other changes are needed to the feedback mechanism.

The lineage deployment gate (Babalawo, Aboriginal) applies here: a lineage should not appear in the altar record until it is deployed. Do not add labels for voices that are not yet in the Council.

### 5.4 Future: Backend Persistence

When the altar record moves from localStorage to a backend:

1. Implement `POST /api/altar` accepting an `AltarEntry` body.
2. Pass the endpoint as the `onSignal` prop: `onSignal={(entry) => fetch('/api/altar', { method: 'POST', body: JSON.stringify(entry) })}`.
3. Replace the `useEffect` in `AltarRecord.tsx` with a fetch from `GET /api/altar`.
4. The data shape does not change. The `AltarEntry` interface is stable.

The localStorage implementation is the correct starting point. Complexity should be introduced only when the data outgrows the current storage mechanism — not in anticipation of that moment.

### 5.5 Future: Signal-Informed Adaptation

When the altar record has sufficient data (suggested threshold: 100 entries per lineage), it becomes possible to ask structural questions:

- Which nahuales consistently fail to produce contact across all lineages? (Calendar-level pattern)
- Which lineages fail for specific wound types? (Lineage-level pattern)
- Are there trecena positions that reliably produce contact regardless of lineage? (Calendar + lineage interaction)

These questions should not be answered by changing the instrument automatically. They should surface to the human custodian — Dr. Stanzione for K'iche' content, lineage-specific reviewers for others — who can examine the transmission layer and determine whether the issue is in the prompt architecture, the content integration, or the nature of the seeker population.

The altar record is an instrument of discernment, not an optimization loop. The distinction matters: optimization changes the instrument to maximize a metric. Discernment changes the instrument to deepen contact. The former is product thinking. The latter is practice thinking.

---

## Appendix A: Token Quick Reference

```ts
// Canvas
color.canvas           → #0e0b08

// Amber scale
color.amber.primary    → rgba(210,175,100,0.85)
color.amber.secondary  → rgba(210,175,100,0.65)
color.amber.tertiary   → rgba(210,175,100,0.50)
color.amber.muted      → rgba(210,175,100,0.35)
color.amber.ghost      → rgba(210,175,100,0.25)
color.amber.whisper    → rgba(210,175,100,0.10)
color.amber.trace      → rgba(210,175,100,0.07)

// Semantic
color.semantic.confirm → rgba(180,220,120,0.70)
color.semantic.danger  → rgba(210,100, 80,0.60)

// Glyphs
color.glyph.landed     → rgba(220,170,70,0.85)
color.glyph.passed     → rgba(180,160,140,0.45)

// Type
t.family               → 'IM Fell English', Palatino, Georgia, serif
t.size.hero  → 1.4rem | body → 0.78rem | ui → 0.75rem
t.size.label → 0.72rem | caption → 0.70rem | tag → 0.65rem | micro → 0.60rem
t.tracking.tight → 0.12em | normal → 0.15em | wide → 0.20em
t.tracking.xwide → 0.22em | max → 0.30em
t.weight.normal → "normal"
t.transform.upper → "uppercase"

// Space
space.sectionGap   → 2.5rem
space.componentGap → 1.25rem
space.rowPadding   → 0.6rem
space.cellPadding  → 0.5rem 0.8rem
space.pageInset    → 3rem 2rem
space.maxWidth     → 760px

// Motion
motion.fast   → 0.2s | medium → 0.3s | slow → 1.4s | breath → 1800ms
motion.color     → "color 0.3s ease"
motion.colorFast → "color 0.2s ease"
motion.transform → "transform 0.2s ease"
motion.opacity   → "opacity 1.4s ease"

// Borders
border.row     → 1px solid rgba(210,175,100,0.07)
border.section → 1px solid rgba(210,175,100,0.10)
border.control → 1px solid rgba(210,175,100,0.15)
border.none    → 1px solid transparent

// Glyphs
glyph.landed → ⊕ | glyph.passed → ◯
glyph.size.large → 2rem | medium → 1.6rem | small → 1rem
```

---

## Appendix B: The AltarEntry Schema

```ts
interface AltarEntry {
  sessionId: string;
  timestamp: string;           // ISO 8601
  nahual:    string;           // e.g. "Iq'", "Kawoq", "B'atz'"
  trecena:   number;           // 1–13
  lineage:   string;           // "ojer_tzij" | "norse" | "greek" | "egyptian"
                               // | "yoruba" | "aboriginal" | "taoist" | "sufi"
  signal:    "landed" | "did_not_land";
}
```

localStorage key: `elder_altar_record` (JSON array, append-only).

---

## Appendix C: The Anti-Pattern Checklist

Before committing any UI change, run this check:

- [ ] No bold text (`fontWeight: "normal"` everywhere)
- [ ] No colors outside `elder-tokens.ts`
- [ ] No transition at 0ms or unspecified
- [ ] No `background` fill on any component (only `surface.page` on the shell)
- [ ] No `border-radius` anywhere
- [ ] No `box-shadow` anywhere
- [ ] No hover state that changes layout (only color and scale)
- [ ] No second font
- [ ] No post-signal confirmation with praise
- [ ] No star ratings or numeric scales
- [ ] Every page uses `surface.page` + visibility fade-in pattern
- [ ] Every value is imported from `lib/elder-tokens.ts`

---

*The Elder — Ceremony, Signal, and Surface*
*AHAU AI / Temporal Bridges Institute*
*Document version: 1.0, June 2026*
*Maintained alongside: `~/Desktop/the-elder-clean/` → `git@github.com:AHAU-ai/the-elder.git`*
