import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // Lets phones and laptops on the home Wi-Fi use the dev server (development only).
  allowedDevOrigins: ["192.168.*.*"],
  cacheComponents: true,
  cacheLife: {
    // Scores, fixtures and the table: refresh in the background every 5 minutes.
    // football-data.org's free plan allows 10 requests a minute, so this is well within limits.
    matchday: {
      stale: 60, // browsers may reuse a page for 1 minute
      revalidate: 300, // fetch fresh data at most every 5 minutes
      expire: 86400, // never serve data older than 1 day
    },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
