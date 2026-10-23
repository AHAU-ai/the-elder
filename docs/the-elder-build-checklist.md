# The Elder — Build Checklist (Acts I–III)

> Status as of 2026-10-22, branch `fix/cross-03-pythia-forbidden-moves`.
> Basis: static read of the code plus `npx tsc --noEmit` (clean). **Nothing here was run in a browser**, and `npm run build` and the test suite were not run. Items marked ✅ mean "the code is there and reads correctly", not "seen working".

Legend: ✅ built · 🟡 built, with a note · ⬜ open · ➖ not applicable

---

## ACT I — Arrival Fire

- ✅ **1.1 Recon** — Resolved.
  - `BREATH_CYCLE_MS` = 18000 (`lib/breathTiming.ts`).
  - The flicker layers do **not** share a duration: five independent durations, seeded from `FLICKER_BASE_DURATIONS_S`.
  - Render sites: root `app/layout.tsx:76`; `Threshold.tsx` (one per beat); `FireMeditation.tsx:71`; `MythicJournal.tsx:150`. `CouncilTabs` no longer owns one.
- ✅ **1.2 Breath-layer phase offset** — `FireAtmosphere.tsx:89-96`. It is `useState` plus a mount effect, not `useRef`. It starts at 0 so SSR and the first client render agree, then is randomised once.
- ✅ **1.3 Flicker-layer phase offsets** — The five flicker layers and both crackle layers are covered.
  - 🟡 The hot core (1.1s), the core shimmer (0.9s) and the smoke layers have no offset. The checklist didn't ask for them, and they're too fast or too diffuse to read as lockstep. Leave unless it's visible on multi-mount.
- ✅ **1.4 Presence nudge** — Implemented as `nudgeBoost`, a separate channel (weight 0.9 into `presenceWarmth`, the hot-core shimmer). It does not call a `triggerBoost`, because none exists. It never touches `smokeCount`.
- ✅ **1.5 Wire the prop** — `arrivalNudge` is set at `app/layout.tsx:76` on the **one persistent root instance**. It is not on `LintelGate` or `Threshold`. The per-beat instances stay unset. This is correct and better than the original assumption.
- ✅ **1.6 Untouched** — `interrupted` was removed and documented in the component header. Not re-verified: smoke veil, reading pacing, crisis-page static fire.

## ACT II — Reading Reveal

> ⚠️ Cut, do not build: any emotional-weight-to-fire-intensity mapping.

- ✅ **2.1 Recon** — Resolved.
  - `/api/divine` uses non-streaming `client.messages.create`, so responses are whole.
  - The smoke veil is already eased and capped.
  - `sr-only` exists in `app/globals.css:251`.
- ➖ **2.2 Full-text buffering** — Not needed: the response is whole.
- ✅ **2.3 Screen-reader fallback** — `OracleResponse.tsx:222`: an `sr-only` region with `aria-live="polite"` holds the full text from the first frame, and the animated reveal is `aria-hidden`. The i18n keys exist in all 11 locales.
- 🟡 **2.4 Heartbeat drum** — The drum is `lib/heartbeatDrum.ts` (`startHeartbeatDrum`, `stopHeartbeatDrum`, refcounted).
  - `OracleResponse` starts it, or takes over the CouncilTab inquiry-phase drum, when the reading text arrives. It stops at the closing tail and on unmount. It does not run during the pre-reading wait, so there is no "loop while awaiting".
  - Not verified: whether the CouncilTabs inquiry-phase drum covers the wait. Check before calling the wait-state sound design done.
  - No latency-ceiling fix, per scope.
- ✅ **2.5 Smoke veil cap** — `FireAtmosphere.tsx:50-54,143`: `MAX_SMOKE_OPACITY` 0.6, `SMOKE_DECAY_RATE` 0.28, exponential approach. The formula also adds a `level * 0.18` term, then clamps to the cap. Tuning (rising through 4–5 questions, flat by ~10) is by-the-numbers only. Eyeball it.
- 🟡 **2.6 Tap-to-complete** — The container tap is built (`OracleResponse.tsx:243-248`), **but there is also a visible button** (`psychopomp-reveal-control`, "own pace" label, lines 229-239). That contradicts the original "no visible button, no label, no hint overlay". ⬜ **Product decision:** keep the button (more discoverable, better for keyboard and a11y) or remove it to honour the original spec.

