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

## Ceremonial continuity (audio and visual) -- keep these true

The opening is one continuous act: cold room, the door, the crossing, the herald, the breath. Anything added to it (sound, light, motion) must read as part of that act, not as a feature. The rules the current build holds, so later changes do not quietly break them:

**Audio**
- **One voice handing to the next.** Landing drone -> hearth (from ~40% open) -> breath tone. The drone stays while the hearth swells in and is gone as the door gives way (measured: about -28, -44, -54 dBFS over the last ~0.8s of a hold), so there is never a gap or a spike at the crossing.
- **One pitch.** The landing drone is A (55 Hz and 110 Hz); the hearth drone's root is the same A2 (110 Hz). Keep new tones in that family, keep thirds out (a third implies a mode, and a mode implies a tradition), and do not imitate a particular tradition's instrument.
- **An invitation, not a hook.** No escalation with time spent, no repeating or nagging after it is muted, no volume jump to win attention. It swells only as the pointer nears the door and falls back when it leaves. (This is the docs/inhabiting-the-elder.md line, dwelling not retention, applied to sound.)
- **The visitor's choice is the visitor's.** Always-visible control, remembered; muted means muted everywhere on the landing, including the early fire, and that includes the buzz. Haptics are on by default (owner decision 2026-10-10, replacing the earlier "no haptics" rule): a soft hum that follows the sound and never escalates with time, never repeats after the sound is muted, and is silent under reduced motion (see "It is also felt" above). No attempt to defeat the browser's autoplay rule.
- **Quiet ceilings.** Limiter on the siren (peaks below about -9 dBFS); slow fade-ins (4.5s siren, 3.5s hearth). Nothing percussive on the landing, and no choir, organ or bell timbres (they read as one tradition).

**Visual**
- **Warm against cold.** The room is cold and still; the seam, veins, sheen and frame are the only warm things until the door opens, so crossing is warmth arriving. Do not add a second warm element that competes with the seam.
- **No lineage imagery, ever.** The door is a plain wardrobe door; the veins are abstract noise-steered lines. No glyphs, runes, sigils, symmetric ornament or tradition-specific marks (lib/portalCopy.ts, "What is deliberately NOT here").
- **One arrival.** The crossing ends where BreathGate's herald begins. Do not invent a second arrival scene.
- **Nothing blocks.** Skip and "go straight in" stay visible; welfare precedes everything and the portal never touches it. Reduced motion: textures stay, pulses and swing go.

**Interface voice.** Controls speak plainly and lowercase in the interface's voice ("sound on", "already know this place"). They are never the Elder's voice and never imperative in it; the Elder's narration stays under the register guard (`check:opening-register`).

## The voice at the door

The landing is no longer silent. A single low, breathy earth-drone calls from the wardrobe (`lib/portalLure.ts`, Web Audio, no files), like wind moving through a long pipe: a deep fundamental (A1, 55 Hz) as a slightly detuned pair, a second voice an octave up (A2 = 110 Hz, exactly the hearth drone's root), a slow sweeping, broad resonance that makes it breathe and "speak" without words, a little low air, a very slow pitch drift, and an exhale at the start (it begins a semitone high and settles over 7s). It swells with the breath (one cycle, in step with the seam's own swell). The pointer is the lure: the nearer it comes to the door the louder, brighter and wider-sweeping it grows; pressing the door brings it fully up. It stays while the hearth swells in and is gone as the door gives way.

**Why it changed.** The first version (stacked open fifths through vowel formants with vibrato) sounded like a church choir organ, which is the wrong register. This one is one pitch, with no vowel filters and no vibrato.

**It is also felt (haptics).** Where the device supports it, the drone hums in the hand as a soft buzzing vibration (`lib/portalHaptics.ts`). The web Vibration API can only switch the motor on and off, so "soft" is a rapid train of very short pulses (10-16 ms on, 20 ms off, under half of every second) whose pulse length swells with the same breath as the sound, grows as the pointer nears the door, and fades as the hearth takes over. It exists only while the sound is sounding: muting, a locked audio context, a hidden tab, or `prefers-reduced-motion` silence it, and it follows the sound's own mute choice (no separate switch). It works in Chrome on Android and other browsers that implement `navigator.vibrate`; iOS Safari does not, so an iPhone gets the sound only. It is a body sensation with no tradition's signature, in the same neutral family as the sound.

**What it deliberately is not (governance).** It is not any tradition's instrument. Jesse asked for a didgeridoo; the repo has a Dreamtime lineage (Aboriginal Australian) whose own rules forbid using sacred or secret ceremonial knowledge or speaking for a Nation, the yidaki is sacred and in some communities restricted, and this is the universal landing every visitor hears. A lineage-specific threshold sound needs lineage-holder sign-off first (CLAUDE.md), so Jesse chose a neutral deep drone with the same weight and sacredness but no imitation of one instrument: no lip-buzz timbre, no rhythmic overtone accents, no third. If a didgeridoo sound is wanted later, it belongs behind a flag that stays off until the Dreamtime lineage holder and an appropriate cultural authority approve, and probably only for seekers who choose that lineage.

**Why it is built to be heard.** The hearth's own drone is three pure 110 Hz sines at a gain of about 0.05, which a laptop or phone barely reproduces and which sits below a room's noise floor. A 55 Hz fundamental is felt on a good speaker and invisible on a small one, so about 40% of this voice's power is carried at 300 Hz to 1.5 kHz (sawtooth harmonics through the sweeping resonance), where small speakers work.

