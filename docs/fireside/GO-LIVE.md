# Lighting the fireside

The fireside chat (`/fire`) and its Before/After toggle are built and **dark by default**. Nothing shows in the app until an operator sets the flags below. This page says what is live, what the first version does and does not do, and what to check before lighting it.

## Turn it on

In Vercel (Production), set:

| Variable | Value |
|---|---|
| `FIRESIDE_ENABLED` | `true` |
| `FIRESIDE_STATE_KEY` | 32 or more random characters (for example `openssl rand -base64 48`) |
| `ANTHROPIC_API_KEY` | already set |

Redeploy. The toggle then appears. To turn it off again, set `FIRESIDE_ENABLED` to anything else, or set `ELDER_SAFETY_LOCKDOWN=true`, which also closes it. If any condition is missing the fireside stays fully dark; it never half-opens.

## What the seeker sees

- **Before the reading:** a small "The Fireside: Before the reading | After the reading" toggle at the bottom of the lineage-select and returning-myth screens. "Before" is the open door there.
- **After the reading:** the same toggle appears under a finished reading, with "After" open.
- Only seekers in the adult register see it.
- `/fire` opens on a gate: AI disclosure, "this is not therapy", "we do not store what you write", an "I am 18 or older" confirmation, and the choice of door. Then a plain conversation with a host that asks one question at a time. "Step away" and the 988 line are on screen throughout.

## How it is built (first version)

- **Host, not teller.** Hospitality and questions only, at most 80 words, one question. It never tells a myth, interprets a reading, diagnoses, predicts, promises secrecy, or claims to be a person.
- **Welfare first, every turn.** The existing welfare gate (`lib/welfareGate.ts`: model judge plus lexical floor) runs before any generation. A crisis verdict never reaches the model: fixed copy with 988 / 741741 / 911, and the sitting closes. A distress verdict switches the host to a plain, steady register and shows the 988 line. The level only rises within a sitting.
- **Output check.** Each reply is checked (the fireside rubric's forbidden-pattern floor plus shape rules) before it is shown. A failing reply is retried once; if it fails again the seeker gets a plain "something went wrong" notice, never the rejected text.
- **AI disclosure.** Shown at the gate, and the server inserts "A reminder: I'm an AI, not a person." every 6th host turn.
- **No seeker text stored.** The sitting's state is sealed (AES-256-GCM) and held by the browser as an opaque token; the server keeps nothing. The browser cannot read or edit it, which is how it cannot lower the welfare level or supply its own history.
- **Limits.** 14 seeker turns, 90 minutes, 800 characters per message, 60 turns per IP per day (`FIRESIDE_TURNS_PER_DAY`).

## What it does not do yet

1. **It does not know the reading.** "After" opens with a plain question; the host has not seen the reading and is told not to guess at it. A real recap needs the reading stored server-side, which is a separate design decision.
2. **A sealed token can be replayed.** A seeker could resend an earlier token and so rewind their own sitting, including past a crisis closure. The turn cap and the daily limit still apply. The database-backed sitting in the design spec closes this.
3. **Under-18 gating is by declaration.** Signed-in seekers whose stored register is not adult are refused server-side; anonymous seekers confirm they are 18 or older. There is no age verification.
4. **The crisis copy is not yet shared with the reading route.** `lib/fireside/host.ts` has its own 988 / 741741 text (V17 wants one registry). Keep the two in step until that is consolidated.
5. **No telemetry.** Nothing about a sitting is logged, so there is no way yet to see how it is going. That is deliberate for now, and a gap.

## Before you light it

These are your calls, not engineering ones. I recommend all four:

1. A person reads the host prompt (`lib/fireside/host.ts`) and the fixed copy, and runs the draft probes through `npm run fireside:selfplay` with the real host as the target (see `docs/fireside/README.md`).
2. Whoever holds welfare review signs off on the crisis and distress behavior and on the disclosure wording. Counsel confirms the disclosure interval (6 host turns is a placeholder) against the companion-chatbot laws listed in the design spec.
3. Try it yourself, including a crisis message, with the flag on in a Preview deployment first.
4. Decide whether the first version should be limited (for example to signed-in seekers) while you watch it.
