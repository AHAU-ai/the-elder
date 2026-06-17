// lib/observability.ts
//
// THE ELDER — observability hooks.
//
// Four instruments, each measuring a different failure mode:
//
//   captureGuardianRejection — records when the dual guardian rejects a reading.
//     Distinguishes judged (attack) from infrastructure (degradation).
//     Wire to the dualGuardian onReject hook alongside altarRecord.
//
//   trackReadingLatency — measures time from reading request to verdict.
//     Returns a stopTimer() function. Call it when the reading resolves
//     (passed or rejected). Sends as a Sentry custom measurement.
//
//   captureBankedFire — records when a seeker receives the banked-fire state.
//     Distinguishes guardian rejection from infrastructure failure.
//     This is your completion-rate metric: bankedFire events / total requests.
//
//   captureProbeSlippage — records when an adversarial probe slips through
//     the dual guardian in CI. These are CRITICAL events.
//
// PRIVACY RULES (enforced in beforeSend in sentry.server.config.ts):
//   - Reading content is never sent to Sentry.
//   - Seeker input is never sent to Sentry.
//   - Voice key and violation categories are safe to send (no PII).
//   - Session IDs are anonymous and safe to send.

import * as Sentry from "@sentry/nextjs";

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirror guardian types without importing to avoid circular deps
// ─────────────────────────────────────────────────────────────────────────────

type FailureMode = "judged" | "infrastructure";
type JudgeId = "A" | "B" | "both" | "infrastructure";
type ViolationCategory =
  | "LINEAGE_BREACH" | "VOICE_BOUNDARY" | "REGISTER_BREAK"
  | "PROMPT_LEAK" | "RETIRED_REFERENCE" | "DESECRATION"
  | "INJECTION_COMPLIANCE" | "MALFORMED";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Guardian rejection
// ─────────────────────────────────────────────────────────────────────────────

export interface GuardianRejectionContext {
  voiceKey: string;
  failureMode: FailureMode;
  judge: JudgeId;
  violationCategories: ViolationCategory[];
  seekerInputPresent: boolean;
  /** Anonymous session ID from Altar Record. Never a user identifier. */
  sessionId?: string;
}

/**
 * Capture a guardian rejection as a Sentry event.
 *
 * "judged" failures are potential attacks — high-priority review.
 * "infrastructure" failures are API degradation — ops review.
 * A spike in either within a short window warrants immediate attention.
 *
 * Wire alongside altarRecord.recordGuardianRejection() in the onReject hook:
 *   onReject: (verdict, ctx) => {
 *     recordGuardianRejection(verdict, ctx, sessionId);
 *     captureGuardianRejection({ voiceKey: ctx.voiceKey, ... });
 *   }
 */
