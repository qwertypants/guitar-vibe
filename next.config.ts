import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.NEXT_PUBLIC_APP_MODE === "pages" ? {
    output: "export",
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/guitar-vibe",
    trailingSlash: true,
  } as const : {}),
  agentRules: false,
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
