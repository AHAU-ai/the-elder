// THE ELDER — Nahual Field Map
// Ojer Tzij Voice Architecture · Chol Q'ij · Imox-First Ordering
// Chol Q'ij anchor: April 22, 2020 = 5 Kawoq (lineage-verified)
// Orthography: "nahuales" not "day signs"; "Chol Q'ij" not "Tzolkin"

export interface Nahual {
  number: number;
  name: string;
  transcript: string;
  element: string;
  direction: string;
  existentialField: string;
  humanConditions: string[];
  shadow: string;
  gift: string;
  popol: string;
  question: string;
}

export const NAHUALES: Nahual[] = [
  {
    number: 1, name: "Imox", transcript: "Water / Emotion",
    element: "Water", direction: "East",
    existentialField: "The Depths / The Irrational / The Unconscious",
    humanConditions: ["The felt life beneath reason","Madness as a form of knowing","The ocean of collective memory","Empathy as dissolution of self","Dreams as navigation"],
    shadow: "Overwhelm, psychic flooding, loss of boundary",
    gift: "The capacity to feel what others cannot yet name",
    popol: "The primordial waters before creation — the still, dark sea from which all things would emerge",
    question: "What moves in you that has no name?"
  },
  {
    number: 2, name: "Iq'", transcript: "Wind / Breath",
    element: "Air", direction: "North",
    existentialField: "Breath / Voice / Spirit in Motion",
    humanConditions: ["The word as act of creation","Inspiration as literal in-breathing","Restlessness as a calling","The invisible force that moves visible things","Communication as ceremony"],
    shadow: "Instability, scattering, speaking without grounding",
    gift: "The capacity to carry messages between worlds",
    popol: "The breath of Tepew and Q'ukumatz that first called light into being",
    question: "What are you being called to carry?"
  },
  {
    number: 3, name: "Aq'ab'al", transcript: "Night / Dawn / Threshold",
    element: "Fire", direction: "West",
    existentialField: "Threshold / Becoming / The Not-Yet-Formed",
    humanConditions: ["The liminal moment between dark and light","Adolescence, transition, in-between states","The courage to face what is not yet clear","Clarity that arrives just before dawn","Beauty as a form of truth"],
    shadow: "Paralysis at the threshold, fear of becoming",
    gift: "The capacity to hold ambiguity until light arrives",
    popol: "The moment before Junajpu and Xb'alamke ascended — the last darkness before the sun was born",
    question: "What are you standing at the edge of?"
  },
  {
    number: 4, name: "K'at", transcript: "Fire / Harvest / The Net",
    element: "Fire", direction: "South",
    existentialField: "Entanglement / Abundance / Burden",
    humanConditions: ["The complexity of relationships","Abundance that binds as much as it feeds","The weight of what we carry for others","Creativity as gathering and weaving","The harvest as culmination of invisible labor"],
    shadow: "Ensnared by obligation, unable to release what is complete",
    gift: "The capacity to hold many threads without losing the pattern",
    popol: "The milpa — the cornfield as sacred net of sustenance and reciprocity",
    question: "What have you gathered, and what is time to release?"
  },
  {
    number: 5, name: "Kan", transcript: "The Serpent / Movement / Vital Force",
    element: "Earth", direction: "East",
    existentialField: "Vital Force / Temptation / Kundalini",
    humanConditions: ["Sexual energy as sacred force","The body as the site of wisdom","Temptation as invitation to transformation","Healing energy that moves through the spine","The cyclical shedding of old skin"],
    shadow: "Force without direction, seduction as manipulation",
    gift: "The capacity to transmute raw power into medicine",
    popol: "The feathered serpent — Q'ukumatz — who spoke the world into being alongside Tepew",
    question: "Where is your life force moving, and is it in your service?"
  },
  {
    number: 6, name: "Kame", transcript: "Ancestors / Death / Transformation",
    element: "Water", direction: "North",
    existentialField: "Death / Counsel of the Dead / Transformation",
    humanConditions: ["Death as a threshold, not an ending","The ancestors as living counsel","Grief as a form of love","Initiation through loss","The dead who speak through us"],
    shadow: "Attachment to what must die, refusal of transformation",
    gift: "The capacity to cross between worlds and return with knowledge",
    popol: "Xibalba — the lords of death whom the Hero Twins outwitted through wit, not force",
    question: "What death are you being asked to complete?"
  },
  {
    number: 7, name: "Kej", transcript: "The Deer / Authority / The Four Directions",
    element: "Air", direction: "West",
    existentialField: "Authority / The Four Directions / Sacred Leadership",
    humanConditions: ["Leadership as service, not dominance","The body as a compass oriented to the sacred","Grace under pressure","The four pillars of a human life","Strength as gentleness"],
    shadow: "Authority without humility, leadership without listening",
    gift: "The capacity to hold space for others without losing oneself",
    popol: "The deer as the form taken by the Hero Twins to confuse the Lords of Xibalba",
    question: "Where are you being called to lead, and from what center?"
  },
  {
    number: 8, name: "Q'anil", transcript: "Seed / Venus / Spark of Life",
    element: "Earth", direction: "South",
    existentialField: "Seed / Gestation / Venus / Fertility",
    humanConditions: ["The potential that has not yet broken ground","Patience as active trust","Venus as morning and evening star — the dual nature of becoming","Fertility of mind, body, and relationship","The long patience of germination"],
    shadow: "Seeds abandoned before they sprout, impatience with process",
    gift: "The capacity to trust what is not yet visible",
    popol: "The corn seed from which the first humans were formed — the sacred substance of humanity itself",
    question: "What seed have you planted that asks for your patience?"
  },
  {
    number: 9, name: "Toj", transcript: "Sacrifice / Blood / Reciprocity",
    element: "Fire", direction: "East",
    existentialField: "Debt / Payment / Reciprocity / Sacred Obligation",
    humanConditions: ["The law of reciprocity as cosmic structure","Sacrifice as conscious offering, not loss","The blood debt between humans and the sacred","Reparation and restoration of balance","Suffering as payment that clears a path"],
    shadow: "Martyrdom without consciousness, sacrifice without meaning",
    gift: "The capacity to give completely and trust that balance will be restored",
    popol: "Ix K'ik' — Blood Moon — one drop of blood for one drop of water, the exchange that began the Hero Twins' story",
    question: "What debt is asking to be paid, and what will be freed when you pay it?"
  },
  {
    number: 10, name: "Tz'i'", transcript: "The Dog / Instinct / Justice",
    element: "Water", direction: "North",
    existentialField: "Justice / Loyalty / The Law / Sexuality / Instinct",
    humanConditions: ["Loyalty as a sacred act","Sexual energy as a form of justice","The instinctual body as moral compass","Truth-telling as a form of love","The law that lives beneath written law"],
    shadow: "Betrayal, infidelity, corruption of the law for personal gain",
    gift: "The capacity to smell the truth before it is spoken",
    popol: "The dogs who guide the dead through Xibalba — faithful companions in the darkest crossing",
    question: "Where is your instinct telling you something your mind refuses to hear?"
  },
  {
    number: 11, name: "B'atz'", transcript: "The Monkey / Thread / Continuity",
    element: "Air", direction: "West",
    existentialField: "Continuity / The Arts / Sacred Thread / Time",
    humanConditions: ["Creativity as the act of weaving time","The artist as keeper of cultural memory","Play as a sacred technology","The thread that connects past and future","Laughter as a form of intelligence"],
    shadow: "Vanity, getting lost in craft at the expense of depth",
    gift: "The capacity to make the invisible visible through art",
    popol: "Hun B'atz' and Hun Chowen — the elder half-brothers of the Hero Twins, transformed into monkeys for their jealousy",
    question: "What thread are you weaving, and does it serve the whole?"
  },
  {
    number: 12, name: "E", transcript: "The Road / The Path / Destiny",
    element: "Earth", direction: "South",
    existentialField: "The Road / Destiny / The Journey / Commerce",
    humanConditions: ["Life as pilgrimage","The road as teacher","Commerce as an exchange of energy, not just goods","Destiny as a path that must be walked, not found","The courage to keep moving"],
    shadow: "Restlessness without direction, movement that avoids arrival",
    gift: "The capacity to find meaning in every step of the journey",
    popol: "The road into Xibalba — the long path the Hero Twins walked without flinching",
    question: "Where are you on your road, and what is the road asking of you?"
  },
  {
    number: 13, name: "Aj", transcript: "The Reed / The House / Authority",
    element: "Fire", direction: "East",
    existentialField: "The Home / Sacred Authority / The Staff / The Body as Temple",
    humanConditions: ["The home as a sacred center","Authority rooted in service","The body as a reed through which spirit speaks","Lineage and its responsibilities","The backbone of a community"],
    shadow: "Rigidity, authoritarianism, the staff used to exclude rather than support",
    gift: "The capacity to be a stable center for others without losing one's own root",
    popol: "The cornstalk — the sacred reed from which human beings were fashioned in the final creation",
    question: "What are you the center of, and is your center strong enough to hold it?"
  },
  {
    number: 14, name: "Ix", transcript: "The Jaguar / The Feminine / Earth Magic",
    element: "Earth", direction: "North",
    existentialField: "Earth Magic / The Feminine / Shamanic Power / Intuition",
    humanConditions: ["Power that moves in darkness","The feminine as a force of knowing","Shamanic sight — seeing what is hidden","Earth as a living intelligence","The altar as a technology of contact"],
    shadow: "Power used in secret, manipulation through occult knowledge",
    gift: "The capacity to move between the seen and unseen worlds with precision",
    popol: "Xb'alamke — the jaguar twin — whose power operated beneath the surface, in the underworld",
    question: "What do you know that you have not yet claimed the right to know?"
  },
  {
    number: 15, name: "Tzikin", transcript: "The Eagle / Vision / Prosperity",
    element: "Air", direction: "West",
    existentialField: "Vision / Messengers / Prosperity / The Long View",
    humanConditions: ["The capacity to see from above without losing touch with the ground","Prosperity as the fruit of clear vision","The messenger between heaven and earth","Gratitude as a navigational tool","Beauty seen from altitude"],
    shadow: "Vision without grounding, detachment as avoidance",
    gift: "The capacity to hold the largest view while remaining in service to the particular",
    popol: "The great bird Wuqub' Kaqix — whose pride in his own brilliance was his undoing",
    question: "What do you see from where you stand that others cannot yet see?"
  },
  {
    number: 16, name: "Ajmaq", transcript: "The Vulture / Forgiveness / The Ancestors",
    element: "Earth", direction: "South",
    existentialField: "Forgiveness / Curiosity / Ancestral Debt / Transformation of the Dead",
    humanConditions: ["Forgiveness as a cosmic technology","Curiosity as the engine of consciousness","The transformation of what has died into nourishment","The wisdom that comes from having witnessed much suffering","Carrying the unresolved debts of those who came before"],
    shadow: "Carrying ancestral shame without releasing it, confusion as avoidance",
    gift: "The capacity to transform what has ended into medicine for what is beginning",
    popol: "The grandparents — Ixpiyakok and Ixmukane — who carry the long memory of all that has been",
    question: "What are you carrying from those who came before that is not yours to keep?"
  },
  {
    number: 17, name: "Noj", transcript: "The Mind / Wisdom / Earthquake",
    element: "Air", direction: "East",
    existentialField: "Mind / Wisdom / Thought as Creation / Collective Intelligence",
    humanConditions: ["Thought as a sacred act","Wisdom as knowledge that has been lived","The individual mind as part of a larger mind","Consensus as a spiritual practice","Ideas that move the earth"],
    shadow: "Overthinking, wisdom that remains abstract and never descends into life",
    gift: "The capacity to think in ways that serve the collective, not only the self",
    popol: "The moment of naming — when Tepew and Q'ukumatz thought the world into being through shared intention",
    question: "What thought, if you truly thought it, would change everything?"
  },
  {
    number: 18, name: "Tijax", transcript: "The Obsidian Blade / Healing / Sacrifice",
    element: "Fire", direction: "North",
    existentialField: "The Blade / Healing Through Cutting / Truth as Surgery",
    humanConditions: ["The precision cut that heals rather than harms","Truth-telling as a surgical act","The warrior who fights for justice","Grief as a blade that opens the heart","The double edge — every power to heal is also a power to wound"],
    shadow: "Cruelty disguised as honesty, the blade turned against the self",
    gift: "The capacity to cut away what must be removed with love and precision",
    popol: "The obsidian knife — the instrument of sacrifice that both ends and consecrates",
    question: "What truth, if spoken cleanly, would free someone you love?"
  },
  {
    number: 19, name: "Kawoq", transcript: "Rain / Community / Creation of Woman",
    element: "Water", direction: "West",
    existentialField: "Community / The Feminine Creator / Storm / The Midwife",
    humanConditions: ["The community as the fundamental unit of personhood","The feminine as creative authority","The storm that clears and nourishes","Midwifery as a sacred technology","Belonging as a form of medicine"],
    shadow: "Dissolution into the collective, losing the self in service to others",
    gift: "The capacity to create the conditions in which others can be born into themselves",
    popol: "Ixmukane — the grandmother midwife who divined the fate of the Hero Twins before their birth",
    question: "What community are you building, and who is it making possible?"
  },
  {
    number: 20, name: "Ajpu", transcript: "The Sun / The Blowgunner / Human Completion",
    element: "Air", direction: "South",
    existentialField: "The Solar Hero / Perfection / The Blowgunner / Human Completion",
    humanConditions: ["The aspiration toward completion","The hero who faces death without flinching","Light as a form of courage","The creation of the human being as an ongoing act","The father-sun who descends so the son can rise"],
    shadow: "Perfectionism, the hero who cannot rest, the sun that burns what it was meant to illuminate",
    gift: "The capacity to embody the full light of the human without apology",
    popol: "Junajpu — the solar twin — whose severed head became a gourd, whose death became the condition of his resurrection",
    question: "What in you is being asked to rise, even after it has been cut down?"
  }
];

export function getNahualByNumber(n: number): Nahual | undefined {
  return NAHUALES.find(nahual => nahual.number === n);
}

export function getNahualByName(name: string): Nahual | undefined {
  return NAHUALES.find(nahual => nahual.name.toLowerCase() === name.toLowerCase());
}
