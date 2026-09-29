import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The desktop sidebar's account row sits in the bottom-left corner, where
  // the dev indicator would cover it.
  devIndicators: { position: "bottom-right" },
  reactCompiler: true,
};

export default nextConfig;
