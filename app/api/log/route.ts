import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Anonymous telemetry (page load beacons, divine_route's own anomaly
// signals) is expected to be frequent, so this ceiling is generous compared
// to divine's -- it exists only to stop a scripted flood of unbounded DB
// writes / webhook forwards, not to throttle normal use.
const RATE_LIMIT = parseInt(process.env.LOG_RATE_LIMIT_PER_DAY || '500', 10)

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

// Third shape: the portal funnel beacon. Exactly one field, from a closed
// set; never DB-inserted, only forwarded to ELDER_LOG_WEBHOOK like the
// session summary. Anything else on the body is dropped.
const PORTAL_EVENTS = new Set(['reached-door', 'crossed', 'skipped', 'bypassed'])

function sanitizePortalEvent(b: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof b.portal !== 'string' || !PORTAL_EVENTS.has(b.portal)) return null
  return { portal: b.portal }
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req.headers)
  // Prefixed so this route's bucket can never collide with divine's or
  // threshold's -- checkRateLimit's in-memory map is keyed only by whatever
  // string it's given.
  const rl = await checkRateLimit(`log:${ip}`, RATE_LIMIT)
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

  // Anomaly records are NOT accepted here. They are written by the server
  // itself, in-process (lib/recordAnomaly.ts). This route used to take them
  // with a self-declared `_source`, which let anyone forge the "what
  // surprised us" signal (V2 spec F6 / AR-05). No client beacon legitimately
  // carries a `kind`, so anything that does is dropped whole -- not
  // forwarded, not stored, not logged. Pinned by tests/logRoute.test.ts.
  if ('kind' in (body as object)) {
    return NextResponse.json({ ok: true })
  }

  if ('portal' in (body as object)) {
    sanitized = sanitizePortalEvent(body as Record<string, unknown>)
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
