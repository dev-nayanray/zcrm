import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" output is for self-hosting (e.g. `bun .next/standalone/server.js`).
  // Vercel has its own build/deploy pipeline and is incompatible with standalone
  // output (it causes ENOENT errors on .next/*.nft.json trace files), so it's
  // disabled automatically when building on Vercel.
  output: process.env.VERCEL ? undefined : "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
