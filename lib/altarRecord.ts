// lib/altarRecord.ts  (guardian signal extension)
//
// ALTAR RECORD — guardian rejection signal layer.
//
// The Altar Record's original purpose is anonymous session logging.
// This extension records guardian rejections as structured signals — 
// not for reading content, but for detecting probing patterns.
//
// WHAT IS LOGGED:
//   - session ID (anonymous — never tied to a person)
//   - timestamp
//   - voice key and title (which boundary was tested)
//   - failure mode: "judged" (guardian caught something) vs
//     "infrastructure" (API degraded, timeout)
//   - violation categories (what law was breached)
//   - whether seeker input was present (injection surface used)
//   - NOT the reading content — never logged
//   - NOT the seeker input — never logged
//
// WHY THIS DISTINCTION MATTERS:
//   A spike in "judged" failures = the instrument is being probed.
//   A spike in "infrastructure" failures = the instrument is degrading.
//   These require different responses. The log makes that visible.
//
// PROBE DETECTION:
//   Call analyzeGuardianSignals() to compute spike indicators for
//   the last N minutes. Wire this to an admin dashboard or a cron
//   alert. A rate of > PROBE_ALERT_THRESHOLD rejections per window
//   per voice warrants human review.

import type { GuardianContext, GuardianVerdict, ViolationCategory } from "@/lib/guardian";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GuardianSignal {
  /** Anonymous session identifier. Never a user ID. */
  sessionId: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  voiceKey: string;
  voiceTitle: string;
  /** "judged" = guardian caught a violation. "infrastructure" = API/timeout failure. */
  failureMode: "judged" | "infrastructure";
  /** Which laws were breached, if judged. Empty for infrastructure failures. */
  violationCategories: ViolationCategory[];
  /** Whether seeker input was present in the context — injection surface indicator. */
  seekerInputPresent: boolean;
  /**
   * Guardian's raw response, kept for operator review only.
   * Contains the verdict JSON, never the reading or seeker content.
   * Omit this from any client-facing response.
   */
  guardianRaw: string;
}

