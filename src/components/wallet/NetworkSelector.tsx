"use client";

import Link from "next/link";
import { Check, ChevronDown, Loader2, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRsChain } from "./ChainProvider";

export function NetworkSelector() {
  const { chainId, network, networks, setChainId, isSwitching, switchError } = useRsChain();
  const builtins = networks.filter((n) => !n.custom);
  const customs = networks.filter((n) => n.custom);

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="h-10 gap-2 rounded-full px-3.5">
            {isSwitching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: network?.color ?? "#f6465d" }}
                aria-hidden
              />
            )}
            <span className="max-w-[110px] truncate text-[13px] font-semibold">
              {network?.shortName ?? `Chain ${chainId}`}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto">
          <DropdownMenuLabel>Networks</DropdownMenuLabel>
          {builtins.map((net) => (
            <DropdownMenuItem key={net.chainId} onSelect={() => setChainId(net.chainId)} className="justify-between">
              <span className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: net.color }} aria-hidden />
                <span className="font-medium">{net.name}</span>
                {net.testnet && <Badge variant="warning">Testnet</Badge>}
              </span>
              {net.chainId === chainId && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          {customs.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Custom networks</DropdownMenuLabel>
              {customs.map((net) => (
                <DropdownMenuItem key={net.chainId} onSelect={() => setChainId(net.chainId)} className="justify-between">
                  <span className="flex items-center gap-2.5">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: net.color }} aria-hidden />
                    <span className="font-medium">{net.name}</span>
                    {net.testnet && <Badge variant="warning">Testnet</Badge>}
                  </span>
                  {net.chainId === chainId && <Check className="size-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/networks" className="flex items-center gap-2.5">
              <Settings2 className="size-4" /> Manage networks
            </Link>
          </DropdownMenuItem>
          {!network && (
            <p className="px-2.5 py-2 text-xs text-destructive">
              Current chain ({chainId}) is not supported by RS WALLET. Switch networks to continue.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {switchError && <p className="max-w-[220px] text-right text-[11px] text-destructive">{switchError}</p>}
    </div>
  );
}
