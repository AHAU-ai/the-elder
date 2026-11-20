/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs/config");

const nextConfig = {
  reactStrictMode: true,
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  // Replaces the deprecated `disableLogger`; same effect (strip Sentry debug logging
  // from the bundle). Not supported with Turbopack, as before.
  webpack: { treeshake: { removeDebugLogging: true } },
});
