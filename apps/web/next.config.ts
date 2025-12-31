import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async rewrites() {
    // In Docker, use service name; in dev, use localhost
    const apiUrl =
      process.env.API_URL ||
      (process.env.NODE_ENV === "production"
        ? "http://api:4000"
        : "http://localhost:4000");
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
