import { cn } from "@/lib/utils";
import { LOGO_DATA_URI } from "@/lib/logo-data";

/**
 * RS WALLET logo — interlocked RS mark with the Trust-blue gradient wave
 * on a black rounded square (approved by Razz, 2026-11-21). Artwork lives
 * in `src/lib/logo-data.ts` and is shared with the icon/share surfaces.
 */
export function RSLogo({
  size = 40,
  withWordmark = false,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_DATA_URI}
        width={size}
        height={size}
        alt="RS WALLET logo"
        className="shrink-0 rounded-[22%]"
      />
      {withWordmark && (
        <span className="leading-none">
          <span className="block text-[17px] font-bold tracking-[0.18em] text-foreground">
            RS <span className="text-gradient">WALLET</span>
          </span>
          <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Non-custodial · EVM
          </span>
        </span>
      )}
    </span>
  );
}
