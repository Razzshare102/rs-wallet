"use client";

import Link from "next/link";
import { Info, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SUPPORTED_NETWORKS } from "@/lib/chains";

const RPC_OVERRIDE_IDS = [1, 56, 137, 42161, 10, 8453, 43114, 11155111];
const RPC_ENV: Record<number, string | undefined> = {
  1: process.env.NEXT_PUBLIC_RPC_1,
  56: process.env.NEXT_PUBLIC_RPC_56,
  137: process.env.NEXT_PUBLIC_RPC_137,
  42161: process.env.NEXT_PUBLIC_RPC_42161,
  10: process.env.NEXT_PUBLIC_RPC_10,
  8453: process.env.NEXT_PUBLIC_RPC_8453,
  43114: process.env.NEXT_PUBLIC_RPC_43114,
  11155111: process.env.NEXT_PUBLIC_RPC_11155111,
};

export default function SettingsPage() {
  const overridden = RPC_OVERRIDE_IDS.filter((id) => Boolean(RPC_ENV[id]));

  return (
    <div>
      <PageHeader title="Settings" subtitle="App configuration and status. No secrets are ever shown here." />

      <div className="flex flex-col gap-4">

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Network RPC endpoints</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              RS WALLET ships with public RPC endpoints for all {SUPPORTED_NETWORKS.length} built-in
              networks. Public endpoints are rate-limited; for heavier use, set{" "}
              <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_RPC_&lt;chainId&gt;</code>{" "}
              environment variables to your own endpoints.
            </p>
            <p className="flex items-center gap-2 text-sm">
              <Info className="size-4 text-muted-foreground" />
              {overridden.length > 0
                ? `Custom RPC overrides active for chain IDs: ${overridden.join(", ")}.`
                : "No RPC overrides configured — public defaults in use."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security &amp; data</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              Your encrypted vault lives only in this browser. Nothing about your keys, phrase or
              password is sent to any server — the only network calls RS WALLET makes are to chain RPC
              endpoints, price sources and the swap aggregator you approve.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/security">Open Security Center</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/networks">Manage networks</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/accounts">Manage accounts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          RS WALLET · Non-custodial EVM wallet · Your keys never leave your device.
        </p>
      </div>
    </div>
  );
}
