"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Eye, EyeOff, RefreshCw, ShieldAlert } from "lucide-react";
import { OnboardingShell, PasswordSetup, PhraseGrid, isPasswordAcceptable } from "@/components/wallet/Onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useVault } from "@/components/wallet/VaultProvider";
import { generateRecoveryPhrase } from "@/lib/wallet/accounts";

export default function CreateWalletPage() {
  const router = useRouter();
  const { status, setPendingSetup } = useVault();
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === "unlocked") router.replace("/dashboard");
  }, [status, router]);

  if (status === "locked") {
    return (
      <OnboardingShell title="Wallet already exists" subtitle="This device already has an RS WALLET.">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Unlock it to continue. Creating a second wallet here would replace nothing — your existing
              wallet stays untouched. To start over, unlock first, then delete the wallet from the
              Security Center (only with your recovery phrase saved).
            </p>
            <Button asChild variant="gradient">
              <Link href="/unlock">Unlock existing wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </OnboardingShell>
    );
  }

  const startPhraseStep = () => {
    const mnemonic = generateRecoveryPhrase();
    setPhrase(mnemonic);
    setPendingSetup({ mnemonic, password });
    setStep(2);
  };

  return (
    <OnboardingShell
      title="Create a new wallet"
      subtitle="Your wallet is generated on this device and encrypted with your password. Nothing is uploaded."
    >
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <PasswordSetup
            password={password}
            confirm={confirm}
            onPasswordChange={setPassword}
            onConfirmChange={setConfirm}
          />
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={!isPasswordAcceptable(password, confirm)}
            onClick={startPhraseStep}
          >
            Continue <ArrowRight className="size-4" />
          </Button>
        </div>
      )}

      {step === 2 && phrase && (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold text-foreground">Save these 12 words in order.</p>
              <p className="mt-1 text-muted-foreground">
                This recovery phrase is the ONLY way to restore your wallet. Anyone who sees it can take
                your funds. RS WALLET never sees it and cannot recover it for you. Write it down
                offline — never screenshot it or store it in cloud notes.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className={revealed ? "" : "select-none blur-md"}>
              <PhraseGrid words={phrase.split(" ")} />
            </div>
            {!revealed && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
              >
                <Eye className="size-5" /> Tap to reveal recovery phrase
                <span className="text-xs font-normal text-muted-foreground">
                  Make sure nobody is watching your screen.
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5" /> Never share this phrase with anyone.
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => {
                const mnemonic = generateRecoveryPhrase();
                setPhrase(mnemonic);
                setPendingSetup({ mnemonic, password });
                setSaved(false);
              }}
            >
              <RefreshCw className="size-3.5" /> Regenerate
            </button>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="mt-0.5 size-4 accent-[#7c5cff]"
            />
            I saved my recovery phrase somewhere safe and offline, and I understand that losing it
            means losing access to my funds forever.
          </label>

          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={!saved || !revealed}
            onClick={() => router.push("/verify")}
          >
            Verify recovery phrase <ArrowRight className="size-4" />
          </Button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {revealed ? "Hide phrase" : "Show phrase"}
          </button>
        </div>
      )}
    </OnboardingShell>
  );
}
