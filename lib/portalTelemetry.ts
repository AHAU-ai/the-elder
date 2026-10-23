// lib/portalTelemetry.ts
//
// Anonymous funnel for the portal: did a cold visitor reach the door, cross
// it, or skip it. One field, no session id, no timing, no PII -- the payload
// is exactly { portal: <event> } and /api/log forwards only that.

export const PORTAL_EVENTS = ['reached-door', 'crossed', 'skipped', 'bypassed'] as const;
export type PortalEvent = (typeof PORTAL_EVENTS)[number];

export function logPortalEvent(event: PortalEvent): void {
  if (typeof window === 'undefined') return;
  try {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portal: event }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* telemetry never breaks the door */ }
}