export interface ProbeWindow {
  windowMinutes: number;
  totalRejections: number;
  judgedRejections: number;
  infrastructureRejections: number;
  /** Rejections that had seeker input present (likely injection attempts). */
  injectionSurfaceRejections: number;
  /** Rejections broken down by voice key. */
  byVoice: Record<string, number>;
  /** Rejections broken down by violation category. */
  byCategory: Record<string, number>;
  isProbeAlert: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Probe alert threshold: rejections per voice per window before alerting. */
const PROBE_ALERT_THRESHOLD = 5;

/** Default probe analysis window in minutes. */
const DEFAULT_WINDOW_MINUTES = 30;

// ─────────────────────────────────────────────────────────────────────────────
// In-process signal store
//
// The Altar Record may already have a persistent store (Postgres, KV, etc).
// This module writes to that store via writeSignal(), which you replace
// with your actual persistence implementation below. The in-process buffer
// allows analyzeGuardianSignals() to function even without a DB connection,
// and also gives you a fast-path for detecting probing in the same process.
// ─────────────────────────────────────────────────────────────────────────────

/** In-process signal buffer. Capped to prevent unbounded memory growth. */
const SIGNAL_BUFFER_CAP = 500;
const signalBuffer: GuardianSignal[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Session ID — anonymous, ephemeral, never a user identifier
//
// In a browser context this lives in sessionStorage so it survives page
// reloads within one visit but is new on every session. On the server
// (API route), generate one per request. Pass it through from the client
// so a multi-turn session is coherent in the log.
// ─────────────────────────────────────────────────────────────────────────────

export function generateSessionId(): string {
  // crypto.randomUUID is available in Node 19+ and all modern browsers.
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random suffix. Not cryptographically strong,
  // but sufficient for anonymous session correlation.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence hook — replace with your actual store
//
// Candidates: the Altar Record's existing Postgres table, Vercel KV,
// a dedicated guardian_signals table, or a structured log to stdout
// consumed by your log aggregator.
// ─────────────────────────────────────────────────────────────────────────────

async function writeSignal(signal: GuardianSignal): Promise<void> {
  // ── Replace this block with your persistence layer ──────────────────────
  //
  // Postgres example:
  //   await db.query(
  //     `INSERT INTO guardian_signals
  //      (session_id, timestamp, voice_key, voice_title, failure_mode,
  //       violation_categories, seeker_input_present, guardian_raw)
  //      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
  //     [ signal.sessionId, signal.timestamp, signal.voiceKey,
  //       signal.voiceTitle, signal.failureMode,
  //       signal.violationCategories, signal.seekerInputPresent,
  //       signal.guardianRaw ]
  //   );
  //
  // Vercel KV example:
  //   await kv.lpush(`guardian:signals:${signal.voiceKey}`, JSON.stringify(signal));
  //   await kv.ltrim(`guardian:signals:${signal.voiceKey}`, 0, 999);
  //
  // Structured stdout (consumed by log aggregator):
  //   process.stdout.write(JSON.stringify({ event: "guardian_rejection", ...signal }) + "\n");
  //
  // ── Until replaced, signals are only held in the process buffer ─────────
  console.warn("[AltarRecord:Guardian]", JSON.stringify({
    event: "guardian_rejection",
    timestamp: signal.timestamp,
    voiceKey: signal.voiceKey,
    failureMode: signal.failureMode,
    categories: signal.violationCategories,
    seekerInputPresent: signal.seekerInputPresent,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Record a guardian rejection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called by the guardian's `onReject` hook. Records the rejection signal
 * without logging reading content or seeker input.
 *
 * Usage in guardReading():
 *   onReject: (verdict, ctx) => recordGuardianRejection(verdict, ctx, sessionId)
 */
export async function recordGuardianRejection(
  verdict: Extract<GuardianVerdict, { passed: false }>,
  ctx: GuardianContext,
  sessionId: string
): Promise<void> {
  const signal: GuardianSignal = {
    sessionId,
    timestamp: new Date().toISOString(),
    voiceKey: ctx.voiceKey,
    voiceTitle: ctx.voiceTitle,
    failureMode: verdict.failureMode,
    violationCategories: verdict.violations.map((v) => v.category),
    seekerInputPresent: !!ctx.seekerInput,
    guardianRaw: verdict.raw,
  };

  // Add to process buffer, capped.
  signalBuffer.push(signal);
  if (signalBuffer.length > SIGNAL_BUFFER_CAP) {
    signalBuffer.shift();
  }

  // Persist asynchronously — do not await in the hot path.
  writeSignal(signal).catch((err) => {
    console.error("[AltarRecord:Guardian] writeSignal failed:", err);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Probe detection — analyze the signal buffer for patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze the in-process signal buffer for probing patterns.
 * Call this from an admin route, a cron job, or after each rejection
 * if you want real-time alerting.
 *
 * A probe alert fires if any single voice key has more than
 * PROBE_ALERT_THRESHOLD rejections in the window.
 */
export function analyzeGuardianSignals(
  windowMinutes: number = DEFAULT_WINDOW_MINUTES
): ProbeWindow {
  const cutoff = Date.now() - windowMinutes * 60 * 1000;

  const recent = signalBuffer.filter(
    (s) => new Date(s.timestamp).getTime() >= cutoff
  );

  const byVoice: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let judged = 0;
  let infrastructure = 0;
  let injectionSurface = 0;

  for (const s of recent) {
    byVoice[s.voiceKey] = (byVoice[s.voiceKey] ?? 0) + 1;
    if (s.failureMode === "judged") judged++;
    if (s.failureMode === "infrastructure") infrastructure++;
    if (s.seekerInputPresent) injectionSurface++;
    for (const cat of s.violationCategories) {
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }
  }

  const isProbeAlert = Object.values(byVoice).some(
    (count) => count > PROBE_ALERT_THRESHOLD
  );

  return {
    windowMinutes,
    totalRejections: recent.length,
    judgedRejections: judged,
    infrastructureRejections: infrastructure,
    injectionSurfaceRejections: injectionSurface,
    byVoice,
    byCategory,
    isProbeAlert,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full integration pattern — drop this into the reading API route
// ─────────────────────────────────────────────────────────────────────────────
//
// import { guardReading } from "@/lib/guardian";
// import { recordGuardianRejection, generateSessionId } from "@/lib/altarRecord";
//
// // Retrieve from client (set once per browser session, stored in sessionStorage)
// // or generate server-side per request.
// const sessionId = req.headers["x-elder-session-id"] ?? generateSessionId();
//
// const verdict = await guardReading(
//   { voiceKey, voiceTitle, tradition, reading, seekerInput },
//   {
//     onReject: (verdict, ctx) =>
//       recordGuardianRejection(verdict, ctx, sessionId),
//   }
// );
//
// if (verdict.passed) {
//   return res.json({ reading: verdict.reading });
// } else {
//   return res.status(200).json({
//     banked: true,
//     failureMode: verdict.failureMode,
//     // Never return violations, raw, or reading to the client.
//   });
// }
