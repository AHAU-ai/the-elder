import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { summarize, formatSummary } from '@/lib/altarSummary';
import { fetchSignalRows, parseDays } from '@/lib/altarSummaryQuery';

export const runtime = 'nodejs';

// Operator-only. What seekers said back after their Readings, in aggregate:
// land rate with an honest interval, per lineage and per contract/model/corpus
// version, plus a drift check between consecutive versions. See
// lib/altarSummary.ts for why the statistics are as cautious as they are.
//
// Auth: shared secret, same shape as the other admin routes (Bearer header,
// fails closed when ADMIN_SECRET is unset) — but compared in constant time.
// Never called by the seeker-facing app. The query never selects user_id.
//
//   GET /api/admin/altar-summary?days=90            -> JSON
//   GET /api/admin/altar-summary?days=90&format=text -> plain text

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'no DATABASE_URL' }, { status: 503, headers: NO_STORE });
  }

  const days = parseDays(req.nextUrl.searchParams.get('days'));

  try {
    const rows = await fetchSignalRows(neon(process.env.DATABASE_URL), days);
    const summary = summarize(rows);
    if (req.nextUrl.searchParams.get('format') === 'text') {
      return new NextResponse(`${formatSummary(summary)}\n`, {
        status: 200,
        headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    return NextResponse.json(
      { days, generatedAt: new Date().toISOString(), rows: rows.length, summary },
      { headers: NO_STORE },
    );
  } catch {
    // No detail to the caller: a connection string or schema must never leak
    // through an error body.
    return NextResponse.json({ error: 'query_failed' }, { status: 500, headers: NO_STORE });
  }
}
