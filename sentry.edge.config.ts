// sentry.edge.config.ts
//
// Sentry edge runtime initialization for The Elder.
// Runs in Vercel edge middleware (rate limiting, routing).
// Minimal config — edge runtime has limited APIs.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 1.0,
  initialScope: {
    tags: {
      instrument: "the-elder",
      layer: "edge",
    },
  },
  enabled: process.env.NODE_ENV !== "development",
});
