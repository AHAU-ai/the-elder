import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUserId } from '@/lib/auth';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { PRIMARY_MODEL, WELFARE_MODEL } from '@/lib/model.config';
import { firesideEnabled } from '@/lib/fireside/flag';
import { openSitting, takeTurn } from '@/lib/fireside/engine';
import type { ChatMessage, Deps } from '@/lib/fireside/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

// The fireside chat (docs/fireside/GO-LIVE.md). Dark unless firesideEnabled(). The browser holds an
// opaque sealed token; the server keeps no seeker text (lib/fireside/sealed.ts). Unknown fields are
// rejected: the client may never supply history, a welfare level, or reading text.

const TURNS_PER_DAY = Number(process.env.FIRESIDE_TURNS_PER_DAY ?? 60);
const HOST_MAX_TOKENS = 260;

export async function GET() {
  return NextResponse.json({ enabled: firesideEnabled() }, { headers: { 'Cache-Control': 'no-store' } });
}

function reject(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function realDeps(): Deps {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return {
    now: () => Date.now(),
    env: process.env,
    judge: async (system, user) => {
      const res = await client.messages.create({ model: WELFARE_MODEL, max_tokens: 64, system, messages: [{ role: 'user', content: user }] });
      const b = res.content.find((x) => x.type === 'text');
      return b && 'text' in b ? b.text : '';
    },
    generate: async (system: string, messages: ChatMessage[]) => {
      const res = await client.messages.create({ model: PRIMARY_MODEL, max_tokens: HOST_MAX_TOKENS, temperature: 0.7, system, messages });
      const b = res.content.find((x) => x.type === 'text');
      return b && 'text' in b ? b.text : '';
    },
  };
}

export async function POST(req: NextRequest) {
  if (!firesideEnabled()) return reject('The fire is not lit here yet.', 404);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    body = parsed as Record<string, unknown>;
  } catch {
    return reject('Invalid request.', 400);
  }

  // Seekers who told us they are under 18 never sit here, and nothing is kept for them (V16).
  const userId = process.env.DATABASE_URL ? getSessionUserId(req) : null;
  if (userId) {
    try {
      const { getNarrativeRegister } = await import('@/lib/narrativeRegister');
      const reg = await getNarrativeRegister(userId);
      if (reg !== 'adult') return reject('This space is for adults.', 403);
    } catch {
      return reject('The fire is not available right now.', 503);
    }
  }

  if (body.action === 'open') {
    const allowed = new Set(['action', 'mode', 'adult']);
    if (Object.keys(body).some((k) => !allowed.has(k))) return reject('Invalid request.', 400);
    if (body.adult !== true) return reject('Please confirm you are 18 or older.', 400);
    if (body.mode !== 'before' && body.mode !== 'after') return reject('Invalid request.', 400);
    const r = openSitting(body.mode, { now: () => Date.now(), env: process.env });
    if ('error' in r) return reject(r.error, r.status);
    return NextResponse.json({ state: r.token, host: r.host, disclosure: r.disclosure }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (body.action === 'turn') {
    const allowed = new Set(['action', 'state', 'message']);
    if (Object.keys(body).some((k) => !allowed.has(k))) return reject('Invalid request.', 400);

    const rl = await checkRateLimit(`fireside:${getClientIP(req.headers)}`, TURNS_PER_DAY);
    if (!rl.allowed) return reject('The fire must rest for today. Please come back tomorrow.', 429);

    const r = await takeTurn(body.state, body.message, realDeps());
    const h = { headers: { 'Cache-Control': 'no-store' } };
    switch (r.kind) {
      case 'host': return NextResponse.json({ kind: 'host', state: r.token, host: r.host, resources: r.resources }, h);
      case 'crisis': return NextResponse.json({ kind: 'crisis', host: r.host, closed: true }, h);
      case 'closed': return NextResponse.json({ kind: 'closed', host: r.host, closed: true }, h);
      case 'failure': return NextResponse.json({ kind: 'failure', state: r.token, host: r.host }, h);
      case 'invalid': return reject(r.error, r.status);
    }
  }

  return reject('Invalid request.', 400);
}
