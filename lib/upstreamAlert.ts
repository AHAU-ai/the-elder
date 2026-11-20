// lib/upstreamAlert.ts
//
// Make an infrastructure failure LOUD to the operator, never to the seeker.
//
// When the model is unreachable (credits exhausted, key revoked, upstream
// outage) the seeker is told plainly that the fire cannot answer right now
// (see app/api/divine/route.ts). This module makes sure the person who runs
// the instrument finds out in minutes, not after testers report it.
//
// Three channels, all best-effort and none allowed to throw or delay the
// response by more than WEBHOOK_TIMEOUT_MS:
//   1. A greppable stderr line  -> Vercel runtime logs
//        [ELDER_UPSTREAM_FAIL] kind=billing status=400 route=/api/divine voice=ojer_tzij
//   2. Sentry, at "error" level, fingerprinted by kind so it groups into one
//      issue that an alert rule can notify on (the existing captureBankedFire
//      is level "info" and is a completion-rate metric, not an alarm).
//   3. An optional webhook (ALERT_WEBHOOK_URL: a Slack-compatible incoming
//      webhook, or any URL accepting JSON {text}). Absent => skipped.
//
// PRIVACY: carries only the failure kind, HTTP status, route and voice key.
// Never seeker input, reading text, the API key, or the raw upstream message.
//
// DEDUPE: at most one webhook per kind per DEDUPE_MS *per server instance*.
// This is in-memory, so on serverless it bounds spam within a warm instance
// but is not a global guarantee; Sentry's own grouping is the durable layer.

import * as Sentry from "@sentry/nextjs";
import Anthropic from "@anthropic-ai/sdk";
import { classifyUpstreamError, type UpstreamInfo } from "@/src/resilience/failTowardSilence";

const DEDUPE_MS = 15 * 60 * 1000;
const WEBHOOK_TIMEOUT_MS = 2500;

const lastWebhookAt = new Map<string, number>();

export interface UpstreamAlertContext {
  route: string;
  voiceKey?: string;
  upstream: UpstreamInfo;
}

/** Test hook: clear the in-memory webhook dedupe state. */
export function _resetUpstreamAlertDedupe(): void {
  lastWebhookAt.clear();
}

export async function alertUpstreamFailure(ctx: UpstreamAlertContext): Promise<void> {
  const { kind, status } = ctx.upstream;
  try {
    console.error(
      `[ELDER_UPSTREAM_FAIL] kind=${kind}` +
        (status !== undefined ? ` status=${status}` : "") +
        ` route=${ctx.route}` +
        (ctx.voiceKey ? ` voice=${ctx.voiceKey}` : "")
    );
  } catch {
    /* logging must never throw */
  }

  try {
    Sentry.withScope((scope) => {
      scope.setLevel("error");
      scope.setTag("event.type", "upstream_failure");
      scope.setTag("upstream.kind", kind);
      if (status !== undefined) scope.setTag("upstream.status", String(status));
      scope.setTag("route", ctx.route);
      if (ctx.voiceKey) scope.setTag("voice_key", ctx.voiceKey);
      scope.setFingerprint(["elder-upstream-failure", kind]);
      Sentry.captureMessage(`Upstream failure: ${kind}`, "error");
    });
  } catch {
    /* observability must never throw */
  }

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  const now = Date.now();
  const last = lastWebhookAt.get(kind) ?? 0;
  if (now - last < DEDUPE_MS) return;
  lastWebhookAt.set(kind, now);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text:
            `The Elder cannot reach its model: ${kind}` +
            (status !== undefined ? ` (HTTP ${status})` : "") +
            ` on ${ctx.route}. Seekers are being told the fire cannot answer.`,
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* a dead webhook must never break the response */
  }
}

/**
 * Report a failure thrown by a model call, but ONLY if it really is the model
 * API being unreachable. A seeker turning back (APIUserAbortError), a database
 * error, or a bug in our own code that happens to surface in the same catch is
 * not an upstream outage and must not page the operator as one. Never throws.
 */
export async function reportModelFailure(err: unknown, route: string, voiceKey?: string): Promise<void> {
  try {
    if (err instanceof Anthropic.APIUserAbortError) return;
    if (!(err instanceof Anthropic.APIError)) return;
    const upstream: UpstreamInfo =
      err instanceof Anthropic.APIConnectionTimeoutError
        ? { kind: "timeout" }
        : err instanceof Anthropic.APIConnectionError
          ? { kind: "overloaded" }
          : classifyUpstreamError(err);
    await alertUpstreamFailure({ route, voiceKey, upstream });
  } catch {
    /* alerting must never break a route */
  }
}

/**
 * Wrap a model call: on failure, tell the operator (see reportModelFailure),
 * then rethrow UNCHANGED so each caller's existing fallback behaviour is exactly
 * what it was. Use at call sites whose own catch swallows the error into a
 * graceful fallback, where the outage would otherwise be invisible.
 */
export async function withModelAlert<T>(route: string, call: Promise<T>, voiceKey?: string): Promise<T> {
  try {
    return await call;
  } catch (err) {
    await reportModelFailure(err, route, voiceKey);
    throw err;
  }
}
