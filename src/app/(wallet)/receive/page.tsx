"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, TriangleAlert } from "lucide-react";
import QRCode from "qrcode";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { eip681Uri } from "@/lib/uri";

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3.5 py-3 text-left transition-colors hover:bg-secondary"
        title={`Copy ${label.toLowerCase()}`}
      >
        <span className={mono ? "break-all font-mono text-xs leading-5" : "text-sm font-medium"}>
          {value}
        </span>
        {copied ? (
          <Check className="size-4 shrink-0 text-success" />
        ) : (
          <Copy className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

export default function ReceivePage() {
  const { address, source, isConnected } = useActiveAccount();
  const { network, chainId } = useRsChain();
  // EIP-681 payment URI: ethereum:<address>@<chainId>
  const eip681 = address ? eip681Uri(address, chainId) : "";

  // QR image keyed by the URI it encodes, so a stale code is never shown.
  const [qr, setQr] = useState<{ uri: string; url: string } | null>(null);
  const qrDataUrl = qr && qr.uri === eip681 ? qr.url : null;

  useEffect(() => {
    if (!eip681) return;
    let cancelled = false;
    QRCode.toDataURL(eip681, {
      width: 440,
      margin: 2,
      color: { dark: "#0b0f1c", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQr({ uri: eip681, url });
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eip681]);

  return (
    <div>
      <PageHeader title="Receive" subtitle="Share your address to receive funds on the active network." />

      {!isConnected || !address ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              No active account. Unlock the built-in wallet or connect an external wallet to get your
              receiving address.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="gradient">
                <Link href="/unlock">Unlock wallet</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/create">Create wallet</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <Card className="glass">
            <CardContent className="flex flex-col items-center p-6">
              <div className="flex items-center gap-2">
                <Badge variant={source === "builtin" ? "default" : "secondary"}>
                  {source === "builtin" ? "Built-in wallet" : "External wallet"}
                </Badge>
                <Badge variant="outline">{network?.name ?? `Chain ${chainId}`}</Badge>
              </div>

              <div className="mt-5 rounded-3xl bg-white p-3 shadow-lg shadow-black/30">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt={`QR code for ${address}`} width={220} height={220} />
                ) : (
                  <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-slate-500">
                    Generating QR…
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Scan with any EVM wallet app. The code encodes an EIP-681 payment URI for this network.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <CopyRow label="Your address" value={address} />
              <CopyRow label="EIP-681 payment URI" value={eip681} />
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Only receive assets on <span className="font-semibold text-foreground">{network?.name ?? "the selected network"}</span>.
              Sending tokens from another network to this address can lose them. Your address is the
              same on every EVM network, but the network you pick here is what the QR code tells the
              sender to use.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
