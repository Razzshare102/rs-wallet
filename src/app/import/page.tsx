"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import type { Hex } from "viem";
import { OnboardingShell, PasswordSetup, isPasswordAcceptable } from "@/components/wallet/Onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVault } from "@/components/wallet/VaultProvider";
import {
  accountFromPrivateKey,
  isValidPrivateKey,
  isValidRecoveryPhrase,
  normalizePhrase,
} from "@/lib/wallet/accounts";
import type { VaultPayload } from "@/lib/wallet/vault";
import { cn } from "@/lib/utils";

type Mode = "phrase" | "key";

export default function ImportWalletPage() {
  const router = useRouter();
  const { status, initializeVault } = useVault();
  const [mode, setMode] = useState<Mode>("phrase");
  const [phrase, setPhrase] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  if (status === "locked" || status === "unlocked") {
    return (
      <OnboardingShell title="Wallet already exists" subtitle="This device already has an RS WALLET.">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Importing here will not overwrite it. Unlock your existing wallet first; you can add more
              accounts — including by private key — from the Accounts page. To replace the wallet
              entirely, delete it from the Security Center after unlocking.
            </p>
            <Button asChild variant="gradient">
              <Link href={status === "locked" ? "/unlock" : "/accounts"}>
                {status === "locked" ? "Unlock existing wallet" : "Go to Accounts"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </OnboardingShell>
    );
  }

  const wordCount = phrase.trim() ? normalizePhrase(phrase).split(" ").length : 0;
  const phraseValid = isValidRecoveryPhrase(phrase);
  const keyValid = isValidPrivateKey(privateKey);
  const secretValid = mode === "phrase" ? phraseValid : keyValid;
  const canSubmit = secretValid && isPasswordAcceptable(password, confirm) && !busy;

  const submit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      let payload: VaultPayload;
      if (mode === "phrase") {
        payload = {
          version: 1,
          mnemonic: normalizePhrase(phrase),
          hdAccountCount: 1,
          importedKeys: [],
          names: {},
          activeAccountId: "hd:0",
          createdAt: Date.now(),
        };
      } else {
        const key = privateKey.trim() as Hex;
        const account = accountFromPrivateKey(key);
        void account;
        const id = crypto.randomUUID();
        payload = {
          version: 1,
          mnemonic: null,
          hdAccountCount: 0,
          importedKeys: [{ id, name: "Imported 1", privateKey: key }],
          names: {},
          activeAccountId: `pk:${id}`,
          createdAt: Date.now(),
        };
      }
      await initializeVault(payload, password);
      router.replace("/dashboard");
    } catch {
      setError("Could not create the encrypted vault on this device. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell
      title="Import wallet"
      subtitle="Your phrase or key is encrypted on this device and never sent anywhere."
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card/60 p-1">
          {(
            [
              ["phrase", "Recovery phrase"],
              ["key", "Private key"],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                mode === m ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Only import on a device you trust.</span>{" "}
            Never paste a phrase or key into any other website — no legitimate service will ever ask for
            it.
          </p>
        </div>

        {mode === "phrase" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-phrase">Recovery phrase (12 or 24 words)</Label>
            <textarea
              id="import-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={4}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="word1 word2 word3 …"
              className="w-full resize-none rounded-xl border border-input bg-card/60 px-3.5 py-3 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
            <p className="text-xs text-muted-foreground">
              {wordCount > 0 ? `${wordCount} word${wordCount === 1 ? "" : "s"} entered. ` : ""}
              {touched && phrase.trim() && !phraseValid && (
                <span className="font-medium text-destructive">
                  This phrase is not a valid BIP-39 phrase (check spelling, word order and count).
                </span>
              )}
              {phraseValid && <span className="font-medium text-success">Valid recovery phrase.</span>}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-key">Private key (0x…)</Label>
            <Input
              id="import-key"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              onBlur={() => setTouched(true)}
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              className="font-mono"
            />
            {touched && privateKey.trim() && !keyValid && (
              <p className="text-xs font-medium text-destructive">
                That is not a valid private key (64 hex characters with a 0x prefix).
              </p>
            )}
            {keyValid && <p className="text-xs font-medium text-success">Valid private key.</p>}
          </div>
        )}

        <PasswordSetup
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
          idPrefix="import"
        />

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button variant="gradient" size="lg" className="w-full" disabled={!canSubmit} onClick={submit}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Import wallet
        </Button>
      </div>
    </OnboardingShell>
  );
}
