"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { OnboardingShell } from "@/components/wallet/Onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useVault } from "@/components/wallet/VaultProvider";
import { cn } from "@/lib/utils";

interface QuizItem {
  position: number; // 0-based index into the phrase
  options: string[];
}

function buildQuiz(words: string[]): QuizItem[] {
  const positions = new Set<number>();
  while (positions.size < 3) positions.add(Math.floor(Math.random() * words.length));
  return [...positions]
    .sort((a, b) => a - b)
    .map((position) => {
      const correct = words[position];
      const decoys = new Set<string>();
      while (decoys.size < 2) {
        const w = words[Math.floor(Math.random() * words.length)];
        if (w !== correct) decoys.add(w);
      }
      const options = [correct, ...decoys].sort(() => Math.random() - 0.5);
      return { position, options };
    });
}

export default function VerifyPhrasePage() {
  const router = useRouter();
  const { pendingSetup, completeSetup, status } = useVault();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const words = useMemo(() => pendingSetup?.mnemonic.split(" ") ?? [], [pendingSetup]);
  const [quiz] = useState<QuizItem[]>(() => (words.length ? buildQuiz(words) : []));

  if (status === "unlocked" || done) {
    return (
      <OnboardingShell title="Wallet created" subtitle="Your encrypted vault is stored on this device.">
        <Card className="glass">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <CheckCircle2 className="size-12 text-success" />
            <h2 className="mt-4 text-lg font-semibold">You are all set</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Your wallet was created and encrypted locally. Keep your recovery phrase offline — it is
              the only backup.
            </p>
            <Button asChild variant="gradient" size="lg" className="mt-6">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </OnboardingShell>
    );
  }

  if (!pendingSetup) {
    return (
      <OnboardingShell title="Nothing to verify" subtitle="Start by creating a wallet.">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              There is no wallet setup in progress. For your security, the recovery phrase only exists
              in memory during setup and is never stored before your vault is created.
            </p>
            <Button asChild variant="gradient">
              <Link href="/create">Create wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </OnboardingShell>
    );
  }

  const allAnswered = quiz.every((q) => answers[q.position]);

  const submit = async () => {
    setError(null);
    const wrong = quiz.some((q) => answers[q.position] !== words[q.position]);
    if (wrong) {
      setError("Some words are incorrect. Check your saved phrase and try again.");
      return;
    }
    setBusy(true);
    try {
      await completeSetup();
      setDone(true);
    } catch {
      setError("Could not create the encrypted vault on this device. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell
      title="Verify your recovery phrase"
      subtitle="Select the correct word for each position to prove you saved the phrase."
      backHref="/create"
    >
      <div className="flex flex-col gap-5">
        {quiz.map((q) => (
          <div key={q.position}>
            <p className="mb-2 text-sm font-medium">Word #{q.position + 1}</p>
            <div className="grid grid-cols-3 gap-2">
              {q.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [q.position]: option }))}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 font-mono text-sm font-medium transition-colors",
                    answers[q.position] === option
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button variant="gradient" size="lg" className="w-full" disabled={!allAnswered || busy} onClick={submit}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Create my wallet
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/create")}
        >
          Back to recovery phrase
        </button>
      </div>
    </OnboardingShell>
  );
}
