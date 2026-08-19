// scripts/generate-marker-landscapes.mjs
//
// One-time (re-run-on-demand) generator for the shareable card's marker
// landscapes -- see docs/shareable-card-visual-system.md for the
// governance context this operates under.
//
// Scope, deliberately narrow:
//   - Images are keyed to MARKER ARCHETYPE (wound/threshold/pattern/exile/
//     figure), never to voice/tradition. Nothing here is generated "as"
//     any named tradition, so no tradition-bearer consent question
//     applies -- there is no culture being depicted, authorized or not.
//   - Each marker has three VARIANTS (compositional variety within the
//     same archetype), selected at render time by hashing the reading's
//     own quoted line (lib/mythopoetics/cardConfig.ts, landscapeFor()) --
//     so two different readings that land on the same marker don't
//     necessarily show the same picture. Still archetype-only: the
//     variant is chosen by the text's hash, not by anything that reads as
//     "which tradition."
//   - Pure atmospheric landscape: no people, no ritual objects, no
//     culturally-specific iconography. Elemental scenery (light, stone,
//     water, sky) only.
//   - Cached, not dynamic: run once, output committed to
//     public/card-landscapes/, never called at request time. No per-share
//     API cost or latency, no runtime dependency on this key.
//
// Usage: GEMINI_API_KEY=... node scripts/generate-marker-landscapes.mjs

import { writeFile, mkdir, access } from 'node:fs/promises'
import path from 'node:path'

const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) {
  console.error('GEMINI_API_KEY is required (see .env.example).')
  process.exit(1)
}

const OUT_DIR = path.join(process.cwd(), 'public', 'card-landscapes')

const STYLE = `Painterly, moody digital matte painting. Palette: near-black
obsidian, warm gold and ember light, deep bronze shadow -- no other hues.
Cinematic, single dramatic light source, soft atmospheric haze, fine film
grain. Portrait orientation. No text, no logos, no watermark, no border.
Absolutely no human figures, animals, faces, statues, masks, altars,
symbols, writing, or any culturally- or religiously-specific object --
pure elemental landscape only (rock, light, water, sky, vegetation).`

// Three compositional variants per marker -- same archetype/mood, different
// scene, so line-to-variant hashing produces real visual variety instead of
// a coat of paint over one image.
const MARKERS = {
  wound: [
    `A deep, weathered ravine cut into dark stone, a single narrow shaft
     of ember-gold light falling into it from above, mist pooling at the
     bottom. The rock shows old fracture lines, healed-over but visible.`,
    `A dry cracked riverbed at golden hour, one jagged fissure running
     across the cracked earth with warm ember light glowing up from
     inside the crack, cracked plates of ground stretching to the
     horizon.`,
    `An ancient tree split down its trunk by some old violence, the
     split trunk still standing, warm gold light glowing from within the
     split as if held there, dark quiet forest around it.`,
  ],
  threshold: [
    `A great stone archway standing alone on a cliff's edge at dusk,
     open on the far side onto a softly glowing, mist-filled unknown --
     the feeling of a doorway between worlds, an invitation past it
     rather than a destination shown. Gold light spills through the
     opening into the dark foreground.`,
    `A narrow gap between two towering cliff faces, standing at the
     mouth of the passage looking through toward warm golden mist far
     beyond -- the walls almost meeting overhead, a sliver of light at
     the far end.`,
    `A weathered stone doorway half-buried in wind-sculpted dunes, warm
     golden light pouring out from the darkness within it across the
     sand, dusk sky above.`,
  ],
  pattern: [
    `A wide valley terraced in concentric rings, a slow river bending
     back on itself in a spiral, moonlight repeating in still pools at
     each turn. The composition itself spirals inward toward a single
     point of gold light at the center.`,
    `A field of still dark water pools, each one reflecting the moon,
     arranged in a spiral path that winds across flat stone toward a
     glowing center.`,
    `Layered rock strata forming natural concentric rings around a
     glowing tidal pool, seen from slightly above, gold light pooling
     at the innermost ring.`,
  ],
  exile: [
    `A vast, empty high desert or tundra beneath a huge night sky, one
     faint path receding to a horizon with no destination in sight,
     isolated points of starlight overhead, no shelter, no landmark.`,
    `A single frozen lake stretching to the horizon under an enormous
     starfield, cracked ice catching faint light, utterly alone, no
     path, no shore visible.`,
    `An endless salt flat at night, a faint warm glow along the far
     horizon, perfectly flat and empty in every direction, no path, no
     shelter.`,
  ],
  figure: [
    `A single tall dark monolith or standing rock spire on a wind-
     scoured ridge, silhouetted against a glowing aurora-like sky -- a
     felt presence with no person in frame, immense and still.`,
    `A lone weathered sea-stack rising straight out of dark still water
     at dusk, warm gold light glowing behind it, utterly solitary and
     immense.`,
    `A single dead tree standing alone on a high ridge against a
     star-filled sky, bare branches stark and still, an unmistakable
     presence with nothing else in frame.`,
  ],
}

async function generate(label, prompt) {
  const fullPrompt = `${prompt}\n\n${STYLE}`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
    }
  )
  if (!res.ok) {
    throw new Error(`${label}: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
  if (!part) throw new Error(`${label}: no image returned -- ${JSON.stringify(data).slice(0, 400)}`)
  return Buffer.from(part.inlineData.data, 'base64')
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  for (const [marker, variants] of Object.entries(MARKERS)) {
    for (let i = 0; i < variants.length; i++) {
      const label = `${marker}-${i + 1}`
      const outPath = path.join(OUT_DIR, `${label}.png`)
      if (await access(outPath).then(() => true).catch(() => false)) {
        console.log(`skipping ${label} (already exists)`)
        continue
      }
      process.stdout.write(`generating ${label}... `)
      const buf = await generate(label, variants[i])
      await writeFile(outPath, buf)
      console.log(`saved ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
