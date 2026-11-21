"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, KeyRound, ShieldCheck, Globe2, ArrowLeftRight, Lock } from "lucide-react";
import { RSLogo } from "@/components/brand/RSLogo";
import { Button } from "@/components/ui/button";
import { SUPPORTED_NETWORKS } from "@/lib/chains";
import { BuiltinChip } from "@/components/wallet/BuiltinChip";
import { ChainProvider } from "@/components/wallet/ChainProvider";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const FEATURES = [
  {
    icon: KeyRound,
    title: "Your keys, your coins",
    text: "Built-in wallets are generated on your device and encrypted with AES-256-GCM. Keys never touch a server.",
  },
  {
    icon: Globe2,
    title: "8 EVM networks",
    text: "Ethereum, BNB Chain, Polygon, Arbitrum, Optimism, Base, Avalanche and Sepolia — plus custom networks.",
  },
  {
    icon: ArrowLeftRight,
    title: "Real swaps & sends",
    text: "Live balances, real gas estimates, aggregator swap quotes and on-chain tracking. Nothing is mocked.",
  },
  {
    icon: ShieldCheck,
    title: "Security first",
    text: "Approval warnings, address checks and explicit confirmation before every signature.",
  },
];

export default function LandingPage() {
  return (
    <ChainProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5">
        <header className="flex items-center justify-between py-5">
          <RSLogo withWordmark size={38} />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/security">Security</Link>
            </Button>
            <BuiltinChip />
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center pb-20 pt-10 text-center sm:pt-16">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
            <RSLogo size={84} className="justify-center" />
          </motion.div>
          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-7 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl"
          >
            One wallet for <span className="text-gradient">every EVM chain</span>
          </motion.h1>
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Create your own encrypted wallet on this device — a 12-word recovery phrase,
            encrypted with your password. Non-custodial — always.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="mt-10 w-full max-w-xl"
          >
            <div className="glass rounded-3xl p-6 text-left">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <KeyRound className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">Built-in wallet</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Generate a 12-word recovery phrase on-device. Encrypted locally with your password —
                only you can unlock it.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild variant="gradient">
                  <Link href="/create">
                    Create wallet <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/import">Import</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard">Open dashboard</Link>
                </Button>
              </div>
            </div>

          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            {SUPPORTED_NETWORKS.map((n) => (
              <span
                key={n.chain.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: n.color }} />
                {n.chain.name}
              </span>
            ))}
          </motion.div>

          <div className="mt-16 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ duration: 0.45, delay: 0.1 + i * 0.07 }}
                className="rounded-3xl border border-border bg-card/60 p-6"
              >
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </motion.div>
            ))}
          </div>

          <p className="mt-14 flex max-w-xl items-start gap-2 text-left text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            RS WALLET never receives, stores or transmits your recovery phrase or private keys. If you
            lose your recovery phrase and password, nobody — including RS WALLET — can recover your funds.
          </p>
        </main>
      </div>
    </ChainProvider>
  );
}
