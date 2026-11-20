"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { OnboardingShell } from "@/components/wallet/Onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RSLogo } from "@/components/brand/RSLogo";
import { useVault } from "@/components/wallet/VaultProvider";

export default function UnlockPage() {
  const router = useRouter();
  const { status, unlock, deleteWallet } = useVault();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (status === "unlocked") router.replace("/dashboard");
    if (status === "no-vault") router.replace("/");
  }, [status, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlock(password);
      router.replace("/dashboard");
    } catch {
      // Deliberately generic: never reveal whether the vault or the
      // password check failed in a distinguishable way.
      setError("Incorrect password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell
      title="Welcome back"
      subtitle="Enter your password to unlock the built-in wallet on this device."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex justify-center py-2">
          <RSLogo size={64} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="unlock-password">Password</Label>
          <Input
            id="unlock-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your wallet password"
          />
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={!password || busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          Unlock wallet
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Forgot your password? RS WALLET cannot reset it — the password only exists in your head.
          You can restore access with your recovery phrase by resetting the wallet below.
        </p>
      </form>

      <div className="mt-8 border-t border-border pt-5">
        {!showReset ? (
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Forgot password — reset wallet with recovery phrase
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-sm font-semibold text-foreground">Reset this wallet?</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This permanently deletes the encrypted wallet from this device. You can only get your
              funds back by importing your recovery phrase or private key again. If you do not have
              them saved, your funds will be lost forever.
            </p>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed">
              <input
                type="checkbox"
                checked={resetConfirmed}
                onChange={(e) => setResetConfirmed(e.target.checked)}
                className="mt-0.5 size-4 accent-[#f6465d]"
              />
              I have my recovery phrase / private key saved and understand this deletion is permanent.
            </label>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={!resetConfirmed || resetting}
                onClick={async () => {
                  setResetting(true);
                  await deleteWallet();
                  router.replace("/import");
                }}
              >
                {resetting ? <Loader2 className="size-4 animate-spin" /> : null}
                Delete wallet &amp; import
              </Button>
              <Button variant="ghost" onClick={() => setShowReset(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </OnboardingShell>
  );
}
