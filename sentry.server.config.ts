// sentry.server.config.ts
//
// Sentry server-side initialization for The Elder.
// Runs in Next.js API routes and server components.
// Captures guardian failures, API errors, and reading generation exceptions.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",

  tracesSampleRate: 1.0,

  initialScope: {
    tags: {
      instrument: "the-elder",
      layer: "server",
    },
  },

  // Strip reading content and seeker input from all breadcrumbs.
  // These are never sent to a third-party service.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "http" && breadcrumb.data) {
      delete breadcrumb.data.body;
      delete breadcrumb.data.response_body;
    }
    return breadcrumb;
  },

  // Strip reading content from error events before sending.
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      if (data.reading)     delete data.reading;
      if (data.seekerInput) delete data.seekerInput;
    }
    return event;
  },

  enabled: process.env.NODE_ENV !== "development",
});
