/**
 * lib/fireside/flag.ts
 *
 * The fireside chat is dark unless an operator lights it. Three things must all hold:
 *   FIRESIDE_ENABLED=true        the operator's decision
 *   FIRESIDE_STATE_KEY set       the secret that seals a sitting's state (>= 32 chars)
 *   ANTHROPIC_API_KEY set        the host and the welfare judge both need the model
 * and the global safety lockdown (ELDER_SAFETY_LOCKDOWN) must be off. Missing any of them
 * means "off", never "partly on".
 */
export function firesideEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.FIRESIDE_ENABLED !== 'true') return false;
  if (!env.FIRESIDE_STATE_KEY || env.FIRESIDE_STATE_KEY.length < 32) return false;
  if (!env.ANTHROPIC_API_KEY) return false;
  const lock = (env.ELDER_SAFETY_LOCKDOWN ?? '').toLowerCase();
  if (lock === 'true' || lock === '1' || lock === 'on') return false;
  return true;
}
