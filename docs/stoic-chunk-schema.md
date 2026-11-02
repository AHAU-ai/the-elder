# Stoic Lineage Corpus: Chunk Schema (v0.2)

Handoff spec for ingestion. Applies to the Stoic lineage retrieval corpus in The Elder. Supersedes v0.1.

## Changes from v0.1

- Addresses: v0.1 claimed one citation is stable across translations. It is not: Casaubon (1634) numbers sections differently from Long and most modern editions. `address` now carries the standard numbering as the cross-translation key (`canonical`) and the translation's own numbering (`edition_ref`).
- `text_scope` added: stored passages are often excerpts of a section, and stance tags must only describe the stored text.
- `stance` is limited to the three topics that have a defined vocabulary (cosmos, fate_and_agency, death).
- Retrieval rule for tension queries corrected: several Marcus sections (4.3, 6.10, 9.28) set out both poles themselves.
- Validation rules extended from 5 to 9.

## Principles

1. Every chunk has a canonical address in the standard numbering, which is the key that stays the same when the translation changes. The translation's own numbering is kept separately.
2. Provenance is metadata, always stored, even when the output doesn't show it.
3. Testimonia and fragments are never voiced in first person.
4. Stance and theme tags are human-curated or human-reviewed. Unreviewed LLM tags are stored but never used in production retrieval.
5. A stance tag describes what the stored chunk text says, not what the surrounding section says.

