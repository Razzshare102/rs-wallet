"use client";

import { useState } from "react";
import { Check, ExternalLink, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRsChain } from "@/components/wallet/ChainProvider";
import type { CustomNetworkForm } from "@/lib/customChains";
import type { ResolvedNetwork } from "@/lib/chains";

const EMPTY_FORM: CustomNetworkForm = {
  name: "",
  chainId: "",
  rpcUrl: "",
  currencyName: "",
  currencySymbol: "",
  currencyDecimals: "18",
  explorerUrl: "",
  testnet: false,
};

function NetworkRow({ net }: { net: ResolvedNetwork }) {
  const { chainId, setChainId, removeCustomNetwork } = useRsChain();
  const active = net.chainId === chainId;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5">
      <span className="size-3 rounded-full" style={{ backgroundColor: net.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {net.name}
          {active && <Badge>Active</Badge>}
          {net.testnet && <Badge variant="warning">Testnet</Badge>}
          {net.custom && <Badge variant="secondary">Custom</Badge>}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Chain ID {net.chainId} · {net.nativeSymbol} · {net.rpcUrl}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {net.explorerUrl && (
          <Button asChild variant="ghost" size="sm">
            <a href={net.explorerUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> Explorer
            </a>
          </Button>
        )}
        {!active && (
          <Button variant="secondary" size="sm" onClick={() => setChainId(net.chainId)}>
            <Check className="size-4" /> Switch
          </Button>
        )}
        {net.custom && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => removeCustomNetwork(net.chainId)}
            title="Remove custom network"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function NetworksPage() {
  const { networks, addCustomNetwork, setChainId } = useRsChain();
  const [form, setForm] = useState<CustomNetworkForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const builtins = networks.filter((n) => !n.custom);
  const customs = networks.filter((n) => n.custom);

  const set = (key: keyof CustomNetworkForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const err = addCustomNetwork(form);
    if (err) {
      setError(err);
      setNotice(null);
      return;
    }
    setError(null);
    setNotice(`Added ${form.name}. You can switch to it from the network selector.`);
    setChainId(Number(form.chainId));
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  return (
    <div>
      <PageHeader
        title="Networks"
        subtitle="Eight built-in EVM networks plus your own custom networks. Custom network settings are stored only in this browser."
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Built-in networks</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {builtins.map((net) => (
              <NetworkRow key={net.chainId} net={net} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Custom networks</CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setShowForm((s) => !s)}>
              <Plus className="size-4" /> Add network
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {customs.length === 0 && !showForm && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                No custom networks yet. Add any EVM network by its chain ID and RPC URL — for example a
                local Anvil/Hardhat node or another L2.
              </p>
            )}
            {customs.map((net) => (
              <NetworkRow key={net.chainId} net={net} />
            ))}

            {showForm && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cn-name">Network name *</Label>
                    <Input id="cn-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="My Network" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cn-chain">Chain ID *</Label>
                    <Input id="cn-chain" inputMode="numeric" value={form.chainId} onChange={(e) => set("chainId", e.target.value)} placeholder="e.g. 31337" />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="cn-rpc">RPC URL *</Label>
                    <Input id="cn-rpc" value={form.rpcUrl} onChange={(e) => set("rpcUrl", e.target.value)} placeholder="https://…" className="font-mono text-[13px]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cn-cur-name">Currency name *</Label>
                    <Input id="cn-cur-name" value={form.currencyName} onChange={(e) => set("currencyName", e.target.value)} placeholder="Ether" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="cn-cur-sym">Symbol *</Label>
                      <Input id="cn-cur-sym" value={form.currencySymbol} onChange={(e) => set("currencySymbol", e.target.value)} placeholder="ETH" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="cn-cur-dec">Decimals</Label>
                      <Input id="cn-cur-dec" inputMode="numeric" value={form.currencyDecimals} onChange={(e) => set("currencyDecimals", e.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="cn-explorer">Block explorer URL (optional)</Label>
                    <Input id="cn-explorer" value={form.explorerUrl} onChange={(e) => set("explorerUrl", e.target.value)} placeholder="https://…" className="font-mono text-[13px]" />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.testnet}
                    onChange={(e) => set("testnet", e.target.checked)}
                    className="size-4 accent-[#7c5cff]"
                  />
                  This is a testnet
                </label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Only add RPC endpoints you trust — a malicious RPC can misreport balances and
                  transaction results. RS WALLET never sends your keys to an RPC.
                </p>
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="gradient" onClick={submit}>
                    Add &amp; switch
                  </Button>
                  <Button variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {notice && <p className="text-sm text-success">{notice}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
