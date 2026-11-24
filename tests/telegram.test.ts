import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getTelegramUser,
  getViewportStableHeight,
  haptic,
  interceptExternalLink,
  isInTelegram,
  openExternal,
} from "@/lib/telegram";

// The vitest environment is node, so `window` does not exist by default.
// Install a fake one per test via globalThis and remove it afterwards.
function setWindow(value: unknown): void {
  (globalThis as { window?: unknown }).window = value;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  vi.restoreAllMocks();
});

function telegramWindow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Telegram: {
      WebApp: {
        initData: "query_id=AAE&user=%7B%22id%22%3A123%7D&auth_date=1700000000&hash=abc",
        initDataUnsafe: {
          user: { id: 123, first_name: "Razz", username: "Razz2015" },
        },
        version: "7.0",
        colorScheme: "dark",
        themeParams: { bg_color: "#060609" },
        viewportStableHeight: 640,
        isExpanded: true,
        ready: vi.fn(),
        expand: vi.fn(),
        close: vi.fn(),
        openLink: vi.fn(),
        openTelegramLink: vi.fn(),
        ...overrides,
      },
    },
    open: vi.fn(),
  };
}

describe("isInTelegram", () => {
  it("is false with no window (SSR / node)", () => {
    expect(isInTelegram()).toBe(false);
  });

  it("is false in a plain browser without window.Telegram", () => {
    setWindow({ open: vi.fn() });
    expect(isInTelegram()).toBe(false);
  });

  it("is false when Telegram exists but initData is empty", () => {
    setWindow(telegramWindow({ initData: "" }));
    expect(isInTelegram()).toBe(false);
  });

  it("is true with a non-empty initData", () => {
    setWindow(telegramWindow());
    expect(isInTelegram()).toBe(true);
  });
});

describe("getTelegramUser", () => {
  it("returns null outside Telegram", () => {
    expect(getTelegramUser()).toBeNull();
  });

  it("returns the user from initDataUnsafe inside Telegram", () => {
    setWindow(telegramWindow());
    expect(getTelegramUser()).toEqual({ id: 123, first_name: "Razz", username: "Razz2015" });
  });

  it("returns null when initDataUnsafe has no user", () => {
    setWindow(telegramWindow({ initDataUnsafe: {} }));
    expect(getTelegramUser()).toBeNull();
  });
});

describe("getViewportStableHeight", () => {
  it("returns null outside Telegram", () => {
    expect(getViewportStableHeight()).toBeNull();
  });

  it("returns the stable height inside Telegram", () => {
    setWindow(telegramWindow());
    expect(getViewportStableHeight()).toBe(640);
  });
});

describe("openExternal", () => {
  it("falls back to window.open in a plain browser", () => {
    const win = { open: vi.fn() };
    setWindow(win);
    openExternal("https://etherscan.io/tx/0xabc");
    expect(win.open).toHaveBeenCalledWith(
      "https://etherscan.io/tx/0xabc",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("uses WebApp.openLink inside Telegram and does not call window.open", () => {
    const win = telegramWindow();
    setWindow(win);
    openExternal("https://etherscan.io/tx/0xabc");
    const webApp = (win.Telegram as { WebApp: { openLink: ReturnType<typeof vi.fn> } }).WebApp;
    expect(webApp.openLink).toHaveBeenCalledWith("https://etherscan.io/tx/0xabc");
    expect(win.open).not.toHaveBeenCalled();
  });

  it("does not throw with no window at all", () => {
    expect(() => openExternal("https://example.com")).not.toThrow();
  });
});

describe("interceptExternalLink", () => {
  it("returns false outside Telegram (anchor default navigation proceeds)", () => {
    setWindow({ open: vi.fn() });
    expect(interceptExternalLink("https://example.com")).toBe(false);
  });

  it("returns true and opens via the SDK inside Telegram", () => {
    const win = telegramWindow();
    setWindow(win);
    expect(interceptExternalLink("https://example.com")).toBe(true);
    const webApp = (win.Telegram as { WebApp: { openLink: ReturnType<typeof vi.fn> } }).WebApp;
    expect(webApp.openLink).toHaveBeenCalledWith("https://example.com");
    expect(win.open).not.toHaveBeenCalled();
  });
});

describe("haptic", () => {
  it("is a no-op outside Telegram and never throws", () => {
    expect(() => haptic("light")).not.toThrow();
    expect(() => haptic("success")).not.toThrow();
    expect(() => haptic("error")).not.toThrow();
  });

  it("calls impactOccurred for light feedback inside Telegram", () => {
    const feedback = { impactOccurred: vi.fn(), notificationOccurred: vi.fn(), selectionChanged: vi.fn() };
    setWindow(telegramWindow({ HapticFeedback: feedback }));
    haptic("light");
    expect(feedback.impactOccurred).toHaveBeenCalledWith("light");
    expect(feedback.notificationOccurred).not.toHaveBeenCalled();
  });

  it("calls notificationOccurred for success/error inside Telegram", () => {
    const feedback = { impactOccurred: vi.fn(), notificationOccurred: vi.fn(), selectionChanged: vi.fn() };
    setWindow(telegramWindow({ HapticFeedback: feedback }));
    haptic("success");
    haptic("error");
    expect(feedback.notificationOccurred).toHaveBeenCalledWith("success");
    expect(feedback.notificationOccurred).toHaveBeenCalledWith("error");
  });
});
