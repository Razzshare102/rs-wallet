import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { VaultProvider } from "@/components/wallet/VaultProvider";
import { TelegramProvider } from "@/components/wallet/TelegramProvider";
import { appUrl } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "RS WALLET — Non-custodial EVM Wallet",
  description:
    "RS WALLET is a non-custodial EVM wallet. Create or import your own wallet across 8 networks — your keys never leave your device.",
  applicationName: "RS WALLET",
  authors: [{ name: "RS WALLET" }],
  keywords: ["EVM wallet", "non-custodial", "Web3", "Ethereum", "BNB Chain", "RS WALLET"],
  openGraph: {
    type: "website",
    siteName: "RS WALLET",
    title: "RS WALLET — Non-custodial EVM Wallet",
    description:
      "Create or import your own wallet across 8 EVM networks. Your keys never leave your device.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "RS WALLET — Non-custodial EVM Wallet",
    description:
      "Create or import your own wallet across 8 EVM networks. Your keys never leave your device.",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Web3Provider>
          <VaultProvider>
            <TelegramProvider>{children}</TelegramProvider>
          </VaultProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
