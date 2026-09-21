import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  agentRules: false,
  allowedDevOrigins: ["*.lhr.life"],
};

export default nextConfig;
