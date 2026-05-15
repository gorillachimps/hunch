"use client";

/**
 * Client-side helper that calls /api/find-proxy to discover the user's
 * Polymarket DepositWallet from their connected EOA. Returns null on any
 * failure (no API key configured, no proxy found, network glitch); callers
 * should fall back to the manual paste flow.
 */
export async function findPolymarketProxy(
  eoa: string,
): Promise<{ proxy: `0x${string}` | null; count?: number }> {
  try {
    const r = await fetch(`/api/find-proxy?eoa=${eoa}`, { cache: "no-store" });
    if (!r.ok) return { proxy: null };
    const data = (await r.json()) as {
      proxy: string | null;
      count?: number;
    };
    if (!data.proxy) return { proxy: null };
    return {
      proxy: data.proxy as `0x${string}`,
      count: data.count,
    };
  } catch {
    return { proxy: null };
  }
}
