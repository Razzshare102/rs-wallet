"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getViewportStableHeight,
  getWebApp,
  isInTelegram,
} from "@/lib/telegram";

/** RS WALLET chrome colour inside Telegram (matches --background). */
const TG_BACKGROUND = "#060609";

/** Routes where the Telegram BackButton stays hidden (top-level screens). */
const TOP_LEVEL_ROUTES = ["/", "/dashboard"];

function applyViewportHeight(): void {
  try {
    const height = getViewportStableHeight();
    if (typeof height === "number" && height > 0) {
      document.documentElement.style.setProperty(
        "--tg-viewport-stable-height",
        `${height}px`,
      );
    }
  } catch {
    /* Viewport sizing is best-effort; CSS falls back to 100dvh. */
  }
}

/**
 * Telegram BackButton wiring. Kept separate from TelegramProvider because it
 * reads the current route via usePathname(), which blocks static prerendering
 * unless it sits behind a <Suspense> boundary. It renders nothing.
 */
function TelegramBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isInTelegram()) return;
    const backButton = getWebApp()?.BackButton;
    if (!backButton) return;

    const isTopLevel = TOP_LEVEL_ROUTES.includes(pathname ?? "");
    try {
      if (isTopLevel) backButton.hide();
      else backButton.show();
    } catch {
      /* BackButton visibility is cosmetic. */
    }

    const onBackClick = () => {
      try {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push("/dashboard");
        }
      } catch {
        router.push("/dashboard");
      }
    };
    try {
      backButton.onClick(onBackClick);
    } catch {
      /* BackButton without onClick support — nothing to wire. */
    }
    return () => {
      try {
        backButton.offClick(onBackClick);
      } catch {
        /* Ignore cleanup errors. */
      }
    };
  }, [pathname, router]);

  return null;
}

/**
 * Wires the Telegram Mini App chrome around the wallet. In a plain browser
 * (or during SSR) this renders children unchanged and does nothing.
 *
 * - ready() + expand() on mount, header/background set to the wallet theme.
 * - Keeps the `--tg-viewport-stable-height` CSS var in sync with Telegram.
 * - Shows the Telegram BackButton on every route except "/" and "/dashboard";
 *   tapping it goes back, or to /dashboard when there is no history.
 * - Never crashes if the SDK is absent or only partially implemented.
 */
export function TelegramProvider({ children }: { children: ReactNode }) {
  // One-time SDK setup: ready, expand, colours, viewport/theme listeners.
  useEffect(() => {
    if (!isInTelegram()) return;
    const wa = getWebApp();
    if (!wa) return;

    try {
      wa.ready();
    } catch {
      /* Continue without ready() — the app still works. */
    }
    try {
      wa.expand();
    } catch {
      /* Continue unexpanded. */
    }
    try {
      wa.setHeaderColor?.(TG_BACKGROUND);
      wa.setBackgroundColor?.(TG_BACKGROUND);
    } catch {
      /* Theme colours are cosmetic. */
    }
    applyViewportHeight();

    const onViewportChanged = () => applyViewportHeight();
    const onThemeChanged = () => {
      try {
        wa.setHeaderColor?.(TG_BACKGROUND);
        wa.setBackgroundColor?.(TG_BACKGROUND);
      } catch {
        /* Cosmetic only. */
      }
    };
    try {
      wa.onEvent?.("viewportChanged", onViewportChanged);
      wa.onEvent?.("themeChanged", onThemeChanged);
    } catch {
      /* Event subscription is optional. */
    }
    return () => {
      try {
        wa.offEvent?.("viewportChanged", onViewportChanged);
        wa.offEvent?.("themeChanged", onThemeChanged);
      } catch {
        /* Ignore cleanup errors. */
      }
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <TelegramBackButton />
      </Suspense>
      {children}
    </>
  );
}
