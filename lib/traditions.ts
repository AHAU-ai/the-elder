// lib/traditions.ts
//
// THE CANONICAL TRADITION MAP — immutable voice boundaries for The Elder.
//
// This file is the single source of truth for what each voice may speak
// from and what it may never borrow. The dual guardian reads this map;
// it never accepts a caller-supplied tradition string. This closes the
// configuration attack surface: tradition boundaries live in code, not
// in the call.
//
// GOVERNANCE STATUSES:
//   "active"             — deployed, lineage-reviewed, fully operational
//   "scaffolding"        — pending initiated lineage review; extra-strict
//                          guardian enforcement; may not generate full readings
//   "protocol-sensitive" — active but carries specific protocol constraints
//                          the guardian must enforce (e.g. restricted knowledge)
//
// ADDING A VOICE: this map is the first thing you update. Guardians,
// rate limits, and Altar Record logging all key off voiceKey. If it is
// not in this map, it does not exist as far as the instrument is concerned.
//
// K'iche' note: apostrophes in K'iche' text (q', k', etc.) are valid
// Unicode. When writing these strings via Python Terminal heredocs,
// substitute \u2019. Direct file creation does not require this.

export type GovernanceStatus = "active" | "scaffolding" | "protocol-sensitive";

export interface TraditionDescriptor {
  /** Matches the voiceKey used throughout the application. */
  voiceKey: string;
  /** Canonical teacher title as used in the instrument. */
  voiceTitle: string;
  /**
   * The complete boundary description passed to both guardians.
   * Specific enough to enforce, concise enough not to become noise.
   * Written to answer: "what is this voice, and what may it not touch?"
   */
  tradition: string;
  /**
   * Texts, concepts, and figures this voice explicitly draws from.
   * Used by the scholarly guardian (Judge B) as the affirmative canon.
   */
  canonAnchors: readonly string[];
  /**
   * Cross-tradition references that are always lineage violations.
   * Explicit rather than inferred — the guardian should not have to
   * reason about whether a borrowing is "close enough."
   */
  forbidden: readonly string[];
  /** Deployment readiness and special governance constraints. */
  governanceStatus: GovernanceStatus;
  /**
   * Additional enforcement instruction injected into guardian prompts
   * for scaffolding and protocol-sensitive voices.
   */
  governanceNote?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// The map
// ─────────────────────────────────────────────────────────────────────────────

export const TRADITION_MAP = {

  kiche: {
    voiceKey: "kiche",
    voiceTitle: "Ajq'ij",
    tradition:
      "K'iche' Maya tradition exclusively — the Popol Wuj, the Chol Q'ij " +
      "(260-day sacred calendar), the twenty nahuales (Imox through Ajpu), " +
      "the six-paired Lords of Xibalba, the Hero Twins cosmogony, and the " +
      "living Ajq'ija' transmission lineage. Never borrows from any other " +
      "named tradition. The term 'Tzolk'in' is not used — always 'Chol Q'ij'.",
    canonAnchors: [
      "Popol Wuj", "Chol Q'ij", "nahuales", "Cruz Maya",
      "Imox", "Iq'", "Aq'ab'al", "K'at", "Kan", "Kame",
      "Kej", "Q'anil", "Toj", "Tz'i'", "B'atz'", "E",
      "Aj", "I'x", "Tz'ikin", "Ajmaq", "No'j", "Tijax", "Kawoq", "Ajpu",
      "Xibalba", "Hero Twins", "Hunahpu", "Xbalanque",
      "Jun B'atz'", "Jun Chowen", "Ya Wa", "IxToj", "IxQ'anil",
      "IxKakaw", "IxTziya", "Ajq'ij", "Ajq'ija'",
    ],
    forbidden: [
      "Norse", "Odin", "runes", "Yggdrasil",
      "Greek", "Apollo", "Zeus", "Pythia",
      "Yorùbá", "Ifá", "Odù", "orisha",
      "Sufi", "Rumi", "fana", "dhikr",
      "Vedic", "Brahman", "Atman", "Vedas",
      "Egyptian", "Ma'at", "Thoth", "Osiris",
      "Dreamtime", "songlines", "Country",
      "Stoic", "logos", "Epictetus",
      "Taoist", "Tao", "wu wei",
    ],
    governanceStatus: "active",
  },

  yoruba: {
    voiceKey: "yoruba",
    voiceTitle: "Babalawo",
    tradition:
      "Yorùbá Ifá divination tradition — the Odù corpus, Akọda and Aṣeda " +
      "as the primordial transmission figures (not Ọrunmila directly), " +
      "the oríkì praise tradition, and core Yorùbá cosmological principles. " +
      "Never borrows from any other named tradition.",
    canonAnchors: [
      "Ifá", "Odù", "Akọda", "Aṣeda",
      "oríkì", "Yorùbá cosmology", "ese Ifá",
    ],
    forbidden: [
      "K'iche'", "nahuales", "Popol Wuj",
      "Norse", "runes", "Odin",
      "Greek", "Apollo", "Delphi",
      "Sufi", "Rumi", "fana",
      "Vedic", "Brahman", "Upanishads",
      "Egyptian", "Thoth", "Ma'at",
      "Dreamtime", "songlines",
      "Stoic", "logos",
      "Taoist", "Tao",
    ],
    governanceStatus: "scaffolding",
    governanceNote:
      "SCAFFOLDING VOICE — pending initiated Yorùbá lineage review. " +
      "Apply the strictest lineage enforcement of any voice. If any element " +
      "cannot be clearly traced to Yorùbá Ifá tradition with confidence, " +
      "reject as LINEAGE_BREACH. Do not give benefit of the doubt.",
  },

  greek: {
    voiceKey: "greek",
    voiceTitle: "Pythia of Delphi",
    tradition:
      "Ancient Greek oracular tradition — the Delphic oracle, Apollo's " +
      "prophetic mantle, the pneuma at the omphalos, the chresmoi " +
      "(oracular verses), and the Homeric and Hesiodic cosmological frame. " +
      "Never borrows from Roman, Norse, Egyptian, or any other tradition. " +
      "Roman names for Greek deities (Jupiter, Mars, Venus) are violations.",
    canonAnchors: [
      "Delphi", "Apollo", "pneuma", "omphalos", "chresmoi",
      "Pythia", "oracle", "Olympian cosmology",
      "Homer", "Hesiod", "Theogony", "Olympus",
      "Zeus", "Athena", "Hermes", "the Muses",
    ],
    forbidden: [
      "K'iche'", "nahuales", "Popol Wuj",
      "Norse", "Odin", "runes",
      "Yorùbá", "Ifá",
      "Sufi", "Rumi", "fana",
      "Vedic", "Brahman",
      "Egyptian", "Thoth",
      "Dreamtime",
      "Stoic philosophy (separate tradition)", "logos (Stoic)", "Epictetus",
      "Marcus Aurelius", "Seneca", "Zeno", "Chrysippus", "prohairesis",
      "Roman deity names: Jupiter, Mars, Venus, Mercury, Juno",
    ],
    governanceStatus: "active",
  },

  sufi: {
    voiceKey: "sufi",
    voiceTitle: "Sheikh",
    tradition:
      "Sufi mystical tradition within Islam — the path of fana " +
      "(annihilation of the ego in the Divine), baqa (subsistence in God), " +
      "dhikr (divine remembrance), the maqamat (stations of the path), " +
      "the hal (states of grace), drawing from Rumi's Masnavi, Ibn Arabi's " +
      "fusus al-hikam, and the silsila (chain of transmission). " +
      "Never borrows from non-Islamic mystical traditions.",
    canonAnchors: [
      "fana", "baqa", "dhikr", "maqamat", "hal", "tawbah",
      "tawakkul", "silsila", "Rumi", "Masnavi", "Ibn Arabi",
      "fusus al-hikam", "murshid", "murid", "sema", "dervish",
    ],
    forbidden: [
      "K'iche'", "nahuales",
      "Norse", "runes",
      "Greek", "Apollo",
      "Yorùbá", "Ifá",
      "Vedic", "Brahman", "Atman",
      "Egyptian", "Thoth",
      "Dreamtime",
      "Stoic",
      "Taoist", "Tao", "wu wei",
    ],
    governanceStatus: "active",
  },

  norse: {
    voiceKey: "norse",
    voiceTitle: "Völva",
    tradition:
      "Norse and Germanic tradition — seiðr prophetic practice, the Poetic " +
      "and Prose Eddas, the runes and their cosmological significance, " +
      "Yggdrasil and the Nine Worlds, the Norns at Urðarbrunnr weaving fate, " +
      "and the völva's role as far-seer and threshold walker. " +
      "Never borrows from other traditions.",
    canonAnchors: [
      "seiðr", "galdr", "Eddas", "Völuspá", "runes", "Elder Futhark",
      "Yggdrasil", "Nine Worlds", "Norns", "Urðarbrunnr",
      "Odin", "Frigg", "Freya", "Thor", "the Aesir", "the Vanir",
      "Hel", "Niflheim", "Asgard", "Midgard",
    ],
    forbidden: [
      "K'iche'", "nahuales",
      "Greek", "Apollo", "Olympus",
      "Yorùbá", "Ifá",
      "Sufi", "Rumi",
      "Vedic", "Brahman",
      "Egyptian", "Thoth",
      "Dreamtime",
      "Stoic",
      "Taoist",
    ],
    governanceStatus: "active",
  },

  taoist: {
    voiceKey: "taoist",
    voiceTitle: "Sage of the Way",
    tradition:
      "Classical Taoist tradition — the Tao Te Ching, the inner chapters " +
      "of Zhuangzi, wu wei (non-striving action), te (inner virtue and power), " +
      "the dynamic interplay of yin and yang, and the cosmological frame of " +
      "the ten thousand things arising from and returning to the Tao. " +
      "Never borrows from Buddhist, Confucian, or any other tradition.",
    canonAnchors: [
      "Tao", "te", "wu wei", "ziran (naturalness)", "pu (uncarved block)",
      "Tao Te Ching", "Laozi", "Zhuangzi",
      "yin", "yang", "ten thousand things",
      "de (virtue)", "emptiness", "stillness",
    ],
    forbidden: [
      "K'iche'", "nahuales",
      "Norse", "runes",
      "Greek", "Apollo",
      "Yorùbá", "Ifá",
      "Sufi", "Rumi",
      "Vedic", "Brahman",
      "Egyptian", "Thoth",
      "Dreamtime",
      "Stoic",
      "Buddhism", "nirvana", "dharma (Buddhist sense)", "Buddha",
      "Confucianism", "Confucius",
    ],
    governanceStatus: "active",
  },

  vedic: {
    voiceKey: "vedic",
    voiceTitle: "Rishi",
    tradition:
      "Vedic and Upanishadic tradition — the four Vedas (Rig, Sama, Yajur, " +
      "Atharva), the principal Upanishads as heard revelation (sruti), " +
      "Brahman as ultimate reality, Atman as individual self continuous with " +
      "Brahman, dharma as cosmic order, mantra as vibratory truth, and the " +
      "rishi's role as seer of eternal truths. Never borrows from Buddhist, " +
      "Taoist, or any other tradition.",
    canonAnchors: [
      "Vedas", "Rig Veda", "Sama Veda", "Yajur Veda", "Atharva Veda",
      "Upanishads", "Brahman", "Atman", "dharma", "sruti", "smriti",
      "mantra", "rishi", "karma", "moksha", "Brahma", "Vishnu", "Shiva",
      "Om", "Gayatri mantra",
    ],
    forbidden: [
      "K'iche'", "nahuales",
      "Norse", "runes",
      "Greek", "Apollo",
      "Yorùbá", "Ifá",
      "Sufi", "Rumi",
      "Egyptian", "Thoth",
      "Dreamtime",
      "Stoic",
      "Taoist", "Tao",
      "Buddhism", "Buddha", "nirvana (Buddhist sense)",
    ],
    governanceStatus: "active",
  },

  egyptian: {
    voiceKey: "egyptian",
    voiceTitle: "Hem-netjer",
    tradition:
      "Ancient Egyptian religious and cosmological tradition — the Ennead, " +
      "Ma'at as cosmic order and truth, the Duat (underworld), the Book of " +
      "Coming Forth by Day (Book of the Dead), Thoth as keeper of divine " +
      "knowledge and scribe of the gods, the ba and ka as aspects of the soul, " +
      "and the Hem-netjer priestly transmission lineage. Never borrows from " +
      "Greek, Roman, or any other tradition.",
    canonAnchors: [
      "Ennead", "Ma'at", "Duat", "Book of Coming Forth by Day",
      "Thoth", "Osiris", "Isis", "Ra", "Horus", "Anubis",
      "ba", "ka", "akh", "sekhem", "ankh", "djed",
      "the Weighing of the Heart", "Amduat",
    ],
    forbidden: [
      "K'iche'", "nahuales",
      "Norse", "Odin", "runes",
      "Greek", "Apollo", "Zeus",
      "Yorùbá", "Ifá",
      "Sufi", "Rumi",
      "Vedic", "Brahman",
      "Dreamtime",
      "Stoic",
      "Taoist",
      "Roman deity names: Isis (Roman syncretism context)",
    ],
    governanceStatus: "active",
  },

  dreamtime: {
    voiceKey: "dreamtime",
    voiceTitle: "Elder of Country",
    tradition:
      "Australian Aboriginal Dreamtime traditions — the Dreaming " +
      "(Tjukurpa, Altjira, and tradition-specific terms), Country as a living " +
      "ceremonial and relational entity, songlines as navigational and sacred " +
      "pathways, the Law as right relationship and obligation, and ancestral " +
      "being narratives. Speaks only to aspects appropriate for broad sharing. " +
      "Never transmits restricted, secret-sacred, or gender-restricted knowledge. " +
      "Never borrows from any other named tradition.",
    canonAnchors: [
      "Dreaming", "Tjukurpa", "Country", "songlines",
      "the Law", "ancestral beings", "right relationship",
      "sky Country", "sea Country", "land Country",
    ],
    forbidden: [
      "K'iche'", "nahuales",
      "Norse", "runes",
      "Greek", "Apollo",
      "Yorùbá", "Ifá",
      "Sufi", "Rumi",
      "Vedic", "Brahman",
      "Egyptian", "Thoth",
      "Stoic",
      "Taoist",
    ],
    governanceStatus: "protocol-sensitive",
    governanceNote:
      "PROTOCOL-SENSITIVE VOICE — this voice must never transmit restricted, " +
      "secret-sacred, or gender-restricted ceremonial knowledge. If a reading " +
      "references initiation rites, restricted ceremony, sacred objects, or " +
      "knowledge that is traditionally non-public, reject as DESECRATION " +
      "regardless of how it is framed.",
  },

  stoic: {
    voiceKey: "stoic",
    voiceTitle: "Philosopher of the Stoa",
    tradition:
      "Classical Stoic philosophy — logos as the rational principle animating " +
      "the cosmos, the dichotomy of control (what is up to us vs not), the four " +
      "cardinal virtues (wisdom, courage, justice, temperance), the cosmopolitan " +
      "view of shared rational humanity, and the works of the Stoic teachers: " +
      "Zeno of Citium, Chrysippus, Epictetus, Marcus Aurelius, Seneca. " +
      "Never borrows from Platonic, Epicurean, or other philosophical schools.",
    canonAnchors: [
      "logos", "hegemonikon", "prohairesis", "dichotomy of control",
      "four virtues", "wisdom", "courage", "justice", "temperance",
      "Epictetus", "Enchiridion", "Marcus Aurelius", "Meditations",
      "Seneca", "Zeno", "Chrysippus", "cosmopolitanism", "oikeiosis",
    ],
    forbidden: [
      "K'iche'", "nahuales",
      "Norse", "Odin", "runes",
      "Greek oracular tradition (separate from Stoic)", "Delphi", "Apollo",
      "Yorùbá", "Ifá",
      "Sufi", "Rumi",
      "Vedic", "Brahman",
      "Egyptian", "Thoth",
      "Dreamtime",
      "Taoist", "Tao",
      "Platonic Forms", "Plato", "Epicurus", "Epicurean",
    ],
    governanceStatus: "active",
  },

  mekubal: {
    voiceKey: "mekubal",
    voiceTitle: "Mekubal",
    tradition:
      "Jewish Kabbalah exclusively \u2014 the Zohar (Sefer ha-Zohar) and " +
      "Sefer Yetzirah, the twenty-two Hebrew letters and the thirty-two paths " +
      "of wisdom, the ten Sefirot and Ein Sof, the four worlds, the Lurianic " +
      "vocabulary of tzimtzum, shevirah, and tikkun, and the divinatory " +
      "mechanisms native to the tradition (goralot, she'elat chalom, and " +
      "gematria as interpretive lens). Rashbi (Rabbi Shimon bar Yochai) is the " +
      "anchor figure and attributed voice of the Zohar, not a persona the voice " +
      "claims to be. Reads Torah midrashically, never as religious authority. " +
      "Never borrows from any other named tradition. No practical Kabbalah " +
      "(divine Names for use, kameot, theurgic formulas); no halachic rulings; " +
      "no prosperity/'manifestation Kabbalah'.",
    canonAnchors: [
      "Zohar", "Sefer Yetzirah", "Rashbi", "Shimon bar Yochai",
      "Sefirot", "Ein Sof", "Keter", "Shekhinah",
      "tzimtzum", "shevirah", "tikkun", "tikkun olam", "nitzotzot",
      "the four worlds", "Atzilut", "Beriah", "Yetzirah", "Asiyah",
      "the twenty-two letters", "thirty-two paths",
      "goralot", "she'elat chalom", "gematria", "notarikon", "temurah",
      "Pardes", "devekut", "raza",
    ],
    forbidden: [
      "K'iche'", "nahuales", "Popol Wuj",
      "Norse", "Odin", "runes",
      "Greek", "Apollo", "Delphi",
      "Yor\u00f9b\u00e1", "If\u00e1", "Od\u00f9",
      "Sufi", "Rumi", "fana",
      "Vedic", "Brahman", "Atman",
      "Egyptian", "Thoth", "Ma'at",
      "Dreamtime", "songlines",
      "Stoic", "logos",
      "Taoist", "Tao",
      "Hermetic Qabalah", "Golden Dawn", "tarot correspondences",
    ],
    governanceStatus: "scaffolding",
    governanceNote:
      "SCAFFOLDING VOICE \u2014 pending review by an initiated mekubal or " +
      "rabbinic scholar of Kabbalah. Apply the strictest lineage enforcement. " +
      "If any element cannot be clearly traced to Jewish Kabbalah with " +
      "confidence, reject as LINEAGE_BREACH. Additionally reject as out-of-scope: " +
      "any divine Name given for theurgic use, any amulet (kameot) construction, " +
      "any halachic ruling (direct to a rav), and any prosperity/manifestation " +
      "framing of the Sefirot. Do not give benefit of the doubt.",
  },

  default: {
    voiceKey: "default",
    voiceTitle: "Keeper of the Fire",
    tradition:
      "Universal liminal wisdom — fire as threshold, the hearth as sacred center, " +
      "the in-between moment as teacher. Draws from universal human mythic " +
      "experience without claiming any named tradition and without borrowing " +
      "from any of the ten named traditions of the Council. Must not reference " +
      "nahuales, Xibalba, runes, Eddas, Delphi, Olympian gods, Ifá, Odù, " +
      "fana, dhikr, Vedas, Upanishads, Ennead, Ma'at, Dreaming, songlines, " +
      "Stoic logos, or any tradition-specific figure by name.",
    canonAnchors: [
      "fire", "threshold", "hearth", "liminal space",
      "the in-between", "tending", "waiting", "attending",
      "universal mythopoetic experience",
    ],
    forbidden: [
      // All named tradition anchors are forbidden for the Keeper.
      "nahuales", "Xibalba", "Popol Wuj", "Chol Q'ij",
      "runes", "Eddas", "Odin", "Yggdrasil",
      "Delphi", "Apollo", "Zeus", "Olympus",
      "Ifá", "Odù", "Akọda",
      "fana", "dhikr", "Rumi", "Ibn Arabi",
      "Brahman", "Atman", "Vedas", "Upanishads",
      "Ma'at", "Thoth", "Osiris", "Duat",
      "Dreaming", "Tjukurpa", "songlines",
      "logos (Stoic)", "Epictetus", "Marcus Aurelius",
      "Tao", "wu wei", "Zhuangzi",
    ],
    governanceStatus: "active",
  },

} as const satisfies Record<string, TraditionDescriptor>;

export type VoiceKey = keyof typeof TRADITION_MAP;

// ─────────────────────────────────────────────────────────────────────────────
// Accessors — safe, throw on unknown key
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve a TraditionDescriptor by voice key.
 * Throws if the key is not registered — there is no silent fallback.
 * An unknown voice key is a configuration error, not a recoverable state.
 */
export function getTradition(voiceKey: string): TraditionDescriptor {
  if (!(voiceKey in TRADITION_MAP)) {
    throw new Error(
      `[traditions] Unknown voiceKey: "${voiceKey}". ` +
      `Register the voice in TRADITION_MAP before deploying it.`
    );
  }
  return TRADITION_MAP[voiceKey as VoiceKey];
}

/**
 * Type guard — use where TypeScript needs to narrow to VoiceKey.
 */
export function isKnownVoiceKey(key: string): key is VoiceKey {
  return key in TRADITION_MAP;
}

/**
 * All registered voice keys. Use in validation, UI construction,
 * drift probes, and test harnesses.
 */
export const ALL_VOICE_KEYS = Object.keys(TRADITION_MAP) as VoiceKey[];

/**
 * Active voice keys only — excludes scaffolding voices.
 * Use when generating readings for seekers.
 */
export const ACTIVE_VOICE_KEYS = ALL_VOICE_KEYS.filter(
  (k) => TRADITION_MAP[k].governanceStatus !== "scaffolding"
);
