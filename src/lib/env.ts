import { z } from "zod";

/**
 * Public (browser-safe) environment configuration.
 * Only NEXT_PUBLIC_* values belong here. Server-only secrets (0x API key,
 * market-data keys) are read directly from process.env inside API routes
 * and must never be imported into client code.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_REOWN_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_COINGECKO_API_KEY: z.string().optional(),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_REOWN_PROJECT_ID: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_COINGECKO_API_KEY: process.env.NEXT_PUBLIC_COINGECKO_API_KEY,
});

if (!parsed.success) {
  // Never log values, only the fact that configuration is invalid.
  console.error("Invalid public environment configuration.");
}

export const publicEnv = parsed.success
  ? parsed.data
  : {
      NEXT_PUBLIC_REOWN_PROJECT_ID: undefined,
      NEXT_PUBLIC_APP_URL: undefined,
      NEXT_PUBLIC_COINGECKO_API_KEY: undefined,
    };

export const reownProjectId = publicEnv.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";
export const hasReownProjectId = reownProjectId.length > 0;
export const appUrl = publicEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
