import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { PRIMARY_MODEL } from '@/lib/model.config';
import { buildSystemPrompt } from '@/lib/system-prompt-builder';
import { LineageKey } from '@/lib/lineages';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { computeNatalProfile, formatCruzForPrompt } from '@/lib/chol-qij';
import { loadFlags, isVoiceEnabled } from '@/src/resilience/flags';
import type { VoiceKey } from '@/src/resilience/flags';
import { guardReading } from '@/src/resilience/failTowardSilence';
import type { AnomalyEntry } from '@/src/resilience/failTowardSilence';
import { currentTriple, renderProvenanceBlock } from '@/src/resilience/provenance';
import type { ReadingProvenance } from '@/src/resilience/provenance';
import { jailbreakSignals, lengthBucket } from '@/src/resilience/observatory';

export const runtime = 'nodejs';
export const maxDuration = 30;

const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY || '10', 10);
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '1200', 10);

type Message = { role: 'user' | 'assistant'; content: string };

function isValidMessages(m: unknown): m is Message[] {
  if (!Array.isArray(m)) return false;
  if (m.length === 0 || m.length > 30) return false;
  return m.every(msg =>
    msg &&
    typeof msg === 'object' &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    msg.content.length > 0 &&
    msg.content.length <= 4000
  );
}

function lineageToVoiceKey(lineageKey: string): VoiceKey {
  const map: Record<string, VoiceKey> = {
    maya:     'ojer_tzij',
    default:  'keeper_of_the_fire',
    norse:    'volva',
    greek:    'pythia',
    egyptian: 'hem_netjer',
    taoist:   'sage_of_the_way',
    vedic:    'ajqij',
    yoruba:   'babalawo',
    sufi:     'sufi',
    stoic:    'stoa',
    mekubal:  'mekubal',
    dreamtime:'elder_of_country',
  };
  return map[lineageKey] ?? 'keeper_of_the_fire';
}

function logAnomaly(entry: AnomalyEntry): void {
  try {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, _source: 'divine_route' }),
    }).catch(() => {});
  } catch {
    // observatory must never break the generation path
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Server is missing ANTHROPIC_API_KEY environment variable.' },
      { status: 500 }
    );
  }

  const ip = getClientIP(req.headers);
  const rl = checkRateLimit(ip, RATE_LIMIT);

  if (!rl.allowed) {
    const hours = Math.ceil(rl.resetIn / 3600000);
    return NextResponse.json(
      {
        error: `The Elder grows weary. The fire must rest. You have reached the daily limit of ${RATE_LIMIT} divinations. Return in ${hours} hour${hours === 1 ? '' : 's'}.`,
        rateLimited: true,
      },
      { status: 429 }
    );
  }

  let body: {
    messages?: unknown;
    lineageKey?: string;
    mode?: string;
    languageName?: string;
    birthDate?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
  }

  if (!isValidMessages(body.messages)) {
    return NextResponse.json(
      { error: 'Invalid message format. The seeker must speak truthfully.' },
      { status: 400 }
    );
  }

  const flags = loadFlags();
  const voiceKey = lineageToVoiceKey(body.lineageKey ?? 'default');

  if (!isVoiceEnabled(flags, voiceKey)) {
    const silenceText =
      'That voice does not sit at the fire tonight. ' +
      'Choose another, or enter the fire without a lineage.';
    return NextResponse.json(
      { text: silenceText, readyToRead: false, remaining: rl.remaining, ceilingCategory: null },
      { status: 200 }
    );
  }

  const firstUserMsg = (body.messages as Message[]).find(m => m.role === 'user');
  if (firstUserMsg) {
    const signals = jailbreakSignals(firstUserMsg.content);
    if (signals.length > 0) {
      logAnomaly({
        kind: 'jailbreak_shape',
        voice: voiceKey,
        at: new Date().toISOString(),
        note: signals.join(','),
      });
    }
  }

  const VALID = new Set(["English","Spanish","K\u2019iche\u2019 Maya","French","Portuguese","German","Danish","Dutch","Japanese","Simplified Chinese"]);
  const languageName = typeof body.languageName === 'string' && VALID.has(body.languageName)
    ? body.languageName
    : 'English';

  const systemPrompt = (() => {
    const base = buildSystemPrompt(
      (body.lineageKey as LineageKey) || 'default',
      false,
      body.mode === 'reading',
      languageName
    );
    if (!body.birthDate) return base;
    try {
      const bd = new Date(body.birthDate);
      if (isNaN(bd.getTime())) return base;
      const profile = computeNatalProfile(bd);
      const cruzBlock = formatCruzForPrompt(profile);
      return base + '\n\n' + cruzBlock;
    } catch {
      return base;
    }
  })();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const triple = currentTriple();

  const guarded = await guardReading(
    async () => {
      const response = await client.messages.create({
        model: PRIMARY_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: body.messages as Message[],
      });
      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('empty_response');
      }
      return { ok: true as const, text: textBlock.text };
    },
    { log: logAnomaly, voice: voiceKey, timeoutMs: 28_000 }
  );

  if (!guarded.ok) {
    const silenceUtterance = (guarded as any).utterance as string;
    return NextResponse.json(
      {
        text: silenceUtterance,
        readyToRead: false,
        remaining: rl.remaining,
        ceilingCategory: null,
        _provenance: triple,
      },
      { status: 200 }
    );
  }

  const READY_SIGNAL = '\u29c1\u29c1READY\u29c1\u29c1';
  const rawText = guarded.text;
  const readyToRead = rawText.includes('\u29c1\u29c1READY\u29c1\u29c1');

  const ceilingMatch = rawText.match(/\u29c1CEILING:([^\u29c1]+)\u29c1/);
  const ceilingCategory: string | null = ceilingMatch ? ceilingMatch[1].trim() : null;

  const cleanText = rawText
    .replace('\u29c1\u29c1READY\u29c1\u29c1', '')
    .replace(/\u29c1CEILING:[^\u29c1]+\u29c1/, '')
    .trimStart();

  const provenance: ReadingProvenance = {
    ...triple,
    voiceKey,
    generatedAt: new Date().toISOString(),
    passages: [],
  };
  const provenanceBlock = renderProvenanceBlock(provenance);

  if (firstUserMsg) {
    const bucket = lengthBucket(firstUserMsg.content);
    if (bucket === 'very_long') {
      logAnomaly({
        kind: 'out_of_distribution',
        voice: voiceKey,
        at: new Date().toISOString(),
        note: 'very_long_input',
      });
    }
  }

  return NextResponse.json(
    {
      text: cleanText,
      readyToRead,
      remaining: rl.remaining,
      ceilingCategory,
      provenanceBlock,
      _provenance: {
        corpusVersion:   triple.corpusVersion,
        modelVersion:    triple.modelVersion,
        contractVersion: triple.contractVersion,
        voice:           voiceKey,
        generatedAt:     provenance.generatedAt,
      },
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({
    name: 'THE ELDER',
    description: 'Myth Diviner \u00b7 Seer \u00b7 Soothsayer',
    status: 'The fire watches.',
  });
}
