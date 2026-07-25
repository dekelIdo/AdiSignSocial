import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["nodemailer"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
