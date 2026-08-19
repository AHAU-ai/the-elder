import { NextRequest, NextResponse } from 'next/server';
import {
  getLettersDueForEmailDelivery,
  markLetterEmailSent,
  markLetterEmailAttemptFailed,
} from '@/lib/thresholdLetterLedger';
import { sendThresholdLetterEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Scheduled sweep (see vercel.json) that delivers kept Threshold Letters
// back to seekers who opted in, once they're old enough
// (DELIVERY_DELAY_DAYS in lib/thresholdLetterLedger.ts). This is the one
// proactive/"push" touchpoint in an otherwise entirely pull-based memory
// architecture (myth_archetype, RecallLetter, journal synthesis all only
// activate if the seeker returns on their own) — see
// docs/shareable-card-visual-system.md's sibling reasoning for why this
// stays a single one-time send per letter rather than a recurring nudge:
// email_attempts + delivery_email_sent_at together make re-sending the
// same letter impossible, by construction, not by discipline.
//
// Auth: a shared secret, not a session — this route is invoked by Vercel
// Cron (or any scheduler), never by a browser. Fails closed if
// CRON_SECRET is unset, same posture as ELDER_SESSION_SECRET/ALTAR_SECRET
// elsewhere in this codebase (see .env.example).

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: 'no DATABASE_URL' });
  }

  let sent = 0;
  let failed = 0;

  try {
    const due = await getLettersDueForEmailDelivery();
    const url = siteUrl();

    for (const letter of due) {
      const ok = await sendThresholdLetterEmail(letter.email, letter.returnGift, letter.thresholdImage, url);
      if (ok) {
        await markLetterEmailSent(letter.id);
        sent++;
      } else {
        await markLetterEmailAttemptFailed(letter.id);
        failed++;
      }
    }
  } catch (err) {
    console.error('[cron/deliver-threshold-letters] Sweep failed:', err);
    return NextResponse.json({ error: 'sweep failed', sent, failed }, { status: 500 });
  }

  return NextResponse.json({ sent, failed });
}
