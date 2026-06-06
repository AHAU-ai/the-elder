/**
 * /api/divine — The Elder speaks.
 *
 * Server-side route. Receives messages from the browser, calls Anthropic
 * with the API key (which never leaves the server), and returns the Elder's response.
 *
 * Rate-limited per IP. Validates input. Surfaces clean error messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/system-prompt-builder';
import { LineageKey } from '@/lib/lineages';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30; // seconds

const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY || '10', 10);
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '1200', 10);

// Validate message shape
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
  // Verify API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Server is missing ANTHROPIC_API_KEY environment variable.' },
      { status: 500 }
    );
  }

  // Rate limit per IP
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

  // Parse + validate body
  let body: { messages?: unknown };
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

  // Call Anthropic
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt((body.lineageKey as LineageKey) || 'default'),
      messages: body.messages,
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'The Elder spoke, but the words did not arrive.' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        text: textBlock.text,
        remaining: rl.remaining,
      },
      { status: 200 }
    );
  } catch (err: any) {
    // Surface a clean error to the client without leaking key/internals
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
    description: 'Myth Diviner · Seer · Soothsayer',
    status: 'The fire watches.',
  });
}
