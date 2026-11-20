import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { VaultProvider } from "@/components/wallet/VaultProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RS WALLET — Non-custodial EVM Wallet",
  description:
    "RS WALLET is a non-custodial EVM wallet. Create or import your own wallet, or connect MetaMask, Rabby, Coinbase Wallet and WalletConnect wallets across 8 networks.",
  applicationName: "RS WALLET",
  authors: [{ name: "RS WALLET" }],
  keywords: ["EVM wallet", "non-custodial", "Web3", "Ethereum", "BNB Chain", "RS WALLET"],
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Web3Provider>
          <VaultProvider>{children}</VaultProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
