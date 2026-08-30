# Referral / Acquisition Attribution

First pass at answering a question the project record had no way to
answer before this: does any given distribution effort — a partner org's
link, a shared reading — actually bring in NEW seekers, not just get
looked at by people already using the app?

## How it works

1. Anyone landing on any page with `?ref=<code>` in the URL gets a
   first-touch cookie (`elder_ref`, 90 days, `middleware.ts` +
   `lib/referral.ts`). "First-touch" means the *first* `ref` code a
   visitor ever arrives with is what sticks — clicking a different link
   later doesn't reassign credit.
2. If that visitor signs up (`app/api/auth/verify/route.ts`), the code is
   written once to `elder_user.referral_source` / `referred_at` and never
   changed again on later sign-ins.
3. `npm run referral:report` queries `elder_user` grouped by
   `referral_source` — real new-account counts per channel.

## Giving a partner org a trackable link

Pick a short, stable code for the org (lowercase, hyphenated — the
sanitizer in `lib/referral.ts` accepts `[a-zA-Z0-9_-]{1,64}`, nothing
else) and hand them:

```
https://<your-domain>/?ref=partner-<name>
```

Example: `https://theelder.app/?ref=partner-okma` for a link OKMA
(Oxlajuj Ajpop / a K'iche' Ajq'ij network) might place on their own site
or share with their community. Every signup that first arrived through
that link shows up as `partner-okma` in the report.

Naming convention: `partner-<org>` for organizations, `share-<uuid>` is
reserved (auto-generated, see below) — don't hand-issue codes starting
with `share-`.

## Tracked shares

`app/components/ShareableCard.tsx`'s "Meet The Elder" link on a shared
card's public page (`app/share/[id]`) already carries `?ref=share-<id>`.
`share_card.open_count` tracks how many times that public page loaded
(reach); `referral:report`'s second table cross-references opens against
actual signups per share, so you can see conversion rate, not just reach.

**Known gap, not yet closed**: `ShareableCard.createShareLink()` only
runs for signed-in seekers — an anonymous "taste" visitor who gets a
reading they want to share falls back to sharing the raw PNG image
directly via the device share sheet (`navigator.share({files})`), with
no `/share/[id]` link and therefore zero tracking. This means the exact
audience most likely to produce organic, no-friction virality — someone
trying the app for the first time with no account — is currently
invisible to this whole measurement system. Closing this would mean
letting `POST /api/share` create a card with a nullable `owner_user_id`
for anonymous callers; not done here since it's a real product/schema
decision (anonymous-owned rows, moderation/abuse surface) beyond this
pass's scope.

## Running the report

```
npm run referral:report
npm run referral:report -- --since 2026-08-01
npm run referral:report -- --source partner-okma
```

Requires `DATABASE_URL` (reads `.env.local` if not already set in the
environment, same as `scripts/drift-detect.mjs`).
