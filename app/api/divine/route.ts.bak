import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/system-prompt-builder';
import { LineageKey } from '@/lib/lineages';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { computeNatalProfile, formatCruzForPrompt } from '@/lib/chol-qij';

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

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: body.messages,
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'The Elder spoke, but the words did not arrive.' },
        { status: 502 }
      );
    }

    const READY_SIGNAL = '\u29c1\u29c1READY\u29c1\u29c1';
    const rawText = textBlock.text;
    const readyToRead = rawText.includes(READY_SIGNAL);

    // Ceiling signal detection
    const ceilingMatch = rawText.match(/\u29c1CEILING:([^\u29c1]+)\u29c1/);
    const ceilingCategory: string | null = ceilingMatch ? ceilingMatch[1].trim() : null;
    const cleanText = rawText
      .replace(READY_SIGNAL, '')
      .replace(/\u29c1CEILING:[^\u29c1]+\u29c1/, '')
      .trimStart();

    return NextResponse.json(
      { text: cleanText, readyToRead, remaining: rl.remaining, ceilingCategory },
      { status: 200 }
    );
  } catch (err: any) {
    const message =
      err?.error?.message ||
      err?.message ||
      'The fire cannot reach Anthropic at this moment.';
    const status = err?.status || 502;
    console.error('[Elder] Anthropic API error:', err?.status, message);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'THE ELDER',
    description: 'Myth Diviner \u00b7 Seer \u00b7 Soothsayer',
    status: 'The fire watches.',
  });
}
