"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  createPublicClient,
  formatEther,
  hexToBytes,
  http,
  isHex,
  numberToHex,
  type Hex,
  type LocalAccount,
} from "viem";
import { Globe, Loader2, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVault, type AccountInfo } from "@/components/wallet/VaultProvider";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { getNetwork, resolveBuiltin } from "@/lib/chains";
import { builtinWalletClient, humanizeError } from "@/lib/signing";
import { hasReownProjectId } from "@/lib/env";
import { shortenAddress } from "@/lib/utils";
import {
  buildApprovedNamespaces,
  getSignClient,
  parseWcChainId,
  WC_USER_REJECTED,
  type WcClient,
  type WcProposal,
  type WcRequest,
  type WcSession,
} from "@/lib/walletconnect";

const WC_USER_DISCONNECTED = { code: 6000, message: "User disconnected." };
const EIP1193_USER_REJECTED = { code: 4001, message: "User rejected the request." };

interface DappsContextValue {
  ready: boolean;
  sessions: WcSession[];
  pair: (uri: string) => Promise<void>;
  disconnect: (topic: string) => Promise<void>;
  lastError: string | null;
  clearLastError: () => void;
}

const DappsContext = createContext<DappsContextValue | null>(null);

export function useDapps(): DappsContextValue {
  const ctx = useContext(DappsContext);
  if (!ctx) throw new Error("useDapps must be used inside DappsProvider");
  return ctx;
}

function decodeMessagePreview(raw: unknown): string {
  if (typeof raw !== "string") return String(raw ?? "");
  if (isHex(raw)) {
    try {
      const text = new TextDecoder().decode(hexToBytes(raw as Hex));
      if (/^[\x09\x0A\x0D\x20-\x7E -￿]*$/.test(text)) return text;
    } catch {
      /* not text */
    }
    return raw;
  }
  return raw;
}

