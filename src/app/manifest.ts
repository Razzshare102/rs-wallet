import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes RS WALLET installable (browser "Install app" and
 * the Android TWA/APK). Icons are rendered on demand by /pwa-icon from
 * the single brand mark in src/lib/brand-image.tsx.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RS WALLET",
    short_name: "RS WALLET",
    description:
      "RS WALLET — non-custodial EVM wallet. Your keys never leave your device.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#060609",
    theme_color: "#060609",
    icons: [
      { src: "/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
