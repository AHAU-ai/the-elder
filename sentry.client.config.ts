// sentry.client.config.ts
//
// Sentry client-side initialization for The Elder.
// Runs in the browser. Captures JS errors, unhandled promise rejections,
// and performance traces on the seeker-facing surface.
//
// No session replay — ceremonial readings are private by design.
// No PII collection — seekers are anonymous by design.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",

  // Capture all transactions initially. Tune to 0.2 once baseline is known.
  tracesSampleRate: 1.0,

  // No session replay — ceremonial privacy.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Tag every event as coming from The Elder.
  initialScope: {
    tags: {
      instrument: "the-elder",
      layer: "client",
    },
  },

  // Strip seeker input from breadcrumbs before sending to Sentry.
  // Readings and seeker input are sacred data — they do not leave the instrument.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
      if (breadcrumb.data) {
        delete breadcrumb.data.body;
        delete breadcrumb.data.response;
      }
    }
    return breadcrumb;
  },

  // Only enable in production and preview — not local dev.
  enabled: process.env.NODE_ENV !== "development",
});