export function DappsProvider({ children }: { children: ReactNode }) {
  const vault = useVault();
  const rsChain = useRsChain();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<WcSession[]>([]);
  const [proposals, setProposals] = useState<WcProposal[]>([]);
  const [requests, setRequests] = useState<WcRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const clientRef = useRef<WcClient | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const vaultRef = useRef(vault);
  const chainRef = useRef(rsChain);
  // Keep the refs in sync after commit (never assign refs during render).
  useEffect(() => {
    vaultRef.current = vault;
    chainRef.current = rsChain;
  });

  const refreshSessions = useCallback(() => {
    const client = clientRef.current;
    if (client) setSessions(client.session.getAll());
  }, []);

  const respondResult = useCallback(async (req: WcRequest, result: unknown) => {
    const client = clientRef.current;
    if (!client) return;
    await client.respond({
      topic: req.topic,
      response: { id: req.id, result, jsonrpc: "2.0" },
    });
  }, []);

  const respondError = useCallback(async (req: WcRequest, error: { code: number; message: string }) => {
    const client = clientRef.current;
    if (!client) return;
    await client
      .respond({ topic: req.topic, response: { id: req.id, error, jsonrpc: "2.0" } })
      .catch(() => undefined);
  }, []);

  const findAccount = useCallback((address?: string): AccountInfo | null => {
    const { accounts, activeAccount } = vaultRef.current;
    if (address) {
      const match = accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
      if (match) return match;
    }
    return activeAccount ?? accounts[0] ?? null;
  }, []);

  /** Executes an approved session request with the built-in vault. Returns the JSON-RPC result. */
  const executeRequest = useCallback(
    async (req: WcRequest): Promise<unknown> => {
      const { request, chainId: wcChainId } = req.params;
      const method = request.method;
      const params = (request.params ?? []) as unknown[];
      const chainIdNum = parseWcChainId(wcChainId) ?? chainRef.current.chainId;
      const v = vaultRef.current;
      if (v.status !== "unlocked") throw new Error("Wallet is locked.");

      const localFor = (address?: string): LocalAccount => {
        const account = findAccount(address);
        if (!account) throw new Error("The requesting account is not in this wallet.");
        const local = v.getLocalAccount(account.id);
        if (!local) throw new Error("Wallet is locked.");
        return local;
      };

      switch (method) {
        case "wallet_switchEthereumChain": {
          const target = Number.parseInt((params[0] as { chainId: string }).chainId, 16);
          if (!getNetwork(target)) {
            throw Object.assign(new Error("RS WALLET does not support that chain."), { code: 4902 });
          }
          chainRef.current.setChainId(target);
          return null;
        }
        case "eth_sendTransaction":
        case "eth_signTransaction": {
          const tx = params[0] as { from?: string; to?: string; value?: string; data?: Hex; gas?: string };
          if (!tx.to) throw new Error("Transaction has no recipient.");
          const network = resolveBuiltin(chainIdNum);
          if (!network) throw new Error("RS WALLET does not support that chain.");
          const local = localFor(tx.from);
          const base = {
            to: tx.to as Hex,
            value: tx.value ? BigInt(tx.value) : 0n,
            data: tx.data ?? ("0x" as Hex),
          };
          if (method === "eth_sendTransaction") {
            const walletClient = builtinWalletClient(local, network);
            return walletClient.sendTransaction({
              ...base,
              ...(tx.gas ? { gas: BigInt(tx.gas) } : {}),
            } as Parameters<typeof walletClient.sendTransaction>[0]);
          }
          const publicClient = createPublicClient({ chain: network.chain, transport: http(network.rpcUrl) });
          const [nonce, gas, fees] = await Promise.all([
            publicClient.getTransactionCount({ address: local.address }),
            tx.gas
              ? Promise.resolve(BigInt(tx.gas))
              : publicClient.estimateGas({ account: local, ...base }),
            publicClient.estimateFeesPerGas().catch(() => null),
          ]);
          return local.signTransaction({
            ...base,
            gas,
            nonce,
            chainId: chainIdNum,
            ...(fees
              ? { type: "eip1559", maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas }
              : { type: "legacy", gasPrice: await publicClient.getGasPrice() }),
          } as Parameters<LocalAccount["signTransaction"]>[0]);
        }
        case "personal_sign": {
          const [message, address] = params as [string, string];
          const local = localFor(address);
          if (isHex(message)) {
            return local.signMessage({ message: { raw: hexToBytes(message as Hex) } });
          }
          return local.signMessage({ message });
        }
        case "eth_sign": {
          const [address, message] = params as [string, string];
          const local = localFor(address);
          if (isHex(message)) {
            return local.signMessage({ message: { raw: hexToBytes(message as Hex) } });
          }
          return local.signMessage({ message });
        }
        case "eth_signTypedData":
        case "eth_signTypedData_v4": {
          const [address, json] = params as [string, string];
          const local = localFor(address);
          const typed = JSON.parse(json) as {
            domain: Record<string, unknown>;
            types: Record<string, unknown>;
            primaryType: string;
            message: Record<string, unknown>;
          };
          const types = { ...typed.types };
          delete types.EIP712Domain;
          return local.signTypedData({
            domain: typed.domain,
            types,
            primaryType: typed.primaryType,
            message: typed.message,
          } as Parameters<LocalAccount["signTypedData"]>[0]);
        }
        default:
          throw Object.assign(new Error(`RS WALLET does not support the method "${method}".`), { code: 4200 });
      }
    },
    [findAccount],
  );

  // ---- SignClient lifecycle ----
  useEffect(() => {
    if (!hasReownProjectId || initPromiseRef.current) return;
    initPromiseRef.current = (async () => {
      const client = await getSignClient();
      clientRef.current = client;

      client.on("session_proposal", (proposal) => {
        setProposals((q) => [...q, proposal]);
      });
      client.on("session_request", (event) => {
        const method = event.params.request.method;
        if (method === "eth_chainId") {
          void respondResult(
            event,
            numberToHex(parseWcChainId(event.params.chainId) ?? chainRef.current.chainId),
          );
          return;
        }
        if (method === "eth_accounts") {
          const account = findAccount();
          void respondResult(event, account ? [account.address] : []);
          return;
        }
        setRequests((q) => [...q, event]);
      });
      const refresh = () => refreshSessions();
      client.on("session_delete", refresh);
      client.on("session_expire", refresh);
      client.on("session_update", refresh);

      refreshSessions();
      setReady(true);
    })();
    initPromiseRef.current.catch(() => {
      initPromiseRef.current = null;
    });
  }, [findAccount, refreshSessions, respondResult]);

  const pair = useCallback(async (uri: string) => {
    const trimmed = uri.trim();
    if (!trimmed.startsWith("wc:")) {
      throw new Error("That does not look like a WalletConnect URI (it starts with wc:).");
    }
    if (initPromiseRef.current) await initPromiseRef.current;
    const client = clientRef.current ?? (await getSignClient());
    clientRef.current = client;
    await client.pair({ uri: trimmed });
  }, []);

  const disconnect = useCallback(
    async (topic: string) => {
      const client = clientRef.current;
      if (!client) return;
      await client.disconnect({ topic, reason: WC_USER_DISCONNECTED });
      refreshSessions();
    },
    [refreshSessions],
  );

  // ---- Proposal actions ----
  const proposal = proposals[0] ?? null;
  const approveProposal = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !proposal) return;
    const addresses = vaultRef.current.accounts.map((a) => a.address);
    if (vaultRef.current.status !== "unlocked" || addresses.length === 0) {
      setModalError("Unlock your built-in wallet first — a dApp can only connect to an unlocked wallet.");
      return;
    }
    setBusy(true);
    setModalError(null);
    try {
      await client.approve({ id: proposal.id, namespaces: buildApprovedNamespaces(addresses) });
      setProposals((q) => q.slice(1));
      refreshSessions();
    } catch (err) {
      setModalError(humanizeError(err));
    } finally {
      setBusy(false);
    }
  }, [proposal, refreshSessions]);

  const rejectProposal = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !proposal) return;
    setBusy(true);
    try {
      await client.reject({ id: proposal.id, reason: WC_USER_REJECTED });
    } catch {
      /* proposal may already be gone */
    }
    setProposals((q) => q.slice(1));
    setBusy(false);
    setModalError(null);
  }, [proposal]);

  // ---- Request actions ----
  const request = requests[0] ?? null;
  const approveRequest = useCallback(async () => {
    if (!request) return;
    setBusy(true);
    setModalError(null);
    try {
      const result = await executeRequest(request);
      await respondResult(request, result);
      setRequests((q) => q.slice(1));
    } catch (err) {
      const code = (err as { code?: number }).code ?? -32603;
      await respondError(request, { code, message: humanizeError(err) });
      setRequests((q) => q.slice(1));
      setLastError(humanizeError(err));
    } finally {
      setBusy(false);
    }
  }, [request, executeRequest, respondResult, respondError]);

  const rejectRequest = useCallback(async () => {
    if (!request) return;
    setBusy(true);
    await respondError(request, EIP1193_USER_REJECTED);
    setRequests((q) => q.slice(1));
    setBusy(false);
    setModalError(null);
  }, [request, respondError]);

  const sessionForRequest = request
    ? (sessions.find((s) => s.topic === request.topic) ?? null)
    : null;

  return (
    <DappsContext.Provider
      value={{
        ready,
        sessions,
        pair,
        disconnect,
        lastError,
        clearLastError: () => setLastError(null),
      }}
    >
      {children}
      {proposal && (
        <ProposalModal
          proposal={proposal}
          busy={busy}
          error={modalError}
          unlocked={vault.status === "unlocked"}
          accountCount={vault.accounts.length}
          onApprove={approveProposal}
          onReject={rejectProposal}
        />
      )}
      {request && (
        <RequestModal
          request={request}
          session={sessionForRequest}
          busy={busy}
          error={modalError}
          unlocked={vault.status === "unlocked"}
          onApprove={approveRequest}
          onReject={rejectRequest}
        />
      )}
    </DappsContext.Provider>
  );
}

