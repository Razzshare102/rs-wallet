import { NextResponse, type NextRequest } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { normalizeZeroExQuote, SWAP_FEE_BPS, SWAP_FEE_RECIPIENT } from "@/lib/swap";

/**
 * GET /api/swap/quote?chainId=&sellToken=&buyToken=&sellAmount=&taker=&slippageBps=
 *
 * Proxies the 0x Swap API (allowance-holder, v2) with the server-only
 * ZEROX_API_KEY. Token addresses may be the literal "native" for the
 * chain's gas token (mapped to the 0x convention 0xEeee…EEeE).
 *
 * Every quote carries the RS WALLET swap fee (SWAP_FEE_BPS = 1% of the
 * sell amount, paid by 0x to SWAP_FEE_RECIPIENT / the SWAP_FEE_RECIPIENT
 * env override). The fee is inside the quote the user reviews.
 *
 * Without a key the route returns 503 { error: "not_configured" } and
 * the Swap page explains exactly how to configure it — swaps are never
 * faked or quoted from another source.
 */

const NATIVE_PSEUDO = "0xEeeeeEeeeEaEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const querySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  sellToken: z.string().refine((v) => v === "native" || isAddress(v), "invalid sellToken"),
  buyToken: z.string().refine((v) => v === "native" || isAddress(v), "invalid buyToken"),
  sellAmount: z.string().regex(/^\d+$/, "sellAmount must be base units"),
  taker: z.string().refine((v) => isAddress(v), "invalid taker"),
  slippageBps: z.coerce.number().int().min(0).max(5_000).default(50),
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

export async function GET(request: NextRequest) {
  const apiKey = process.env.ZEROX_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "Swap is not configured on this deployment. Set the server environment variable ZEROX_API_KEY (free key at dashboard.0x.org) and redeploy.",
      },
      { status: 503 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const sp = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    chainId: sp.get("chainId") ?? "",
    sellToken: sp.get("sellToken") ?? "",
    buyToken: sp.get("buyToken") ?? "",
    sellAmount: sp.get("sellAmount") ?? "",
    taker: sp.get("taker") ?? "",
    slippageBps: sp.get("slippageBps") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }
  const q = parsed.data;
  if (q.sellToken !== "native" && q.buyToken !== "native" && q.sellToken.toLowerCase() === q.buyToken.toLowerCase()) {
    return NextResponse.json({ error: "same_token" }, { status: 400 });
  }

  const sellTokenResolved = q.sellToken === "native" ? NATIVE_PSEUDO : q.sellToken;
  const feeRecipientEnv = process.env.SWAP_FEE_RECIPIENT;
  const feeRecipient = feeRecipientEnv && isAddress(feeRecipientEnv) ? feeRecipientEnv : SWAP_FEE_RECIPIENT;
  const params = new URLSearchParams({
    chainId: String(q.chainId),
    sellToken: sellTokenResolved,
    buyToken: q.buyToken === "native" ? NATIVE_PSEUDO : q.buyToken,
    sellAmount: q.sellAmount,
    taker: q.taker,
    slippageBps: String(q.slippageBps),
    // RS WALLET fee: 1% of the sell amount, collected by 0x into the
    // owner's wallet. Included in the quote the user reviews and signs.
    swapFeeRecipient: feeRecipient,
    swapFeeBps: String(SWAP_FEE_BPS),
    swapFeeToken: sellTokenResolved,
  });

  try {
    const res = await fetch(`https://api.0x.org/swap/allowance-holder/quote?${params}`, {
      headers: {
        "0x-api-key": apiKey,
        "0x-version": "v2",
        accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const reason =
        data && typeof data === "object" && "reason" in data
          ? String((data as { reason: unknown }).reason)
          : `0x API HTTP ${res.status}`;
      return NextResponse.json({ error: "quote_failed", message: reason }, { status: 502 });
    }
    const quote = normalizeZeroExQuote(data);
    return NextResponse.json({ quote });
  } catch (err) {
    return NextResponse.json(
      {
        error: "quote_failed",
        message: err instanceof Error ? err.message : "Quote request failed.",
      },
      { status: 502 },
    );
  }
}
