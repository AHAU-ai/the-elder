# The Portal — the crossing before the breath

**Status:** built, verified in a production build; not merged. Flagged for Shalom review (non-blocking, same basis as the opening bridge).
**Files:** `app/components/PortalGate.tsx`, `lib/portalCrossing.ts` (+ test), `lib/portalCopy.ts`, `app/page.tsx` (wiring), `scripts/check-opening-register.mjs` (extended).

## What it is

A cold visitor no longer lands *in* the fire. They land in an ordinary, quiet, cold room — dim, blue-black, dust in the air, nothing asking anything of them — with one anomaly: a seam of ember light in the wall where no door should be. They put a hand to it (press and hold; or one tap). It gives. Warmth comes through the gap, embers drift toward them, the camera steps through, the room falls away, and they are standing in the fire that was already burning. BreathGate's herald — its ember flare and the Eye igniting to ask *What myth is living through you?* — is the other side of the door. The breath, reception, age beat and everything after are untouched.

The Narnia mechanic, taken apart:

| What makes the wardrobe work | Here |
|---|---|
| An ordinary world to contrast against | The cold room. The real fire (`CeremonyGround` + `FireAtmosphere`, mounted in the root layout) has been burning behind it the whole time; the portal is what stands in front of it. Crossing is warmth *arriving*, not a screen change. |
| A single anomaly that begs a question | The ember seam, igniting at ~0.65s. The first three seconds are: dark → room emerges → seam lights → one quiet line. |
| Your own hand does it | Hold to push; release early and it eases shut (no penalty); release late and it carries you through; tap and it crosses on its own. |
| The senses shift *during* the act | Light and colour warm, the wall takes the glow, text warms from cold grey to gold, the hearth's own sound bed fades in as the door passes ~40% open, embers stream out and grow toward you, the camera pushes forward. |
| One iconic arrival | The existing herald. No competing arrival scene was invented. |

## Invariants this respects

- **Welfare precedes everything / never a gate.** The portal runs before any model call exists and cannot touch the welfare gate. Skip is on screen from 2.4s; a tap is always enough; nothing holds a seeker in the room.
- **Never instructive in the Elder's voice.** The three narration lines are witnessing, lineage-agnostic, no flattery. They live in `lib/portalCopy.ts` and are now mechanically guarded by `check:opening-register` (forbidden patterns on every line; crossing line must be anchored to fire/ember/smoke; structural change fails loudly; boundary check keeps it out of the prompt layer). The interface label "HOLD TO OPEN" is the interface speaking, like BreathGate's "BREATHE IN", and is deliberately outside the guard.
- **No lineage imagery.** A plain door in a plain room. Nothing belongs to a tradition.
- **BreathGate is still the literal opener of the sitting proper.** It is unchanged; it mounts at the instant the door gives way and the portal's flare clears over it.
- **Honest copy.** No claims about the product or the seeker; scene-setting only.

## Behaviour

- Every visit meets the door, except a same-tab return (`elder_breathed`), which never sees it. A visitor who is not signed in always meets it, however many times they have crossed. A signed-in member is offered "go straight in" (in place of the skip link): it fades the room and lands on the breath, the opener of the sitting, without crossing; it is not remembered, so the door is there the next visit. Anyone's "already know this place" skips portal *and* breath, landing where BreathGate's own skip lands.
- Input: pointer (with capture), keyboard (Tab lands on the door; Space/Enter on the bare page also work), screen-reader click (treated as a tap). A hold can never stick: blur, tab-hide and pointer-cancel all release.
- `prefers-reduced-motion`: no swing, no push, no particles, no hold mechanic — any press is a tap and the room simply dissolves to the fire (~0.9s).
- Hydration: first paint is an opaque near-black void for everyone (never the lit room, never the fire), so neither first-timers nor returning visitors get a flash of the wrong world.
- The Threshold chunk is now warmed at idle time while the seeker is at the door, so the end of the breath never lands on the Suspense fallback.
- Layout is *measured*, not percentage-based: the door takes whatever space is left after the narration (which wraps 1–3 times depending on width) and the hint/skip. Short screens (landscape phones) switch to a compact layout.
- Performance: one rAF loop, state in refs, visuals as CSS custom properties; the warm light effects are opacity-only layers so the camera push never forces full-screen repaints.

## Verified (production build, headless Chromium)

