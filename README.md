# RS WALLET

A production-grade, **non-custodial** EVM wallet that runs entirely in the browser.
Two wallet modes:

- **Built-in wallet** — BIP-39 recovery phrase (12/24 words) or private-key import.
  Secrets are encrypted with **AES-256-GCM** (key derived via **PBKDF2-HMAC-SHA256,
  600,000 iterations**) and stored only as ciphertext in IndexedDB. Plaintext keys
  exist only in memory while the vault is unlocked.
- **External wallet** — MetaMask, Rabby, Coinbase Wallet, WalletConnect and more via
  Reown AppKit / wagmi (EIP-1193). RS WALLET never asks for an external wallet's
  seed phrase or private key.

Networks: Ethereum, BNB Chain, Polygon, Arbitrum, Optimism, Base, Avalanche and
Sepolia, plus user-defined custom networks. All balances, prices and history are
read live from the chain / public APIs — **nothing is ever fabricated**: when data
is unavailable the UI says so.

> ⚠️ Browser wallets cannot match hardware-wallet security. Read
> [Security model & limitations](#security-model--limitations) before holding
> significant funds.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in at least NEXT_PUBLIC_REOWN_PROJECT_ID
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build
npm run start
```

## Scripts

| Command         | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Development server                            |
| `npm run build` | Production build (includes TypeScript check)  |
| `npm run start` | Serve the production build                    |
| `npm test`      | Vitest suite (40 tests)                       |
| `npm run lint`  | ESLint (Next + React Hooks rules)             |

## Environment variables

Copy `.env.example` to `.env.local`. **Server-only keys must never be prefixed
with `NEXT_PUBLIC_`** and are read only inside API routes.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Yes, for WalletConnect/AppKit | Reown project ID — create one at [dashboard.reown.com](https://dashboard.reown.com). Without it, injected wallets (MetaMask/Rabby/Coinbase extension) still work and the app shows a configuration notice. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public URL of the deployment (AppKit metadata). |
| `ZEROX_API_KEY` | For swaps | 0x Swap API key (server-only) — [dashboard.0x.org](https://dashboard.0x.org). Without it the Swap page shows exactly how to configure it; swaps are never faked. |
| `ETHERSCAN_API_KEY` | For full history | Etherscan API key (server-only). One key serves all supported chains via Etherscan API V2. Without it, Activity shows transactions broadcast from this app only, with a clear note. |
| `COINGECKO_API_KEY` | Optional | CoinGecko Demo/Pro key (server-only) for higher price rate limits. Prices work without it at public limits. |
| `NEXT_PUBLIC_RPC_<chainId>` | Optional | Custom RPC URL per chain (`1, 56, 137, 42161, 10, 8453, 43114, 11155111`). Defaults are the public endpoints from viem's chain definitions. RPC URLs are public configuration, not secrets. |

## Folder structure

```
src/
  app/
    page.tsx                 Landing page
    create/  import/  verify/  unlock/     Built-in wallet onboarding
    (wallet)/                App shell (sidebar / bottom tabs)
      dashboard/             Portfolio overview + USD total + recent activity
      send/  receive/        Transfers (gas estimate, review-before-sign, QR + EIP-681)
      swap/                  0x aggregator swaps (exact-amount approvals, slippage)
      assets/  token/[contract]/   Token list, custom tokens, token details
      activity/              Merged local + explorer history, live status tracking
      accounts/              HD accounts, private-key import, password-gated export
      networks/              Built-in + custom network management
      security/              Vault status, phrase backup, password change, approval manager
      settings/              Live configuration status
    api/
      prices/route.ts        CoinGecko proxy (zod-validated, rate-limited)
      history/route.ts       Etherscan V2 history proxy (zod-validated, rate-limited)
      swap/quote/route.ts    0x quote proxy (server key only)
  components/
    brand/RSLogo.tsx         Original RS monogram
    layout/AppShell.tsx      App chrome, unsupported-chain banner
    providers/Web3Provider.tsx   wagmi + AppKit + TanStack Query + vault/chain providers
    ui/                      shadcn-style primitives (button, card, dialog, …)
    wallet/                  VaultProvider, ChainProvider, onboarding, ActivityList,
                             ApprovalManager, NetworkSelector, ConnectButton
  config/wagmi.ts            wagmi/AppKit configuration
  hooks/                     useActiveAccount, useBalances, useActivity, usePrices, useTokenList
  lib/
    chains.ts  customChains.ts     Network definitions + custom network validation
    tokens.ts  tokenStore.ts       Curated ERC-20 registry + user tokens (localStorage)
    publicClient.ts          Cached viem public clients, ERC-20 ABI, metadata reads
    signing.ts               Built-in wallet client + human-readable error mapping
    activity.ts  history.ts  Local tx store; explorer normalization + merge
    prices.ts  swap.ts       CoinGecko mapping; 0x quote normalization + slippage math
    uri.ts                   EIP-681 payment URIs
    env.ts                   Zod-validated public environment
    wallet/
      crypto.ts              PBKDF2 (600k) + AES-256-GCM vault cryptography (Web Crypto)
      accounts.ts            BIP-39/BIP-44 derivation (m/44'/60'/0'/0/n), key validation
      vault.ts               IndexedDB vault: create / unlock / persist / change password
tests/                       Vitest: wallet crypto + derivation vectors, vault storage,
                             token registry integrity, activity store + history merge,
                             swap quote normalization, price mapping (40 tests)
```

## Features

- **Create / import** — 12-word phrase with a 3-word verification quiz, or import a
  phrase (12/24) or a single private key. Duplicate keys are rejected.
- **Multi-account** — unlimited HD accounts from one phrase plus imported keys,
  rename, switch active account, password-gated private-key export.
- **Locking** — manual lock + auto-lock after 1/5/15/30 minutes of inactivity
  (or Never, with a warning). Changing the password re-encrypts the vault.
- **Balances** — native + ERC-20 balances read via RPC multicall every 30 s,
  curated verified registry per chain, custom tokens with on-chain metadata
  fetch and an explicit *Unverified* badge, hide/unhide.
- **Send** — recipient validation (ENS names are rejected with an explanation —
  no resolver is bundled), contract-recipient and self-send warnings, live gas
  estimation, fee reservation on MAX, full review card before signing. Nothing
  is ever signed automatically.
- **Receive** — QR code + EIP-681 payment URI for the active network.
- **Activity** — transactions broadcast from the app are recorded locally and
  tracked to confirmation (receipt polling); explorer history is merged and
  deduplicated by hash. Filters: sent / received / swaps / approvals.
- **Swap** — 0x aggregator quotes (refresh every 20 s), slippage control,
  minimum-received calculation, route contract shown, **exact-amount approvals
  only** (never unlimited), approval → review → sign flow.
- **Portfolio** — CoinGecko USD prices for native + held tokens; the dashboard
  total covers priced assets only and says so. Testnet assets show no USD value.
- **Approval manager** (Security Center) — read any token + spender allowance
  live from chain, unlimited-approval warning, revoke (approve 0) with confirm.
- **Custom networks** — validated form (duplicate/built-in chain IDs rejected),
  switching via `wallet_addEthereumChain` (EIP-3085) for external wallets.

## Test results

Verified 2026-11-21 on the final build:

- `npm test` — **40/40 tests pass** (5 files): vault encryption roundtrip,
  wrong-password and tamper rejection, canonical BIP-39 derivation vector
  (`abandon` ×11 + `about` → `0x9858EfFD…Eda94`), vault create/unlock/persist/
  delete in IndexedDB, token registry address/checksum integrity across all
  8 chains, EIP-681 URIs, explorer history normalization + merge/dedupe,
  0x quote normalization (incomplete quotes throw), slippage math, price mapping.
- `npx tsc --noEmit` — clean (TypeScript strict).
- `npm run lint` — clean. Eight targeted `eslint-disable` comments exist, each
  with an inline justification: four for the SSR-safe localStorage/IndexedDB
  hydration pattern (external-store reads after mount), two for `Date.now()`
  inside transaction handlers misclassified as render by the purity rule, one
  for the QR-code `<img>` (a data URL), and one `exhaustive-deps`.
- `npm run build` — production build passes; all routes generated.
- Runtime smoke test — production server serves the landing page and wallet
  routes (HTTP 200); `/api/prices` returned live CoinGecko prices through the
  proxy (BNB $538.92, BSC USDT $0.998992 at test time); `/api/history` without
  a key and `/api/swap/quote` without a key return their documented
  graceful-degradation payloads (empty list + explanation, and HTTP 503
  `not_configured`).

## Security model & limitations

**Model**

- Vault ciphertext only in IndexedDB; the decryption key is derived from the
  user's password (PBKDF2-HMAC-SHA256, 600,000 iterations, fresh salt + IV per
  encryption) and held only in memory while unlocked. The password itself is
  never stored.
- localStorage holds **no secrets**: selected chain, auto-lock preference,
  custom network definitions (public RPC URLs), custom/hidden token lists, and
  transaction metadata (public on-chain data).
- Server secrets (`ZEROX_API_KEY`, `ETHERSCAN_API_KEY`, `COINGECKO_API_KEY`)
  are read only inside API routes. API routes proxy **public data only**, are
  zod-validated and rate-limited (30 req/min/IP), and never receive keys,
  signatures or user secrets.
- Every transaction (send, approve, swap, revoke) goes through an explicit
  review/confirm step. The app never auto-signs and never requests unlimited
  token approvals.
- No `dangerouslySetInnerHTML`, no `eval`, no third-party scripts beyond the
  wallet-connection stack.

**Limitations — read honestly**

- **Browser storage is not a hardware wallet.** Anyone with access to the
  unlocked device/browser profile can attempt to use the wallet; malware or a
  malicious extension on the machine is out of scope. The vault protects
  against casual access and offline extraction only as far as the password is
  strong. Keep large funds on a hardware wallet.
- **No seed backup = no recovery.** If the password is forgotten *and* the
  recovery phrase is lost, funds are unrecoverable — by design.
- **RPC trust.** Balances/history come from public RPC endpoints and public
  APIs (CoinGecko, Etherscan, 0x). A malicious or wrong RPC can misreport
  state; set your own RPC endpoints for higher assurance. Custom RPC URLs are
  trusted exactly as much as the operator you choose.
- **Explorer history needs a key.** Without `ETHERSCAN_API_KEY`, Activity
  shows only transactions this app broadcast (plus their confirmations).
- **Custom networks** depend on Multicall3 for token balances; networks
  without it will show balance errors rather than partial data. Explorer
  history and prices are unavailable for custom networks.
- **ENS is not resolved** in this version — send to `0x…` addresses only.
- **Not audited.** This code has unit tests and a self-review, not a
  professional security audit. Do not deploy it as a custodial service.

## Deploying to Vercel

1. Push this folder to a GitHub repository (or use the `vercel` CLI from the folder).
2. In Vercel: **New Project → Import** the repo. Framework preset: **Next.js**
   (auto-detected). No build settings need changing (`npm run build`).
3. Add environment variables (Project → Settings → Environment Variables):
   `NEXT_PUBLIC_REOWN_PROJECT_ID`, `NEXT_PUBLIC_APP_URL` (your production URL),
   and — server-only, no `NEXT_PUBLIC_` prefix — `ZEROX_API_KEY`,
   `ETHERSCAN_API_KEY`, `COINGECKO_API_KEY` as needed.
4. Deploy. After the first deploy, set `NEXT_PUBLIC_APP_URL` to the final
   production domain and redeploy so AppKit metadata matches.
5. Add your production domain to the Reown project's allowed origins in the
   Reown dashboard, or WalletConnect connections will be rejected.

## Completed / pending checklist

**Completed**

- [x] Stage 1 — Architecture, design system, branding, all 16 pages scaffolded
- [x] Stage 2 — Built-in wallet: BIP-39 create/import, encrypted vault, accounts, lock/unlock
- [x] Stage 3 — External wallets (AppKit), 8 networks + custom networks, config status page
- [x] Stage 4 — Real balances, ERC-20 management, Send/Receive with review-before-sign
- [x] Stage 5 — Transaction tracking + Activity (local + explorer merge)
- [x] Stage 6 — 0x swaps with exact-amount approvals, CoinGecko portfolio, approval manager
- [x] Stage 7 — Tests (40/40), lint + typecheck clean, production build verified,
      runtime smoke test, security review, this README

**Pending / optional**

- [ ] Live deployment on Vercel (needs the repo pushed + env vars set — see above)
- [ ] Live end-to-end smoke test with a real browser wallet + funded testnet account
      (connection/signing flows are code-complete; they were not exercised against a
      real wallet inside this build environment)
- [ ] Professional third-party security audit before holding significant funds
- [ ] ENS resolution, address book, and price charts (future enhancements)
