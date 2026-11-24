// Telegram Mini App helpers (client-side, UI-only).
//
// RS WALLET runs inside Telegram as a Mini App via the Telegram WebApp JS SDK
// (loaded in src/app/layout.tsx). This module is a thin, dependency-free,
// SSR-safe wrapper around `window.Telegram.WebApp`.
//
// SECURITY: Telegram is used for UI chrome only — ready/expand, theme,
// haptics, BackButton and opening external links. Nothing here authenticates
// the user, unlocks the vault, or moves secrets: initData / the Telegram user
// are NEVER trusted for identity or vault access, and the seed phrase and
// vault password are never sent anywhere. The local BIP-39 vault in IndexedDB
// remains the only security model.

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  section_bg_color?: string;
}

export interface TelegramHapticFeedback {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

export interface TelegramBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  version: string;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  /** Stable viewport height in px (excludes the collapsing Telegram header). */
  viewportStableHeight: number;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  /** Optional on older / partial SDK implementations — always guard before use. */
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (eventType: "viewportChanged" | "themeChanged", callback: () => void) => void;
  offEvent?: (eventType: "viewportChanged" | "themeChanged", callback: () => void) => void;
  HapticFeedback?: TelegramHapticFeedback;
  BackButton?: TelegramBackButton;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

/** The Telegram WebApp object, or null in a plain browser / during SSR. */
export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * True only when actually running inside Telegram with a real launch payload.
 * A bare `window.Telegram` (or an empty initData) does not count — the app
 * must behave as a normal web wallet in that case.
 */
export function isInTelegram(): boolean {
  const wa = getWebApp();
  return !!wa && typeof wa.initData === "string" && wa.initData.length > 0;
}

/**
 * The Telegram user from the launch payload, if any. Display-only:
 * never use this for identity, auth, or vault unlock.
 */
export function getTelegramUser(): TelegramUser | null {
  return getWebApp()?.initDataUnsafe?.user ?? null;
}

export function getThemeParams(): TelegramThemeParams {
  return getWebApp()?.themeParams ?? {};
}

/** Stable viewport height in px when inside Telegram, null otherwise. */
export function getViewportStableHeight(): number | null {
  const wa = getWebApp();
  if (!wa || typeof wa.viewportStableHeight !== "number") return null;
  return wa.viewportStableHeight;
}

export function haptic(kind: "light" | "success" | "error" | "warning" = "light"): void {
  const wa = getWebApp();
  try {
    if (kind === "light") wa?.HapticFeedback?.impactOccurred("light");
    else wa?.HapticFeedback?.notificationOccurred(kind);
  } catch {
    /* Haptics are best-effort — never break the wallet over them. */
  }
}

/**
 * Open an external URL. Inside Telegram this uses WebApp.openLink (stays in
 * the Telegram in-app browser); in a plain browser it falls back to a new tab.
 */
export function openExternal(url: string): void {
  const wa = getWebApp();
  try {
    if (wa) {
      wa.openLink(url);
      return;
    }
  } catch {
    /* Fall through to window.open below. */
  }
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Anchor-click helper for `<a target="_blank">` links: inside Telegram,
 * prevent the default navigation and route through WebApp.openLink instead.
 * Returns true when the click was handled (caller should preventDefault).
 */
export function interceptExternalLink(url: string): boolean {
  if (!isInTelegram()) return false;
  openExternal(url);
  return true;
}