// ---------------- Modals ----------------

function ModalShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function PeerHeader({ name, url, icon }: { name: string; url: string; icon?: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="size-11 rounded-2xl" />
      ) : (
        <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary">
          <Globe className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{url}</p>
      </div>
    </div>
  );
}

function ProposalModal({
  proposal,
  busy,
  error,
  unlocked,
  accountCount,
  onApprove,
  onReject,
}: {
  proposal: WcProposal;
  busy: boolean;
  error: string | null;
  unlocked: boolean;
  accountCount: number;
  onApprove: () => void;
  onReject: () => void;
}) {
  const peer = proposal.params.proposer.metadata;
  const requiredChains = proposal.params.requiredNamespaces.eip155?.chains ?? [];
  const chainNames = requiredChains
    .map((c) => getNetwork(parseWcChainId(c) ?? -1)?.chain.name ?? c)
    .join(", ");
  return (
    <ModalShell>
      <PeerHeader name={peer.name} url={peer.url} icon={peer.icons?.[0]} />
      <p className="mt-4 text-sm leading-relaxed">
        <span className="font-medium">{peer.name}</span> wants to connect to your wallet. It will see
        your {accountCount} account address{accountCount === 1 ? "" : "es"} on{" "}
        {chainNames || "the supported networks"} and can ask you to sign messages and transactions.
        Every signature still needs your approval here.
      </p>
      {!unlocked && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs leading-relaxed text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Your built-in wallet is locked. Unlock it before approving this connection.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onReject} disabled={busy}>
          <X className="size-4" /> Reject
        </Button>
        {unlocked ? (
          <Button variant="gradient" className="flex-1" onClick={onApprove} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Connect
          </Button>
        ) : (
          <Button asChild variant="gradient" className="flex-1">
            <Link href="/unlock">Unlock wallet</Link>
          </Button>
        )}
      </div>
    </ModalShell>
  );
}

