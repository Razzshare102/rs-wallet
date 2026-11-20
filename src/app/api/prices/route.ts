import { NextResponse, type NextRequest } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { COINGECKO_PLATFORMS, NATIVE_COINGECKO_IDS, type PriceMap } from "@/lib/prices";

/**
 * GET /api/prices?chainId=56&tokens=0x…,0x…
 *
 * Public-data proxy for CoinGecko prices (spec §10/§12). Returns USD
 * prices keyed by "native" and by lowercase token address. Any token
 * CoinGecko does not know — and everything on testnets — comes back
 * null, never a fabricated number. COINGECKO_API_KEY (server-only)
 * raises the rate limits when set.
 */

const querySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  tokens: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => isAddress(s))
        .slice(0, 30),
    ),
});

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

async function gecko(path: string, apiKey: string | undefined): Promise<unknown> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;
  const res = await fetch(`https://api.coingecko.com/api/v3${path}`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  return res.json();
}

function priceOf(container: unknown, key: string): number | null {
  if (typeof container !== "object" || container === null) return null;
  const entry = (container as Record<string, unknown>)[key];
  if (typeof entry !== "object" || entry === null) return null;
  const usd = (entry as Record<string, unknown>).usd;
  return typeof usd === "number" && Number.isFinite(usd) ? usd : null;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ prices: {}, error: "rate_limited" }, { status: 429 });
  }
  const parsed = querySchema.safeParse({
    chainId: request.nextUrl.searchParams.get("chainId") ?? "",
    tokens: request.nextUrl.searchParams.get("tokens") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ prices: {}, error: "invalid_query" }, { status: 400 });
  }
  const { chainId, tokens } = parsed.data;
  const prices: PriceMap = { native: null };
  for (const token of tokens) prices[token] = null;

  const nativeId = NATIVE_COINGECKO_IDS[chainId] ?? null;
  const platform = COINGECKO_PLATFORMS[chainId] ?? null;
  const apiKey = process.env.COINGECKO_API_KEY || undefined;

  try {
    const jobs: Promise<void>[] = [];
    if (nativeId) {
      jobs.push(
        gecko(`/simple/price?ids=${nativeId}&vs_currencies=usd`, apiKey).then((data) => {
          prices.native = priceOf(data, nativeId);
        }),
      );
    }
    if (platform && tokens.length > 0) {
      const list = tokens.join(",");
      jobs.push(
        gecko(
          `/simple/token_price/${platform}?contract_addresses=${list}&vs_currencies=usd`,
          apiKey,
        ).then((data) => {
          for (const token of tokens) prices[token] = priceOf(data, token);
        }),
      );
    }
    await Promise.all(jobs);
    return NextResponse.json(
      { prices },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  } catch {
    // Prices are best-effort display data: return nulls, not an error page.
    return NextResponse.json({ prices, error: "prices_unavailable" });
  }
}
