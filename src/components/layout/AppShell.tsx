"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  Globe2,
  History,
  LayoutDashboard,
  Network,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useAccount } from "wagmi";
import { RSLogo } from "@/components/brand/RSLogo";
import { NetworkSelector } from "@/components/wallet/NetworkSelector";
import { BuiltinChip } from "@/components/wallet/BuiltinChip";
import { ChainProvider, useRsChain } from "@/components/wallet/ChainProvider";
import { DappsProvider } from "@/components/wallet/DappsProvider";
import { cn } from "@/lib/utils";

/** Shown when the connected external wallet sits on a chain RS WALLET doesn't support. */
function UnsupportedChainBanner() {
  const { isConnected } = useAccount();
  const { network, chainId, setChainId } = useRsChain();
  if (!isConnected || network) return null;
  return (
    <div className="border-b border-warning/40 bg-warning/10 px-4 py-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <TriangleAlert className="size-4 text-warning" />
          Your wallet is on unsupported chain {chainId}.
        </p>
        <div className="flex gap-2">
          {[
            [1, "Ethereum"],
            [56, "BNB Chain"],
            [8453, "Base"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setChainId(id as number)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              Switch to {label as string}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Coins },
  { href: "/send", label: "Send", icon: ArrowUpFromLine },
  { href: "/receive", label: "Receive", icon: ArrowDownToLine },
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/dapps", label: "dApps", icon: Globe2 },
  { href: "/activity", label: "Activity", icon: History },
] as const;

const MANAGE = [
  { href: "/accounts", label: "Accounts", icon: Users },
  { href: "/networks", label: "Networks", icon: Network },
  { href: "/security", label: "Security Center", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const MOBILE_TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Coins },
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/activity", label: "Activity", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_rgba(5,0,255,0.45)]"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className={cn("size-[18px]", active && "text-primary")} />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <ChainProvider>
      <DappsProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/70 px-4 py-6 lg:flex">
          <Link href="/" className="px-1">
            <RSLogo withWordmark size={40} />
          </Link>
          <nav className="mt-8 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </nav>
          <p className="mb-2 mt-8 px-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Manage
          </p>
          <nav className="flex flex-col gap-1">
            {MANAGE.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </nav>
          <div className="mt-auto rounded-2xl glass p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Non-custodial</p>
            Your keys never leave this device. RS WALLET cannot access your funds.
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-xl sm:px-6">
            <Link href="/" className="lg:hidden">
              <RSLogo size={34} />
            </Link>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2.5">
              <NetworkSelector />
              <BuiltinChip />
            </div>
          </header>

          <UnsupportedChainBanner />

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">{children}</main>

          {/* Mobile bottom tabs — Trust Wallet style, Swap raised in the centre */}
          <nav className="tg-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl lg:hidden">
            <div className="mx-auto grid max-w-md grid-cols-5">
              {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                if (href === "/swap") {
                  return (
                    <Link key={href} href={href} className="flex flex-col items-center gap-1 pb-2.5 pt-1 text-[10px] font-medium text-muted-foreground">
                      <span className="flex size-12 -translate-y-3 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40">
                        <Icon className="size-5" />
                      </span>
                      <span className="-mt-2.5">{label}</span>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                      active ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
      </DappsProvider>
    </ChainProvider>
  );
}
