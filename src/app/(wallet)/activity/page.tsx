"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityList } from "@/components/wallet/ActivityList";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { useActivity } from "@/hooks/useActivity";
import type { TxKind } from "@/lib/activity";

type Filter = "all" | TxKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "send", label: "Sent" },
  { key: "receive", label: "Received" },
  { key: "swap", label: "Swaps" },
  { key: "approve", label: "Approvals" },
];

export default function ActivityPage() {
  const { address, isConnected } = useActiveAccount();
  const { network } = useRsChain();
  const { txs, pendingCount, explorerError, isLoading, refresh } = useActivity(address, network);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () => (filter === "all" ? txs : txs.filter((t) => t.kind === filter)),
    [txs, filter],
  );

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle={
          network
            ? `Transactions for your active account on ${network.name}.`
            : "Transaction history across networks."
        }
      />

      {!isConnected || !address ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              No active account. Unlock the built-in wallet or connect an external wallet to see
              its transaction history.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="gradient">
                <Link href="/unlock">Unlock wallet</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Connect external</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    filter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <Badge variant="warning" className="gap-1">
                  <Loader2 className="size-3 animate-spin" /> {pendingCount} pending
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={refresh}>
                <RefreshCw className="size-4" /> Refresh
              </Button>
            </div>
          </div>

          {explorerError && (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
              <p className="text-sm leading-relaxed text-muted-foreground">{explorerError}</p>
            </div>
          )}

          <Card>
            <CardContent className="px-5 py-2">
              {isLoading && txs.length === 0 ? (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading on-chain history…
                </p>
              ) : (
                <ActivityList
                  txs={filtered}
                  network={network}
                  emptyMessage={
                    filter === "all"
                      ? "No transactions on this network yet. Transactions you send from RS WALLET appear here instantly and are tracked to confirmation; past on-chain history loads from the block explorer."
                      : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} transactions on this network yet.`
                  }
                />
              )}
            </CardContent>
          </Card>

          <p className="text-xs leading-relaxed text-muted-foreground">
            History combines transactions broadcast from this app (stored only on this device)
            with your public on-chain history from the network&apos;s block explorer. Pending
            transactions are checked against the chain every few seconds until they confirm or
            fail.
          </p>
        </div>
      )}
    </div>
  );
}
