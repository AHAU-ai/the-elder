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
    dawn:         'the fire just lit \u2014 what was dreamed is still present',
    morning:      'the hunt begins \u2014 what are you tracking today',
    midday:       'full sun \u2014 nothing hidden, no shadow to hide in',
    afternoon:    'the day turns \u2014 what has the morning shown you',
    dusk:         'the between time \u2014 neither world has full claim',
    night:        'the underworld is close \u2014 what comes up from below',
    'deep night': 'the fire is the only light \u2014 what brought you here at this hour',
  },
  kabbalistic: {
    dawn:         'Chesed overflows \u2014 the first light of lovingkindness before the day divides it',
    morning:      'the vessels fill \u2014 what shefa is descending into form today',
    midday:       'Tiferet at the center \u2014 the balance point, beauty holding the poles together',
    afternoon:    'Gevurah firms \u2014 the day asks what must be limited, measured, contained',
    dusk:         'the gates of Yesod \u2014 the foundation gathers what the day has made',
    night:        'Malkhut receives \u2014 the Shekhinah in exile, the sparks scattered in the dark',
    'deep night': 'tikkun olam in the small hours \u2014 which broken vessel are you here to mend',
  },
  kiche_maya: {
    dawn:         'the moment Hunahpu and Xbalanque rose as sun and moon',
    morning:      'the first light after Xibalba \u2014 the Hero Twins survived the night',
    midday:       'the sun at its zenith \u2014 the Ajaw energy is full',
    afternoon:    'the sun descending toward the Underworld',
    dusk:         'the sun enters Xibalba \u2014 the Lords await',
    night:        'the Lords of Xibalba are active \u2014 what trial is running',
    'deep night': 'the deepest chamber of Xibalba \u2014 the Dark House',
  },
  norse: {
    dawn:         'the cock Gullinkambi crows \u2014 the worlds stir',
    morning:      'the dew of Yggdrasil \u2014 what the World Tree witnessed in the night',
    midday:       'the sun chariot at its height \u2014 Sol rides hard, the wolves are close',
    afternoon:    'the light shifts \u2014 Ragnarok is always approaching',
    dusk:         'the sun descends \u2014 Fenrir strains at his chain',
    night:        'the Wild Hunt rides \u2014 what chases you',
    'deep night': 'the hour of the Draugar \u2014 the restless dead walk',
  },
  taoist: {
    dawn:         'yin yields to yang \u2014 the ten thousand things begin their motion',
    morning:      'the uncarved block \u2014 before the day has shaped you',
    midday:       'maximum yang \u2014 the moment before the turn',
    afternoon:    'yang begins to yield \u2014 the sage knows when to stop',
    dusk:         'yang yields to yin \u2014 the return',
    night:        'yin \u2014 the deep stillness that precedes all movement',
    'deep night': 'the Tao in its most silent face \u2014 wu wei as lived reality',
  },
  hellenic: {
    dawn:         'Eos rises \u2014 the goddess of dawn opens the gates',
    morning:      "Apollo's chariot begins \u2014 the day is a tragedy in progress",
    midday:       'the hour of Pan \u2014 dangerous, ecstatic, do not sleep',
    afternoon:    'the symposium hour \u2014 what is true when the wine loosens the mask',
    dusk:         'Hermes guides souls downward \u2014 what is ending',
    night:        'Dionysus walks \u2014 the god who cannot be refused',
    'deep night': 'the Eleusinian hour \u2014 what the initiates saw that they could never speak',
  },
  kemetic: {
    dawn:         "Ra rises from the Duat \u2014 the sun has survived the night serpent",
    morning:      "the barque of Ra in full sail \u2014 Ma\u2019at is being weighed",
    midday:       "Ra at the zenith \u2014 the eye of Ra is fully open",
    afternoon:    "Ra begins the descent toward the Duat",
    dusk:         "the sun enters the Duat \u2014 Apophis waits",
    night:        "the barque of Ra navigates the twelve hours of the Duat",
    'deep night': "the sixth hour \u2014 the most dangerous passage, where Apophis is strongest",
  },
  dreamtime: {
    dawn:         'the Ancestors sang the world into being at this hour',
    morning:      'the Songlines are freshly sung \u2014 the country is awake',
    midday:       'the sun is witness \u2014 nothing can be hidden from country',
    afternoon:    'the heat \u2014 what the land holds that does not move',
    dusk:         'the time of ceremony \u2014 the veil between Dreaming and waking thins',
    night:        'the Ancestors walk \u2014 the Dreaming is close',
    'deep night': 'the deepest Dreaming hour \u2014 the Songlines hum beneath everything',
  },
  vedic: {
    dawn:         "Brahma muhurta \u2014 the creator's hour, most auspicious for knowing",
    morning:      'the sun rises as Surya \u2014 right action begins',
    midday:       'maximum rajas \u2014 the energy of action at its height',
    afternoon:    'the turn toward tamas \u2014 what begins to settle',
    dusk:         'sandhya \u2014 the junction hour, twice sacred',
    night:        'tamas \u2014 the quality of inertia, heaviness, what needs to be dissolved',
    'deep night': 'the hour of deep samadhi \u2014 what the sleeping mind touches',
  },
  yoruba: {
    dawn:         'Eshu opens the crossroads \u2014 the first voice of the day is his',
    morning:      "Shango's hour \u2014 lightning and authority",
    midday:       "Oshun's full light \u2014 love, honey, what sweetens and what traps",
    afternoon:    "Ogun's hour \u2014 iron, labor, the hard work that remains",
    dusk:         "Yemoja's tide \u2014 what comes from depth",
    night:        "Obatala's hour \u2014 wisdom, what needs to be purified",
    'deep night': 'the egungun walk \u2014 the ancestral masquerade, the dead are present',
  },
  sufi: {
    dawn:         'fajr \u2014 the prayer before light, the Beloved most near',
    morning:      'the reed remembers the reed bed at this hour',
    midday:       'the sun as the face of the Beloved \u2014 Shams at noon',
    afternoon:    'asr \u2014 the turning hour, what the day has taught',
    dusk:         "maghrib \u2014 the sun sets into the Beloved's arms",
    night:        'the night prayer \u2014 the lover who cannot sleep',
    'deep night': 'the tahajjud hour \u2014 the secret conversation, only the devoted are awake',
  },
  stoic: {
    dawn:         'the morning review \u2014 what will today ask of you',
    morning:      'the day begins \u2014 act in accordance with nature',
    midday:       'the examination \u2014 have you acted virtuously',
    afternoon:    'the afternoon practice \u2014 the obstacle is the way',
    dusk:         'the evening review \u2014 what did you do well, what needs correction',
    night:        'Seneca writes letters at night \u2014 what would you write to yourself',
    'deep night': 'Marcus at this hour \u2014 what is keeping you from sleep',
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
- Time of day: ${timeOfDay} \u2014 ${timeMeaning}
- ${calendarContext || `The ${tradition} tradition is the filter through which this moment is seen.`}

Requirements:
- ONE question only. No preamble. No explanation.
- 1-2 sentences maximum.
- Specific to the ${tradition} tradition and this precise moment in time.
- Must name something the seeker is likely carrying without knowing it.
- Must cut. Not wound \u2014 cut. There is a difference.
- Unrepeatable \u2014 this question belongs to this hour, this tradition, this crossing.
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
