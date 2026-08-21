// scripts/generate-marker-frame-flowers.mjs
//
// AI-generated floral frame ornament for the shareable card, additive to
// the existing hand-authored Flower SVG component (app/components/
// ShareableCard.tsx) -- see docs/shareable-card-visual-system.md for the
// governance context this operates under, and that file's own record of
// why the SVG blooms were originally built procedurally.
//
// This follows the exact same three load-bearing constraints as
// scripts/generate-marker-landscapes.mjs (see that file's header):
//   - Keyed to MARKER ARCHETYPE only, never voice/tradition.
//   - Generic/wild botanical forms only -- deliberately avoids any flower
//     with a strong named-culture or named-religion association (no lotus,
//     marigold, chrysanthemum, hibiscus, cherry blossom, jasmine, etc.).
//     Wildflowers, thorned vines, and elemental blooms only.
//   - Cached, not dynamic: run once, output committed to public/, never
//     called at request/share time.
//
// Composition differs from the landscape script on purpose: these are thin
// horizontal garland/vine strips meant to drape along the card's top and
// bottom edges (not full-frame backgrounds), sitting alongside -- not
// replacing -- the existing hand-drawn corner blooms. Rendered on a pure
// black background so ShareableCard.tsx can screen-blend them into the
// card's own obsidian field, the same compositing technique this file
// already uses for its grain-texture layer -- no alpha channel required
// from the model, which diffusion image models rarely render reliably.
//
// A person must look at all outputs before they ship, per the governance
// doc -- this script only generates candidates into public/card-flowers/;
// wiring them into ShareableCard.tsx is a separate, deliberate step after
// review.
//
// Usage: GEMINI_API_KEY=... node scripts/generate-marker-frame-flowers.mjs

import { writeFile, mkdir, access } from 'node:fs/promises'
import path from 'node:path'

const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) {
  console.error('GEMINI_API_KEY is required (see .env.example).')
  process.exit(1)
}

const OUT_DIR = path.join(process.cwd(), 'public', 'card-flowers')

const STYLE = `Painterly digital matte painting, botanical illustration
quality. Palette: near-black background, warm gold and ember light on the
petals and stems, deep bronze shadow -- no other hues. A thin horizontal
garland or trailing vine of wildflowers and leaves, composed to drape along
a narrow edge (wide and short, not square). Rendered on a solid pure black
(#000000) background, no gradient, no vignette, no ground or horizon --
flowers and foliage only, floating on black. Soft rim light on each petal
edge as if lit from within. No text, no logos, no watermark, no border, no
frame. Absolutely no human figures, animals, faces, statues, insects,
symbols, writing, or any culturally- or religiously-specific flower
(no lotus, marigold, chrysanthemum, hibiscus, cherry blossom, jasmine,
rose used as a symbol) -- generic wildflowers, thorned vines, and small
elemental blooms only.`

// One image per marker, matching the mood language already established
// for that marker's landscape prompts (generate-marker-landscapes.mjs).
const MARKERS = {
  wound: `A trailing garland of dark, thorned vine with a few deep
    ember-red wildflowers, some petals scattered and torn as if the vine
    was pulled through something rough -- beauty with visible old damage,
    not pristine.`,
  threshold: `A garland of pale, night-blooming wildflowers just opening,
    petals catching warm gold light as if lit from a doorway just out of
    frame -- the sense of something about to cross into bloom.`,
  pattern: `A garland where the same small gold wildflower repeats in a
    winding, spiraling vine, each bloom slightly different in how it has
    turned toward the light -- rhythmic repetition, not identical copies.`,
  exile: `A sparse, wind-bent vine with only two or three small
    frost-touched wildflowers along its length, most of the stem bare --
    isolation and distance rather than abundance.`,
  figure: `A single tall stem with one unmistakable wildflower in full
    bloom, other stems nearby left as dark silhouettes with no blooms --
    one presence made deliberately singular among many.`,
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
  for (const [marker, prompt] of Object.entries(MARKERS)) {
    const outPath = path.join(OUT_DIR, `${marker}.png`)
    if (await access(outPath).then(() => true).catch(() => false)) {
      console.log(`skipping ${marker} (already exists)`)
      continue
    }
    process.stdout.write(`generating ${marker}... `)
    const buf = await generate(marker, prompt)
    await writeFile(outPath, buf)
    console.log(`saved ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
