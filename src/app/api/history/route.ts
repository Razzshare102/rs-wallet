import { NextResponse, type NextRequest } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { resolveBuiltin } from "@/lib/chains";
import {
  normalizeNativeRow,
  normalizeTokenRow,
  type ExplorerNativeRow,
  type ExplorerTokenRow,
} from "@/lib/history";
import type { StoredTx } from "@/lib/activity";

/**
 * GET /api/history?address=0x…&chainId=56
 *
 * Public-data proxy for block-explorer history (spec §12: API routes
 * only proxy public data; keys stay server-side). Uses the Etherscan
 * API V2, which serves every supported chain from one endpoint.
 *
 * ETHERSCAN_API_KEY is optional: without a key (or if the explorer is
 * unreachable / rate-limits us) the route returns an empty list plus a
 * plain-language `error`, and the Activity page falls back to locally
 * recorded transactions. Nothing here ever fabricates history.
 */

const querySchema = z.object({
  address: z.string().refine((v) => isAddress(v), "invalid address"),
  chainId: z.coerce.number().int().positive(),
});

// ── Tiny in-memory rate limit: 30 requests / minute / IP ──────────────
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 30;
}

interface EtherscanResponse<T> {
  status: string;
  message: string;
  result: T[] | string;
}

async function fetchAction<T>(
  chainId: number,
  action: "txlist" | "tokentx",
  address: string,
  apiKey: string | undefined,
): Promise<T[]> {
  const params = new URLSearchParams({
    chainid: String(chainId),
    module: "account",
    action,
    address,
    page: "1",
    offset: action === "txlist" ? "50" : "100",
    sort: "desc",
  });
  if (apiKey) params.set("apikey", apiKey);
  const res = await fetch(`https://api.etherscan.io/v2/api?${params}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`explorer HTTP ${res.status}`);
  const data = (await res.json()) as EtherscanResponse<T>;
  if (Array.isArray(data.result)) return data.result;
  // "No transactions found" is a valid empty result, not an error.
  if (typeof data.result === "string" && data.message === "No transactions found") return [];
  throw new Error(typeof data.result === "string" ? data.result : "explorer error");
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ txs: [], error: "Too many requests — try again in a minute." }, { status: 429 });
  }

  const parsed = querySchema.safeParse({
    address: request.nextUrl.searchParams.get("address") ?? "",
    chainId: request.nextUrl.searchParams.get("chainId") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ txs: [], error: "Invalid address or chain." }, { status: 400 });
  }
  const { address, chainId } = parsed.data;

  const network = resolveBuiltin(chainId);
  if (!network) {
    return NextResponse.json({
      txs: [],
      error: "Explorer history is only available for the built-in networks.",
    });
  }

  const apiKey = process.env.ETHERSCAN_API_KEY || undefined;
  try {
    const [nativeRows, tokenRows] = await Promise.all([
      fetchAction<ExplorerNativeRow>(chainId, "txlist", address, apiKey),
      fetchAction<ExplorerTokenRow>(chainId, "tokentx", address, apiKey),
    ]);
    const txs: StoredTx[] = [
      ...nativeRows.map((row) =>
        normalizeNativeRow(row, address, chainId, network.nativeSymbol, network.nativeDecimals),
      ),
      ...tokenRows.map((row) => normalizeTokenRow(row, address, chainId)),
    ];
    return NextResponse.json({ txs });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({
      txs: [],
      error: apiKey
        ? `Block explorer history unavailable right now (${detail}). Showing transactions recorded by this app only.`
        : "Block explorer history needs an ETHERSCAN_API_KEY on the server (free at etherscan.io). Showing transactions recorded by this app only.",
    });
  }
}
