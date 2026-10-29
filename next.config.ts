import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth-heavy, per-person pages: render dynamically by default (no Cache Components).
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Template JSON files are read from disk at runtime.
  outputFileTracingIncludes: { "/**": ["./templates/**/*.json"] },
};

export default nextConfig;
