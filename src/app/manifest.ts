import type { MetadataRoute } from "next";

/** Manifest aplikasi (dapat dipasang di layar utama). Layar pembuka memakai ikon 512 dan warna latar di bawah. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arah Saham",
    short_name: "ArahSaham",
    description: "Ringkasan kondisi pasar saham Indonesia dan analisis personal harian berbasis data.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "id",
    background_color: "#ffffff",
    theme_color: "#2554d6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
