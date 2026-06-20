// Price source — the live Miden faucet price API.
//
//   GET /v1/price/{faucet_id}            → one token
//   GET /v1/prices?ids={id1},{id2},...   → batch
//
// Response (per faucet): { faucet_id, ticker, vs_currency:"usd",
//   price:"<string>", decimals, as_of, stale, source }
//
// The API is keyed by faucet id and returns USD price + ticker + decimals, so
// it doubles as our token-metadata source — no manual symbol/decimals registry.

const BASE = (
  (import.meta.env.VITE_PRICE_API_URL as string) ||
  "https://35-175-40-181.sslip.io"
).replace(/\/+$/, "");

export interface TokenMeta {
  faucetId: string;
  ticker: string;
  decimals: number;
  priceUsd: number;
  stale: boolean;
}

interface ApiEntry {
  faucet_id: string;
  ticker: string;
  price: string;
  decimals: number;
  stale?: boolean;
}

function toMeta(e: ApiEntry): TokenMeta {
  const priceUsd = Number(e.price);
  if (!Number.isFinite(priceUsd)) {
    throw new Error(`price API: non-numeric price "${e.price}" for ${e.faucet_id}`);
  }
  return {
    faucetId: e.faucet_id,
    ticker: e.ticker,
    decimals: e.decimals,
    priceUsd,
    stale: !!e.stale,
  };
}

/** Fetch metadata + USD price for one or more faucets (batch endpoint). */
export async function fetchTokens(faucetIds: string[]): Promise<TokenMeta[]> {
  if (faucetIds.length === 0) return [];
  const url = `${BASE}/v1/prices?ids=${faucetIds.map(encodeURIComponent).join(",")}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`price API: ${res.status} ${res.statusText} from ${url}`);
  }
  const body = (await res.json()) as Record<string, ApiEntry>;
  return faucetIds
    .map((id) => body[id])
    .filter((e): e is ApiEntry => !!e)
    .map(toMeta);
}

/**
 * Swap rate: requested tokens per 1 offered token = offered$ / requested$.
 * Pure — operates on already-fetched metadata.
 */
export function rateFrom(offered: TokenMeta, requested: TokenMeta): number {
  if (offered.priceUsd <= 0 || requested.priceUsd <= 0) {
    throw new Error("price API: a token has a non-positive USD price.");
  }
  return offered.priceUsd / requested.priceUsd;
}
