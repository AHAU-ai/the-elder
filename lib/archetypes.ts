import { LineageKey } from './lineages';

export interface ArchetypeCard {
  name: string;
  role: string;
  existentialField: string;
  gift: string;
  shadow: string;
  elderQuestion: string;
  canonicalAnchor: string;
}

export interface LineageArchetypes {
  diagnosticQuestions: string[];
  archetypes: ArchetypeCard[];
}

export const LINEAGE_ARCHETYPES: Record<LineageKey, LineageArchetypes> = {

  default: {
    diagnosticQuestions: [
      "What wound do you carry that you have never shown to another person?",
      "What have you destroyed — and what was born in the wreckage?",
      "What calls you forward that you keep refusing to answer?",
    ],
    archetypes: [
      {
        name: "The Wounded Healer",
        role: "The one whose wound becomes the instrument",
        existentialField: "Suffering as initiation — the wound that opens the gift",
        gift: "The capacity to hold others in their darkest passages because you have walked there yourself",
        shadow: "Using others' wounds to avoid your own — healing as flight from the self",
        elderQuestion: "What would remain of your purpose if you were no longer in pain?",
        canonicalAnchor: "Chiron — the immortal who cannot heal himself, yet heals all others",
      },
      {
        name: "The Threshold Guardian",
        role: "The keeper of the between-place",
        existentialField: "Liminality — permanent residency at the crossing point",
        gift: "The ability to stand in uncertainty without collapsing it prematurely into resolution",
        shadow: "Guarding the threshold so well that nothing — including yourself — ever crosses it",
        elderQuestion: "What are you guarding against that you claim to be guarding for?",
        canonicalAnchor: "The fire at the cave mouth — the place where the known ends",
      },
      {
        name: "The Descent Maker",
        role: "The one who goes under willingly",
        existentialField: "The necessary downward movement — toward what must be faced",
        gift: "The willingness to lose what must be lost in order to arrive at what cannot be found any other way",
        shadow: "Mistaking descent for collapse — wearing destruction as identity",
        elderQuestion: "Are you descending, or have you simply fallen and named it a choice?",
        canonicalAnchor: "Inanna at the seven gates — stripped of everything, arriving naked before the dark",
      },
    ],
  },

  maya: {
    diagnosticQuestions: [
      "What house of Xibalba are you moving through right now — which Lord governs this ordeal?",
      "What in your life has been stripped away that you once believed was essential to your survival?",
      "The corn must die in the ground before it can become food. What in you is still refusing the ground?",
    ],
    archetypes: [
      {
        name: "The Corn Seed",
        role: "The life-force that must descend before it can rise",
        existentialField: "The milpa cycle — death underground as the condition of future abundance",
        gift: "The knowledge that descent is not failure but preparation — the seed knows what the standing stalk has forgotten",
        shadow: "Refusing to be planted — remaining a seed forever, intact and sterile",
        elderQuestion: "What ground are you refusing to enter because you fear you will not emerge?",
        canonicalAnchor: "Hun Hunahpu's skull hung in the calabash tree — still generating life from death",
      },
      {
        name: "The Ball Court Player",
        role: "The one who plays the game that cannot be refused",
        existentialField: "The contest with Xibalba — where the stakes are always life itself",
        gift: "The understanding that the Lords of death must be met with cunning and sacred play, not with force",
        shadow: "Becoming so skilled at the game that you forget the game was meant to be survived, not perfected",
        elderQuestion: "What challenge before you are you treating as a performance when it requires your life?",
        canonicalAnchor: "Hunahpu and Xbalanque in the House of Darkness — navigating by what they carry, not what they can see",
      },
      {
        name: "Ix K'ik' — Blood Moon",
        role: "The one who receives the impossible and carries it forward",
        existentialField: "Conception through the word — the power to bring forth life from what appeared to be only death",
        gift: "The capacity to receive what falls from the dead place and transform it into living continuation",
        shadow: "Carrying the seed of another's destiny while never planting your own",
        elderQuestion: "Whose story are you gestating — and when does your own story begin?",
        canonicalAnchor: "Ix K'ik' receiving the spittle of Hun Hunahpu — the dead man's word becomes the living child",
      },
      {
        name: "The Ajq'ij",
        role: "The daykeeper — the one who reads the living count",
        existentialField: "Time as sacred architecture — each day a force, not an empty container",
        gift: "The ability to stand inside time's pattern and name what it is asking of those who move through it",
        shadow: "Reading the count for others while refusing to read your own nahual's demand",
        elderQuestion: "What does your own nahual ask of you that you have been too busy counting days to hear?",
        canonicalAnchor: "The Chol Q'ij — twenty nahuales turning in their eternal round",
      },
    ],
  },

  norse: {
    diagnosticQuestions: [
      "What is already woven in your wyrd that you have been pretending is still a choice?",
      "What have you sacrificed that was actually worth sacrificing — and what did you receive in return?",
      "Where is the frost-giant operating in your life — the force that destroys what it cannot control?",
    ],
    archetypes: [
      {
        name: "The Hanged One",
        role: "The one who surrenders to ordeal in order to receive knowledge",
        existentialField: "Wisdom as cost — nothing of worth arrives without sacrifice",
        gift: "The understanding that the runes are not discovered but earned — through the willingness to hang between worlds",
        shadow: "Performing sacrifice without genuine surrender — the gesture without the fall",
        elderQuestion: "What are you pretending to sacrifice while keeping the most important thing safely intact?",
        canonicalAnchor: "Odin on Yggdrasil — nine days hanging, no food, no water, until the runes rise",
      },
      {
        name: "The Volva",
        role: "The seeress who speaks what fate has already woven",
        existentialField: "Wyrd as already-written — the seeress reads what is, not what might be",
        gift: "The capacity to name what others cannot bear to see — and to name it without flinching",
        shadow: "Using the gift of sight as power over others rather than service to the pattern",
        elderQuestion: "What do you already know that you have been refusing to speak aloud?",
        canonicalAnchor: "The Voluspa — the seeress summoned from the dead to speak the fate of the worlds",
      },
      {
        name: "The Wyrd-Bound",
        role: "The one living out what the Norns cut at birth",
        existentialField: "Fate as tapestry — the thread's length was set before the first breath",
        gift: "The freedom that comes from accepting what was always already true — action without the weight of futile resistance",
        shadow: "Using fate as an excuse to abdicate the choices that are genuinely yours to make",
        elderQuestion: "What are you blaming on the Norns that is actually within your own hand to change?",
        canonicalAnchor: "The three Norns at the Well — Urd, Verdandi, Skuld — weaving without pause",
      },
    ],
  },

  taoist: {
    diagnosticQuestions: [
      "What are you forcing right now that the Tao is clearly asking you to release?",
      "Where in your life are you generating the opposite of what you intend through the very effort of your trying?",
      "What would remain if you stopped doing everything you do to make yourself feel safe?",
    ],
    archetypes: [
      {
        name: "The Uncarved Block",
        role: "The one who has not yet been shaped by the world's demands",
        existentialField: "Pu — original nature before the ten thousand things impose their forms",
        gift: "The capacity to receive any shape without losing the root — to be water, not ice",
        shadow: "Mistaking formlessness for undevelopment — using the uncarved block as permission to remain unconscious",
        elderQuestion: "What have you let the world carve away that you now need to recover?",
        canonicalAnchor: "Chapter 28 of the Tao Te Ching — return to the uncarved block",
      },
      {
        name: "The Water Bearer",
        role: "The one who yields and thereby overcomes",
        existentialField: "Wu wei — the power of non-contention, the strength of apparent weakness",
        gift: "The understanding that the softest thing in the world overcomes the hardest — that yielding is not defeat",
        shadow: "Using spiritual yielding to avoid the genuine confrontation that is actually required",
        elderQuestion: "Where is your yielding wisdom — and where is it avoidance wearing wisdom's face?",
        canonicalAnchor: "Chapter 78 — nothing in the world is softer than water, yet nothing surpasses it in overcoming the hard",
      },
      {
        name: "The Cook of Prince Hui",
        role: "The master who moves through the world without friction",
        existentialField: "Skill as Tao-alignment — the naturalness that looks like effortlessness from outside",
        gift: "The capacity to find the spaces that already exist in things and move through them without forcing",
        shadow: "Performing effortlessness as an aesthetic while still driven by the need to be seen as masterful",
        elderQuestion: "Where are you still using your blade on bone — and where have you found the natural spaces?",
        canonicalAnchor: "Zhuangzi — the cook who has not replaced his knife in nineteen years",
      },
    ],
  },

  greek: {
    diagnosticQuestions: [
      "What is the hamartia — the specific flaw — that keeps generating the same consequence in your life?",
      "Which god have you refused to honor — and in what form has that god returned uninvited?",
      "What oracle have you been given that you have been trying to outrun?",
    ],
    archetypes: [
      {
        name: "The Tragic Hero",
        role: "The one whose greatness and fatal flaw are the same force",
        existentialField: "Hamartia — the specific wound or excess that drives both the rise and the fall",
        gift: "The magnitude that makes the fall meaningful — only the tall tree casts a long shadow",
        shadow: "The inability to see the flaw that everyone else can see — hubris as blindness to one's own pattern",
        elderQuestion: "What quality do you most prize in yourself that is also what is bringing you down?",
        canonicalAnchor: "Oedipus — the man who solved the Sphinx's riddle yet could not read his own fate",
      },
      {
        name: "The Orpheus Wound",
        role: "The one who descends for love and loses through looking back",
        existentialField: "The descent into Hades — love as the motive that breaks the final law",
        gift: "The knowledge that some things must be trusted in the dark — that the final moment of the ordeal requires surrender of control",
        shadow: "The compulsion to verify, to look back, to make certain — destroying the thing by refusing to trust it",
        elderQuestion: "What are you looking back at right now that you need to trust enough to leave behind?",
        canonicalAnchor: "Orpheus on the ascent from Hades — Eurydice behind him, the prohibition he cannot keep",
      },
      {
        name: "The Pythia",
        role: "The one who speaks what the god moves through them to say",
        existentialField: "Entheos — the divine within, speaking through the human vessel",
        gift: "The capacity to be a clear instrument — to transmit what arrives without the ego's interference",
        shadow: "Speaking as if from the god when it is only the self — mistaking one's own desire for divine instruction",
        elderQuestion: "When you speak your truth most fully — is it you speaking, or something moving through you?",
        canonicalAnchor: "The Pythia of Delphi on her tripod above the sacred fissure — breathing the pneuma, speaking in tongues",
      },
    ],
  },

  egyptian: {
    diagnosticQuestions: [
      "What would the feather of Ma'at find when it weighs your heart — what does your heart carry that it has not yet confessed?",
      "What has been dismembered in your life — what Osiris-scattered pieces are waiting for an Isis to gather them?",
      "What is your Ka trying to tell you that your waking self refuses to hear?",
    ],
    archetypes: [
      {
        name: "The Dismembered King",
        role: "The one who must be scattered before being gathered into new form",
        existentialField: "The Osiris cycle — death, scattering, and the loving reconstruction of identity",
        gift: "The knowledge that what is gathered after dismemberment is more whole than what existed before the scattering",
        shadow: "Remaining in the scattered state — refusing the Isis-work of gathering because it requires admitting the death",
        elderQuestion: "Who is doing the work of Isis for you — and are you letting them find all the pieces?",
        canonicalAnchor: "Osiris scattered across Egypt — fourteen pieces that Isis finds, one that the Nile keeps",
      },
      {
        name: "The Weigher of Hearts",
        role: "The one who stands before the final truth without deception",
        existentialField: "Ma'at — cosmic truth, balance, the feather that judges all",
        gift: "The capacity for radical honesty — to stand before the scale without inflation or diminishment",
        shadow: "The forty-two negative confessions spoken without genuine reckoning — spiritual performance instead of true weighing",
        elderQuestion: "If your heart were weighed against the feather right now — what would tip the scale?",
        canonicalAnchor: "The Hall of Two Truths — Anubis at the scale, Thoth recording, Ammit waiting",
      },
      {
        name: "The Solar Barque Rider",
        role: "The one who descends into the Duat each night and rises each dawn",
        existentialField: "The eternal recurrence — Ra's nightly death and morning resurrection as cosmic law",
        gift: "The understanding that every ending is a passage, not an annihilation — the sun sets to rise",
        shadow: "Identifying with the darkness of the Duat as permanent — forgetting that the barque moves",
        elderQuestion: "You are somewhere in the twelve hours of the night journey — which hour are you in?",
        canonicalAnchor: "The Amduat — Ra's twelve-hour passage through the underworld, battling Apophis",
      },
    ],
  },

  dreamtime: {
    diagnosticQuestions: [
      "What Songline runs beneath the ground you are standing on — and are you walking it or crossing it against the grain?",
      "What ceremony in your life has been left unfinished — what Dreaming story was interrupted and has not been completed?",
      "What country — inner or outer — have you been displaced from, and what part of yourself left with it?",
    ],
    archetypes: [
      {
        name: "The Songline Walker",
        role: "The one who moves through the world by singing the country into being",
        existentialField: "The Songlines as living map — every step a word in the story the ancestors sang",
        gift: "The knowledge that the path is not found but sung — that the land responds to the voice that knows it",
        shadow: "Walking the land without singing — moving through the world as if it were merely geography",
        elderQuestion: "What is the song you were given to sing — and when did you stop singing it?",
        canonicalAnchor: "The great Songlines of Australia — paths of ancestral creation that cross the continent",
      },
      {
        name: "The Dreaming Ancestor",
        role: "The one who carries the creative time in their body",
        existentialField: "The Dreaming — not past but ever-present, the ancestral creative force alive in this moment",
        gift: "The capacity to act from the Dreaming rather than merely the waking — to create as the ancestors created",
        shadow: "Claiming the Dreaming as identity while living entirely in the waking — the name without the fire",
        elderQuestion: "What are you creating right now that will still be singing in the country after you are gone?",
        canonicalAnchor: "The ancestral beings who sang the world into existence — still moving, still creating",
      },
      {
        name: "The Broken Songline",
        role: "The one whose ancestral story has been interrupted",
        existentialField: "Disconnection from country — the wound of displacement from the living land",
        gift: "The particular power of the one who has been separated and finds the way back — the restoration that only the broken can perform",
        shadow: "Remaining in the wound of disconnection — making the break itself the identity",
        elderQuestion: "Where is the nearest strand of the Songline that still runs — and can you hear it?",
        canonicalAnchor: "The Songlines that were severed — and the work of listening them back into audibility",
      },
    ],
  },

  vedic: {
    diagnosticQuestions: [
      "What veil — what maya — are you most attached to, the one you would fight hardest to keep in place?",
      "What is your dharma calling you toward that your ego keeps translating into something safer?",
      "Tat tvam asi — That thou art. What in you most fiercely resists this recognition?",
    ],
    archetypes: [
      {
        name: "Arjuna on the Field",
        role: "The one who must fight the war they do not want to fight",
        existentialField: "Dharmic duty in conflict with personal attachment — the war that must be entered",
        gift: "The Gita itself — the teaching that only arrives in the middle of the unbearable choice",
        shadow: "Paralysis disguised as compassion — refusing the necessary action because action has cost",
        elderQuestion: "What battle are you refusing to enter — and what teaching is waiting for you there?",
        canonicalAnchor: "Arjuna between the armies, bow lowered, asking Krishna why he must fight",
      },
      {
        name: "The Veil-Wearer",
        role: "The one who has mistaken maya for reality",
        existentialField: "Maya — the cosmic illusion that presents the separate self as fundamental",
        gift: "The moment of recognition — when the veil thins and the Atman behind the persona becomes visible",
        shadow: "Spiritual bypassing — using the concept of maya to avoid genuine engagement with the world",
        elderQuestion: "Which of your most cherished beliefs about yourself is the veil you most need to see through?",
        canonicalAnchor: "Indra's net — each jewel reflecting all others, none independent",
      },
      {
        name: "The Renunciant",
        role: "The one called to release the fruits of action",
        existentialField: "Nishkama karma — action without attachment to outcome",
        gift: "The freedom that comes when the action is complete in itself, independent of what it produces",
        shadow: "Spiritual detachment as emotional unavailability — renunciation as a way of never being touched",
        elderQuestion: "What would you do differently today if you were genuinely unattached to what it produced?",
        canonicalAnchor: "Krishna's teaching on the yoga of action — do the work, release the fruit",
      },
    ],
  },

  yoruba: {
    diagnosticQuestions: [
      "What agreement did your Ori make before birth that your waking self has been trying to renegotiate?",
      "Which Orisha is most active in your life right now — and are you feeding it or fleeing from it?",
      "What crossroads are you standing at — and what have you been carrying to the wrong destination?",
    ],
    archetypes: [
      {
        name: "The Ori's Agreement",
        role: "The one living out the destiny the head chose before birth",
        existentialField: "Ori and ayanmo — the personal destiny selected before incarnation",
        gift: "The alignment that comes when one stops fighting the agreement and begins living it consciously",
        shadow: "The obstructed Ori — the destiny blocked by broken agreements, accumulated debt, or the interference of the ego",
        elderQuestion: "What does your Ori know about your purpose that you have been refusing to hear?",
        canonicalAnchor: "The moment before birth — choosing one's Ori from among those the Creator offers",
      },
      {
        name: "Eshu at the Crossroads",
        role: "The trickster-messenger who opens and closes all roads",
        existentialField: "The crossroads as the site of all possibility and all misdirection",
        gift: "The understanding that Eshu's tricks are teachings — that the wrong road taken consciously becomes the right road",
        shadow: "Blaming Eshu for the road you chose — refusing to acknowledge your own misdirection",
        elderQuestion: "What message has Eshu been trying to deliver that you have been refusing to receive?",
        canonicalAnchor: "Eshu at the crossroads — the first to be fed, the last to be forgotten",
      },
      {
        name: "The Oshun Current",
        role: "The one carrying the force of love, beauty, and fresh water",
        existentialField: "Oshun's domain — sweetness, desire, the river that gives life to the dry land",
        gift: "The capacity to sweeten what has become bitter — to bring the fresh water to what has stagnated",
        shadow: "The wound of Oshun — the one whose gifts were refused, who withdrew the sweet water and left only salt",
        elderQuestion: "Where has the river in you gone underground — and what would it take to bring it back to the surface?",
        canonicalAnchor: "Oshun's withdrawal when the other Orishas ignored her — and the world's desperate summoning of her return",
      },
    ],
  },

  sufi: {
    diagnosticQuestions: [
      "From what reed bed have you been cut — what original wholeness does your longing remember?",
      "What in you is the nafs al-ammara — the commanding self that mistakes its own voice for the Beloved's?",
      "The Beloved hid so that you would search. What has your searching revealed about the seeker?",
    ],
    archetypes: [
      {
        name: "The Reed",
        role: "The one whose wound of separation is also the instrument of song",
        existentialField: "The cut from the reed bed — separation as the condition of music",
        gift: "The knowledge that the wound and the song are one — that the cry of longing is already the finding",
        shadow: "Dwelling in the wound without discovering the music — separation as identity, not as instrument",
        elderQuestion: "Have you discovered yet that the crying is the song — or are you still waiting for the pain to stop before you begin?",
        canonicalAnchor: "The opening lines of Rumi's Masnavi — Beshno in nay — listen to this reed",
      },
      {
        name: "The Moth and the Flame",
        role: "The one who moves toward annihilation as the highest form of union",
        existentialField: "Fana — the annihilation of the ego-self in the divine fire",
        gift: "The willingness to be consumed — to prefer the flame to the shadow one casts by staying safely distant",
        shadow: "Performing the longing without the genuine willingness to be changed — circling the flame without entering",
        elderQuestion: "How close are you actually willing to fly — and what are you protecting by keeping the safe distance?",
        canonicalAnchor: "Attar's Conference of the Birds — the thirty birds who become the Simorgh",
      },
      {
        name: "The Drunken Mystic",
        role: "The one intoxicated by the divine presence — beyond the law's categories",
        existentialField: "The wine of divine knowledge — the state beyond the mind's categories of permitted and forbidden",
        gift: "The direct experience that no doctrine can contain — the taste of the Beloved that silences all argument",
        shadow: "Spiritual intoxication as escape from genuine responsibility — using the mystic state to avoid the work of earth",
        elderQuestion: "What are you using the wine to forget that needs instead to be faced sober and clear?",
        canonicalAnchor: "Hafiz in the tavern — the place where divine love operates beyond the mosque's permission",
      },
    ],
  },

  stoic: {
    diagnosticQuestions: [
      "What in your current situation is genuinely up to you — and what have you been treating as yours to control that never was?",
      "What false belief about what is good is generating the passion — the fear or desire — that is making you suffer?",
      "What would Marcus Aurelius say to you, right now, about the story you are telling yourself about this situation?",
    ],
    archetypes: [
      {
        name: "The Examined One",
        role: "The one who applies the logos to every impulse before acting",
        existentialField: "The hegemonikon — the ruling faculty that must be kept clean and directed",
        gift: "The capacity to create space between stimulus and response — to choose the response rather than simply enact the reflex",
        shadow: "Analysis as avoidance — using philosophical examination to perpetually defer the action that clarity demands",
        elderQuestion: "You have examined this sufficiently. What does the examination tell you to do — and why have you not done it?",
        canonicalAnchor: "Marcus Aurelius in the Meditations — writing to himself, holding himself to account, without an audience",
      },
      {
        name: "The Preferred Indifferent",
        role: "The one learning to hold externals without being held by them",
        existentialField: "Ta adiaphora — health, wealth, reputation as preferred but not required",
        gift: "The freedom that comes when one can engage fully with the world while remaining unshaken by what the world returns",
        shadow: "Stoic numbness disguised as Stoic peace — the cutting off of genuine feeling under the name of philosophy",
        elderQuestion: "What are you calling indifference that is actually suppression — and what cost is that suppression extracting?",
        canonicalAnchor: "Epictetus — the slave who was more free than his master, because he knew what was his",
      },
      {
        name: "The Memento Mori Bearer",
        role: "The one who holds the skull — death as clarifying companion",
        existentialField: "Amor fati — love of fate, including the fate of one's own death",
        gift: "The clarity that comes when death is kept close — when the shortness of the time renders the trivial trivial",
        shadow: "Using memento mori as a way to avoid investment — death-awareness as emotional preemptive surrender",
        elderQuestion: "If you had one year — not metaphorically, actually — what would immediately become obviously wrong with how you are spending today?",
        canonicalAnchor: "Marcus Aurelius on impermanence — Alexander and his muleteer both equally dust",
      },
    ],
  },

  mekubal: {
    diagnosticQuestions: [
      "What in your life is broken that you have not yet named broken?",
      "Where are you trying to possess what can only be received?",
      "What have you been carrying that arrived before you did?",
    ],
    archetypes: [
      {
        name: "The Vessel",
        role: "Carrier of sparks without claiming to be the light",
        existentialField: "The tension between holding the form and not becoming the form",
        gift: "The capacity to carry what you did not make",
        shadow: "Mistaking the vessel for the source",
        elderQuestion: "What are you holding that is not yours to keep, but that you are not yet willing to pass on?",
        canonicalAnchor: "Zohar — the vessel and the light, shevirat ha-kelim",
      },
      {
        name: "The Gatherer of Sparks",
        role: "One who recognizes the holy in the broken",
        existentialField: "Tikkun — repair as the only possible orientation to a shattered world",
        gift: "Seeing the light that survives the breaking",
        shadow: "Using the language of repair to avoid the work of repair",
        elderQuestion: "Which broken thing in your life are you willing to gather rather than discard?",
        canonicalAnchor: "Lurianic Kabbalah — nitzotzot, the scattered sparks",
      },
    ],
  },

  buddhist: {
    diagnosticQuestions: [
      "What have you been sheltered from that a single encounter with old age, sickness, or death would unmake?",
      "What loss are you carrying as though it were uniquely yours — and what would it mean to see it as universal?",
      "What have you already done that you believe places you permanently outside the possibility of change?",
    ],
    archetypes: [
      {
        name: "The Four Sights",
        role: "The sheltered one who cannot unsee what has been seen",
        existentialField: "Dukkha's first appearance — the moment protection from suffering fails and cannot be restored",
        gift: "The clarity that comes only from confronting what was hidden — the beginning of the path is always a rupture",
        shadow: "Turning the shock of seeing into despair rather than the first noble truth — mistaking the sight of suffering for the whole of reality rather than its beginning",
        elderQuestion: "What have you already seen that you cannot unsee — and have you let it become the start of a path, or only a wound?",
        canonicalAnchor: "The traditional account of the young Siddhartha's four chariot rides — old age, sickness, death, and the wandering ascetic",
      },
      {
        name: "Kisa Gotamī and the Mustard Seed",
        role: "The griever who believes her loss is singular",
        existentialField: "Dukkha universalized — grief mistaken for exception, healed by recognizing it as the shared condition of every house",
        gift: "The capacity to let grief connect rather than isolate — to find, in searching every household, that none is untouched",
        shadow: "Using the universality of loss to bypass the specific grief in front of you, rather than letting the search itself be the teaching",
        elderQuestion: "What are you searching for that would prove your grief is different from everyone else's — and what would you find if you kept searching honestly?",
        canonicalAnchor: "The Dhammapada commentary account of Kisa Gotamī, sent to find a mustard seed from a house death has never visited",
      },
      {
        name: "Aṅgulimāla",
        role: "The one who believes the past has already decided who they are",
        existentialField: "Kamma mistaken for a life sentence rather than a pattern that can be interrupted",
        gift: "Proof, in the tradition's own record, that no action places a person permanently beyond the path — 'I have stopped; you have not'",
        shadow: "Using 'I have already gone too far to change' as a shield against the harder work of actually stopping",
        elderQuestion: "What is the 'I have already gone too far' story you tell yourself — and is it protecting you, or keeping you exactly where you are?",
        canonicalAnchor: "The Aṅgulimāla Sutta (Majjhima Nikāya 86) — 'I have stopped, Aṅgulimāla; you stop too'",
      },
    ],
  },

};
