// lib/drumFocus.ts
//
// One heartbeat drum at a time.
//
// The app has several independent lub-dub sources, each with its own
// AudioContext and tempo: the hearth fire's steady pulse
// (app/components/enhancements.ts), the waiting-breath drum
// (lib/ambientBreathTone.ts), and the paced heartbeat that quickens during
// the inquiry and runs under the reading (lib/heartbeatDrum.ts). Left alone
// they overlap -- the reading's quickened pulse over the hearth's unchanged
// one -- which reads as two hearts.
//
// lib/heartbeatDrum.ts is the foreground drum: while it is running, the
// others hold their strikes. They keep their own timers and simply resume on
// their next tick once the foreground drum has fully stopped, so nothing
// needs to be torn down, rebuilt or cross-wired.
//
// Refcounted so overlapping claimants can't release each other's hold.

let claims = 0;

/** The foreground heartbeat has started: background drums fall silent. */
export function claimForegroundDrum(): void {
  claims += 1;
}

/** The foreground heartbeat has fully stopped: background drums may resume. */
export function releaseForegroundDrum(): void {
  claims = Math.max(0, claims - 1);
}

/** Whether a foreground heartbeat is currently running. */
export function isForegroundDrumActive(): boolean {
  return claims > 0;
}
