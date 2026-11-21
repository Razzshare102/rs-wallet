"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Globe, Link2, Loader2, Plug, Unplug } from "lucide-react";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDapps } from "@/components/wallet/DappsProvider";
import { useVault } from "@/components/wallet/VaultProvider";
import { hasReownProjectId } from "@/lib/env";
import { getNetwork } from "@/lib/chains";
import { parseWcChainId } from "@/lib/walletconnect";

const POPULAR_DAPPS = [
  { name: "Uniswap", url: "https://app.uniswap.org", blurb: "Swap tokens on Ethereum, Base, BNB Chain and more." },
  { name: "PancakeSwap", url: "https://pancakeswap.finance", blurb: "The main DEX on BNB Chain." },
  { name: "OpenSea", url: "https://opensea.io", blurb: "NFT marketplace across EVM chains." },
  { name: "Aave", url: "https://app.aave.com", blurb: "Lend and borrow on multiple networks." },
  { name: "1inch", url: "https://app.1inch.io", blurb: "DEX aggregator for best swap rates." },
  { name: "Lido", url: "https://stake.lido.fi", blurb: "Stake ETH and receive stETH." },
] as const;

export default function DappsPage() {
  const { ready, sessions, pair, disconnect, lastError, clearLastError } = useDapps();
  const { status: vaultStatus } = useVault();
  const [uri, setUri] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairSent, setPairSent] = useState(false);
  const unlocked = vaultStatus === "unlocked";

  const onPair = async () => {
    setPairing(true);
    setPairError(null);
    setPairSent(false);
    clearLastError();
    try {
      await pair(uri);
      setUri("");
      setPairSent(true);
    } catch (err) {
      setPairError(err instanceof Error ? err.message : "Pairing failed. Check the URI and try again.");
    } finally {
      setPairing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="dApps"
        subtitle="Connect RS WALLET to Uniswap, PancakeSwap and any WalletConnect dApp. You approve every connection and signature."
      />

      {!hasReownProjectId ? (
        <Card>
          <CardContent className="p-6 text-sm leading-relaxed text-muted-foreground">
            dApp connections use WalletConnect, which needs the Reown Project ID in the app
            configuration. It is not set in this deployment, so dApp connections are unavailable.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {!unlocked && (
            <Card className="glass">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  {vaultStatus === "locked"
                    ? "Your built-in wallet is locked. Unlock it to connect to dApps — connections and signatures use your built-in accounts."
                    : "Create or import a built-in wallet first. dApps connect to your built-in accounts, and every signature is approved by you here."}
                </p>
                <div className="flex gap-2">
                  {vaultStatus === "locked" ? (
                    <Button asChild variant="gradient">
                      <Link href="/unlock">Unlock wallet</Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild variant="gradient">
                        <Link href="/create">Create wallet</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/import">Import wallet</Link>
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plug className="size-4 text-accent" /> Connect a dApp
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                <li>Open the dApp (below, or any WalletConnect dApp) and choose <span className="text-foreground">Connect Wallet → WalletConnect</span>.</li>
                <li>Copy the connection link it shows (the QR screen has a copy-link option).</li>
                <li>Paste it here and approve the connection in the popup.</li>
              </ol>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder="wc:…"
                  className="font-mono text-xs"
                  disabled={!unlocked || pairing}
                />
                <Button variant="gradient" onClick={onPair} disabled={!unlocked || pairing || !uri.trim()}>
                  {pairing ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                  Connect
                </Button>
              </div>
              {pairError && <p className="text-sm text-destructive">{pairError}</p>}
              {pairSent && !pairError && (
                <p className="text-sm text-success">
                  Connection request sent — if the dApp responded, approve it in the popup.
                </p>
              )}
              {lastError && <p className="text-sm text-destructive">{lastError}</p>}
              {!ready && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Starting the WalletConnect relay…
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected dApps</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No dApps connected yet. Sessions you approve will appear here, and you can
                  disconnect them at any time.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {sessions.map((s) => {
                    const chainIds: number[] = [];
                    for (const a of s.namespaces.eip155?.accounts ?? []) {
                      const id = parseWcChainId(a);
                      if (id !== null && !chainIds.includes(id)) chainIds.push(id);
                    }
                    const chains = chainIds.map(
                      (id) => getNetwork(id)?.chain.name ?? `Chain ${id}`,
                    );
                    return (
                      <li key={s.topic} className="flex items-center gap-3 py-3">
                        {s.peer.metadata.icons?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.peer.metadata.icons[0]} alt="" className="size-10 rounded-xl" />
                        ) : (
                          <span className="flex size-10 items-center justify-center rounded-xl bg-secondary">
                            <Globe className="size-5" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.peer.metadata.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.peer.metadata.url}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {chains.slice(0, 4).map((name) => (
                              <Badge key={name} variant="secondary" className="text-[10px]">
                                {name}
                              </Badge>
                            ))}
                            {chains.length > 4 && (
                              <Badge variant="secondary" className="text-[10px]">
                                +{chains.length - 4} more
                              </Badge>
                            )}
                          </span>
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void disconnect(s.topic)}
                        >
                          <Unplug className="size-4" /> Disconnect
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 text-base font-semibold">Popular dApps</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {POPULAR_DAPPS.map((d) => (
                <a
                  key={d.name}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-3xl border border-border bg-card p-5 transition-colors hover:border-accent/50"
                >
                  <span className="flex items-center justify-between">
                    <span className="font-semibold">{d.name}</span>
                    <ExternalLink className="size-4 text-muted-foreground transition-colors group-hover:text-accent" />
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">
                    {d.blurb}
                  </span>
                  <span className="mt-3 block truncate text-xs text-muted-foreground">{d.url}</span>
                </a>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              These links open the real dApps in a new tab. Always check the address bar shows the
              exact domain before connecting — lookalike sites are a common scam.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
