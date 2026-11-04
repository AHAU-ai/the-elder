/**
 * email.ts
 *
 * Sends the magic-link email via Resend's REST API directly (no SDK
 * dependency, matching the repo's lean dependency list — see
 * package.json). Fails closed and silently: an email that doesn't send
 * must never surface as a crash on the request route; the caller always
 * responds the same generic "check your email" message either way, so a
 * delivery failure is only visible in server logs.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendMagicLink(email: string, link: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error('[email] RESEND_API_KEY or EMAIL_FROM not configured; cannot send magic link.');
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Your way back to the fire',
        text: `The Elder remembers you.\n\nFollow this thread to return to your myth:\n${link}\n\nThis thread stays open for 15 minutes. If you did not ask for it, let it burn out — nothing happens.`,
        html: `
          <div style="font-family: Georgia, 'Times New Roman', serif; color: #2a2016; max-width: 480px; margin: 0 auto; padding: 24px;">
            <p style="font-style: italic; font-size: 16px; line-height: 1.7;">The Elder remembers you.</p>
            <p style="font-style: italic; font-size: 16px; line-height: 1.7;">Follow this thread to return to your myth:</p>
            <p style="margin: 28px 0;">
              <a href="${link}" style="color: #b8862f; font-size: 15px; letter-spacing: 0.04em;">${link}</a>
            </p>
            <p style="font-size: 12px; color: #7a6a5a; letter-spacing: 0.02em;">
              This thread stays open for 15 minutes. If you did not ask for it, let it burn out — nothing happens.
            </p>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend API error:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Failed to send magic link:', err);
    return false;
  }
}

/**
 * "A letter has come for you" — delayed delivery of a kept Threshold
 * Letter, sent only to a seeker who explicitly opted in
 * (elder_user.letters_by_email; see lib/thresholdLetterLedger.ts and
 * app/api/cron/deliver-threshold-letters). One email per letter, ever —
 * delivery_email_sent_at makes this un-repeatable, so this is never a
 * recurring nudge, just the one closing of the loop the seeker asked for.
 */
export async function sendThresholdLetterEmail(
  email: string,
  returnGift: string,
  thresholdImage: string,
  siteUrl: string,
  // The signed one-click stop (lib/letterStop.ts). Absent only if no signing
  // secret is configured, in which case the email falls back to the older
  // "sign in and turn it off" line rather than going out with a dead link.
  stopUrl: string | null = null
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error('[email] RESEND_API_KEY or EMAIL_FROM not configured; cannot send threshold letter.');
    return false;
  }

  const lettersUrl = `${siteUrl.replace(/\/$/, '')}/letters`;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'A letter has come for you',
        ...(stopUrl
          ? { headers: { 'List-Unsubscribe': `<${stopUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
          : {}),
        text: `A letter you kept has come back to you.\n\n${returnGift}\n${thresholdImage ? `\n${thresholdImage}\n` : ''}\nAll your kept letters: ${lettersUrl}\n\nYou are receiving this because you asked the fire to send letters back to you. ${stopUrl ? `To stop: ${stopUrl}` : 'To stop, sign in and turn it off.'}`,
        html: `
          <div style="font-family: Georgia, 'Times New Roman', serif; color: #2a2016; max-width: 480px; margin: 0 auto; padding: 24px;">
            <p style="font-style: italic; font-size: 15px; letter-spacing: 0.04em; color: #7a6a5a; text-transform: uppercase; font-size: 11px;">A letter has come for you</p>
            <p style="font-size: 17px; line-height: 1.9; margin: 24px 0;">${returnGift.replace(/</g, '&lt;')}</p>
            ${thresholdImage ? `<p style="font-style: italic; font-size: 14px; color: #7a6a5a;">${thresholdImage.replace(/</g, '&lt;')}</p>` : ''}
            <p style="margin: 32px 0 8px;">
              <a href="${lettersUrl}" style="color: #b8862f; font-size: 14px; letter-spacing: 0.04em;">All your kept letters →</a>
            </p>
            <p style="font-size: 11px; color: #7a6a5a; letter-spacing: 0.02em; margin-top: 28px;">
              You are receiving this because you asked the fire to send letters back to you. ${stopUrl ? `<a href="${stopUrl}" style="color: #7a6a5a;">Stop these letters</a>` : 'To stop, sign in and turn it off.'}
            </p>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend API error (threshold letter):', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Failed to send threshold letter:', err);
    return false;
  }
}

/**
 * "Someone reached out" — alerts the operator when a tradition-bearer
 * inquiry lands (app/tradition-bearers, lib/traditionBearerLedger.ts).
 * These need a human to actually follow up quickly; without this, a row
 * in tradition_bearer_inquiry could sit unnoticed indefinitely, which
 * defeats the point of building the door at all. Sent to
 * TRADITION_BEARER_ALERT_EMAIL (falls back to EMAIL_FROM so this degrades
 * to "the sending address also receives it" rather than silently no-op
 * if a dedicated inbox was never configured).
 */
export async function sendTraditionBearerInquiryAlert(
  lineageLabel: string,
  name: string,
  relationship: string,
  contact: string,
  message: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.TRADITION_BEARER_ALERT_EMAIL || process.env.EMAIL_FROM;
  if (!apiKey || !from || !to) {
    console.error('[email] RESEND_API_KEY, EMAIL_FROM, or an alert recipient not configured; cannot send tradition-bearer alert.');
    return false;
  }

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Tradition-bearer inquiry: ${lineageLabel}`,
        text: `A tradition-bearer inquiry came in for ${lineageLabel}.\n\nName: ${name}\nStanding: ${relationship}\nContact: ${contact}\n\nMessage:\n${message}\n\nThis does not authorize anything by itself — reply directly to ${contact} to start a real conversation, then record the outcome in docs/reading-shape-voice-review.md the same way every other review is recorded.`,
        html: `
          <div style="font-family: Georgia, 'Times New Roman', serif; color: #2a2016; max-width: 520px; margin: 0 auto; padding: 24px;">
            <p style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #7a6a5a;">Tradition-bearer inquiry</p>
            <p style="font-size: 17px; margin: 8px 0 20px;">${esc(lineageLabel)}</p>
            <p style="font-size: 14px; line-height: 1.8;"><strong>Name:</strong> ${esc(name)}</p>
            <p style="font-size: 14px; line-height: 1.8;"><strong>Standing:</strong> ${esc(relationship)}</p>
            <p style="font-size: 14px; line-height: 1.8;"><strong>Contact:</strong> ${esc(contact)}</p>
            <p style="font-size: 14px; line-height: 1.8; margin-top: 18px; white-space: pre-wrap;">${esc(message)}</p>
            <p style="font-size: 11px; color: #7a6a5a; letter-spacing: 0.02em; margin-top: 28px;">
              This does not authorize anything by itself. Reply directly to start a real conversation, then record the outcome in docs/reading-shape-voice-review.md.
            </p>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend API error (tradition-bearer alert):', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Failed to send tradition-bearer alert:', err);
    return false;
  }
}