## Chunk schema (JSON Schema, draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "StoicChunk",
  "type": "object",
  "required": [
    "chunk_id", "text", "text_scope", "author", "work", "address",
    "translation", "source_type", "reported_by", "voice_permission",
    "stance", "themes", "ingest"
  ],
  "properties": {
    "chunk_id": {
      "type": "string",
      "description": "Deterministic: {author_slug}.{work_slug}.{canonical address}.{translation_id}",
      "examples": ["marcus.meditations.4.3.casaubon1634"]
    },
    "text": { "type": "string", "description": "Passage text exactly as in the stated translation. Public-domain translations only unless licensed." },
    "text_language": { "type": "string", "default": "en" },
    "text_scope": {
      "enum": ["excerpt", "full_section"],
      "description": "excerpt: the stored text is part of the section at this address. full_section: it is the whole section."
    },

    "author": {
      "type": "object",
      "required": ["name", "school_phase"],
      "properties": {
        "name": { "type": "string" },
        "school_phase": {
          "enum": ["early", "middle", "roman"],
          "description": "early: Zeno, Cleanthes, Chrysippus. middle: Panaetius, Posidonius. roman: Seneca, Musonius, Epictetus, Marcus."
        },
        "taught_by": { "type": "array", "items": { "type": "string" }, "description": "Optional lineage link, e.g. Marcus -> [Epictetus (via Rusticus)]" }
      }
    },

    "work": { "type": "string", "examples": ["Meditations", "Discourses", "Enchiridion", "Letters to Lucilius", "Hymn to Zeus"] },

    "address": {
      "type": "object",
      "required": ["canonical"],
      "properties": {
        "canonical": { "type": "string", "description": "Standard numbering (the numbering used by Long and most modern editions), e.g. 4.3 / 1.1.7 / Ep. 41. Same value for every translation of the passage." },
        "edition_ref": { "type": ["string", "null"], "description": "The translation's own numbering when it differs, e.g. Casaubon 'IV.III'. Null if identical or unknown." },
        "book": { "type": ["string", "integer", "null"], "description": "In the canonical numbering." },
        "section": { "type": ["string", "integer", "null"], "description": "In the canonical numbering." },
        "line_range": { "type": ["string", "null"] }
      }
    },

    "translation": {
      "type": "object",
      "required": ["translation_id", "translator", "year", "license"],
      "properties": {
        "translation_id": { "type": "string", "examples": ["long1862", "casaubon1634", "gummere1917"] },
        "translator": { "type": "string" },
        "year": { "type": "integer" },
        "edition_or_source": { "type": "string", "description": "Where the text was obtained (e.g. Project Gutenberg ID, Perseus URN), plus caveats such as modernized spelling." },
        "license": { "enum": ["public_domain", "licensed", "unknown"] }
      }
    },

    "source_type": {
      "enum": ["primary", "fragment", "testimonium"],
      "description": "primary: surviving work by the author. fragment: quoted words attributed to the author by a later source. testimonium: a report about the author's teaching."
    },

    "reported_by": {
      "type": ["object", "null"],
      "description": "REQUIRED (non-null) when source_type is fragment or testimonium. Null for primary.",
      "properties": {
        "author": { "type": "string", "examples": ["Diogenes Laertius", "Cicero", "Plutarch", "Stobaeus"] },
        "work": { "type": "string" },
        "address": { "type": "string" }
      }
    },

    "voice_permission": {
      "enum": ["first_person_ok", "attributed_only"],
      "description": "Derived rule: primary => first_person_ok. fragment/testimonium => attributed_only (render as 'it is said that...' or 'Chrysippus is reported to have held...')."
    },

    "stance": {
      "type": "array",
      "description": "Zero or more positions the STORED TEXT takes. Empty when the stored text does not itself take a position. Only topics with a defined vocabulary are allowed.",
      "items": {
        "type": "object",
        "required": ["topic", "position"],
        "properties": {
          "topic": { "enum": ["cosmos", "fate_and_agency", "death"] },
          "position": { "type": "string" },
          "confidence": { "enum": ["explicit", "implied"], "default": "explicit" }
        },
        "allOf": [
          { "if": { "properties": { "topic": { "const": "cosmos" } } },
            "then": { "properties": { "position": { "enum": ["providence", "atoms", "undecided", "both_entertained"] } } } },
          { "if": { "properties": { "topic": { "const": "fate_and_agency" } } },
            "then": { "properties": { "position": { "enum": ["fate", "assent_is_ours", "both"] } } } },
          { "if": { "properties": { "topic": { "const": "death" } } },
            "then": { "properties": { "position": { "enum": ["dissolution", "return_to_logos", "indifferent"] } } } }
        ]
      }
    },

    "themes": {
      "type": "array",
      "items": { "enum": ["control", "cosmos_logos", "death", "duty", "perception", "virtue", "emotion", "community", "time", "nature"] },
      "minItems": 1
    },
    "themes_freeform": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Optional. Original free-form theme labels kept from earlier corpus versions."
    },

    "ingest": {
      "type": "object",
      "required": ["version", "tagged_by"],
      "properties": {
        "version": { "type": "string" },
        "tagged_by": { "enum": ["human", "llm_reviewed_by_human", "llm_unreviewed"], "description": "Production retrieval excludes stance and theme tags marked llm_unreviewed." },
        "token_count": { "type": "integer" },
        "notes": { "type": "string" }
      }
    }
  }
}
```

## Example chunk (Meditations 4.3, Casaubon excerpt)

```json
{
  "chunk_id": "marcus.meditations.4.3.casaubon1634",
  "text": "A man cannot any whither retire better than to his own soul; he especially who is beforehand provided of such things within, which whensoever he doth withdraw himself to look in, may presently afford unto him perfect ease and tranquillity.",
  "text_language": "en",
  "text_scope": "excerpt",
  "author": { "name": "Marcus Aurelius", "school_phase": "roman", "taught_by": ["Epictetus (via Rusticus)"] },
  "work": "Meditations",
  "address": { "canonical": "4.3", "edition_ref": "IV.III", "book": 4, "section": 3 },
  "translation": {
    "translation_id": "casaubon1634",
    "translator": "Meric Casaubon",
    "year": 1634,
    "edition_or_source": "Project Gutenberg #2680 (Casaubon text; modernized spelling; file header may omit translator)",
    "license": "public_domain"
  },
  "source_type": "primary",
  "reported_by": null,
  "voice_permission": "first_person_ok",
  "stance": [],
  "themes": ["control", "emotion"],
  "ingest": { "version": "0.2", "tagged_by": "llm_unreviewed", "token_count": 52 }
}
```

Stance is empty here on purpose. The providence-or-atoms sentence is in the same section (4.3) but not in this excerpt. It belongs in its own chunk, which would carry `cosmos: both_entertained`.

## Chunking rules

- Chunk by the source's natural unit: Meditations by book.section, Discourses by book.chapter (split long chapters at section numbers), Enchiridion by chapter, Letters by letter (split at paragraph breaks if over ~600 tokens).
- When a chunk is an excerpt of a section, set `text_scope` to `excerpt`. Several excerpts of one section are allowed and share the same `address.canonical`, so `chunk_id` must be made unique with a suffix (`.a`, `.b`) after the translation id.
- Never split a passage mid-argument. Keep very short adjacent sections separate rather than merging.
- Translation swaps keep `address.canonical` and change `translation_id`, `edition_ref` and `chunk_id`.
- Fragments and testimonia get their own chunks with `reported_by` filled in. Do not fold them into a primary author's chunks.

## Validation rules (reject on ingest)

1. `source_type` is fragment or testimonium and `reported_by` is null.
2. `source_type` is fragment or testimonium and `voice_permission` is `first_person_ok`.
3. `translation.license` is not `public_domain` or `licensed`.
4. Duplicate `chunk_id`.
5. `stance.position` not in the controlled vocabulary for its `topic`, or `topic` not one of the three defined.
6. For work `Meditations`: `address.canonical` does not match `^(1[0-2]|[1-9])\.[1-9][0-9]?$`.
7. `address.book` and `address.section` do not equal the parts of `address.canonical` (where both are given).
8. `chunk_id` does not start with `{author_slug}.{work_slug}.{canonical}.{translation_id}`.
9. `text_scope` missing or not one of the two values.

## Retrieval and response rules

- For tension queries (e.g. providence vs atoms), retrieve chunks tagged `both_entertained` (Meditations 4.3, 6.10 and 9.28 each set out the alternatives themselves) and, where available, at least one single-pole chunk (`providence` or `atoms`) from another passage. Retrieval filters on `stance` rather than relying on semantic similarity alone.
- Cap authors per response at 3.
- Exclude stance and theme tags marked `llm_unreviewed` from production retrieval.

## Response log schema (for audit and drift tracking)

```json
{
  "response_id": "string",
  "timestamp": "ISO 8601",
  "query_theme": ["string"],
  "chunks_used": [
    { "chunk_id": "string", "role": "voice | tension_pole | testimonium_citation", "output_span": "optional: which sentence(s) it fed" }
  ],
  "authors_used": ["string"],
  "stance_poles_surfaced": [{ "topic": "string", "positions": ["string"] }]
}
```

Use this log to monitor author balance over time (e.g. Seneca crowding out Marcus) and to answer "which passage fed this sentence."

## Open decisions for the builder

- Vocabularies for stance topics beyond the three defined (emotion, politics_and_duty, knowledge) and the final `themes` list (starter list above).
- Whether `stance` tagging is done by hand for the Marcus/Epictetus core and LLM-assisted with review for the rest.
- Source of truth for texts (Perseus vs Gutenberg) and the exact translation edition for each.
