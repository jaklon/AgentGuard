import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  agentRules: false,
  allowedDevOrigins: ["*.lhr.life"],
};

export default nextConfig;
