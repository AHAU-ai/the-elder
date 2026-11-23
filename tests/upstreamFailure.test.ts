/**
 * upstreamFailure.test.ts — the instrument fails toward honesty on infrastructure errors.
 * Pure-logic (no DB, no model, no network). Run: npx tsx tests/upstreamFailure.test.ts
 *
 * Guards the 2026-11-20 fix: when the model is unreachable (credits exhausted, key
 * revoked, outage) the seeker must be told plainly, NOT handed an in-register
 * "silence" as if it were a Reading (which led to a Threshold Letter for a reading
 * that never happened).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyUpstreamError,
  guardReading,
  type AnomalyEntry,
} from "../src/resilience/failTowardSilence";
import Anthropic from "@anthropic-ai/sdk";
import { dualGuardReading } from "../lib/dualGuardian";
import {
  alertUpstreamFailure,
  reportModelFailure,
  withModelAlert,
  _resetUpstreamAlertDedupe,
} from "../lib/upstreamAlert";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    console.error(`FAIL  ${name}`);
    failures++;
  }
}
const err = (status: number | undefined, message: string) =>
  Object.assign(new Error(message), status === undefined ? {} : { status });

async function main() {
  // 1. Classification — including Anthropic's quirk of reporting exhausted credits as a 400.
  check("billing: 400 + credit-balance message",
    classifyUpstreamError(err(400, "Your credit balance is too low to access the Anthropic API.")).kind === "billing");
  check("billing: 402", classifyUpstreamError(err(402, "x")).kind === "billing");
  check("auth: 401", classifyUpstreamError(err(401, "invalid x-api-key")).kind === "auth");
  check("auth: 403", classifyUpstreamError(err(403, "forbidden")).kind === "auth");
  check("rate_limited: 429", classifyUpstreamError(err(429, "rate")).kind === "rate_limited");
  check("overloaded: 500", classifyUpstreamError(err(500, "boom")).kind === "overloaded");
  check("overloaded: 529", classifyUpstreamError(err(529, "overloaded")).kind === "overloaded");
  check("timeout", classifyUpstreamError(new Error("ELDER_TIMEOUT")).kind === "timeout");
  check("unknown: empty_response", classifyUpstreamError(new Error("empty_response")).kind === "unknown");
  check("never throws on garbage", classifyUpstreamError(null).kind === "unknown" && classifyUpstreamError(42).kind === "unknown");
  check("a plain 400 (bad request) is NOT billing", classifyUpstreamError(err(400, "messages: field required")).kind === "unknown");

  // 2. guardReading carries the classification through to the route.
  const logged: AnomalyEntry[] = [];
  const g = await guardReading(
    async () => { throw err(400, "Your credit balance is too low to access the Anthropic API."); },
    { log: (e) => logged.push(e) }
  );
  check("guardReading: failure is not ok", g.ok === false);
  // tsconfig is strict:false, so `!g.ok` does not narrow the union; read through a cast.
  const gs = g as { upstream?: { kind: string }; failureClass?: string };
  check("guardReading: carries upstream.kind=billing", gs.upstream?.kind === "billing");
  check("guardReading: still a model_error silence class", gs.failureClass === "model_error");
  check("guardReading: still logs the anomaly", logged.length === 1 && logged[0].kind === "silence");
  const ok = await guardReading(async () => ({ ok: true as const, text: "a reading" }), { log: () => {} });
  check("guardReading: success path untouched", ok.ok === true && ok.text === "a reading");

  // 3. Alert helper: never throws, webhook deduped per kind, carries no seeker content.
  const realFetch = globalThis.fetch;
  const realErr = console.error;
  const calls: { url: string; body: string }[] = [];
  const lines: string[] = [];
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  (globalThis as any).fetch = async (url: string, init: any) => { calls.push({ url, body: String(init?.body) }); return new Response("ok"); };
  try {
    delete process.env.ALERT_WEBHOOK_URL;
    _resetUpstreamAlertDedupe();
    await alertUpstreamFailure({ route: "/api/divine", voiceKey: "ojer_tzij", upstream: { kind: "billing", status: 400 } });
    check("alert: no webhook when ALERT_WEBHOOK_URL unset", calls.length === 0);
    check("alert: greppable stderr line", lines.some((l) => l.includes("[ELDER_UPSTREAM_FAIL] kind=billing status=400 route=/api/divine voice=ojer_tzij")));

    process.env.ALERT_WEBHOOK_URL = "https://example.invalid/hook";
    _resetUpstreamAlertDedupe();
    await alertUpstreamFailure({ route: "/api/divine", upstream: { kind: "billing", status: 400 } });
    await alertUpstreamFailure({ route: "/api/divine", upstream: { kind: "billing", status: 400 } });
    check("alert: same kind deduped to one webhook", calls.length === 1);
    await alertUpstreamFailure({ route: "/api/divine", upstream: { kind: "auth", status: 401 } });
    check("alert: a different kind still alerts", calls.length === 2);
    check("alert: payload has no key/seeker material", !/sk-ant|messages|reading/i.test(calls[0].body.replace("Seekers are being told", "")));

    (globalThis as any).fetch = async () => { throw new Error("network down"); };
    _resetUpstreamAlertDedupe();
    let threw = false;
    try { await alertUpstreamFailure({ route: "/api/divine", upstream: { kind: "overloaded", status: 529 } }); } catch { threw = true; }
    check("alert: a dead webhook never throws", threw === false);
  } finally {
    globalThis.fetch = realFetch;
    console.error = realErr;
    delete process.env.ALERT_WEBHOOK_URL;
  }

  // 4. The dual guardian's judges carry WHY they could not conclude (the case that used to be
  //    reported to the seeker as "what rose to my lips was not mine to say").
  const judgeCtx = { voiceKey: "kiche", reading: "The seed went under and the corn kept its count.", seekerInput: "grief" };
  const clientRejecting = (e: () => Error) =>
    ({ messages: { create: () => Promise.reject(e()) } }) as never;
  {
    const billing = await dualGuardReading(judgeCtx, {
      client: clientRejecting(() => err(400, "Your credit balance is too low to access the Anthropic API.")),
      timeoutMs: 2000,
    });
    const b = billing as { passed: boolean; failureMode?: string; upstream?: { kind: string } };
    check("guardian: judge on empty credit fails closed as infrastructure", b.passed === false && b.failureMode === "infrastructure");
    check("guardian: ...and the verdict says billing", b.upstream?.kind === "billing");
    const auth = (await dualGuardReading(judgeCtx, { client: clientRejecting(() => err(401, "invalid x-api-key")), timeoutMs: 2000 })) as { upstream?: { kind: string } };
    check("guardian: judge 401 -> auth", auth.upstream?.kind === "auth");
    const hang = (await dualGuardReading(judgeCtx, {
      client: { messages: { create: (_p: unknown, o?: { signal?: AbortSignal }) => new Promise((_r, rej) => o?.signal?.addEventListener("abort", () => rej(new Error("aborted")))) } } as never,
      timeoutMs: 60,
    })) as { upstream?: { kind: string } };
    check("guardian: judge timeout -> timeout", hang.upstream?.kind === "timeout");
  }

  // 5. reportModelFailure / withModelAlert: alert only for a real model-API outage; rethrow unchanged.
  {
    const realErr2 = console.error;
    const seen: string[] = [];
    console.error = (...a: unknown[]) => { seen.push(a.map(String).join(" ")); };
    delete process.env.ALERT_WEBHOOK_URL;
    try {
      _resetUpstreamAlertDedupe();
      const credit = Anthropic.APIError.generate(
        400,
        { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } },
        "400 Your credit balance is too low to access the Anthropic API.",
        new Headers()
      );
      await reportModelFailure(credit, "/api/journal");
      check("report: a real API credit error alerts as billing",
        seen.some((l) => l.includes("[ELDER_UPSTREAM_FAIL] kind=billing") && l.includes("route=/api/journal")));

      seen.length = 0;
      await reportModelFailure(new Error("connection to Neon refused"), "/api/journal");
      check("report: a non-API error (e.g. database) does NOT alert", seen.length === 0);
      await reportModelFailure(new Anthropic.APIUserAbortError(), "/api/threshold");
      check("report: a seeker turning back (abort) does NOT alert", seen.length === 0);
      await reportModelFailure(undefined, "/api/x");
      check("report: never throws on garbage", true);

      _resetUpstreamAlertDedupe();
      let rethrown: unknown;
      try { await withModelAlert("/api/myth/patterns", Promise.reject(credit)); } catch (e) { rethrown = e; }
      check("withModelAlert: rethrows the SAME error (caller fallbacks unchanged)", rethrown === credit);
      check("withModelAlert: ...after alerting", seen.some((l) => l.includes("route=/api/myth/patterns")));
      check("withModelAlert: success passes the value through", (await withModelAlert("/api/x", Promise.resolve(7))) === 7);
    } finally {
      console.error = realErr2;
    }
  }

  // 6. The route, checked against the real source (like lib/i18n/i18n.test.ts does).
  const src = readFileSync(resolve(__dirname, "../app/api/divine/route.ts"), "utf8");
  const cStart = src.indexOf("const upstreamUnavailable = async (");
  const cEnd = src.indexOf("for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS");
  const closure = cStart >= 0 && cEnd > cStart ? src.slice(cStart, cEnd) : "";
  check("route: shared infra response located", closure.length > 0);
  check("route: it answers 503, never 200", /status:\s*503/.test(closure) && !/status:\s*200/.test(closure));
  check("route: it alerts the operator", /alertUpstreamFailure\(/.test(closure));
  check("route: it refunds the seeker's charge", /refundRateLimit\(/.test(closure));
  check("route: it keeps _infra for the harness", /_infra:\s*\{\s*silenced:\s*true/.test(closure));
  check("route: it speaks in the seeker's language, with no raw error detail", /ST\.say\('server\.upstream_unavailable'\)/.test(closure) && !/err\.message|\.stack/.test(closure));
  check("route: it sends no in-register silence as `text`", !/\btext:/.test(closure));

  const gStart = src.indexOf("if (!guarded.ok) {");
  const gEnd = src.indexOf("const rawText = guarded.text;");
  const genBranch = gStart >= 0 && gEnd > gStart ? src.slice(gStart, gEnd) : "";
  check("route: a generation failure goes through the shared response", /return upstreamUnavailable\(/.test(genBranch));

  const jStart = src.indexOf("if (guardianRejectedFinal && guardianInfraFailure) {");
  const jEnd = src.indexOf("if (guardianRejectedFinal) {", jStart + 1);
  const judgeBranch = jStart >= 0 && jEnd > jStart ? src.slice(jStart, jEnd) : "";
  check("route: a judge-infrastructure failure goes through the shared response", /return upstreamUnavailable\(/.test(judgeBranch));
  check("route: ...and is never reported as a guardian rejection of the content", !/guardian_rejected|contract_violation/.test(judgeBranch));
  check("route: ...and is decided BEFORE the content-rejection branch", jStart >= 0 && jStart < src.indexOf("\n  if (guardianRejectedFinal) {"));

  // 7. Every language has the honest message.
  for (const lang of ["en", "de", "es", "fr", "ki", "nl", "da", "ja", "ko", "zh", "pt"]) {
    const m = readFileSync(resolve(__dirname, `../lib/i18n/messages/${lang}.ts`), "utf8");
    check(`i18n: ${lang} has server.upstream_unavailable`, /'server\.upstream_unavailable':\s*["'].{20,}/.test(m));
  }

  if (failures) {
    console.error(`\n${failures} upstream-failure check(s) failed`);
    process.exit(1);
  }
  console.log("\nupstream-failure: all checks passed");
}
main();