## ACT III — Threshold Letter Closing

- ✅ **3.1 / 3.1b Closing sequence state** — `lib/useClosingSequence.ts` is built with three phases. `ThresholdLetter.tsx` wires it:
  - `beginClosing` fires at the exhale.
  - `markSettled` fires from the ring's `onTransitionEnd` (a CSS **transition**, not an animation event) plus a fallback timer (`RING_SETTLE_FALLBACK_MS`, about 6.4s after the closing tail starts) for reduced-motion and backgrounded tabs.
  - Unverified: nothing else (audio cue, other triggers) reads ring timing from this state. The audio tone takes `RING_SETTLE_MS` directly.
- 🟡 **3.2 Exit affordance** — Appears only when settled, takes focus, and has an `aria-label` (`letter.return_aria`). It replaces "return to the fire" once settled.
  - ⬜ **Destination:** `handleExitClosing` does `window.location.assign('/')`, a **full page reload** that resets the breath gate, audio and in-memory state. The original item said to confirm lineage-select versus fresh entry gate. This is still unconfirmed.
- ✅ **3.3 Letter-reveal pacing** — The original greps targeted the wrong file. `ThresholdLetters.tsx` (plural) is the kept-letters list and has no reveal. The closing letter is `ThresholdLetter.tsx` (singular). It doesn't use `WordReveal`. It gates the four-beat reveal on `fetchDone` (8s abort), so the letter assembles whole before any beat shows.
- 🟡 **3.4 ShareableCard static background** — There is no `FireAtmosphere` inside the card. The drifting embers are on the overlay outside `cardRef`, so they never export.
  - ✅ **Export determinism — fixed 2026-10-22.** The exported node (`cardRef`) contains tilt-driven layers (two parallax layers and a glass sheen) fed by `tilt` state, so `toBlob` used to capture whatever tilt was live. `renderPng` now freezes tilt input (`frozenRef`), snaps `tilt` to rest, drops the layers' transitions (`exporting`), waits two frames, then captures. It restores in a `finally`. Typecheck clean; **not yet verified on a device**.
- ✅ **3.5 Anonymous shareable-card access** — `CouncilTabs.tsx:948-975`: the card opens unconditionally, and only the `/api/threshold-letters` persistence is gated on `signedIn`. The share link (`createShareLink`) is deliberately signed-in only.
  - Not audited: copy that implies sign-in is needed to keep the card. A grep of `en.ts` found only journal, tree and kept-letters strings, which is correct.
- 🟡 **3.6 Bhikkhu** — The authorization (Shalom Ormsby, 2026-07-31) is already recorded in `docs/reading-shape-voice-review.md:269`, so no code change is needed.
  - Note: the same row's **Judgment is CONTRADICTED** (Jataka passages), a content issue separate from authorization. Not examined here.

---

## Verification

- ✅ `npx tsc --noEmit` — clean (2026-10-22).
- ⬜ `npm run build` and the test suite — not run.
- ⬜ **End-to-end walkthrough** — none of it is run in a browser. Open items from static reading:
  - [ ] 2. Nudge and drum collision (step 3): does the drum have a visual component? It doesn't appear to. Confirm.
  - [ ] 5. Both the tap and the visible button complete the reveal.
  - [ ] 6. Smoke veil caps visually over 8–10 questions.
  - [ ] 9. Exit control appears only after settle, takes focus, and the fallback timer fires under reduced motion.
  - [ ] 10. **Card export is identical at different times and tilts** — fix is in (see 3.4). Verify on a phone: export while tilted and while flat, then compare the PNGs.
  - [ ] 11. Exit lands on the intended destination (decision pending, see 3.2).

## Report back

- Ceremony-phase state (`arrivalNudge`, `useClosingSequence`, `smokeCount`) is still separate, local component state. No shared store exists.
- `letterReady` from the original list doesn't exist. It's replaced by `fetchDone` in `ThresholdLetter.tsx`.

## Open decisions

1. Keep or remove the visible "own pace" button (2.6).
2. Exit destination: `/` reload, or lineage-select without a reload (3.2).
(Freezing `tilt` during card export was decided and done; see 3.4.)
