import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