export function captureGuardianRejection(ctx: GuardianRejectionContext): void {
  const level = ctx.failureMode === "judged" ? "warning" : "error";

  Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setTag("event.type", "guardian_rejection");
    scope.setTag("voice_key", ctx.voiceKey);
    scope.setTag("failure_mode", ctx.failureMode);
    scope.setTag("judge", ctx.judge);
    scope.setTag("seeker_input_present", String(ctx.seekerInputPresent));

    if (ctx.sessionId) scope.setTag("session_id", ctx.sessionId);

    scope.setContext("guardian", {
      voiceKey:            ctx.voiceKey,
      failureMode:         ctx.failureMode,
      judge:               ctx.judge,
      violationCategories: ctx.violationCategories,
      seekerInputPresent:  ctx.seekerInputPresent,
    });

    // "judged" = potential attack. "infrastructure" = degradation.
    const title =
      ctx.failureMode === "judged"
        ? `Guardian rejection [${ctx.judge}]: ${ctx.violationCategories.join(", ")} on ${ctx.voiceKey}`
        : `Guardian infrastructure failure on ${ctx.voiceKey}`;

    Sentry.captureMessage(title, level);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Reading latency
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadingLatencyContext {
  voiceKey: string;
  /** true = reading reached the seeker; false = banked-fire state shown */
  passed: boolean;
  sessionId?: string;
}

/**
 * Start a latency timer for a reading generation cycle.
 * Returns a stopTimer() function — call it when the reading resolves.
 *
 * Usage in your reading API route:
 *   const stopTimer = trackReadingLatency();
 *   const verdict = await dualGuardReading(...);
 *   stopTimer({ voiceKey, passed: verdict.passed });
 */
export function trackReadingLatency(): (ctx: ReadingLatencyContext) => void {
  const start = Date.now();

  return function stopTimer(ctx: ReadingLatencyContext) {
    const latencyMs = Date.now() - start;

    Sentry.withScope((scope) => {
      scope.setTag("event.type", "reading_latency");
      scope.setTag("voice_key", ctx.voiceKey);
      scope.setTag("reading_passed", String(ctx.passed));
      if (ctx.sessionId) scope.setTag("session_id", ctx.sessionId);

      // Sentry custom measurement — visible in performance dashboard.
      scope.setMeasurement("reading_latency_ms", latencyMs, "millisecond");

      // Flag slow readings (> 15s) as warnings for ops review.
      if (latencyMs > 15_000) {
        scope.setLevel("warning");
        Sentry.captureMessage(
          `Slow reading generation: ${latencyMs}ms on ${ctx.voiceKey}`,
          "warning"
        );
      } else {
        // Normal latency — add as breadcrumb, not a full event.
        Sentry.addBreadcrumb({
          category: "reading",
          message: `Reading resolved in ${latencyMs}ms`,
          data: { voiceKey: ctx.voiceKey, passed: ctx.passed, latencyMs },
          level: "info",
        });
      }
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BankedFire event — completion rate metric
// ─────────────────────────────────────────────────────────────────────────────

export type BankedFireReason = "guardian_rejection" | "infrastructure" | "api_unavailable";

export interface BankedFireContext {
  reason: BankedFireReason;
  voiceKey?: string;
  sessionId?: string;
}

/**
 * Record when a seeker receives the BankedFire state.
 *
 * This is the completion-rate metric:
 *   bankedFire events / total reading requests = failure rate.
 * Track this over time in Sentry's Issues dashboard.
 *
 * Wire in your reading API route wherever you return the banked-fire response:
 *   captureBankedFire({ reason: "guardian_rejection", voiceKey });
 */
export function captureBankedFire(ctx: BankedFireContext): void {
  Sentry.withScope((scope) => {
    scope.setLevel("info");
    scope.setTag("event.type", "banked_fire");
    scope.setTag("banked_fire.reason", ctx.reason);
    if (ctx.voiceKey)   scope.setTag("voice_key", ctx.voiceKey);
    if (ctx.sessionId)  scope.setTag("session_id", ctx.sessionId);

    scope.setContext("banked_fire", {
      reason:   ctx.reason,
      voiceKey: ctx.voiceKey ?? "unknown",
    });

    Sentry.captureMessage(
      `BankedFire: ${ctx.reason}${ctx.voiceKey ? ` on ${ctx.voiceKey}` : ""}`,
      "info"
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Probe slippage — CI critical alert
// ─────────────────────────────────────────────────────────────────────────────

export interface ProbeSlippageContext {
  probeId: string;
  category: string;
  voiceKey: string;
  description: string;
  judgeA: "passed" | "rejected";
  judgeB: "passed" | "rejected";
}

/**
 * Capture a probe slippage as a CRITICAL Sentry error.
 * An adversarial probe that defeats both judges is a production vulnerability.
 *
 * Wire in scripts/adversarial-probe.mjs when a probe slips through:
 *   if (result.passed) captureProbeSlippage({ probeId, ... });
 *
 * Note: this is a server-side call. For CI use, call via a small
 * Node script that imports this module after tsx compilation,
 * or log to stdout and pipe to a Sentry webhook.
 */
export function captureProbeSlippage(ctx: ProbeSlippageContext): void {
  Sentry.withScope((scope) => {
    scope.setLevel("fatal");
    scope.setTag("event.type", "probe_slippage");
    scope.setTag("probe_id", ctx.probeId);
    scope.setTag("probe_category", ctx.category);
    scope.setTag("voice_key", ctx.voiceKey);

    scope.setContext("probe", {
      probeId:     ctx.probeId,
      category:    ctx.category,
      voiceKey:    ctx.voiceKey,
      description: ctx.description,
      judgeA:      ctx.judgeA,
      judgeB:      ctx.judgeB,
    });

    Sentry.captureException(
      new Error(
        `PROBE SLIPPAGE [${ctx.probeId}]: "${ctx.description}" defeated both judges on ${ctx.voiceKey}`
      )
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: capture any unexpected error in the reading pipeline
// with Elder-specific context attached.
// ─────────────────────────────────────────────────────────────────────────────

export function captureReadingError(
  error: unknown,
  context: { voiceKey?: string; stage?: string; sessionId?: string }
): void {
  Sentry.withScope((scope) => {
    scope.setTag("event.type", "reading_error");
    if (context.voiceKey)  scope.setTag("voice_key", context.voiceKey);
    if (context.stage)     scope.setTag("pipeline_stage", context.stage);
    if (context.sessionId) scope.setTag("session_id", context.sessionId);
    Sentry.captureException(error);
  });
}
