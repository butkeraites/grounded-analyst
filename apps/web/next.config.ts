import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Consume @julius/core straight from its TypeScript source. The web app and
  // the future MCP server are two clients of one core; no build step sits
  // between them and the pipeline contract.
  transpilePackages: ["@julius/core", "@julius/mcp-server"],
  // Server Actions / route handlers do the DB + Redis work; keep pg/ioredis
  // external so they are required at runtime in the Node server, not bundled.
  serverExternalPackages: ["pg", "ioredis", "drizzle-orm", "pino", "posthog-node"],
};

export default nextConfig;
