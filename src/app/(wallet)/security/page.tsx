"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, Loader2, Lock, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { ApprovalManager } from "@/components/wallet/ApprovalManager";
import { PhraseGrid } from "@/components/wallet/Onboarding";
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
import { AUTOLOCK_OPTIONS, useVault } from "@/components/wallet/VaultProvider";
import { changePassword } from "@/lib/wallet/vault";
import { cn } from "@/lib/utils";

function RevealPhrase() {
  const { verifyPassword, revealMnemonic, hasMnemonic } = useVault();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPhrase = async () => {
    if (!phrase) return;
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — your browser blocked clipboard access. Write the words down instead.");
    }
  };

  if (!hasMnemonic) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        This wallet was imported by private key only, so it has no recovery phrase. Each imported key
        must be backed up separately (Accounts → Export key).
      </p>
    );
  }

  const close = (next: boolean) => {
    if (!next) {
      setPassword("");
      setError(null);
      setPhrase(null);
      setRevealed(false);
      setCopied(false);
    }
    setOpen(next);
  };

  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Eye className="size-4" /> View recovery phrase
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recovery phrase</DialogTitle>
            <DialogDescription>
              Verify your password first. Never share this phrase — anyone who has it controls your
              wallet.
            </DialogDescription>
          </DialogHeader>
          {!phrase ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reveal-password">Wallet password</Label>
              <Input
                id="reveal-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wallet password"
              />
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            </div>
          ) : (
            <div className="relative">
              <div className={revealed ? "" : "select-none blur-md"}>
                <PhraseGrid words={phrase.split(" ")} />
              </div>
              {!revealed && (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
                >
                  <Eye className="size-4" /> Tap to reveal
                </button>
              )}
            </div>
          )}
          {phrase && revealed && (
            <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs leading-relaxed text-warning">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              Copy it only into a safe, private place. Never paste your phrase into a website, chat
              or email — anyone with these words controls your wallet.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => close(false)}>
              {phrase ? "Done" : "Cancel"}
            </Button>
            {!phrase && (
              <Button
                variant="gradient"
                disabled={!password || busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  const ok = await verifyPassword(password);
                  setBusy(false);
                  if (!ok) {
                    setError("Incorrect password.");
                    return;
                  }
                  setPhrase(revealMnemonic());
                }}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Verify &amp; show
              </Button>
            )}
            {phrase && (
              <Button variant="ghost" onClick={() => setRevealed((r) => !r)}>
                {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {revealed ? "Hide" : "Show"}
              </Button>
            )}
            {phrase && revealed && (
              <Button variant="gradient" onClick={copyPhrase}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy phrase"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChangePassword() {
  const { lock } = useVault();
  const router = useRouter();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = newPw.length >= 8 && newPw === confirm && oldPw.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cp-old">Current password</Label>
          <Input id="cp-old" type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cp-new">New password</Label>
          <Input id="cp-new" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cp-confirm">Confirm new password</Label>
          <Input id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </div>
      {confirm && newPw !== confirm && <p className="text-xs font-medium text-destructive">New passwords do not match.</p>}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <div>
        <Button
          variant="secondary"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await changePassword(oldPw, newPw);
              lock();
              router.replace("/unlock");
            } catch {
              setError("Current password is incorrect.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Change password &amp; lock
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Changing your password re-encrypts the vault on this device. It does not change your recovery
        phrase or any account.
      </p>
    </div>
  );
}

function DeleteWallet() {
  const { deleteWallet, verifyPassword } = useVault();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Delete wallet from this device
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setPassword("");
            setConfirmed(false);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete wallet?</DialogTitle>
            <DialogDescription>
              This permanently removes the encrypted vault from this device. Your funds stay on-chain,
              but you can only access them again with your recovery phrase or private keys.
            </DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 size-4 accent-[#f6465d]"
            />
            I have my recovery phrase and all imported private keys backed up safely.
          </label>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-password">Wallet password</Label>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmed || !password || busy}
              onClick={async () => {
                setBusy(true);
                const ok = await verifyPassword(password);
                if (!ok) {
                  setError("Incorrect password.");
                  setBusy(false);
                  return;
                }
                await deleteWallet();
                router.replace("/");
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SecurityPage() {
  const { status, lock, autoLockMinutes, setAutoLockMinutes, hasMnemonic } = useVault();

  return (
    <div>
      <PageHeader title="Security Center" subtitle="Vault status, backups and safety controls." />

      {status === "no-vault" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <ShieldCheck className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              No built-in wallet on this device. Create or import one to use the encrypted vault.
            </p>
            <Button asChild variant="gradient">
              <Link href="/create">Create wallet</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {status === "locked" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Lock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Your vault is encrypted and locked. Unlock to manage security settings.
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-5 text-success" /> Vault status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">Unlocked</Badge>
                <Badge variant="secondary">AES-256-GCM</Badge>
                <Badge variant="secondary">PBKDF2 · 600,000 iterations</Badge>
                <Badge variant="secondary">{hasMnemonic ? "Recovery phrase wallet" : "Private-key wallet"}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your vault is stored only in this browser&apos;s IndexedDB, encrypted with a key derived
                from your password. Plaintext keys exist only in memory while unlocked. Browser wallets
                cannot match hardware-wallet security — keep large funds on a hardware wallet.
              </p>
              <div>
                <Button variant="secondary" onClick={() => lock()}>
                  <Lock className="size-4" /> Lock wallet now
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Auto-lock after inactivity</Label>
                <div className="flex flex-wrap gap-2">
                  {[...AUTOLOCK_OPTIONS, 0].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setAutoLockMinutes(minutes)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                        autoLockMinutes === minutes
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {minutes === 0 ? "Never" : `${minutes} min`}
                    </button>
                  ))}
                </div>
                {autoLockMinutes === 0 && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <ShieldAlert className="size-3.5" /> Anyone with access to this device can use your
                    unlocked wallet. Not recommended.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recovery phrase backup</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your recovery phrase is the only backup of every account derived from it. Store it
                offline, in more than one safe place, and never type it into any other website.
              </p>
              <RevealPhrase />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change password</CardTitle>
            </CardHeader>
            <CardContent>
              <ChangePassword />
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Deleting removes the encrypted vault from this device only. It cannot be undone by
                RS WALLET.
              </p>
              <DeleteWallet />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-4">
        <ApprovalManager />
      </div>
    </div>
  );
}
