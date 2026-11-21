import { cn } from "@/lib/utils";

/**
 * RS monogram — monoline R + S drawn as SVG strokes with the brand gradient.
 * Original mark for RS WALLET (not copied from any existing wallet brand).
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
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label="RS WALLET logo"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="rs-grad" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6e63ff" />
            <stop offset="48%" stopColor="#0500ff" />
            <stop offset="100%" stopColor="#0091ff" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="58" height="58" rx="16" fill="#0b0f1c" stroke="url(#rs-grad)" strokeWidth="2.5" />
        {/* R */}
        <path
          d="M20 44V20h8.2a7 7 0 0 1 0 14H20m8.5 0L36 44"
          stroke="url(#rs-grad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* S */}
        <path
          d="M47.5 22.5c-.8-2.2-2.8-3.4-5.4-3.4-3.3 0-5.6 1.9-5.6 4.6 0 6.4 11.4 3.4 11.4 9.9 0 2.8-2.5 4.7-6 4.7-2.9 0-5.2-1.4-6.1-3.9"
          stroke="url(#rs-grad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(1.5 4)"
        />
      </svg>
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
