"use client";

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Loader2,
  Stamp,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StoredTx, TxKind } from "@/lib/activity";
import type { ResolvedNetwork } from "@/lib/chains";
import { explorerTxUrlFor } from "@/lib/chains";
import { shortenAddress } from "@/lib/utils";

const KIND_ICON: Record<TxKind, typeof ArrowUpFromLine> = {
  send: ArrowUpFromLine,
  receive: ArrowDownToLine,
  swap: ArrowLeftRight,
  approve: Stamp,
  contract: FileCode2,
};

const KIND_LABEL: Record<TxKind, string> = {
  send: "Sent",
  receive: "Received",
  swap: "Swap",
  approve: "Approval",
  contract: "Contract call",
};

export function StatusBadge({ status }: { status: StoredTx["status"] }) {
  if (status === "pending") {
    return (
      <Badge variant="warning" className="gap-1">
        <Loader2 className="size-3 animate-spin" /> Pending
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="size-3" /> Failed
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1">
      <CheckCircle2 className="size-3" /> Confirmed
    </Badge>
  );
}

function formatWhen(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function ActivityList({
  txs,
  network,
  emptyMessage,
}: {
  txs: StoredTx[];
  network: ResolvedNetwork | null;
  emptyMessage: string;
}) {
  if (txs.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {txs.map((tx, i) => {
        const Icon = KIND_ICON[tx.kind];
        const url = network ? explorerTxUrlFor(network, tx.hash) : null;
        const counterparty = tx.kind === "receive" ? tx.from : tx.to;
        return (
          <li key={`${tx.hash}-${tx.tokenAddress ?? "native"}-${i}`} className="flex items-center gap-3 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {KIND_LABEL[tx.kind]} {tx.symbol}
                <StatusBadge status={tx.status} />
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {formatWhen(tx.timestamp)}
                {counterparty ? ` · ${tx.kind === "receive" ? "from" : "to"} ${shortenAddress(counterparty)}` : ""}
                {" · "}
                {shortenAddress(tx.hash, 6)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`font-mono text-sm font-semibold ${
                  tx.kind === "receive" ? "text-success" : ""
                }`}
              >
                {tx.kind === "receive" ? "+" : tx.kind === "send" ? "−" : ""}
                {tx.amount} {tx.symbol}
              </span>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="View transaction on block explorer"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
