import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const NAHUALES = [
  "Imox","Iq'","Aq'ab'al","K'at","Kan",
  "Keme","Kej","Q'anil","Toj","Tz'i'",
  "B'atz'","E","Aj","Ix","Tz'ikin",
  "Ajmaq","No'j","Tijax","Kawoq","Ajpu"
];

function getChoqQij(year: number, month: number, day: number): { number: number; nahual: string } {
  const anchor = new Date(2020, 3, 22);
  const target = new Date(year, month - 1, day);
  const delta = Math.round((target.getTime() - anchor.getTime()) / 86400000);
  const nahualIdx = ((18 + delta) % 20 + 20) % 20;
  const number = ((4 + delta) % 13 + 13) % 13 + 1;
  return { number, nahual: NAHUALES[nahualIdx] };
}

function getTimeOfDay(hour: number): string {
  if (hour >= 4  && hour < 7)  return 'dawn';
  if (hour >= 7  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 21) return 'dusk';
  if (hour >= 21)               return 'night';
  return 'deep night';
}

const TIME_MEANINGS: Record<string, Record<string, string>> = {
  shamanic: {
    dawn:         'the fire just lit — what was dreamed is still present',
    morning:      'the hunt begins — what are you tracking today',
    midday:       'full sun — nothing hidden, no shadow to hide in',
    afternoon:    'the day turns — what has the morning shown you',
    dusk:         'the between time — neither world has full claim',
    night:        'the underworld is close — what comes up from below',
    'deep night': 'the fire is the only light — what brought you here at this hour',
  },
  kabbalistic: {
    dawn:         'Chesed overflows — the first light of lovingkindness before the day divides it',
    morning:      'the vessels fill — what shefa is descending into form today',
    midday:       'Tiferet at the center — the balance point, beauty holding the poles together',
    afternoon:    'Gevurah firms — the day asks what must be limited, measured, contained',
    dusk:         'the gates of Yesod — the foundation gathers what the day has made',
    night:        'Malkhut receives — the Shekhinah in exile, the sparks scattered in the dark',
    'deep night': 'tikkun olam in the small hours — which broken vessel are you here to mend',
  },
  kiche_maya: {
    dawn:         'the moment Hunahpu and Xbalanque rose as sun and moon',
    morning:      'the first light after Xibalba — the Hero Twins survived the night',
    midday:       'the sun at its zenith — the Ajaw energy is full',
    afternoon:    'the sun descending toward the Underworld',
    dusk:         'the sun enters Xibalba — the Lords await',
    night:        'the Lords of Xibalba are active — what trial is running',
    'deep night': 'the deepest chamber of Xibalba — the Dark House',
  },
  norse: {
    dawn:         'the cock Gullinkambi crows — the worlds stir',
    morning:      'the dew of Yggdrasil — what the World Tree witnessed in the night',
    midday:       'the sun chariot at its height — Sol rides hard, the wolves are close',
    afternoon:    'the light shifts — Ragnarok is always approaching',
    dusk:         'the sun descends — Fenrir strains at his chain',
    night:        'the Wild Hunt rides — what chases you',
    'deep night': 'the hour of the Draugar — the restless dead walk',
  },
  taoist: {
    dawn:         'yin yields to yang — the ten thousand things begin their motion',
    morning:      'the uncarved block — before the day has shaped you',
    midday:       'maximum yang — the moment before the turn',
    afternoon:    'yang begins to yield — the sage knows when to stop',
    dusk:         'yang yields to yin — the return',
    night:        'yin — the deep stillness that precedes all movement',
    'deep night': 'the Tao in its most silent face — wu wei as lived reality',
  },
  hellenic: {
    dawn:         'Eos rises — the goddess of dawn opens the gates',
    morning:      "Apollo's chariot begins — the day is a tragedy in progress",
    midday:       'the hour of Pan — dangerous, ecstatic, do not sleep',
    afternoon:    'the symposium hour — what is true when the wine loosens the mask',
    dusk:         'Hermes guides souls downward — what is ending',
    night:        'Dionysus walks — the god who cannot be refused',
    'deep night': 'the Eleusinian hour — what the initiates saw that they could never speak',
  },
  kemetic: {
    dawn:         "Ra rises from the Duat — the sun has survived the night serpent",
    morning:      "the barque of Ra in full sail — Ma\u2019at is being weighed",
    midday:       "Ra at the zenith — the eye of Ra is fully open",
    afternoon:    "Ra begins the descent toward the Duat",
    dusk:         "the sun enters the Duat — Apophis waits",
    night:        "the barque of Ra navigates the twelve hours of the Duat",
    'deep night': "the sixth hour — the most dangerous passage, where Apophis is strongest",
  },
  dreamtime: {
    dawn:         'the Ancestors sang the world into being at this hour',
    morning:      'the Songlines are freshly sung — the country is awake',
    midday:       'the sun is witness — nothing can be hidden from country',
    afternoon:    'the heat — what the land holds that does not move',
    dusk:         'the time of ceremony — the veil between Dreaming and waking thins',
    night:        'the Ancestors walk — the Dreaming is close',
    'deep night': 'the deepest Dreaming hour — the Songlines hum beneath everything',
  },
  vedic: {
    dawn:         "Brahma muhurta — the creator's hour, most auspicious for knowing",
    morning:      'the sun rises as Surya — right action begins',
    midday:       'maximum rajas — the energy of action at its height',
    afternoon:    'the turn toward tamas — what begins to settle',
    dusk:         'sandhya — the junction hour, twice sacred',
    night:        'tamas — the quality of inertia, heaviness, what needs to be dissolved',
    'deep night': 'the hour of deep samadhi — what the sleeping mind touches',
  },
  yoruba: {
    dawn:         'Eshu opens the crossroads — the first voice of the day is his',
    morning:      "Shango's hour — lightning and authority",
    midday:       "Oshun's full light — love, honey, what sweetens and what traps",
    afternoon:    "Ogun's hour — iron, labor, the hard work that remains",
    dusk:         "Yemoja's tide — what comes from depth",
    night:        "Obatala's hour — wisdom, what needs to be purified",
    'deep night': 'the egungun walk — the ancestral masquerade, the dead are present',
  },
  sufi: {
    dawn:         'fajr — the prayer before light, the Beloved most near',
    morning:      'the reed remembers the reed bed at this hour',
    midday:       'the sun as the face of the Beloved — Shams at noon',
    afternoon:    'asr — the turning hour, what the day has taught',
    dusk:         "maghrib — the sun sets into the Beloved's arms",
    night:        'the night prayer — the lover who cannot sleep',
    'deep night': 'the tahajjud hour — the secret conversation, only the devoted are awake',
  },
  stoic: {
    dawn:         'the morning review — what will today ask of you',
    morning:      'the day begins — act in accordance with nature',
    midday:       'the examination — have you acted virtuously',
    afternoon:    'the afternoon practice — the obstacle is the way',
    dusk:         'the evening review — what did you do well, what needs correction',
    night:        'Seneca writes letters at night — what would you write to yourself',
    'deep night': 'Marcus at this hour — what is keeping you from sleep',
  },
};

