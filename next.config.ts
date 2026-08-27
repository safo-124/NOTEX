import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    // Server Actions handle the note and schedule mutations.
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default config;
