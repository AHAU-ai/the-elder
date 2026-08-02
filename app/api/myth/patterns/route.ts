import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { WELFARE_MODEL } from '@/lib/model.config';
import { getSessionUserId } from '@/lib/auth';
import { getUserMyths } from '@/lib/mythLedger';
import { findMythPatterns } from '@/lib/mythPatterns';
import type { ModelJudge } from '@/lib/mythPatterns';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId || !process.env.DATABASE_URL || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ patterns: '' });
  }

  try {
    const myths = await getUserMyths(userId);
    if (myths.length < 2) return NextResponse.json({ patterns: '' });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const judge: ModelJudge = async (system, user) => {
      const res = await client.messages.create({
        model: WELFARE_MODEL, max_tokens: 300,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const b = res.content.find((x) => x.type === 'text');
      return b && 'text' in b ? b.text : '';
    };

    const patterns = await findMythPatterns(myths, judge);
    return NextResponse.json({ patterns });
  } catch (err) {
    console.error('[myth/patterns] Failed to compute patterns:', err);
    return NextResponse.json({ patterns: '' });
  }
}
