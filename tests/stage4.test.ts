import { describe, expect, it } from "vitest";
import { getAddress, isAddress, parseUnits } from "viem";
import { TOKEN_REGISTRY } from "@/lib/tokens";
import { validateCustomNetwork, type CustomNetworkForm } from "@/lib/customChains";
import { eip681TokenUri, eip681Uri } from "@/lib/uri";
import { trimNumber } from "@/hooks/useBalances";
import { humanizeError } from "@/lib/signing";

const ADDR = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";

describe("token registry integrity", () => {
  it("every registry address is valid and correctly checksummed", () => {
    for (const [chainId, tokens] of Object.entries(TOKEN_REGISTRY)) {
      for (const token of tokens) {
        expect(isAddress(token.address), `chain ${chainId} ${token.symbol}`).toBe(true);
        expect(getAddress(token.address)).toBe(token.address);
        expect(token.verified).toBe(true);
        expect(token.decimals).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("has no duplicate contracts per chain", () => {
    for (const tokens of Object.values(TOKEN_REGISTRY)) {
      const seen = new Set(tokens.map((t) => t.address.toLowerCase()));
      expect(seen.size).toBe(tokens.length);
    }
  });

  it("covers all 8 built-in networks", () => {
    for (const chainId of [1, 56, 137, 42161, 10, 8453, 43114, 11155111]) {
      expect(TOKEN_REGISTRY[chainId]?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("custom network validation", () => {
  const base: CustomNetworkForm = {
    name: "Anvil Local",
    chainId: "31337",
    rpcUrl: "http://127.0.0.1:8545",
    currencyName: "Ether",
    currencySymbol: "eth",
    currencyDecimals: "18",
    explorerUrl: "",
    testnet: true,
  };

  it("accepts a valid local network and normalizes it", () => {
    const result = validateCustomNetwork(base, []);
    expect("network" in result).toBe(true);
    if ("network" in result) {
      expect(result.network.chainId).toBe(31337);
      expect(result.network.currencySymbol).toBe("ETH");
      expect(result.network.explorerUrl).toBeNull();
    }
  });

  it("rejects built-in and duplicate chain IDs", () => {
    expect("error" in validateCustomNetwork({ ...base, chainId: "1" }, [])).toBe(true);
    const ok = validateCustomNetwork(base, []);
    if ("network" in ok) {
      expect("error" in validateCustomNetwork(base, [ok.network])).toBe(true);
    }
  });

  it("rejects bad URLs and bad decimals", () => {
    expect("error" in validateCustomNetwork({ ...base, rpcUrl: "not a url" }, [])).toBe(true);
    expect("error" in validateCustomNetwork({ ...base, rpcUrl: "ftp://x" }, [])).toBe(true);
    expect("error" in validateCustomNetwork({ ...base, currencyDecimals: "99" }, [])).toBe(true);
    expect("error" in validateCustomNetwork({ ...base, chainId: "0" }, [])).toBe(true);
    expect("error" in validateCustomNetwork({ ...base, chainId: "1.5" }, [])).toBe(true);
  });
});

describe("EIP-681 URIs", () => {
  it("builds a native payment URI", () => {
    expect(eip681Uri(ADDR as `0x${string}`, 56)).toBe(`ethereum:${ADDR}@56`);
  });

  it("builds an ERC-20 transfer URI with base-unit amounts", () => {
    const uri = eip681TokenUri(
      "0x55d398326f99059fF775485246999027B3197955",
      56,
      ADDR as `0x${string}`,
      "12.5",
      18,
    );
    expect(uri).toBe(
      `ethereum:0x55d398326f99059fF775485246999027B3197955@56/transfer?address=${ADDR}&uint256=${parseUnits("12.5", 18).toString()}`,
    );
  });
});

describe("display + error helpers", () => {
  it("trims balance numbers for display", () => {
    expect(trimNumber("0")).toBe("0");
    expect(trimNumber("1.500000")).toBe("1.5");
    expect(trimNumber("0.0000001")).toBe("<0.000001");
    expect(trimNumber("1234.5678912")).toBe("1,234.567891");
  });

  it("humanizes common wallet errors", () => {
    expect(humanizeError(new Error("User rejected the request"))).toContain("rejected");
    expect(humanizeError(new Error("insufficient funds for gas * price + value"))).toContain(
      "Insufficient funds",
    );
    expect(humanizeError(new Error("HTTP request failed"))).toContain("Network/RPC problem");
  });
});