`tsc` clean; `npm run build` clean; unit tests, `check:opening-register` (including red-team: imperative copy, flattery, unanchored line and renamed export all fail it), `check:purpose`, `check:pattern-view`, `check:unwired-exports`, `check:crisis-directive` all pass. 25 behavioural checks pass: tap, early release → eases shut → can re-press, late release carries through, skip (breath never mounts), keyboard (Tab + hold Space; bare Space tap), reduced motion, returning visitor (no portal), mobile touch, no stray focus ring for mouse visitors, no page errors. Layout clearance checked on 12 viewports (360×640 → 1920×1080, incl. four landscape phones), no horizontal scroll.

**Not verified:** real-device GPU smoothness, real audio output, haptics, iOS Safari audio unlock (the hearth resume is re-attempted on press *and* release for that reason), and the real Cormorant Garamond rendering (the test sandbox cannot reach Google Fonts, so metrics were checked with the fallback serif, which is wider — the measured layout re-fits when the font arrives).

## The enchanted door (visual pass)

The door is no longer a flat CSS rectangle. After first paint, `lib/portalTexture.ts` draws two textures on offscreen canvases (seeded, so the same door every visit; no image assets, no network):

- **Wood.** Procedural walnut: flat-sawn grain with warped growth rings, fibre and pores; stiles and panels run vertically, the rails between them run across. Raised panels with a groove and a bevel, shaded by a baked light from the seam, so each leaf is lit on the side that faces the fire. Wear, soot toward the floor, edge falloff, film grain. Brass hinges are baked in; the brass handles are CSS (cylinder shading, cast shadow, and they take the seam's light).
- **Light veins.** Thin branching threads of ember light leave the seam and wander across the grain, steered by a smooth flow field with random forks and a small pool of light at each tip. Two slow pulses of brighter light climb the veins. The veins brighten as the seam ignites and as the door opens.

A cold colour grade sits over the wood and lifts as the room warms; a warm sheen blends in from the seam; the frame takes the seam's light. Layer opacities are driven by the same `--ignite` / `--warm` / `--cast` custom properties as before, so none of the door logic (hold, tap, skip, bypass, crossing) changed.

**Honest limits.** It is procedural, not a photograph: there is no photographic asset in the repo and no image model in the loop. It reads as lit wood and brass, not a studio photo. If a true photographic door is wanted, the right move is to commission or shoot one and swap it in as `--leaf-tex`.

**Invariants kept.** The patterns are abstract (noise-steered lines): no glyphs, runes, sigils, symmetric ornament or anything that belongs to a tradition, so "No lineage imagery" still holds. Reduced motion: the textures show, the pulses are off. Failure: if canvas or memory is unavailable, the original plain door stays. Cost: one-off ~1s of idle-time canvas work, two small PNG object URLs (revoked on unmount), the swing stays a compositor transform.

## Decisions (resolved)

1. **Sound:** the room is silent. The hearth's bed is acquired once the door is ~40% open (its own 3.5s fade-in is the fade); if the door eases shut below ~10% before committing, the hearth is released. Caveat: on iOS the late-created AudioContext may stay suspended on the tap path until the next gesture (the existing gesture listener and press/release resumes cover most cases) -- unverified on device.
2. **Added time / drop-off:** anonymous funnel beacon on `/api/log`: body `{ portal: 'reached-door' | 'crossed' | 'skipped' | 'bypassed' }` (`lib/portalTelemetry.ts`). One closed-set field, no session id; the route forwards only that to `ELDER_LOG_WEBHOOK` and never writes it to the DB. `reached-door` fires when the door becomes interactive (~0.7s), so same-tab returners are not counted. `bypassed` is a signed-in member choosing "go straight in". The webhook consumer must tolerate this shape.
3. **Returning visitors (revised 2026-10-04):** the persisted `elder_crossed` flag (`lib/portalFlag.ts`) is removed. The door no longer disappears for someone who has crossed once: it stays visible to every visitor who is not signed in. Signed-in members are the ones offered the way past, as a per-visit choice (nothing stored). If members should be able to make it a standing preference, that is a follow-up (account-level setting, so it follows them across devices). Same-tab returners (`elder_breathed`) still skip both.
4. **Shalom review** of `lib/portalCopy.ts`: approved.
5. **Door-as-wardrobe literalness:** kept as is (plain double door) for now.
