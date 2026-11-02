// Validates Stoic chunk-schema v0.2 rules 1-9 (spec: docs/stoic-chunk-schema.md) on every
// corpus/stoic-passages.json entry that carries a chunk_id.
import fs from "node:fs";

const file = process.argv[2] ?? "corpus/stoic-passages.json";
const entries = JSON.parse(fs.readFileSync(file, "utf8")).filter((e) => "chunk_id" in e);
const STANCE = {
  cosmos: ["providence", "atoms", "undecided", "both_entertained"],
  fate_and_agency: ["fate", "assent_is_ours", "both"],
  death: ["dissolution", "return_to_logos", "indifferent"],
};
const slug = { "Marcus Aurelius": "marcus", Meditations: "meditations" };
const failures = [];
const seen = new Set();
const fail = (e, rule, msg) => failures.push(`${e.passage_id ?? e.chunk_id}: rule ${rule}: ${msg}`);

for (const e of entries) {
  const nonPrimary = e.source_type === "fragment" || e.source_type === "testimonium";
  if (nonPrimary && e.reported_by == null) fail(e, 1, "fragment/testimonium without reported_by");
  if (nonPrimary && e.voice_permission === "first_person_ok") fail(e, 2, "fragment/testimonium voiced first person");
  if (!["public_domain", "licensed"].includes(e.translation?.license)) fail(e, 3, `license ${e.translation?.license}`);
  if (seen.has(e.chunk_id)) fail(e, 4, `duplicate chunk_id ${e.chunk_id}`);
  seen.add(e.chunk_id);
  for (const s of e.stance ?? []) {
    if (!(s.topic in STANCE)) fail(e, 5, `topic ${s.topic} not defined`);
    else if (!STANCE[s.topic].includes(s.position)) fail(e, 5, `position ${s.position} not valid for ${s.topic}`);
  }
  const canon = e.address?.canonical;
  if (e.work === "Meditations" && !/^(1[0-2]|[1-9])\.[1-9][0-9]?$/.test(canon ?? "")) fail(e, 6, `canonical ${canon}`);
  const [b, s] = String(canon).split(".");
  if (e.address?.book != null && String(e.address.book) !== b) fail(e, 7, `book ${e.address.book} != ${b}`);
  if (e.address?.section != null && String(e.address.section) !== s) fail(e, 7, `section ${e.address.section} != ${s}`);
  const prefix = `${slug[e.author?.name] ?? "?"}.${slug[e.work] ?? "?"}.${canon}.${e.translation?.translation_id}`;
  if (!String(e.chunk_id).startsWith(prefix)) fail(e, 8, `chunk_id ${e.chunk_id} does not start with ${prefix}`);
  if (!["excerpt", "full_section"].includes(e.text_scope)) fail(e, 9, `text_scope ${e.text_scope}`);
}

console.log(`checked ${entries.length} chunk(s) in ${file}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("all rules 1-9 pass");
