import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @rassm/shared ships TypeScript source, so Next compiles it.
  transpilePackages: ["@rassm/shared"],
};

export default nextConfig;