function RequestModal({
  request,
  session,
  busy,
  error,
  unlocked,
  onApprove,
  onReject,
}: {
  request: WcRequest;
  session: WcSession | null;
  busy: boolean;
  error: string | null;
  unlocked: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const peer = session?.peer.metadata;
  const method = request.params.request.method;
  const params = (request.params.request.params ?? []) as unknown[];
  const chainIdNum = parseWcChainId(request.params.chainId);
  const network = chainIdNum ? getNetwork(chainIdNum) : undefined;
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);

  const tx =
    method === "eth_sendTransaction" || method === "eth_signTransaction"
      ? (params[0] as { from?: string; to?: string; value?: string; data?: string })
      : null;

  useEffect(() => {
    let cancelled = false;
    if (!tx?.to || !chainIdNum) return;
    const resolved = resolveBuiltin(chainIdNum);
    if (!resolved) return;
    const publicClient = createPublicClient({ chain: resolved.chain, transport: http(resolved.rpcUrl) });
    publicClient
      .estimateGas({
        to: tx.to as Hex,
        value: tx.value ? BigInt(tx.value) : 0n,
        data: (tx.data as Hex) ?? "0x",
        ...(tx.from ? { account: tx.from as Hex } : {}),
      } as Parameters<typeof publicClient.estimateGas>[0])
      .then((g) => {
        if (!cancelled) setGasEstimate(g);
      })
      .catch(() => {
        if (!cancelled) setGasEstimate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tx, chainIdNum]);

  let body: ReactNode = null;
  if (tx) {
    const isContractCall = Boolean(tx.data && tx.data !== "0x");
    body = (
      <div className="flex flex-col gap-2 text-sm">
        <Row label="Action" value={method === "eth_sendTransaction" ? "Send transaction" : "Sign transaction"} />
        <Row label="Network" value={network?.chain.name ?? request.params.chainId} />
        {tx.from && <Row label="From" value={shortenAddress(tx.from, 8)} mono />}
        {tx.to && <Row label="To" value={shortenAddress(tx.to, 8)} mono />}
        <Row
          label="Value"
          value={`${tx.value ? formatEther(BigInt(tx.value)) : "0"} ${network?.chain.nativeCurrency.symbol ?? ""}`}
        />
        <Row label="Estimated gas" value={gasEstimate ? gasEstimate.toString() : "—"} />
        {isContractCall && (
          <p className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs leading-relaxed text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            This is a contract interaction ({(tx.data!.length - 2) / 2} bytes of call data). Only
            approve if you started this in the dApp and trust it.
          </p>
        )}
      </div>
    );
  } else if (method === "personal_sign" || method === "eth_sign") {
    const rawMessage = method === "personal_sign" ? params[0] : params[1];
    body = (
      <div className="flex flex-col gap-2 text-sm">
        <Row label="Action" value="Sign message" />
        <Row label="Network" value={network?.chain.name ?? request.params.chainId} />
        <div className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-secondary p-3 font-mono text-xs leading-relaxed">
          {decodeMessagePreview(rawMessage)}
        </div>
        <p className="text-xs text-muted-foreground">
          Signing a message cannot move funds, but it can prove account ownership to the dApp.
        </p>
      </div>
    );
  } else if (method === "eth_signTypedData" || method === "eth_signTypedData_v4") {
    let domainName = "unknown";
    let primaryType = "";
    try {
      const typed = JSON.parse(params[1] as string) as {
        domain?: { name?: string };
        primaryType?: string;
      };
      domainName = typed.domain?.name ?? domainName;
      primaryType = typed.primaryType ?? "";
    } catch {
      /* keep defaults */
    }
    body = (
      <div className="flex flex-col gap-2 text-sm">
        <Row label="Action" value="Sign typed data" />
        <Row label="Domain" value={domainName} />
        {primaryType && <Row label="Type" value={primaryType} />}
        <Row label="Network" value={network?.chain.name ?? request.params.chainId} />
      </div>
    );
  } else if (method === "wallet_switchEthereumChain") {
    const target = Number.parseInt((params[0] as { chainId: string }).chainId, 16);
    body = (
      <div className="flex flex-col gap-2 text-sm">
        <Row label="Action" value="Switch network" />
        <Row label="Switch to" value={getNetwork(target)?.chain.name ?? `Chain ${target}`} />
      </div>
    );
  } else {
    body = <p className="text-sm text-muted-foreground">Method: {method}</p>;
  }

  return (
    <ModalShell>
      <PeerHeader
        name={peer?.name ?? "Unknown dApp"}
        url={peer?.url ?? ""}
        icon={peer?.icons?.[0]}
      />
      <div className="mt-4">{body}</div>
      {!unlocked && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs leading-relaxed text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Your built-in wallet is locked. Unlock it before approving.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onReject} disabled={busy}>
          <X className="size-4" /> Reject
        </Button>
        {unlocked ? (
          <Button variant="gradient" className="flex-1" onClick={onApprove} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Approve
          </Button>
        ) : (
          <Button asChild variant="gradient" className="flex-1">
            <Link href="/unlock">Unlock wallet</Link>
          </Button>
        )}
      </div>
    </ModalShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-[13px] font-medium" : "font-medium"}>{value}</span>
    </div>
  );
}