**What the browser allows.** No page can start sound before the visitor has interacted with it (click, tap, key). So the voice starts at once if the browser trusts the site, and otherwise on the visitor's first click, tap or keypress anywhere. Until then the control reads "sound · touch to wake" and pulses. This cannot be bypassed and no code should try.

**The visitor stays in charge.** A visible control (top right, 44px target, `aria-pressed`, fades with the skip link as the door opens) turns it off and on; the choice is remembered on this device (`elder_portal_sound`). It fades in over 4.5s and a limiter holds it down. A seeker who turned it off is also not given the fire early at 40% open; the breath brings the hearth in on its own as before. The hearth's own mute control in the Threshold is separate and unchanged. No haptics.

**Measured (headless Chrome, analyser on the output):** at rest about -31 to -37 dBFS RMS, near the door about -21 to -24, peaks no higher than -13, silence (< -75) when muted, restored on unmute; fade through the crossing -28, -44, -54 dBFS. **Not verified:** how it sounds by ear on real speakers or phones, iOS Safari unlocking, and the autoplay-blocked path in a real (non-headless) browser: headless Chrome does not enforce the autoplay policy, so the "locked" state was reasoned about but not observed. Tune `LURE_LEVEL`, the resonance sweep and the proximity curve by ear.

## The enchanted door (visual pass)

The door is no longer a flat CSS rectangle. After first paint, `lib/portalTexture.ts` draws two textures on offscreen canvases (seeded, so the same door every visit; no image assets, no network):

- **Wood.** Procedural walnut: flat-sawn grain with warped growth rings, fibre and pores; stiles and panels run vertically, the rails between them run across. Raised panels with a groove and a bevel, shaded by a baked light from the seam, so each leaf is lit on the side that faces the fire. Wear, soot toward the floor, edge falloff, film grain. Brass hinges are baked in; the brass handles are CSS (cylinder shading, cast shadow, and they take the seam's light).
- **Light veins.** Thin branching threads of ember light leave the seam and wander across the grain, steered by a smooth flow field with random forks and a small pool of light at each tip. Two slow pulses of brighter light climb the veins. The veins brighten as the seam ignites and as the door opens.

A cold colour grade sits over the wood and lifts as the room warms; a warm sheen blends in from the seam; the frame takes the seam's light. Layer opacities are driven by the same `--ignite` / `--warm` / `--cast` custom properties as before, so none of the door logic (hold, tap, skip, bypass, crossing) changed.

**Photographic doors.** The leaves now use a real photograph of a walnut wardrobe (supplied by Jesse): its two closed outer doors, each hinged on its outer edge like the portal's leaves, cropped to leaf proportions (0.325 : 1, so the door is 0.65 : 1, wider than the earlier plain 0.4 : 1) and exported to `public/portal/door-left.webp` and `door-right.webp` (~60 KB and ~80 KB). Enhancement is deterministic image processing, not generative: crop, a light median denoise to dissolve a fine generated weave in the source, gentle local-contrast (CLAHE) and mild sharpening so the grain and bevels read as relief, and a per-channel tone match so the darker right door reads as the same timber as the left. The veins, cold grade, warm sheen, brass handles and frame sit over the photograph unchanged. If either image fails to load, the procedural wood below is drawn instead.

**Provenance.** The source image's rights are not recorded in the repo. Confirm they cover shipping it (it is part of a public screen) before this merges.

**Procedural fallback.** The seeded walnut described above is now the fallback; it is only generated if the photographs cannot load.

**Honest limits.** The fallback is procedural, not a photograph. The photographed doors are as good as the source: only the two closed outer doors are used, the open centre doors and interior in the source are not.

**Invariants kept.** The patterns are abstract (noise-steered lines): no glyphs, runes, sigils, symmetric ornament or anything that belongs to a tradition, so "No lineage imagery" still holds. Reduced motion: the textures show, the pulses are off. Failure: if canvas or memory is unavailable, the original plain door stays. Cost: one-off ~1s of idle-time canvas work, two small PNG object URLs (revoked on unmount), the swing stays a compositor transform.

## Decisions (resolved)

1. **Sound:** the room is silent. The hearth's bed is acquired once the door is ~40% open (its own 3.5s fade-in is the fade); if the door eases shut below ~10% before committing, the hearth is released. Caveat: on iOS the late-created AudioContext may stay suspended on the tap path until the next gesture (the existing gesture listener and press/release resumes cover most cases) -- unverified on device.
2. **Added time / drop-off:** anonymous funnel beacon on `/api/log`: body `{ portal: 'reached-door' | 'crossed' | 'skipped' | 'bypassed' }` (`lib/portalTelemetry.ts`). One closed-set field, no session id; the route forwards only that to `ELDER_LOG_WEBHOOK` and never writes it to the DB. `reached-door` fires when the door becomes interactive (~0.7s), so same-tab returners are not counted. `bypassed` is a signed-in member choosing "go straight in". The webhook consumer must tolerate this shape.
3. **Returning visitors (revised 2026-10-04):** the persisted `elder_crossed` flag (`lib/portalFlag.ts`) is removed. The door no longer disappears for someone who has crossed once: it stays visible to every visitor who is not signed in. Signed-in members are the ones offered the way past, as a per-visit choice (nothing stored). If members should be able to make it a standing preference, that is a follow-up (account-level setting, so it follows them across devices). Same-tab returners (`elder_breathed`) still skip both.
4. **Shalom review** of `lib/portalCopy.ts`: approved.
5. **Door-as-wardrobe literalness:** kept as is (plain double door) for now.
