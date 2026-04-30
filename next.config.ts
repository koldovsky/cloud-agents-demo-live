import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.LICENSE.txt": {
        loaders: [path.resolve("./loaders/noop.cjs")],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
