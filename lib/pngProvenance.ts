/**
 * pngProvenance.ts
 *
 * Embeds provenance.ts's machine-readable stamp (provenanceMetadata()) into
 * a PNG file's own bytes, client-side, as a standard tEXt chunk -- so the
 * downloaded/shared card carries its own traceability even after it leaves
 * the app entirely (re-uploaded elsewhere, saved to a phone, forwarded).
 * This is the resolution of provenance.ts's own doc comment on
 * provenanceMetadata(): "the machine-readable stamp embedded in every
 * exported/shared artifact" -- true of the PNG for both signed-in and
 * anonymous seekers alike (the one artifact every seeker actually gets;
 * share_card in lib/shareLedger.ts is the additional, signed-in-only
 * persisted-record half of "exported/shared").
 *
 * Pure client-side byte manipulation, matching ShareableCard.tsx's own
 * "composed and rasterized locally — never uploaded" design: no network
 * call, no server round-trip, just editing the Blob html-to-image already
 * produced before it's downloaded or (for a signed-in seeker) attached to
 * the share flow.
 *
 * PNG chunk format (spec: https://www.w3.org/TR/png/#5Chunk-layout):
 *   4-byte big-endian length (of DATA only) + 4-byte ASCII type +
 *   DATA + 4-byte CRC32 (over type+data).
 * IHDR, the first chunk, is always exactly 13 bytes of data (width, height,
 * bit depth, color type, compression, filter, interlace -- fixed by spec),
 * so it's always exactly 33 bytes total after the 8-byte PNG signature.
 * That makes "insert a new chunk right after IHDR" a safe, fixed offset
 * rather than something requiring a full chunk-stream parse.
 */

const PNG_SIGNATURE_LENGTH = 8;
const IHDR_CHUNK_LENGTH = 4 /* length */ + 4 /* type */ + 13 /* data */ + 4 /* crc */;
const INSERT_OFFSET = PNG_SIGNATURE_LENGTH + IHDR_CHUNK_LENGTH; // 33

// Standard PNG/zlib CRC32 (spec Annex D, reference implementation) -- table
// built once, not per call.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildTextChunk(keyword: string, text: string): Uint8Array {
  // tEXt data = Latin-1 keyword + null separator + Latin-1 text (spec
  // §11.3.4.3). The metadata here is all ASCII (version strings, voice
  // keys, ISO 8601 timestamps, UUID-shaped passage ids) so a plain
  // charCodeAt encoding is safe -- this is deliberately NOT iTXt (which
  // would be needed for real UTF-8 content) because there is none to carry.
  const keywordBytes = new Uint8Array(keyword.length);
  for (let i = 0; i < keyword.length; i++) keywordBytes[i] = keyword.charCodeAt(i) & 0xff;
  const textBytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) textBytes[i] = text.charCodeAt(i) & 0xff;

  const data = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  data.set(keywordBytes, 0);
  data[keywordBytes.length] = 0;
  data.set(textBytes, keywordBytes.length + 1);

  const type = new Uint8Array([0x74, 0x45, 0x58, 0x74]); // "tEXt"
  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type, 0);
  crcInput.set(data, type.length);
  const crc = crc32(crcInput);

  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  chunk.set(type, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc, false);
  return chunk;
}

const PROVENANCE_KEYWORD = "the-elder:provenance";

/**
 * Returns a new Blob with a tEXt chunk carrying JSON.stringify(metadata)
 * inserted right after the PNG's IHDR chunk. Fails soft: if the input
 * isn't recognizably a PNG (wrong signature), returns the original blob
 * unchanged rather than throwing -- an unstamped download is a smaller
 * problem than a broken one for a seeker in the middle of keeping a card.
 */
export async function embedProvenanceInPng(
  blob: Blob,
  metadata: Record<string, unknown>
): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());

  const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (buf[i] !== SIGNATURE[i]) return blob; // not a PNG -- leave untouched
  }
  // IHDR must be the first chunk and must be exactly 13 bytes of data per
  // spec -- confirm rather than assume, since the insert offset depends on it.
  const ihdrType = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
  const ihdrLength = new DataView(buf.buffer).getUint32(8, false);
  if (ihdrType !== "IHDR" || ihdrLength !== 13) return blob;

  const textChunk = buildTextChunk(PROVENANCE_KEYWORD, JSON.stringify(metadata));

  const out = new Uint8Array(buf.length + textChunk.length);
  out.set(buf.subarray(0, INSERT_OFFSET), 0);
  out.set(textChunk, INSERT_OFFSET);
  out.set(buf.subarray(INSERT_OFFSET), INSERT_OFFSET + textChunk.length);

  return new Blob([out], { type: "image/png" });
}
