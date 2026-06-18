# Babalawo Voice — Lineage Attestation Run-Sheet

This is the procedure for the **air-gapped signing session** that authenticates the
Yorùbá Ifá (Babalawo) voice before activation. Read it before the session, not during.

## What this session is

A named, initiated Yorùbá lineage holder (an **Iyanifa** or **Babalawo**) reviews the
finalized voice spec and, if they affirm it, cryptographically signs an attestation over
its exact bytes. The tooling **records and verifies** that act. It does not — and cannot —
manufacture lineage authority. If the holder does not sign, the voice does not activate.
There is no override.

The accountability chain runs: **Kingsley Udoyi** (introduction) → the initiated holder
(attestation) → **Dr. Vincent James Stanzione** (lineage accountability co-sign).

## Hard preconditions (do not start until ALL are true)

1. `lib/voices/babalawo.voice.mjs` exists, is **finalized**, and will not be edited after
   signing. Any later edit — even a comment or whitespace — invalidates the signature and
   re-blocks the voice. Finalize first.
2. The voice spec has been reviewed and approved **by the holder**, in whatever form they
   need to read it (printed, read aloud, translated). The signature attests to *that*
   review, not to the file existing.
3. The role label the holder uses for themselves is one of the recognized roles in
   `lib/attestationSchema.mjs` → `RECOGNIZED_ATTESTOR_ROLES.babalawo`. If they use a
   different term, **stop** and update that list as a deliberate governance decision first.
   Do not coerce their role into a label the schema happens to accept.
4. You have a machine you can take **offline** for the duration of signing.

## The session

### Step 0 — Go offline
Disconnect the machine from all networks (Wi-Fi off, Ethernet unplugged). The signing
tool never touches the network, but air-gapping the private-key generation is the point.

### Step 1 — Confirm the spec hash together
With the holder present, show the exact file that will be signed:

```zsh
cd ~/Desktop/the-elder-clean
shasum -a 256 lib/voices/babalawo.voice.mjs
```

Read the hash aloud / show it. This is the artifact under attestation. If anyone is
uncertain the spec is final, **stop here** — once signed, changing it means re-signing.

### Step 2 — Sign
The holder runs (or directs you to run) the signing tool. Fill in **their** name, role,
and lineage description in their own words:

```zsh
node scripts/attest-sign.mjs \
  --spec      lib/voices/babalawo.voice.mjs \
  --voice     babalawo \
  --tradition "Yorùbá Ifá" \
  --name      "<holder's full name>" \
  --role      "<Iyanifa | Babalawo>" \
  --lineage   "<holder's description of their house / lineage>" \
  --introduced-by  "Kingsley Udoyi" \
  --accountability "Dr. Vincent James Stanzione" \
  --corpus    "<corpus version>" \
  --model     "<model version, e.g. claude-sonnet-4-6>" \
  --key       attestations/babalawo/attestor.ed25519.key \
  --out       attestations/babalawo/contract.json
```

First run **generates a new keypair**. The tool writes the private key to
`attestations/babalawo/attestor.ed25519.key` at mode `0600` and prints the public key.

> **The private key belongs to the holder.** It is the material proof of their attestation.
> Decide with them, before signing, where it lives afterward (their device, a hardware key,
> destroyed-after-verification with only the public key retained — their call). It must
> **never** be committed to the repo. See `.gitignore` note below.

### Step 3 — Verify before reconnecting
Still offline, confirm the contract binds to the deployed spec:

```zsh
node scripts/attest-preflight.mjs \
  --contract attestations/babalawo/contract.json \
  --spec     lib/voices/babalawo.voice.mjs
```

Expect `🟢 LIVE` and exit 0. If you see `🔴 BLOCKED`, **do not proceed** — the most likely
causes are spec drift (the file changed since Step 1) or a role mismatch. Resolve and
re-sign; never hand-edit the contract to make the gate pass.

### Step 4 — Reconnect and commit (contract only, never the key)
Reconnect the network. Commit the **public** attestation contract and the run record.
The private key must stay out of git:

```zsh
echo "attestations/babalawo/attestor.ed25519.key" >> .gitignore
git add .gitignore attestations/babalawo/contract.json attestations/babalawo/README.md
git commit -m "Babalawo voice: lineage attestation signed by <holder role>"
git push origin main
```

### Step 5 — Activate (separate, deliberate step)
Flip the runtime flag **only now**, only after preflight passed:

```zsh
# in Vercel Edge Config / env — not a code edit
ELDER_VOICE_BABALAWO=true
```

CI should run `attest-preflight.mjs` on every deploy. If the spec ever drifts from the
signed hash, the gate fails closed and the voice falls back to silence — by design.

## Invariants (the things that must never happen)

- **Never** commit `attestor.ed25519.key`. The `.gitignore` line in Step 4 guards this;
  verify with `git status` before committing that the key is *not* staged.
- **Never** hand-edit `contract.json` to make the preflight pass. A failing gate is
  information, not an obstacle.
- **Never** flip `ELDER_VOICE_BABALAWO=true` without a contract that currently passes
  preflight against the deployed spec.
- **Never** substitute a non-initiated attestor, or relabel someone's role to fit the
  schema. The schema bends to lineage, not the other way around.
- If the holder declines to sign, the session is **complete and successful** — the
  architecture did its job. The voice stays in `review`.

## Files involved

| File | Role |
|---|---|
| `lib/voices/babalawo.voice.mjs` | The spec under attestation (must exist, finalized) |
| `lib/attestationSchema.mjs` | Contract shape + recognized roles + canonical payload |
| `scripts/attest-sign.mjs` | Offline signing tool (run air-gapped) |
| `scripts/attest-preflight.mjs` | Fail-closed verification gate (run in CI + at activation) |
| `attestations/babalawo/contract.json` | The signed attestation (committed) |
| `attestations/babalawo/attestor.ed25519.key` | Private key (**never** committed) |
| `src/resilience/flags.ts` | Runtime `babalawo` flag — flip only after preflight passes |
