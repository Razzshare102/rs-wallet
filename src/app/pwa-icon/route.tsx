import { ImageResponse } from "next/og";
import { brandMarkDataUri } from "@/lib/brand-image";

/**
 * On-demand PWA icon renderer: /pwa-icon?size=512&maskable=1
 * Draws the brand mark on the app background. Maskable icons keep the
 * mark inside the safe zone (80%) with background padding around it.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = Number(searchParams.get("size"));
  const size = Number.isFinite(requested) ? Math.min(512, Math.max(48, requested)) : 512;
  const maskable = searchParams.get("maskable") === "1";
  const markSize = maskable ? Math.round(size * 0.78) : size;
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
        <img src={brandMarkDataUri} width={markSize} height={markSize} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
