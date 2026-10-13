import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	serverExternalPackages: ["@strands-agents/harness", "@strands-agents/sdk", "openai"],
};

export default nextConfig;