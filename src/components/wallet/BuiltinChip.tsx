"use client";

import Link from "next/link";
import { Loader2, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVault } from "./VaultProvider";
import { shortenAddress } from "@/lib/utils";

/** Header chip for the built-in wallet: unlock CTA when locked, account + lock when unlocked. */
export function BuiltinChip() {
  const { status, activeAccount, lock } = useVault();

  if (status === "loading") {
    return (
      <Button variant="ghost" size="sm" className="h-10 rounded-full px-3" disabled>
        <Loader2 className="size-4 animate-spin" />
      </Button>
    );
  }

  if (status === "no-vault") return null;

  if (status === "locked") {
    return (
      <Button asChild variant="outline" size="sm" className="h-10 rounded-full px-4">
        <Link href="/unlock">
          <Unlock className="size-4" /> Unlock
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button asChild variant="secondary" size="sm" className="h-10 rounded-full px-4">
        <Link href="/accounts" title={activeAccount?.address}>
          <span className="size-2 rounded-full bg-success" aria-hidden />
          <span className="font-mono text-[13px]">
            {activeAccount ? shortenAddress(activeAccount.address) : "Wallet"}
          </span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={() => lock()}
        aria-label="Lock built-in wallet"
        title="Lock wallet"
      >
        <Lock className="size-4" />
      </Button>
    </div>
  );
}
