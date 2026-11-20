"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import type { Hex } from "viem";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVault, type AccountInfo } from "@/components/wallet/VaultProvider";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { isValidPrivateKey } from "@/lib/wallet/accounts";
import { shortenAddress } from "@/lib/utils";
import { useAccount, useDisconnect } from "wagmi";

function ExternalWalletCard() {
  const { address, isConnected, connector, chainId: extChainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { network } = useRsChain();

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">External wallet</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isConnected && address ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Connected</Badge>
              <Badge variant="secondary">{connector?.name ?? "External wallet"}</Badge>
              <Badge variant={network ? "secondary" : "warning"}>
                {network ? network.name : `Unsupported chain ${extChainId}`}
              </Badge>
            </div>
            <p className="font-mono text-sm">{address}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This wallet signs in its own app. RS WALLET never asks for its recovery phrase or private
              key. When the built-in wallet is locked, the external wallet is the active account.
            </p>
            <div>
              <Button variant="secondary" size="sm" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              No external wallet connected. Connect MetaMask, Rabby, Coinbase Wallet or any
              WalletConnect wallet — it keeps its own keys and signs everything itself.
            </p>
            <div>
              <ConnectButton />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      {label}
    </Button>
  );
}

function ExportKeyDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AccountInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { verifyPassword, exportPrivateKey } = useVault();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (!next) {
      setPassword("");
      setError(null);
      setRevealed(null);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    const ok = await verifyPassword(password);
    if (!ok) {
      setError("Incorrect password.");
      setBusy(false);
      return;
    }
    const key = exportPrivateKey(account.id);
    setBusy(false);
    if (!key) {
      setError("Could not derive the private key for this account.");
      return;
    }
    setRevealed(key);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export private key</DialogTitle>
          <DialogDescription>
            {account ? `${account.name} · ${shortenAddress(account.address, 6)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Anyone with this private key controls this account&apos;s funds completely. Never share it,
            never type it into a website, and never store it in screenshots or cloud notes.
          </p>
        </div>
        {!revealed ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="export-password">Enter your wallet password to continue</Label>
            <Input
              id="export-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wallet password"
            />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label>Private key</Label>
            <div className="break-all rounded-xl border border-border bg-secondary/50 p-3.5 font-mono text-xs leading-relaxed">
              {revealed}
            </div>
            <div>
              <CopyButton text={revealed} label="Copy private key" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            {revealed ? "Done" : "Cancel"}
          </Button>
          {!revealed && (
            <Button variant="destructive" disabled={!password || busy} onClick={submit}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Reveal private key
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AccountInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { renameAccount } = useVault();
  const [name, setName] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && account) setName(account.name);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename account</DialogTitle>
          <DialogDescription>Names are stored only inside your encrypted vault.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rename-input">Account name</Label>
          <Input id="rename-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            disabled={!name.trim()}
            onClick={async () => {
              if (account) await renameAccount(account.id, name);
              onOpenChange(false);
            }}
          >
            Save name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountsPage() {
  const vault = useVault();
  const { status, accounts, activeAccount, hasMnemonic } = vault;
  const [exportTarget, setExportTarget] = useState<AccountInfo | null>(null);
  const [renameTarget, setRenameTarget] = useState<AccountInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [importKey, setImportKey] = useState("");
  const [importName, setImportName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Accounts" subtitle="Built-in accounts live in your encrypted vault on this device." />

      {status === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}

      {status === "no-vault" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              No built-in wallet on this device yet. Create one or import an existing wallet.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="gradient">
                <Link href="/create">Create wallet</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/import">Import wallet</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "locked" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Lock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Your wallet is locked. Unlock it to manage accounts.
            </p>
            <Button asChild variant="gradient">
              <Link href="/unlock">Unlock wallet</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {status === "unlocked" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Built-in accounts</CardTitle>
              {hasMnemonic && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setNotice(null);
                    try {
                      const created = await vault.addHdAccount();
                      setNotice(`Added ${created.name} (${shortenAddress(created.address, 6)}).`);
                    } catch (err) {
                      setNotice(err instanceof Error ? err.message : "Could not add account.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Add account
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {accounts.map((account) => {
                const isActive = activeAccount?.id === account.id;
                return (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-bold text-primary">
                      {account.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {account.name}
                        {isActive && <Badge>Active</Badge>}
                        <Badge variant={account.kind === "hd" ? "secondary" : "warning"}>
                          {account.kind === "hd" ? "Recovery phrase" : "Private key"}
                        </Badge>
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{account.address}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <CopyButton text={account.address} label="Copy" />
                      {!isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => vault.setActiveAccountId(account.id)}
                        >
                          Set active
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setRenameTarget(account)}>
                        <Pencil className="size-4" /> Rename
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setExportTarget(account)}>
                        <KeyRound className="size-4" /> Export key
                      </Button>
                    </div>
                  </div>
                );
              })}
              {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import an account by private key</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                The key is encrypted into your vault on this device and never sent anywhere. Imported
                accounts are NOT covered by your recovery phrase — back the key up separately.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="acct-import-key">Private key</Label>
                  <Input
                    id="acct-import-key"
                    value={importKey}
                    onChange={(e) => setImportKey(e.target.value)}
                    placeholder="0x…"
                    className="font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="acct-import-name">Name (optional)</Label>
                  <Input
                    id="acct-import-name"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder="Imported account"
                    maxLength={32}
                  />
                </div>
              </div>
              {importError && <p className="text-sm font-medium text-destructive">{importError}</p>}
              <div>
                <Button
                  variant="secondary"
                  disabled={!importKey.trim() || busy}
                  onClick={async () => {
                    setImportError(null);
                    if (!isValidPrivateKey(importKey)) {
                      setImportError("That is not a valid private key (64 hex characters, 0x-prefixed).");
                      return;
                    }
                    setBusy(true);
                    try {
                      const added = await vault.importPrivateKey(importKey.trim() as Hex, importName);
                      setImportKey("");
                      setImportName("");
                      setNotice(`Imported ${added.name} (${shortenAddress(added.address, 6)}).`);
                    } catch (err) {
                      setImportError(err instanceof Error ? err.message : "Import failed.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <UserPlus className="size-4" /> Import account
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      <ExternalWalletCard />

      <ExportKeyDialog
        account={exportTarget}
        open={Boolean(exportTarget)}
        onOpenChange={(open) => !open && setExportTarget(null)}
      />
      <RenameDialog
        account={renameTarget}
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      />
    </div>
  );
}
