import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function WalletLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading RS WALLET…
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
