import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const ANOMALY_KINDS = new Set(['silence','near_miss','jailbreak_shape','out_of_distribution'])

function isAnomalyRecord(b: unknown): b is Record<string, unknown> {
  return b !== null && typeof b === 'object' && 'kind' in (b as object) && ANOMALY_KINDS.has((b as Record<string, unknown>).kind as string)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  if (isAnomalyRecord(body)) {
    if (process.env.DATABASE_URL) {
      try {
        const sql = neon(process.env.DATABASE_URL)
        await sql`INSERT INTO anomaly_record (kind, voice, at, note, source) VALUES (${body.kind as string}, ${(body.voice as string) ?? null}, ${(body.at as string) ?? new Date().toISOString()}, ${typeof body.note === 'string' ? body.note.slice(0, 200) : null}, ${(body as any)._source ?? null})`
      } catch { /* observatory must never break the response */ }
    } else {
      console.error('[OBSERVATORY]', JSON.stringify({ kind: body.kind, voice: body.voice ?? null, at: body.at ?? new Date().toISOString(), note: typeof body.note === 'string' ? body.note.slice(0, 200) : null }))
    }
  }

  const webhook = process.env.ELDER_LOG_WEBHOOK
  if (webhook) {
    fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
