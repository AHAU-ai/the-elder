// lib/afterPaint.ts
//
// Run `fn` after the browser has painted the frame that follows the current
// event, instead of inside it. requestAnimationFrame fires just BEFORE the
// next paint; the zero-delay timeout inside it fires AFTER that paint.
//
// Why this exists: the fire (FireAtmosphere) answers a seeker's question with
// a flare that changes its full-viewport turbulence filter and animation
// speeds. Kicked off synchronously from the send click, that work lands in
// the same frame as the click's own UI update and shows up as a long INP
// ("Event handlers on this element blocked UI updates"). Deferring the flare
// lets the click paint first; the flare itself looks the same, one frame later.
//
// While the tab is hidden rAF is paused, so a deferred flare simply waits
// until the tab is visible again -- there is nothing to see in the meantime.

export function afterPaint(fn: () => void): void {
  if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
    fn();
    return;
  }
  requestAnimationFrame(() => setTimeout(fn, 0));
}
