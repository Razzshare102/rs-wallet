import { ImageResponse } from "next/og";

import { LOGO_JPEG_DATA_URI } from "@/lib/logo-data";

/**
 * RS WALLET brand mark — the single source of truth for generated brand
 * images (Open Graph / Twitter cards, apple touch icon). The artwork is
 * the logo approved by Razz on 2026-11-21 (interlocked RS with the
 * Trust-blue gradient wave on black), shared with
 * `src/components/brand/RSLogo.tsx` via `src/lib/logo-data.ts`.
 */
export const brandMarkDataUri = LOGO_JPEG_DATA_URI;

/** 1200×630 share image: mark + wordmark on the brand's dark navy. */
export function brandShareImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #060609 0%, #0a0a10 55%, #10101c 100%)",
          color: "#f4f6fb",
          fontFamily: "sans-serif",
        }}
      >
        <img src={brandMarkDataUri} width={196} height={196} alt="" />
        <div
          style={{
            marginTop: 44,
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: 10,
            display: "flex",
          }}
        >
          RS WALLET
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 31,
            fontWeight: 500,
            letterSpacing: 9,
            color: "#9aa7c2",
            display: "flex",
          }}
        >
          NON-CUSTODIAL · EVM WALLET
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

/** 180×180 apple touch icon: the mark on full-bleed dark navy. */
export function brandAppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#060609",
        }}
      >
        <img src={brandMarkDataUri} width={172} height={172} alt="" />
      </div>
    ),
    { width: 180, height: 180 },
  );
}
