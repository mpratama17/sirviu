import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB terlalu kecil untuk brief §6.4 (max 10MB per file).
      // +1MB headroom untuk overhead multipart/form-data (boundary, part
      // headers) — lihat catatan di next/dist/docs bodySizeLimit.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
