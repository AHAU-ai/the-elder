/**
 * recordAnomaly.ts — the one write path for anomaly_record.
 *
 * Anomaly records are the "what surprised us" signal: silences, near misses,
 * jailbreak-shaped inputs, out-of-distribution inputs. Shapes and signals
 * only, never seeker text (see src/resilience/observatory.ts).
 *
 * They used to travel from /api/divine to /api/log over HTTP, and /api/log
 * took a self-declared `_source`. That had three faults (V2 spec F6, AR-05):
 *
 *   1. Anyone could POST a forged anomaly and have it stored as if the
 *      server had written it.
 *   2. The self-call was silently dead for 2.5 months (a relative URL, fixed
 *      2026-08-20), and nothing noticed. A hop that can fail without anyone
 *      knowing is a hop worth removing.
 *   3. Every server-originated record shared one `log:<ip>` rate-limit bucket,
 *      so a single daily cap applied across all seekers.
 *
 * Now the server writes the record itself, in-process, after the response is
 * sent (so latency is unchanged), and /api/log refuses anomaly records from
 * the public. `source` is chosen by the calling server code, never by the
 * client.
 *
 * Telemetry never breaks a request: every failure here is swallowed and
 * logged to stderr only.
 */

import { neon } from '@neondatabase/serverless';
import { after } from 'next/server';

export const ANOMALY_KINDS = ['silence', 'near_miss', 'jailbreak_shape', 'out_of_distribution'] as const;
export type AnomalyKind = (typeof ANOMALY_KINDS)[number];

export interface SanitizedAnomaly {
  kind: AnomalyKind;
  voice: string | null;
  at: string;
  note: string | null;
  source: string;
}

/**
 * Validate and bound an anomaly. Returns null if it is not a well-formed
 * anomaly (the caller drops it). `source` is supplied by trusted server code.
 */
export function sanitizeAnomaly(entry: unknown, source: string): SanitizedAnomaly | null {
  if (entry === null || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.kind !== 'string' || !(ANOMALY_KINDS as readonly string[]).includes(e.kind)) return null;

  let at = new Date().toISOString();
  if (typeof e.at === 'string') {
    const t = Date.parse(e.at);
    if (Number.isFinite(t)) at = new Date(t).toISOString();
  }

  return {
    kind: e.kind as AnomalyKind,
    voice: typeof e.voice === 'string' ? e.voice.slice(0, 64) : null,
    at,
    note: typeof e.note === 'string' ? e.note.slice(0, 200) : null,
    source: source.slice(0, 100),
  };
}

/** Write one anomaly. Never throws. */
export async function recordAnomaly(entry: unknown, source: string): Promise<void> {
  try {
    const s = sanitizeAnomaly(entry, source);
    if (!s) return;

    if (process.env.DATABASE_URL) {
      try {
        const sql = neon(process.env.DATABASE_URL);
        await sql`INSERT INTO anomaly_record (kind, voice, at, note, source) VALUES (${s.kind}, ${s.voice}, ${s.at}, ${s.note}, ${s.source})`;
      } catch (err) {
        console.error('[recordAnomaly] anomaly_record insert failed:', err);
      }
    } else {
      console.error('[OBSERVATORY]', JSON.stringify(s));
    }

    const webhook = process.env.ELDER_LOG_WEBHOOK;
    if (webhook) {
      // Only the sanitized fields, exactly what was recorded.
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[recordAnomaly] failed:', err);
  }
}

/**
 * Record after the response has been sent, so the seeker never waits on
 * telemetry. Falls back to a plain fire-and-forget if called outside a
 * request scope (for example from a script or test).
 */
export function scheduleAnomaly(entry: unknown, source: string): void {
  try {
    after(() => recordAnomaly(entry, source));
  } catch {
    void recordAnomaly(entry, source);
  }
}
