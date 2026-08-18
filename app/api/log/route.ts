import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Anonymous telemetry (page load beacons, divine_route's own anomaly
// signals) is expected to be frequent, so this ceiling is generous compared
// to divine's -- it exists only to stop a scripted flood of unbounded DB
// writes / webhook forwards, not to throttle normal use.
const RATE_LIMIT = parseInt(process.env.LOG_RATE_LIMIT_PER_DAY || '500', 10)

const ANOMALY_KINDS = new Set(['silence','near_miss','jailbreak_shape','out_of_distribution'])

function isAnomalyRecord(b: unknown): b is Record<string, unknown> {
  return b !== null && typeof b === 'object' && 'kind' in (b as object) && ANOMALY_KINDS.has((b as Record<string, unknown>).kind as string)
}

// The other shape this route carries: end-of-session telemetry from
// page.tsx / Threshold.tsx (no `kind` field, never DB-inserted, only
// forwarded to ELDER_LOG_WEBHOOK). Distinguished from an anomaly record by
// requiring sessionId instead. Validated field-by-field so a caller can't
// smuggle arbitrary extra JSON into what the webhook receives.
function sanitizeSessionSummary(b: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof b.sessionId !== 'string') return null
  return {
    sessionId: b.sessionId.slice(0, 100),
    lineage: typeof b.lineage === 'string' ? b.lineage.slice(0, 100) : null,
    exchangeCount: typeof b.exchangeCount === 'number' ? b.exchangeCount : null,
    readingTriggered: typeof b.readingTriggered === 'boolean' ? b.readingTriggered : null,
    readingCompleted: typeof b.readingCompleted === 'boolean' ? b.readingCompleted : null,
    durationSeconds: typeof b.durationSeconds === 'number' ? b.durationSeconds : null,
    crisisFlag: typeof b.crisisFlag === 'boolean' ? b.crisisFlag : null,
    ceilingNamed: typeof b.ceilingNamed === 'boolean' ? b.ceilingNamed : null,
    referralFired: typeof b.referralFired === 'boolean' ? b.referralFired : null,
    referralCategory: typeof b.referralCategory === 'string' ? b.referralCategory.slice(0, 100) : null,
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req.headers)
  // Prefixed so this route's bucket can never collide with divine's or
  // threshold's -- checkRateLimit's in-memory map is keyed only by whatever
  // string it's given.
  const rl = checkRateLimit(`log:${ip}`, RATE_LIMIT)
  if (!rl.allowed) {
    // Telemetry failing is never surfaced as an error to whatever's calling
    // this -- callers here already treat failure as a no-op (`.catch(() =>
    // {})` at every call site) -- so this still returns 200/ok rather than
    // 429, just silently drops the write.
    return NextResponse.json({ ok: true })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: true })

  // Previously: any JSON body, recognized or not, was forwarded whole to the
  // external webhook. That made this route an open relay -- a caller could
  // attach arbitrary extra fields (or an entirely unrelated payload) and
  // have it delivered to ELDER_LOG_WEBHOOK verbatim. Both known shapes are
  // now validated field-by-field and only their recognized fields are ever
  // persisted or forwarded; anything matching neither shape is dropped.
  let sanitized: Record<string, unknown> | null = null

  if (isAnomalyRecord(body)) {
    sanitized = {
      kind: body.kind as string,
      voice: (body.voice as string) ?? null,
      at: (body.at as string) ?? new Date().toISOString(),
      note: typeof body.note === 'string' ? body.note.slice(0, 200) : null,
      source: typeof (body as any)._source === 'string' ? (body as any)._source.slice(0, 100) : null,
    }

    if (process.env.DATABASE_URL) {
      try {
        const sql = neon(process.env.DATABASE_URL)
        await sql`INSERT INTO anomaly_record (kind, voice, at, note, source) VALUES (${sanitized.kind as string}, ${sanitized.voice as string | null}, ${sanitized.at as string}, ${sanitized.note as string | null}, ${sanitized.source as string | null})`
      } catch (err) {
        // observatory must never break the response -- logged server-side
        // only, same posture as every other route's catch blocks.
        console.error('[log_route] anomaly_record insert failed:', err)
      }
    } else {
      console.error('[OBSERVATORY]', JSON.stringify(sanitized))
    }
  } else {
    sanitized = sanitizeSessionSummary(body as Record<string, unknown>)
  }

  if (sanitized) {
    const webhook = process.env.ELDER_LOG_WEBHOOK
    if (webhook) {
      // Forwards only the sanitized/validated fields, never the raw client
      // body -- the webhook receives exactly what was actually recorded,
      // not whatever arbitrary extra JSON a caller attached to the request.
      fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sanitized) }).catch(() => {})
    }
  }
  return NextResponse.json({ ok: true })
}
