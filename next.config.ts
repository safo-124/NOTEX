import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    // Notes and schedule edits only. Files go straight to object storage from
    // the browser, because a Server Action would cap them at Vercel's 4.5 MB
    // request body limit.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default config;
