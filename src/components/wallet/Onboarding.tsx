"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { RSLogo } from "@/components/brand/RSLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function OnboardingShell({
  title,
  subtitle,
  children,
  backHref = "/",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  backHref?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-7">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="RS WALLET home">
          <RSLogo withWordmark size={36} />
        </Link>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
      </div>
      <div className="mt-10">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}

export function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const label = ["Too weak", "Weak", "Fair", "Good", "Strong", "Excellent"][score];
  return { score, label };
}

export function PasswordSetup({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  idPrefix = "pw",
}: {
  password: string;
  confirm: string;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  idPrefix?: string;
}) {
  const [show, setShow] = useState(false);
  const strength = passwordStrength(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-password`}>Create password</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-password`}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {password.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  strength.score <= 1 && "bg-destructive",
                  strength.score === 2 && "bg-warning",
                  strength.score >= 3 && "bg-success",
                )}
                style={{ width: `${(strength.score / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{strength.label}</span>
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          This password encrypts your wallet on this device only. It is not your recovery phrase —
          RS WALLET cannot reset it for you.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-confirm`}>Confirm password</Label>
        <Input
          id={`${idPrefix}-confirm`}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Repeat the password"
          value={confirm}
          onChange={(e) => onConfirmChange(e.target.value)}
        />
        {mismatch && <p className="text-xs font-medium text-destructive">Passwords do not match.</p>}
      </div>
    </div>
  );
}

export function isPasswordAcceptable(password: string, confirm: string): boolean {
  return password.length >= 8 && password === confirm;
}

export function PhraseGrid({ words }: { words: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {words.map((word, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2.5"
        >
          <span className="w-5 text-right text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
          <span className="font-mono text-sm font-medium">{word}</span>
        </div>
      ))}
    </div>
  );
}
