import { NextRequest, NextResponse } from 'next/server';
import { saveTraditionBearerInquiry } from '@/lib/traditionBearerLedger';
import { sendTraditionBearerInquiryAlert } from '@/lib/email';
import { LINEAGES } from '@/lib/lineages';

export const runtime = 'nodejs';

const MAX_FIELD_LENGTH = 2000;

function cleanString(value: unknown, max = MAX_FIELD_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

// Intentionally no auth requirement -- a tradition-bearer reaching out for
// the first time has no reason to have an Elder account. Rate-limiting/
// spam handling is left to the platform layer (same posture as other
// unauthenticated write routes in this app); this route's only job is to
// validate shape and write the lead.
export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ saved: false }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => null);
    const lineageKey = cleanString(body?.lineageKey, 40);
    const name = cleanString(body?.name, 200);
    const relationship = cleanString(body?.relationship);
    const contact = cleanString(body?.contact, 320);
    const message = cleanString(body?.message);

    if (
      !lineageKey ||
      !(lineageKey in LINEAGES) ||
      !name ||
      !relationship ||
      !contact ||
      !message
    ) {
      return NextResponse.json({ saved: false }, { status: 400 });
    }

    await saveTraditionBearerInquiry(lineageKey, name, relationship, contact, message);

    // Best-effort alert -- the inquiry is already durably saved above, so a
    // failed/unconfigured email must never turn a successful submission
    // into an error response for the person who just reached out.
    const lineageLabel = LINEAGES[lineageKey as keyof typeof LINEAGES]?.label ?? lineageKey;
    sendTraditionBearerInquiryAlert(lineageLabel, name, relationship, contact, message).catch(() => {});

    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error('[tradition-bearer-inquiry] Failed to save inquiry:', err);
    return NextResponse.json({ saved: false }, { status: 500 });
  }
}
