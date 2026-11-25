import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Halaman "Cara kerja" dihapus; tautan lama diarahkan ke beranda.
  async redirects() {
    return [{ source: "/cara-kerja", destination: "/", permanent: true }, { source: "/pasar/etf-adr-indonesia", destination: "/pasar/proksi-indonesia", permanent: true }];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        // CSP longgar secukupnya untuk Next, Supabase, dan Midtrans Snap; kencangkan dengan nonce setelah peluncuran.
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self' https://app.midtrans.com https://app.sandbox.midtrans.com" },
      ],
    }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
