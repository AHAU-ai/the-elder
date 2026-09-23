export const PRIMARY_MODEL = "claude-sonnet-4-6" as const;

export const MAX_TOKENS = 2048;
export const TEMPERATURE = 0.85;

// Dead code audit (2026-09-23): this file previously also exported
// ANTHROPIC_FALLBACK_MODEL/GEMINI_FALLBACK_MODEL/OPENAI_FALLBACK_MODEL,
// a Provider union, ACTIVE_PROVIDER (an LLM_PROVIDER env switch), and a
// resolveModel() dispatcher. None had a single caller anywhere in the
// codebase, and there is no Gemini or OpenAI SDK dependency installed
// (package.json has only @anthropic-ai/sdk) -- so even a caller flipping
// LLM_PROVIDER would have had no client to actually route the request
// to. This wasn't a partially-wired feature, it was config for a
// provider-abstraction layer that was never built. Removed rather than
// wired: multi-provider support is a real feature (SDK, client
// construction, response-shape normalization) that deserves its own
// deliberate build, not a config file quietly implying it already
// exists. app/api/divine/route.ts's generation and welfare-judge calls
// use PRIMARY_MODEL/WELFARE_MODEL directly via the Anthropic client and
// always have.

// Welfare classifier model — Haiku-class, synchronous gate run BEFORE generation.
// Pinned to a versioned string so gate behavior never changes under us on a model release.
// Distinct from ANTHROPIC_FALLBACK_MODEL by intent: the welfare gate's model choice is its own decision.



export const WELFARE_MODEL = "claude-haiku-4-5-20251001" as const;