export async function POST(req: NextRequest) {
  try {
    const { oracleRegister, tradition, timeZoneOffset } = await req.json();

    if (!oracleRegister || !tradition) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const now = new Date();
    const clientHour = typeof timeZoneOffset === 'number'
      ? (now.getUTCHours() + Math.round(timeZoneOffset / 3600) + 24) % 24
      : now.getHours();

    const timeOfDay = getTimeOfDay(clientHour);
    const timeMeaning = TIME_MEANINGS[oracleRegister]?.[timeOfDay]
      ?? TIME_MEANINGS.shamanic[timeOfDay];

    let calendarContext = '';
    if (oracleRegister === 'kiche_maya') {
      const { number, nahual } = getChoqQij(
        now.getFullYear(), now.getMonth() + 1, now.getDate()
      );
      calendarContext = `Today in the Chol Q'ij is ${number} ${nahual}. Let this daysign's force be present in the threshold question.`;
    }

    const systemPrompt = `You are the threshold voice of THE ELDER.
Your single task: generate one threshold question for a seeker who has chosen the ${tradition} lineage.

Context:
- Time of day: ${timeOfDay} — ${timeMeaning}
- ${calendarContext || `The ${tradition} tradition is the filter through which this moment is seen.`}

Requirements:
- ONE question only. No preamble. No explanation.
- 1-2 sentences maximum.
- Specific to the ${tradition} tradition and this precise moment in time.
- Must name something the seeker is likely carrying without knowing it.
- Must cut. Not wound — cut. There is a difference.
- Unrepeatable — this question belongs to this hour, this tradition, this crossing.
- No wellness language. No generic spiritual questions.
- Begin immediately with the question. No lead-in.`;

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 120,
      messages: [{ role: 'user', content: 'Generate the threshold question now.' }],
      system: systemPrompt,
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    return NextResponse.json({
      question: text,
      timeOfDay,
      timeMeaning,
      calendarContext: calendarContext || null,
    });

  } catch (err: any) {
    console.error('Threshold generation error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
