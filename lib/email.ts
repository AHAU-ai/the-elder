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
