import { ImageResponse } from "next/og";

/**
 * RS WALLET brand mark — the single source of truth for generated brand
 * images (Open Graph / Twitter cards, apple touch icon). The artwork is
 * the same original monogram used by `src/components/brand/RSLogo.tsx`
 * and `src/app/icon.svg`: monoline R + S strokes on a dark rounded
 * square, violet → electric-blue gradient.
 */
export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><defs><linearGradient id="g" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#a78bfa"/><stop offset="48%" stop-color="#7c5cff"/><stop offset="100%" stop-color="#2f81f7"/></linearGradient></defs><rect x="3" y="3" width="58" height="58" rx="16" fill="#0b0f1c" stroke="url(#g)" stroke-width="2.5"/><path d="M20 44V20h8.2a7 7 0 0 1 0 14H20m8.5 0L36 44" stroke="url(#g)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M49 26.5c-.8-2.2-2.8-3.4-5.4-3.4-3.3 0-5.6 1.9-5.6 4.6 0 6.4 11.4 3.4 11.4 9.9 0 2.8-2.5 4.7-6 4.7-2.9 0-5.2-1.4-6.1-3.9" stroke="url(#g)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const brandMarkDataUri = `data:image/svg+xml;base64,${Buffer.from(
  BRAND_MARK_SVG,
).toString("base64")}`;

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
          background: "linear-gradient(135deg, #05070d 0%, #0b0f1c 55%, #131a30 100%)",
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
          background: "#05070d",
        }}
      >
        <img src={brandMarkDataUri} width={172} height={172} alt="" />
      </div>
    ),
    { width: 180, height: 180 },
  );
}
