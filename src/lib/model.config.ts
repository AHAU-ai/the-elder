export const PRIMARY_MODEL = "claude-sonnet-4-6" as const;
export const ANTHROPIC_FALLBACK_MODEL = "claude-haiku-4-5-20251001" as const;
export const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash" as const;
export const OPENAI_FALLBACK_MODEL = "gpt-4o-mini" as const;

export type Provider = "anthropic" | "gemini" | "openai";
export const ACTIVE_PROVIDER: Provider =
  (process.env.LLM_PROVIDER as Provider) ?? "anthropic";

export const MAX_TOKENS = 2048;
export const TEMPERATURE = 0.85;

export function resolveModel(): { provider: Provider; model: string } {
  switch (ACTIVE_PROVIDER) {
    case "gemini":
      return { provider: "gemini", model: GEMINI_FALLBACK_MODEL };
    case "openai":
      return { provider: "openai", model: OPENAI_FALLBACK_MODEL };
    case "anthropic":
    default:
      return { provider: "anthropic", model: PRIMARY_MODEL };
  }
}
